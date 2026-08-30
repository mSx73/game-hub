import { EventEmitter } from 'events';

export class RankingEngine extends EventEmitter {
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
    this.roundTime = this.settings.orderingTime ?? this.settings.roundTime ?? 60;
    this.pointsPerCorrectPosition = this.settings.pointsPerCorrectPosition ?? 1;
    this.bonusForPerfect = this.settings.bonusForPerfect ?? 3;
    this.currentSet = null;
    this.submissions = new Map();
    this.usedSets = new Set();

    this.sets = [
      { criterion: 'По популярности в России', items: ['Кофе', 'Чай', 'Сок', 'Молоко', 'Вода'], correct: [4, 0, 2, 3, 1] },
      { criterion: 'По площади (от большей к меньшей)', items: ['Франция', 'Германия', 'Испания', 'Италия', 'Польша'], correct: [2, 0, 4, 3, 1] },
      { criterion: 'По году изобретения (от старого к новому)', items: ['Колесо', 'Порох', 'Печатный станок', 'Телефон', 'Интернет'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По калорийности (от меньшей к большей)', items: ['Огурец', 'Яблоко', 'Банан', 'Хлеб', 'Шоколад'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По глубине (от мелкого к глубокому)', items: ['Азовское море', 'Балтийское море', 'Чёрное море', 'Средиземное море', 'Байкал'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По населению (от большего к меньшему)', items: ['Китай', 'Индия', 'США', 'Бразилия', 'Россия'], correct: [1, 0, 2, 3, 4] },
      { criterion: 'По длине (от короткого к длинному)', items: ['Хомяк', 'Кошка', 'Собака', 'Дельфин', 'Жираф'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По скорости (от медленного к быстрому)', items: ['Черепаха', 'Человек', 'Лошадь', 'Гепард', 'Сокол'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По высоте здания (от низкого к высокому)', items: ['Кремль', 'Биг-Бен', 'Эйфелева башня', 'Эмпайр-стейт-билдинг', 'Бурдж-Халифа'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По дате основания города (от старого к новому)', items: ['Рим', 'Париж', 'Москва', 'Нью-Йорк', 'Дубай'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По весу (от лёгкого к тяжёлому)', items: ['Мышь', 'Кролик', 'Овца', 'Корова', 'Слон'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По температуре плавления (от низкой к высокой)', items: ['Ртуть', 'Олово', 'Свинец', 'Золото', 'Вольфрам'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По количеству букв в русском слове', items: ['Дом', 'Кошка', 'Молоко', 'Бабочка', 'Велосипед'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По стоимости (от дешёвого к дорогому)', items: ['Хлеб', 'Кроссовки', 'Телефон', 'Ноутбук', 'Автомобиль'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По расстоянию от Москвы (от ближнего к дальнему)', items: ['Тула', 'Нижний Новгород', 'Казань', 'Екатеринбург', 'Новосибирск'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По году выхода фильма (от старого к новому)', items: ['Ирония судьбы', 'Терминатор', 'Титаник', 'Аватар', 'Мстители: Финал'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По количеству ног', items: ['Змея', 'Человек', 'Собака', 'Паук', 'Сороконожка'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По размеру планеты (от маленькой к большой)', items: ['Меркурий', 'Марс', 'Земля', 'Нептун', 'Юпитер'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По длине реки (от короткой к длинной)', items: ['Нева', 'Дон', 'Волга', 'Нил', 'Амазонка'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По продолжительности жизни животного', items: ['Мышь', 'Собака', 'Лошадь', 'Слон', 'Черепаха'], correct: [0, 1, 2, 3, 4] },
      { criterion: 'По объёму памяти (от малого к большому)', items: ['Дискета', 'CD-диск', 'DVD-диск', 'Флешка', 'Жёсткий диск'], correct: [0, 1, 2, 3, 4] },
    ];
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
    // После resolveRound() фаза «results» — без этого submitRanking отклоняется со 2-го раунда
    this.phase = 'playing';
    this.round++;
    if (this.round > this.maxRounds) { this.endGame(); return; }

    this.submissions.clear();
    let availableIndices = this.sets.map((_, i) => i).filter((i) => !this.usedSets.has(i));
    if (availableIndices.length === 0) {
      this.usedSets.clear();
      availableIndices = this.sets.map((_, i) => i);
    }
    const idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedSets.add(idx);
    this.currentSet = this.sets[idx];

    const shuffled = [...this.currentSet.items].sort(() => Math.random() - 0.5);
    this.shuffledItems = shuffled;
    this.timeLeft = this.roundTime;

    this.emit('round:started', {
      round: this.round, maxRounds: this.maxRounds,
      items: shuffled, criterion: this.currentSet.criterion,
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

  submitRanking(playerId, ranking) {
    if (this._aborted) return false;
    if (this.phase !== 'playing' || !this.currentSet) return false;
    if (this.submissions.has(playerId)) return false;
    if (!Array.isArray(ranking) || ranking.length !== this.currentSet.items.length) return false;

    const n = this.currentSet.items.length;
    const positions = new Set(ranking.filter((p) => typeof p === 'number' && p >= 0 && p < n));
    if (positions.size !== ranking.length) return false;

    this.submissions.set(playerId, ranking);
    this.emit('ranking:submitted', { playerId, total: this.submissions.size, required: this.players.length });

    if (this.submissions.size >= this.players.length) {
      this.stopTimer();
      if (!this._aborted) this.resolveRound();
    }
    return true;
  }

  resolveRound() {
    if (this._aborted) return;
    if (!this.currentSet) return;
    if (this.phase === 'results') return;
    this.phase = 'results';
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    const correct = this.currentSet.correct;
    const n = correct.length;

    const results = this.players.map(p => {
      const rawRanking = this.submissions.get(p.id);
      if (!rawRanking) return { id: p.id, name: p.name, ranking: null, earned: 0, correctPositions: 0 };

      // Frontend sends ranking[displayedIndex]=position (displayed = shuffled order)
      const rankingByPosition = new Array(n).fill(-1);
      for (let displayedIdx = 0; displayedIdx < n; displayedIdx++) {
        const pos = rawRanking[displayedIdx];
        if (typeof pos === 'number' && pos >= 0 && pos < n) rankingByPosition[pos] = displayedIdx;
      }
      // Map displayed index to original index for comparison with correct
      const shuffled = this.shuffledItems || this.currentSet.items;
      const r = rankingByPosition.map((dispIdx) =>
        dispIdx >= 0 ? this.currentSet.items.indexOf(shuffled[dispIdx]) : -1
      );

      let correctPositions = 0;
      for (let i = 0; i < n; i++) {
        if ((r[i] ?? -1) === correct[i]) correctPositions++;
      }

      let earned = correctPositions * this.pointsPerCorrectPosition;
      if (correctPositions === n) earned += this.bonusForPerfect;
      p.score += earned;

      return { id: p.id, name: p.name, ranking: rawRanking, earned, correctPositions };
    });

    this.emit('round:ended', {
      round: this.round, criterion: this.currentSet.criterion,
      items: this.currentSet.items, correctRanking: correct, results,
    });
    this.emit('score:updated', {
      players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
    });

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
      currentCriterion: this.currentSet?.criterion ?? null,
      submissionsCount: this.submissions.size,
    };
  }
}
