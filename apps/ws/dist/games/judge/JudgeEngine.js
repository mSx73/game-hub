import { EventEmitter } from 'events';

const SITUATIONS = [
  { situation: 'Кто виноват: тот, кто опоздал, или тот, кто начал без него?', sideA: 'Опоздавший', sideB: 'Начавший без него' },
  { situation: 'Кто прав: тот, кто громко слушает музыку в транспорте, или тот, кто просит убавить?', sideA: 'Слушающий музыку', sideB: 'Просящий убавить' },
  { situation: 'Кто виноват в разводе: тот, кто ушёл, или тот, кто довёл?', sideA: 'Ушедший', sideB: 'Доведший' },
  { situation: 'Кто прав: веган, который критикует мясоедов, или мясоед, который обижается?', sideA: 'Веган', sideB: 'Мясоед' },
  { situation: 'Кто виноват в конфликте: родитель, который запрещает, или ребёнок, который не слушает?', sideA: 'Родитель', sideB: 'Ребёнок' },
  { situation: 'Кто прав: тот, кто переспал в гостях, или хозяин, который раздражён?', sideA: 'Гость', sideB: 'Хозяин' },
  { situation: 'Кто виноват в пробке: тот, кто подрезал, или тот, кто не уступил?', sideA: 'Подрезавший', sideB: 'Не уступивший' },
  { situation: 'Кто прав: тот, кто отменил встречу в последний момент, или тот, кого отменили?', sideA: 'Отменивший', sideB: 'Отменённый' },
  { situation: 'Кто виноват в ссоре: тот, кто сказал правду, или тот, кто обиделся?', sideA: 'Сказавший правду', sideB: 'Обидевшийся' },
  { situation: 'Кто прав: тот, кто хочет тишину после 22:00, или тот, кто любит шумные вечеринки?', sideA: 'За тишину', sideB: 'За вечеринки' },
];

export class JudgeEngine extends EventEmitter {
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
    this.judgeId = null;
    this.currentSituation = null;
    this.usedIndices = new Set();
    this.discussionTime = this.settings.discussionTime ?? 60;
    this.voteTime = this.settings.voteTime ?? 15;
    this._aborted = false;
    this._roundDelayTimeout = null;
  }

  _scheduleAfterRound() {
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this._roundDelayTimeout = setTimeout(() => {
      this._roundDelayTimeout = null;
      if (this._aborted) return;
      if (this.round >= this.maxRounds) this.endGame();
      else this.nextRound();
    }, 3000);
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

    this.judgeId = this.players[Math.floor(Math.random() * this.players.length)].id;

    let available = SITUATIONS.map((_, i) => i).filter(i => !this.usedIndices.has(i));
    if (available.length === 0) {
      this.usedIndices.clear();
      available = SITUATIONS.map((_, i) => i);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    this.usedIndices.add(idx);
    this.currentSituation = SITUATIONS[idx];

    this.phase = 'discussion';
    this.timeLeft = this.discussionTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      situation: this.currentSituation.situation,
      sideA: this.currentSituation.sideA,
      sideB: this.currentSituation.sideB,
      judgeId: this.judgeId,
      judgeName: this.players.find(p => p.id === this.judgeId)?.name,
      timeLeft: this.timeLeft,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.startVoting();
      }
    }, 1000);
  }

  startVoting() {
    if (this._aborted) return;
    this.phase = 'voting';
    this.timeLeft = this.voteTime;
    this.emit('voting:started', {
      sideA: this.currentSituation.sideA,
      sideB: this.currentSituation.sideB,
      judgeId: this.judgeId,
      timeLeft: this.timeLeft,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (this._aborted) return;
        this.phase = 'results';
        this.emit('round:ended', {
          round: this.round,
          situation: this.currentSituation.situation,
          judgeId: this.judgeId,
        });
        this.emit('score:updated', { players: this.players });
        this._scheduleAfterRound();
      }
    }, 1000);
  }

  submitChoice(playerId, choice) {
    if (this._aborted) return false;
    if (this.phase !== 'voting' || playerId !== this.judgeId) return false;
    const c = String(choice ?? '').toUpperCase();
    if (c !== 'A' && c !== 'B') return false;

    this.stopTimer();
    this.phase = 'results';
    const winner = c === 'A' ? this.currentSituation.sideA : this.currentSituation.sideB;
    const winnerPlayer = this.players.find(p => p.name === winner);
    if (winnerPlayer) winnerPlayer.score = (winnerPlayer.score || 0) + 1;
    const judgePlayer = this.players.find(p => p.id === this.judgeId);
    if (judgePlayer) judgePlayer.score = (judgePlayer.score || 0) + 1;
    this.emit('round:ended', {
      round: this.round,
      situation: this.currentSituation.situation,
      winner,
      verdict: c,
      judgeId: this.judgeId,
    });
    this.emit('score:updated', { players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })) });
    this._scheduleAfterRound();
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
