import { EventEmitter } from 'events';

const DILEMMAS = [
  ['Уметь летать', 'Уметь читать мысли'],
  ['Быть невидимым', 'Уметь телепортироваться'],
  ['Жить без интернета', 'Жить без горячей воды'],
  ['Уметь говорить на всех языках', 'Уметь играть на всех инструментах'],
  ['Быть самым умным', 'Быть самым красивым'],
  ['Жить 200 лет обычной жизнью', 'Жить 50 лет с суперспособностями'],
  ['Знать дату своей смерти', 'Знать причину своей смерти'],
  ['Всегда говорить только правду', 'Всегда врать'],
  ['Иметь машину времени', 'Иметь телепорт'],
  ['Быть знаменитым, но бедным', 'Быть богатым, но неизвестным'],
  ['Уметь дышать под водой', 'Уметь летать со скоростью 10 км/ч'],
  ['Жить в мире Гарри Поттера', 'Жить в мире Звёздных войн'],
  ['Не спать никогда', 'Спать только раз в неделю, но 24 часа'],
  ['Путешествовать в прошлое', 'Путешествовать в будущее'],
  ['Иметь идеальную память', 'Иметь идеальное здоровье'],
  ['Быть собой в прошлом с нынешними знаниями', 'Быть собой через 20 лет'],
  ['Жить на необитаемом острове', 'Жить в космической станции'],
  ['Есть только сладкое', 'Есть только солёное'],
  ['Уметь останавливать время', 'Уметь ускорять время'],
  ['Быть чемпионом мира по шахматам', 'Быть олимпийским чемпионом'],
  ['Жить без музыки', 'Жить без кино'],
  ['Иметь домашнего дракона', 'Иметь домашнего единорога'],
  ['Разговаривать с животными', 'Разговаривать с растениями'],
  ['Никогда не стареть', 'Никогда не болеть'],
  ['Быть лучшим поваром мира', 'Быть лучшим художником мира'],
  ['Читать одну книгу в день', 'Смотреть один фильм в день'],
  ['Иметь бесконечные деньги', 'Иметь бесконечное время'],
  ['Жить в мире без войн', 'Жить в мире без болезней'],
  ['Стать президентом на 1 день', 'Стать миллионером на 1 день'],
  ['Забыть своё прошлое', 'Не иметь будущего'],
  ['Всегда быть в хорошем настроении', 'Всегда быть удачливым'],
  ['Уметь менять внешность', 'Уметь менять голос'],
];

export class WouldYouRatherEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 1;
    this.maxRounds = this.settings.maxRounds ?? 12;
    this.currentDilemma = null;
    this.choices = new Map();
    this.usedDilemmas = new Set();
    this.choiceTime = this.settings.choiceTime ?? 20;
    this.pointsForMajority = this.settings.pointsForMajority ?? 2;
    this.pointsForMinority = this.settings.pointsForMinority ?? 0;
    this.pointsForTie = this.settings.pointsForTie ?? 1;
    this._aborted = false;
    this._roundDelayTimeout = null;
    this._resolvingRound = false;
  }

  start() {
    if (this._aborted) return;
    this.phase = 'playing';
    this.round = 1;
    this.usedDilemmas.clear();
    this._resolvingRound = false;
    this.emit('score:updated', {
      players: this.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
    });
    this.nextRound();
  }

  nextRound() {
    if (this._aborted) return;
    this._resolvingRound = false;
    this.stopTimer();
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }

    if (this.round > this.maxRounds) {
      this.endGame();
      return;
    }

    this.choices.clear();

    let availableIndices = DILEMMAS.map((_, i) => i).filter((i) => !this.usedDilemmas.has(i));
    if (availableIndices.length === 0) {
      this.usedDilemmas.clear();
      availableIndices = DILEMMAS.map((_, i) => i);
    }
    const idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedDilemmas.add(idx);
    this.currentDilemma = DILEMMAS[idx];

    this.phase = 'choosing';
    this.timeLeft = this.choiceTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      optionA: this.currentDilemma[0],
      optionB: this.currentDilemma[1],
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

  submitChoice(playerId, choice) {
    if (this._aborted) return false;
    if (this.phase !== 'choosing') return false;
    if (this.choices.has(playerId)) return false;
    if (!this.players.find(p => p.id === playerId)) return false;
    const c = String(choice || '').trim().toUpperCase();
    if (c !== 'A' && c !== 'B') return false;

    this.choices.set(playerId, c);
    this.emit('choice:submitted', { playerId, total: this.choices.size, required: this.players.length });

    if (this.choices.size >= this.players.length) {
      this.stopTimer();
      if (!this._aborted) this.resolveRound();
    }
    return true;
  }

  resolveRound() {
    if (this._aborted) return;
    if (!this.currentDilemma || this._resolvingRound) return;
    this._resolvingRound = true;
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }

    let countA = 0;
    let countB = 0;
    for (const c of this.choices.values()) {
      if (c === 'A') countA++;
      else countB++;
    }

    const isTie = countA === countB;
    const majorityChoice = isTie ? null : (countA > countB ? 'A' : 'B');
    const majorityText = isTie ? null : (majorityChoice === 'A' ? this.currentDilemma[0] : this.currentDilemma[1]);

    const results = this.players.map(p => {
      const pick = this.choices.get(p.id);
      let earned = 0;
      if (pick != null) {
        if (isTie) {
          earned = this.pointsForTie;
        } else if (majorityChoice != null && pick === majorityChoice) {
          earned = this.pointsForMajority;
        } else {
          earned = this.pointsForMinority;
        }
      }
      p.score += earned;
      return { id: p.id, name: p.name, choice: pick ?? null, earned };
    });

    this.emit('round:ended', {
      round: this.round,
      optionA: this.currentDilemma[0],
      optionB: this.currentDilemma[1],
      countA,
      countB,
      majorityChoice,
      majorityText,
      results,
    });
    this.emit('score:updated', {
      players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
    });

    this.round++;
    if (this.round > this.maxRounds) {
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
    this.emit('game:ended', {
      gameType: 'wouldyourather',
      winner: sorted[0] ? { id: sorted[0].id, name: sorted[0].name, score: sorted[0].score } : null,
      players: sorted.map((p) => ({ id: p.id, name: p.name, score: p.score })),
    });
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
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
      phase: this.phase,
      players: this.players,
      round: this.round,
      maxRounds: this.maxRounds,
      timeLeft: this.timeLeft,
      currentDilemma: this.currentDilemma ? { optionA: this.currentDilemma[0], optionB: this.currentDilemma[1] } : null,
      choicesCount: this.choices.size,
    };
  }
}
