import { EventEmitter } from 'events';

export class AuctionEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.playerById = new Map(this.players.map(p => [p.id, p]));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 0;
    this.maxRounds = Math.max(1, this.settings.maxRounds ?? 10);
    this.answerTime = Math.max(5, this.settings.answerTime ?? 25);
    this.pointsFirst = Math.max(0, this.settings.pointsFirst ?? 5);
    this.pointsSecond = Math.max(0, this.settings.pointsSecond ?? 2);
    this.exactBonus = Math.max(0, this.settings.exactBonus ?? 3);
    this.currentQuestion = null;
    this.answers = new Map();
    this.usedQuestions = new Set();

    this.questions = [
      { q: 'Сколько кошек в России (в миллионах)?', answer: 74 },
      { q: 'Высота Эйфелевой башни в метрах?', answer: 330 },
      { q: 'Сколько станций в Московском метро?', answer: 263 },
      { q: 'Длина Транссибирской магистрали в километрах?', answer: 9288 },
      { q: 'Сколько языков в мире?', answer: 7168 },
      { q: 'Температура на поверхности Солнца в градусах Цельсия?', answer: 5500 },
      { q: 'Население Токио в миллионах?', answer: 14 },
      { q: 'Глубина Байкала в метрах?', answer: 1642 },
      { q: 'Сколько костей у акулы?', answer: 0 },
      { q: 'Скорость света в тысячах км/с?', answer: 300 },
      { q: 'Длина Великой Китайской стены в километрах?', answer: 21196 },
      { q: 'Сколько зубов у улитки (примерно)?', answer: 25000 },
      { q: 'Вес мозга человека в граммах?', answer: 1400 },
      { q: 'Сколько литров крови в теле взрослого человека?', answer: 5 },
      { q: 'Высота горы Эльбрус в метрах?', answer: 5642 },
      { q: 'Возраст Земли в миллиардах лет?', answer: 5 },
      { q: 'Сколько клавиш у пианино?', answer: 88 },
      { q: 'Площадь России в миллионах кв. км?', answer: 17 },
      { q: 'Рекорд скорости гепарда в км/ч?', answer: 120 },
      { q: 'Количество элементов в таблице Менделеева?', answer: 118 },
      { q: 'Сколько сердец у осьминога?', answer: 3 },
      { q: 'Диаметр Луны в километрах?', answer: 3474 },
      { q: 'Сколько мышц в теле человека?', answer: 640 },
      { q: 'Самая низкая зафиксированная температура на Земле?', answer: -89 },
      { q: 'Расстояние от Земли до Луны в тысячах км?', answer: 384 },
      { q: 'Сколько стран в Африке?', answer: 54 },
      { q: 'Длина реки Волга в километрах?', answer: 3530 },
      { q: 'Год основания Москвы?', answer: 1147 },
      { q: 'Население Исландии в тысячах?', answer: 376 },
      { q: 'Сколько олимпийских колец?', answer: 5 },
      { q: 'Глубина Марианской впадины в метрах?', answer: 10994 },
      { q: 'Сколько пар хромосом у человека?', answer: 23 },
      { q: 'Средний рост мужчины в России в сантиметрах?', answer: 176 },
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
    // После resolveRound() фаза «results» — без этого submitAnswer отклоняется со 2-го раунда
    this.phase = 'playing';
    this.round++;
    if (this.round > this.maxRounds) { this.endGame(); return; }

    this.answers.clear();
    let availableIndices = this.questions.map((_, i) => i).filter((i) => !this.usedQuestions.has(i));
    if (availableIndices.length === 0) {
      this.usedQuestions.clear();
      availableIndices = this.questions.map((_, i) => i);
    }
    const idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedQuestions.add(idx);
    this.currentQuestion = this.questions[idx];

    this.timeLeft = this.answerTime;
    this.emit('round:started', {
      round: this.round, maxRounds: this.maxRounds,
      question: this.currentQuestion.q, timeLeft: this.timeLeft,
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
    if (this.phase !== 'playing' || !this.currentQuestion) return false;
    if (this.answers.has(playerId)) return false;
    const num = parseFloat(answer);
    if (isNaN(num)) return false;

    this.answers.set(playerId, num);
    this.emit('answer:submitted', { playerId, total: this.answers.size, required: this.players.length });
    if (this.answers.size >= this.players.length) {
      this.stopTimer();
      if (!this._aborted) this.resolveRound();
    }
    return true;
  }

  resolveRound() {
    if (this._aborted) return;
    if (!this.currentQuestion) return;
    if (this.phase === 'results') return;
    this.phase = 'results';
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    const correct = this.currentQuestion.answer;

    const NO_ANSWER = Number.MAX_SAFE_INTEGER;
    const results = this.players.map(p => {
      const guess = this.answers.get(p.id);
      const diff = guess != null ? Math.abs(guess - correct) : NO_ANSWER;
      return { id: p.id, name: p.name, guess: guess ?? null, diff };
    });
    results.sort((a, b) => a.diff - b.diff);

    if (results[0] && results[0].guess !== null && results[0].diff !== NO_ANSWER) {
      const player = this.playerById.get(results[0].id);
      if (player) {
        player.score += this.pointsFirst;
        if (results[0].diff === 0) player.score += this.exactBonus;
      }
      if (results.length > 1 && results[1].guess !== null && results[1].diff !== NO_ANSWER) {
        const second = this.playerById.get(results[1].id);
        if (second) second.score += this.pointsSecond;
      }
    }

    this.emit('round:ended', {
      round: this.round, question: this.currentQuestion.q, correct,
      results: results.map(r => ({ id: r.id, name: r.name, guess: r.guess, diff: r.diff })),
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
      currentQuestion: this.currentQuestion ? { question: this.currentQuestion.q } : null,
      answersCount: this.answers.size,
    };
  }
}
