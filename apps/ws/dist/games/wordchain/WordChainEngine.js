import { EventEmitter } from 'events';

const LETTERS = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('');

function normalize(s) {
  return String(s || '').trim().toLowerCase().replace(/ё/g, 'е');
}

function lastLetter(word) {
  const w = normalize(word).replace(/[ьъ]$/, '');
  return w ? w.slice(-1).toUpperCase() : null;
}

function firstLetter(word) {
  const w = normalize(word);
  return w ? w[0].toUpperCase().replace('Ё', 'Е') : null;
}

export class WordChainEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 0;
    this.maxRounds = this.settings.maxRounds ?? 5;
    this.roundTime = this.settings.roundTime ?? 60;
    this.currentLetter = null;
    this.usedWords = new Set();
    this.chain = [];
    this.pointsPerWord = this.settings.pointsPerWord ?? 1;
    this.categories = [
      'Любое слово', 'Существительные', 'Города', 'Животные', 'Имена',
      'Страны', 'Еда', 'Профессии', 'Растения', 'Транспорт',
    ];
    this.currentCategory = null;
    this._aborted = false;
    this._roundDelayTimeout = null;
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
    this.round++;
    if (this.round > this.maxRounds) {
      this.endGame();
      return;
    }

    this.usedWords.clear();
    this.chain = [];
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
        if (!this._aborted) this.endRound();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  handleChat(playerId, message) {
    if (this._aborted) return false;
    if (this.phase !== 'playing') return false;

    const word = normalize(message);
    if (!word || word.length < 2) return false;

    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;

    const wFirst = firstLetter(word);
    const expectedLetter = this.chain.length === 0 ? this.currentLetter : lastLetter(this.chain[this.chain.length - 1]);
    const normExpected = expectedLetter === 'Ё' ? 'Е' : expectedLetter;

    if (!wFirst || (wFirst === 'Ё' ? 'Е' : wFirst) !== normExpected) {
      this.emit('word:rejected', {
        playerId,
        playerName: player.name,
        word: message.trim(),
        reason: this.chain.length === 0 ? 'wrong_first_letter' : 'wrong_chain_letter',
        expected: expectedLetter,
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
    this.chain.push(message.trim());
    player.score = (player.score || 0) + this.pointsPerWord;

    this.emit('word:accepted', {
      playerId,
      playerName: player.name,
      word: message.trim(),
      chain: [...this.chain],
      nextLetter: lastLetter(word),
    });
    this.emit('score:updated', { players: this.players });

    return true;
  }

  endRound() {
    if (this._aborted) return;
    this.phase = 'results';
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.emit('round:ended', {
      round: this.round,
      letter: this.currentLetter,
      chainLength: this.chain.length,
      chain: this.chain,
    });
    this.emit('score:updated', { players: this.players });

    if (this.round >= this.maxRounds) {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.endGame();
      }, 3000);
    } else {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.nextRound();
      }, 3000);
    }
  }

  endGame() {
    if (this._aborted) return;
    this.phase = 'finished';
    this.stopTimer();
    const sorted = [...this.players].sort((a, b) => (b.score || 0) - (a.score || 0));
    this.emit('game:ended', {
      winner: sorted[0] ?? null,
      players: sorted,
    });
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
