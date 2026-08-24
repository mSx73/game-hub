import { EventEmitter } from 'events';

const FACTS = [
  { fact: 'Банан — это ягода.', truth: true },
  { fact: 'Сердце креветки находится в голове.', truth: true },
  { fact: 'Мёд никогда не портится.', truth: true },
  { fact: 'Осьминог имеет три сердца.', truth: true },
  { fact: 'Стрекозы живут всего 24 часа.', truth: false },
  { fact: 'Земля — идеальная сфера.', truth: false },
  { fact: 'Человек использует только 10% мозга.', truth: false },
  { fact: 'Волосы и ногти растут после смерти.', truth: false },
  { fact: 'Молния бьёт дважды в одно место.', truth: false },
  { fact: 'Пингвины могут летать.', truth: false },
  { fact: 'В Японии есть остров кроликов.', truth: true },
  { fact: 'У улитки около 14 000 зубов.', truth: true },
  { fact: 'Крокодилы могут высовывать язык.', truth: false },
  { fact: 'Морковь улучшает зрение в темноте.', truth: false },
  { fact: 'Собаки видят только чёрно-белое.', truth: false },
  { fact: 'Золотые рыбки имеют память 3 секунды.', truth: false },
  { fact: 'Слоны не умеют прыгать.', truth: true },
  { fact: 'У жирафа столько же шейных позвонков, сколько у человека.', truth: true },
  { fact: 'Колибри — единственная птица, умеющая летать назад.', truth: true },
  { fact: 'Водопад Виктория слышен за 40 км.', truth: true },
  { fact: 'Снежинки всегда имеют 6 граней.', truth: true },
  { fact: 'В Древнем Риме соль использовалась как зарплата.', truth: true },
  { fact: 'Кетчуп раньше продавали как лекарство.', truth: true },
  { fact: 'На Сатурне и Юпитере идут алмазные дожди.', truth: true },
  { fact: 'Венера — единственная планета, вращающаяся по часовой стрелке.', truth: true },
  { fact: 'Арахис — это орех.', truth: false },
  { fact: 'Кровь человека синяя до контакта с кислородом.', truth: false },
  { fact: 'Быки реагируют на красный цвет.', truth: false },
  { fact: 'Наполеон был низкого роста.', truth: false },
  { fact: 'Великая Китайская стена видна из космоса.', truth: false },
];

export class FactsEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 0;
    this.maxRounds = this.settings.maxRounds ?? 10;
    this.answerTime = this.settings.answerTime ?? 15;
    this.currentFact = null;
    this.answers = new Map();
    this.usedIndices = new Set();
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

    this.answers.clear();
    let available = FACTS.map((_, i) => i).filter(i => !this.usedIndices.has(i));
    if (available.length === 0) {
      this.usedIndices.clear();
      available = FACTS.map((_, i) => i);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    this.usedIndices.add(idx);
    this.currentFact = FACTS[idx];
    this.timeLeft = this.answerTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      fact: this.currentFact.fact,
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

  submitAnswer(playerId, text) { return this.handleChat(playerId, text); }
  handleChat(playerId, message) {
    if (this._aborted) return false;
    if (this.phase !== 'playing' || !this.currentFact) return false;
    if (this.answers.has(playerId)) return false;

    const msg = String(message || '').trim().toLowerCase();
    const isTrue = /^(да|true|правда|1|да|верно|истина)$/i.test(msg);
    const isFalse = /^(нет|false|ложь|0|неверно|неправда)$/i.test(msg);

    if (!isTrue && !isFalse) return false;

    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;

    const guess = isTrue;
    this.answers.set(playerId, guess);

    this.emit('answer:submitted', {
      playerId,
      playerName: player.name,
      total: this.answers.size,
      required: this.players.length,
    });

    if (this.answers.size >= this.players.length) {
      this.stopTimer();
      if (!this._aborted) this.resolveRound();
    }
    return true;
  }

  resolveRound() {
    if (this._aborted) return;
    if (!this.currentFact) return;
    if (this.phase === 'results') return;
    this.phase = 'results';
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    const correct = this.currentFact.truth;

    for (const p of this.players) {
      const guess = this.answers.get(p.id);
      if (guess === correct) p.score = (p.score || 0) + 1;
    }

    this.emit('round:ended', {
      round: this.round,
      fact: this.currentFact.fact,
      truth: correct,
      results: this.players.map(p => ({
        id: p.id,
        name: p.name,
        guess: this.answers.get(p.id),
        correct: this.answers.get(p.id) === correct,
      })),
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
