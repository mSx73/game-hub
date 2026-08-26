import { EventEmitter } from 'events';

export class TrustEngine extends EventEmitter {
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
    this.choices = new Map();
    this.pointsTrust = this.settings.pointsTrust ?? 1;
    this.pointsBetray = this.settings.pointsBetray ?? 3;
    this.pointsBothTrust = this.settings.pointsBothTrust ?? 2;
    this.pointsBothBetray = this.settings.pointsBothBetray ?? 0;
    this._aborted = false;
    this._roundDelayTimeout = null;
    this._resolvingRound = false;
  }

  start() {
    if (this._aborted) return;
    this.phase = 'playing';
    this.round = 0;
    this._resolvingRound = false;
    this._syncPlayersFromRoom();
    this.emit('score:updated', {
      players: this.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
    });
    this.nextRound();
  }

  _syncPlayersFromRoom() {
    const active = (this.room.players || []).filter((p) => !p.isSpectator);
    const scoreById = new Map(this.players.map((p) => [p.id, p.score ?? 0]));
    this.players = active.map((p) => ({
      id: p.id,
      name: p.name,
      score: scoreById.has(p.id) ? scoreById.get(p.id) : 0,
    }));
  }

  nextRound() {
    if (this._aborted) return;
    this._resolvingRound = false;
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

    this._syncPlayersFromRoom();
    if (this.players.length < 2) {
      this.emit('error', { message: 'Недостаточно игроков для «Доверие»' });
      this.endGame();
      return;
    }

    this.choices.clear();
    const rawRt = this.settings.roundTime;
    const n = typeof rawRt === 'number' && !Number.isNaN(rawRt) ? rawRt : Number(rawRt);
    this.timeLeft = Math.min(120, Math.max(8, Number.isFinite(n) && n > 0 ? n : 20));

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      timeLeft: this.timeLeft,
    });
    this.emit('timer:tick', this.timeLeft);

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
    const msg = String(message ?? '').trim().toLowerCase();
    if (msg === 'доверие' || msg === 'trust') return this.submitChoice(playerId, 'trust');
    if (msg === 'предательство' || msg === 'betray') return this.submitChoice(playerId, 'betray');
    return false;
  }

  submitChoice(playerId, choice) {
    if (this._aborted) return false;
    if (this.phase !== 'playing' || this._resolvingRound) return false;
    if (this.choices.has(playerId)) return false;
    const c = String(choice ?? '').toLowerCase();
    if (c !== 'trust' && c !== 'betray' && c !== 'доверие' && c !== 'предательство') return false;

    const isTrust = c === 'trust' || c === 'доверие';
    this.choices.set(playerId, isTrust);
    const submitted = this.players.filter((p) => this.choices.has(p.id)).length;
    this.emit('choice:submitted', { playerId, total: submitted, required: this.players.length });

    if (this.players.length > 0 && this.players.every((p) => this.choices.has(p.id))) {
      this.stopTimer();
      if (!this._aborted) this.resolveRound();
    }
    return true;
  }

  resolveRound() {
    if (this._aborted) return;
    if (this._resolvingRound) return;
    this._resolvingRound = true;
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    const answered = this.players.filter((p) => this.choices.has(p.id)).length;
    const trustCount = this.players.filter((p) => this.choices.get(p.id) === true).length;
    const betrayCount = answered - trustCount;

    const scoreBefore = new Map(this.players.map((p) => [p.id, p.score || 0]));

    for (const p of this.players) {
      const myChoice = this.choices.get(p.id);
      if (myChoice === undefined) continue;

      if (answered === this.players.length && trustCount === this.players.length) {
        p.score = (p.score || 0) + this.pointsBothTrust;
      } else if (answered === this.players.length && trustCount === 0) {
        p.score = (p.score || 0) + this.pointsBothBetray;
      } else if (myChoice) {
        p.score = (p.score || 0) + this.pointsTrust;
      } else {
        p.score = (p.score || 0) + this.pointsBetray;
      }
    }

    const results = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      choice: this.choices.has(p.id) ? (this.choices.get(p.id) ? 'trust' : 'betray') : null,
      earned: (p.score || 0) - (scoreBefore.get(p.id) || 0),
    }));

    this.emit('round:ended', {
      round: this.round,
      trustCount,
      betrayCount,
      answeredCount: Number(answered),
      totalPlayers: this.players.length,
      pointsTrust: this.pointsTrust,
      pointsBetray: this.pointsBetray,
      pointsBothTrust: this.pointsBothTrust,
      pointsBothBetray: this.pointsBothBetray,
      choices: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        choice: this.choices.has(p.id) ? (this.choices.get(p.id) ? 'trust' : 'betray') : null,
      })),
      results,
    });
    this.emit('score:updated', {
      players: this.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
    });

    if (this.round >= this.maxRounds) {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.endGame();
      }, 4000);
    } else {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.nextRound();
      }, 4000);
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
      gameType: 'trust',
      winner: sorted[0] ? { id: sorted[0].id, name: sorted[0].name, score: sorted[0].score } : null,
      players: sorted.map((p) => ({ id: p.id, name: p.name, score: p.score })),
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
