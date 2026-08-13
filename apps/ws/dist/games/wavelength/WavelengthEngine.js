import { EventEmitter } from 'events';

export class WavelengthEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 0;
    this.maxRounds = this.settings.maxRounds ?? 8;
    this.clueTime = this.settings.clueTime ?? 30;
    this.guessTime = this.settings.guessTime ?? 20;
    this.pointsClose = this.settings.pointsClose ?? 2;
    this.pointsExact = this.settings.pointsExact ?? 3;
    this.objectiveMode = this.settings.objectiveMode === true;
    this.psychicIndex = 0;
    this.target = 0;
    this.currentScale = null;
    this.currentClue = null;
    this.guesses = new Map();
    this.usedScales = new Set();

    this.scales = [
      { left: 'Холодное', right: 'Горячее' },
      { left: 'Скучное', right: 'Увлекательное' },
      { left: 'Маленькое', right: 'Огромное' },
      { left: 'Древнее', right: 'Современное' },
      { left: 'Дешёвое', right: 'Дорогое' },
      { left: 'Медленное', right: 'Быстрое' },
      { left: 'Тихое', right: 'Громкое' },
      { left: 'Простое', right: 'Сложное' },
      { left: 'Лёгкое', right: 'Тяжёлое' },
      { left: 'Грустное', right: 'Весёлое' },
      { left: 'Страшное', right: 'Безопасное' },
      { left: 'Полезное', right: 'Вредное' },
      { left: 'Обычное', right: 'Экзотическое' },
      { left: 'Уродливое', right: 'Красивое' },
      { left: 'Мягкое', right: 'Твёрдое' },
      { left: 'Редкое', right: 'Распространённое' },
      { left: 'Слабое', right: 'Сильное' },
      { left: 'Короткое', right: 'Длинное' },
      { left: 'Сухое', right: 'Мокрое' },
      { left: 'Натуральное', right: 'Искусственное' },
      { left: 'Бесполезное', right: 'Незаменимое' },
      { left: 'Детское', right: 'Взрослое' },
      { left: 'Нормальное', right: 'Безумное' },
      { left: 'Романтичное', right: 'Прагматичное' },
      { left: 'Старомодное', right: 'Модное' },
      { left: 'Зимнее', right: 'Летнее' },
      { left: 'Русское', right: 'Иностранное' },
      { left: 'Круглое', right: 'Квадратное' },
      { left: 'Съедобное', right: 'Несъедобное' },
      { left: 'Расслабляющее', right: 'Напрягающее' },
      { left: 'Честное', right: 'Обманчивое' },
      { left: 'Утреннее', right: 'Ночное' },
    ];
    this._aborted = false;
    this._roundDelayTimeout = null;
  }

  start() {
    if (this._aborted) return;
    this.phase = 'playing';
    this.round = 0;
    this.psychicIndex = 0;
    this.usedScales.clear();
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
    if (this.round > this.maxRounds) { this.endGame(); return; }

    this.guesses.clear();
    this.currentClue = null;
    this.target = Math.floor(Math.random() * 101);

    let availableIndices = this.scales.map((_, i) => i).filter((i) => !this.usedScales.has(i));
    if (availableIndices.length === 0) {
      this.usedScales.clear();
      availableIndices = this.scales.map((_, i) => i);
    }
    const idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedScales.add(idx);
    this.currentScale = this.scales[idx];

    const psychic = this.players[this.psychicIndex % this.players.length];
    this.phase = 'clue';

    this.emit('round:started', {
      round: this.round, maxRounds: this.maxRounds,
      left: this.currentScale.left, right: this.currentScale.right,
      psychicId: psychic.id, psychicName: psychic.name,
      target: this.target,
      timeLeft: this.clueTime,
    });

    this.timeLeft = this.clueTime;
    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.startGuessing();
      }
    }, 1000);
  }

  submitClue(playerId, clue) {
    if (this._aborted) return false;
    const psychic = this.players[this.psychicIndex % this.players.length];
    if (this.phase !== 'clue' || playerId !== psychic.id) return false;

    this.stopTimer();
    this.currentClue = clue.trim();
    this.emit('clue:submitted', { psychicId: playerId, clue: this.currentClue });
    if (!this._aborted) this.startGuessing();
    return true;
  }

  startGuessing() {
    if (this._aborted) return;
    this.phase = 'guessing';
    this.timeLeft = this.guessTime;

    this.emit('guess:started', {
      clue: this.currentClue ?? '(без подсказки)',
      left: this.currentScale.left, right: this.currentScale.right,
      timeLeft: this.timeLeft,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.resolveRound();
      }
    }, 1000);
  }

  submitGuess(playerId, value) {
    if (this._aborted) return false;
    if (this.phase !== 'guessing') return false;
    const psychic = this.players[this.psychicIndex % this.players.length];
    if (playerId === psychic.id) return false;
    if (this.guesses.has(playerId)) return false;
    const num = Math.max(0, Math.min(100, parseInt(value, 10)));
    if (isNaN(num)) return false;

    this.guesses.set(playerId, num);
    this.emit('guess:submitted', { playerId, total: this.guesses.size, required: this.players.length - 1 });

    if (this.guesses.size >= this.players.length - 1) {
      this.stopTimer();
      if (!this._aborted) this.resolveRound();
    }
    return true;
  }

  resolveRound() {
    if (this._aborted) return;
    if (this.phase === 'results') return;
    this.phase = 'results';
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    const psychic = this.players[this.psychicIndex % this.players.length];
    const results = this.players.map(p => {
      if (p.id === psychic.id) return { id: p.id, name: p.name, guess: null, diff: null, earned: 0 };
      const guess = this.guesses.get(p.id);
      if (guess == null) return { id: p.id, name: p.name, guess: null, diff: null, earned: 0 };
      const diff = Math.abs(guess - this.target);
      let earned = 0;
      if (diff <= 5) earned = this.pointsExact;
      else if (diff <= 20) earned = this.pointsClose;
      p.score += earned;
      return { id: p.id, name: p.name, guess, diff, earned };
    });

    const totalTeamEarned = results.reduce((s, r) => s + r.earned, 0);
    const guessersCount = Math.max(1, this.players.length - 1);
    if (totalTeamEarned > 0) psychic.score += Math.min(this.pointsExact + 1, Math.round(totalTeamEarned / guessersCount));

    this.emit('round:ended', {
      round: this.round, target: this.target,
      clue: this.currentClue, results,
    });
    this.emit('score:updated', {
      players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
    });

    this.psychicIndex++;
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
    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    this.emit('game:ended', { winner: sorted[0] ?? null, players: sorted });
  }

  stopTimer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
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

  getState() {
    return {
      phase: this.phase, players: this.players,
      round: this.round, maxRounds: this.maxRounds,
      timeLeft: this.timeLeft,
      currentScale: this.currentScale, currentClue: this.currentClue,
      guessesCount: this.guesses.size,
    };
  }
}
