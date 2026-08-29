import { EventEmitter } from 'events';

const WORDS = [
  'кошка', 'собака', 'солнце', 'дождь', 'пицца', 'телефон', 'машина',
  'книга', 'музыка', 'танцы', 'смех', 'любовь', 'дружба', 'путешествие',
  'море', 'гора', 'лес', 'город', 'дом', 'работа', 'отпуск',
  'свадьба', 'день рождения', 'новый год', 'кофе', 'завтрак',
  'спорт', 'футбол', 'плавание', 'лёгкая атлетика', 'хоккей',
  'кино', 'театр', 'концерт', 'музей', 'ресторан',
];

export class EmojiArtEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 0;
    this.maxRounds = this.settings.maxRounds ?? 6;
    this.currentWord = null;
    this.drawerId = null;
    this.guesses = new Map();
    this.usedIndices = new Set();
    this.roundTime = this.settings.roundTime ?? 60;
    this.pointsGuess = Math.max(0, this.settings.pointsGuess ?? 2);
    this.pointsDrawer = Math.max(0, this.settings.pointsDrawer ?? 1);
    this._aborted = false;
    this._roundDelayTimeout = null;
  }

  start() {
    if (this._aborted) return;
    this.phase = 'playing';
    this.round = 0;
    this._emitScoreboard();
    this.nextRound();
  }

  _emitScoreboard() {
    this.emit('score:updated', {
      players: this.players.map((p) => ({ id: p.id, name: p.name, score: p.score ?? 0 })),
    });
  }

  _normWord(s) {
    return String(s ?? '')
      .trim()
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\s+/g, ' ');
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

    this.guesses.clear();
    this.drawerId = this.players[(this.round - 1) % this.players.length].id;

    let available = WORDS.map((_, i) => i).filter(i => !this.usedIndices.has(i));
    if (available.length === 0) {
      this.usedIndices.clear();
      available = WORDS.map((_, i) => i);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    this.usedIndices.add(idx);
    this.currentWord = WORDS[idx];

    this.phase = 'drawing';
    this.timeLeft = this.roundTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      drawerId: this.drawerId,
      drawerName: this.players.find(p => p.id === this.drawerId)?.name,
      timeLeft: this.timeLeft,
      roundTime: this.roundTime,
      pointsGuess: this.pointsGuess,
      pointsDrawer: this.pointsDrawer,
    });

    this.emit('word:pick', {
      playerId: this.drawerId,
      word: this.currentWord,
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

  submitAnswer(playerId, text) { return this.handleChat(playerId, text); }
  handleChat(playerId, message) {
    if (this._aborted) return false;
    if (this.phase !== 'drawing' || playerId === this.drawerId) return false;
    if (this.guesses.has(playerId)) return false;

    const guess = this._normWord(message);
    const answer = this._normWord(this.currentWord);
    const correct = guess === answer;

    if (correct) {
      this.guesses.set(playerId, true);
      const p = this.players.find(x => x.id === playerId);
      const drawer = this.players.find(x => x.id === this.drawerId);
      if (p) p.score = (p.score || 0) + this.pointsGuess;
      if (drawer) drawer.score = (drawer.score || 0) + this.pointsDrawer;

      this.emit('word:guessed', {
        playerId,
        playerName: p?.name,
        word: this.currentWord,
        pointsGuess: this.pointsGuess,
        pointsDrawer: this.pointsDrawer,
      });
      this._emitScoreboard();

      this.stopTimer();
      this.phase = 'results';
      if (this._roundDelayTimeout) {
        clearTimeout(this._roundDelayTimeout);
        this._roundDelayTimeout = null;
      }
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.nextRound();
      }, 3000);
      return true;
    }
    return false;
  }

  endRound() {
    if (this._aborted) return;
    this.phase = 'results';
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    const solverNames = [...this.guesses.keys()]
      .map((id) => this.players.find((x) => x.id === id)?.name)
      .filter(Boolean);

    this.emit('round:ended', {
      round: this.round,
      maxRounds: this.maxRounds,
      word: this.currentWord,
      drawerId: this.drawerId,
      drawerName: this.players.find((p) => p.id === this.drawerId)?.name,
      guessCount: this.guesses.size,
      solverNames,
      pointsGuess: this.pointsGuess,
      pointsDrawer: this.pointsDrawer,
    });
    this._emitScoreboard();

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
    this.emit('game:ended', {
      gameType: 'emojiart',
      winner: sorted[0] ?? null,
      players: sorted.map((p) => ({ id: p.id, name: p.name, score: p.score ?? 0 })),
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
