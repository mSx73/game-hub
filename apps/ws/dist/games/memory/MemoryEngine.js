import { EventEmitter } from 'events';

const SYMBOLS = ['🔴', '🟢', '🔵', '🟡', '🟣', '🟠', '⚪', '🟤'];

export class MemoryEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 1;
    this.maxRounds = this.settings.maxRounds ?? 6;
    this.sequence = [];
    this.alivePlayers = [];
    this.answers = new Map();
    this.baseLength = this.settings.baseLength ?? 3;
    this.answerTime = this.settings.answerTime ?? 15;
    this.showDelay = this.settings.showDelay ?? 3;
    this._aborted = false;
    this._revealTimeout = null;
    this._roundDelayTimeout = null;
  }

  start() {
    if (this._aborted) return;
    this.phase = 'playing';
    this.round = 1;
    this.alivePlayers = this.players.map((p) => p.id);
    this.nextRound();
  }

  nextRound() {
    if (this._aborted) return;
    this.stopTimer();

    if (this.round > this.maxRounds) {
      this.endGame();
      return;
    }

    this.answers.clear();

    const seqLength = this.baseLength + (this.round - 1);
    this.sequence = [];
    for (let i = 0; i < seqLength; i++) {
      this.sequence.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    }

    this.phase = 'showing';

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      sequenceLength: seqLength,
      alivePlayers: this.alivePlayers.length,
    });

    this.emit('sequence:shown', {
      items: this.sequence,
      displayTime: this.showDelay,
    });

    const showMs = (this.showDelay + 1) * 1000;
    this._revealTimeout = setTimeout(() => {
      this._revealTimeout = null;
      if (this._aborted) return;
      this.phase = 'answering';
      this.timeLeft = this.answerTime;

      this.emit('sequence:hidden', {
        sequenceLength: this.sequence.length,
        timeLeft: this.answerTime,
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
    }, showMs);
  }

  submitAnswer(playerId, answer) {
    if (this._aborted) return false;
    if (this.phase !== 'answering') return false;
    if (this.answers.has(playerId)) return false;
    if (!this.alivePlayers.includes(playerId)) return false;

    const raw = Array.isArray(answer) ? answer : (answer ?? '').split(',');
    const submitted = raw.map((s) => (typeof s === 'string' ? s.trim() : String(s).trim()));

    this.answers.set(playerId, submitted);
    this.emit('answer:submitted', { playerId, total: this.answers.size, required: this.alivePlayers.length });

    if (this.answers.size >= this.alivePlayers.length) {
      this.stopTimer();
      this.resolveRound();
    }
    return true;
  }

  resolveRound() {
    if (this._aborted) return;
    if (this.phase === 'results') return;
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.phase = 'results';

    const eliminated = [];
    const survived = [];

    for (const pid of this.alivePlayers) {
      const ans = this.answers.get(pid);
      let correct = false;

      if (ans && ans.length === this.sequence.length) {
        correct = ans.every((s, i) => s === this.sequence[i]);
      }

      const player = this.players.find(p => p.id === pid);
      const pointsForSurvive = this.settings.pointsForSurvive ?? 3;
      const pointsPerElement = this.settings.pointsPerElement ?? 1;
      if (correct) {
        survived.push(pid);
        if (player) player.score += pointsForSurvive + this.sequence.length * pointsPerElement;
      } else {
        eliminated.push(pid);
        this.emit('player:eliminated', {
          playerId: pid,
          playerName: player?.name ?? '?',
        });
      }
    }

    this.alivePlayers = survived;
    if (survived.length === 0) {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.endGame();
      }, 3000);
      this.emit('round:ended', {
        round: this.round,
        correctSequence: this.sequence,
        survivedCount: survived.length,
        eliminatedCount: eliminated.length,
      });
      this.emit('score:updated', {
        players: this.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
      });
      return;
    }

    this.emit('round:ended', {
      round: this.round,
      correctSequence: this.sequence,
      survivedCount: survived.length,
      eliminatedCount: eliminated.length,
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
    this.emit('game:ended', { winner: sorted[0] ?? null, players: sorted });
  }

  stopTimer() {
    if (this._revealTimeout) {
      clearTimeout(this._revealTimeout);
      this._revealTimeout = null;
    }
    if (this.timer) {
      clearInterval(this.timer);
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
  }

  cleanup() {
    this._aborted = true;
    this.stopTimer();
    this.removeAllListeners();
  }

  getState() {
    return {
      phase: this.phase,
      players: this.players,
      round: this.round,
      maxRounds: this.maxRounds,
      timeLeft: this.timeLeft,
      sequenceLength: this.sequence.length,
      answersCount: this.answers.size,
      alivePlayersCount: this.alivePlayers.length,
    };
  }
}
