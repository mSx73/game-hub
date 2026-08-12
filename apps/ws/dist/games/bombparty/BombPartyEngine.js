import { EventEmitter } from 'events';

const LETTERS = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('');

function normalize(s) {
  return String(s || '').trim().toLowerCase().replace(/ё/g, 'е');
}

function containsLetter(word, letter) {
  const w = normalize(word);
  const l = letter.toUpperCase().replace('Ё', 'Е');
  const wNorm = w.toUpperCase().replace(/Ё/g, 'Е');
  return wNorm.includes(l);
}

export class BombPartyEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 0;
    this.currentLetter = null;
    this.currentCategory = null;
    this.usedWords = new Set();
    this.roundTime = this.settings.roundTime ?? 15;
    this.maxRounds = this.settings.maxRounds ?? 10;
    this.categories = [
      'Животные', 'Города', 'Еда', 'Профессии', 'Страны',
      'Имена', 'Растения', 'Транспорт', 'Спорт', 'Фильмы',
      'Предметы', 'Одежда', 'Цвета', 'Фрукты', 'Напитки',
    ];
    this._aborted = false;
    this._roundDelayTimeout = null;
  }

  _scheduleAfterRound(ms) {
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this._roundDelayTimeout = setTimeout(() => {
      this._roundDelayTimeout = null;
      if (this._aborted) return;
      if (this.round >= this.maxRounds) this.endGame();
      else this.nextRound();
    }, ms);
  }

  start() {
    if (this._aborted) return;
    this.phase = 'playing';
    this.round = 0;
    this.nextRound();
  }

  nextRound() {
    if (this._aborted) return;
    this.stopTimer();
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    if (this.round >= this.maxRounds) {
      this.endGame();
      return;
    }
    this.round++;

    this.usedWords.clear();
    this.currentLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const catIdx = Math.floor(Math.random() * this.categories.length);
    this.currentCategory = this.categories[catIdx];
    this.timeLeft = this.roundTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      letter: this.currentLetter,
      category: this.currentCategory,
      timeLeft: this.timeLeft,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.bombExploded();
      }
    }, 1000);
  }

  bombExploded() {
    if (this._aborted) return;
    this.phase = 'results';
    this.emit('bomb:exploded', { round: this.round });
    this.emit('round:ended', { round: this.round, letter: this.currentLetter, category: this.currentCategory });
    this.emit('score:updated', { players: this.players });
    this._scheduleAfterRound(2000);
  }

  submitAnswer(playerId, text) { return this.handleChat(playerId, text); }
  handleChat(playerId, message) {
    if (this._aborted) return false;
    if (this.phase !== 'playing' || !this.currentLetter) return false;

    const word = normalize(message);
    if (!word || word.length < 2) return false;

    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;

    if (!containsLetter(word, this.currentLetter)) {
      this.emit('word:rejected', {
        playerId,
        playerName: player.name,
        word: message.trim(),
        reason: 'no_letter',
        letter: this.currentLetter,
      });
      return true;
    }

    if (this.usedWords.has(word)) {
      this.emit('word:rejected', {
        playerId,
        playerName: player.name,
        word: message.trim(),
        reason: 'duplicate',
      });
      return true;
    }

    this.usedWords.add(word);
    player.score = (player.score || 0) + 1;
    this.stopTimer();
    this.phase = 'results';

    this.emit('word:accepted', {
      playerId,
      playerName: player.name,
      word: message.trim(),
    });
    this.emit('score:updated', { players: this.players });

    this.emit('round:ended', { round: this.round, letter: this.currentLetter, category: this.currentCategory });
    this._scheduleAfterRound(2000);
    return true;
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  endGame() {
    if (this._aborted) return;
    this.phase = 'finished';
    this.stopTimer();
    const sorted = [...this.players].sort((a, b) => (b.score || 0) - (a.score || 0));
    this.emit('game:ended', { winner: sorted[0] ?? null, players: sorted });
  }

  cleanup() {
    this._aborted = true;
    this.stopTimer();
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.removeAllListeners();
  }
}
