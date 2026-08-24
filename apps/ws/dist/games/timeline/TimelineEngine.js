import { EventEmitter } from 'events';

export class TimelineEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 0;
    this.maxRounds = this.settings.maxRounds ?? 12;
    this.answerTime = this.settings.guessTime ?? this.settings.answerTime ?? 30;
    this.pointsForClosest = this.settings.pointsForClosest ?? 2;
    this.pointsForExact = this.settings.pointsForExact ?? 5;
    this.currentEvent = null;
    this.answers = new Map();
    this.usedEvents = new Set();
    this._aborted = false;
    this._roundDelayTimeout = null;

    this.events = [
      { event: 'Основание Москвы', year: 1147 },
      { event: 'Падение Константинополя', year: 1453 },
      { event: 'Открытие Америки Колумбом', year: 1492 },
      { event: 'Начало правления Петра I', year: 1682 },
      { event: 'Основание Санкт-Петербурга', year: 1703 },
      { event: 'Великая французская революция', year: 1789 },
      { event: 'Битва при Бородино', year: 1812 },
      { event: 'Отмена крепостного права в России', year: 1861 },
      { event: 'Изобретение телефона', year: 1876 },
      { event: 'Открытие рентгеновских лучей', year: 1895 },
      { event: 'Первый полёт братьев Райт', year: 1903 },
      { event: 'Начало Первой мировой войны', year: 1914 },
      { event: 'Октябрьская революция', year: 1917 },
      { event: 'Начало Второй мировой войны', year: 1939 },
      { event: 'Создание ООН', year: 1945 },
      { event: 'Запуск первого спутника', year: 1957 },
      { event: 'Полёт Юрия Гагарина в космос', year: 1961 },
      { event: 'Первый человек на Луне', year: 1969 },
      { event: 'Чернобыльская катастрофа', year: 1986 },
      { event: 'Падение Берлинской стены', year: 1989 },
      { event: 'Распад Советского Союза', year: 1991 },
      { event: 'Создание Всемирной паутины', year: 1991 },
      { event: 'Клонирование овечки Долли', year: 1996 },
      { event: 'Запуск Google', year: 1998 },
      { event: 'Террористические атаки 11 сентября', year: 2001 },
      { event: 'Запуск первого iPhone', year: 2007 },
      { event: 'Олимпиада в Сочи', year: 2014 },
      { event: 'Начало пандемии COVID-19', year: 2020 },
      { event: 'Строительство Великой Китайской стены (начало)', year: -221 },
      { event: 'Изобретение книгопечатания Гутенбергом', year: 1440 },
      { event: 'Извержение Везувия и гибель Помпей', year: 79 },
      { event: 'Крещение Руси', year: 988 },
      { event: 'Коронация Наполеона', year: 1804 },
      { event: 'Изобретение паровоза', year: 1804 },
      { event: 'Открытие пенициллина', year: 1928 },
      { event: 'Первая фотография', year: 1826 },
      { event: 'Изобретение электрической лампочки', year: 1879 },
      { event: 'Первая Олимпиада современности', year: 1896 },
      { event: 'Открытие ДНК', year: 1953 },
      { event: 'Запуск Фейсбука', year: 2004 },
      { event: 'Битва на Куликовом поле', year: 1380 },
      { event: 'Монгольское нашествие на Русь', year: 1237 },
    ];
  }

  start() {
    this.phase = 'playing';
    this.round = 0;
    this.usedEvents.clear();
    this.nextRound();
  }

  nextRound() {
    if (this._aborted) return;
    this.stopTimer();
    this.round++;
    if (this.round > this.maxRounds) { this.endGame(); return; }

    this.answers.clear();
    let availableIndices = this.events.map((_, i) => i).filter((i) => !this.usedEvents.has(i));
    if (availableIndices.length === 0) {
      this.usedEvents.clear();
      availableIndices = this.events.map((_, i) => i);
    }
    const idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedEvents.add(idx);
    this.currentEvent = this.events[idx];
    this.phase = 'playing';

    this.timeLeft = this.answerTime;
    this.emit('round:started', {
      round: this.round, maxRounds: this.maxRounds,
      event: this.currentEvent.event, timeLeft: this.timeLeft,
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

  submitAnswer(playerId, answer) {
    if (this._aborted) return false;
    if (this.phase !== 'playing' || !this.currentEvent) return false;
    if (this.answers.has(playerId)) return false;
    const year = parseInt(answer, 10);
    if (isNaN(year) || year < -1000000 || year > 1000000) return false;

    this.answers.set(playerId, year);
    this.emit('answer:submitted', { playerId, total: this.answers.size, required: this.players.length });
    if (this.answers.size >= this.players.length) {
      this.stopTimer();
      if (!this._aborted) this.resolveRound();
    }
    return true;
  }

  resolveRound() {
    if (this._aborted) return;
    if (!this.currentEvent) return;
    if (this.phase === 'results') return;
    this.phase = 'results';
    const correctYear = this.currentEvent.year;

    const results = this.players.map(p => {
      const guess = this.answers.get(p.id);
      const diff = guess != null ? Math.abs(guess - correctYear) : Infinity;
      return { id: p.id, name: p.name, guess: guess ?? null, diff };
    });
    results.sort((a, b) => a.diff - b.diff);

    const minDiff = results[0]?.diff ?? Infinity;
    const winners = results.filter((r) => r.guess != null && r.diff === minDiff);
    for (const w of winners) {
      const player = this.players.find((p) => p.id === w.id);
      if (player) {
        const earned = w.diff === 0 ? this.pointsForExact : this.pointsForClosest;
        player.score += earned;
      }
    }

    this.emit('round:ended', {
      round: this.round, event: this.currentEvent.event, correctYear,
      results: results.map(r => ({ id: r.id, name: r.name, guess: r.guess, diff: r.diff })),
    });
    this.emit('score:updated', {
      players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
    });

    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
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
      currentEvent: this.currentEvent ? { event: this.currentEvent.event } : null,
      answersCount: this.answers.size,
    };
  }
}
