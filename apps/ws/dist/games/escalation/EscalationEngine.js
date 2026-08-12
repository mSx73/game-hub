import { EventEmitter } from 'events';

const PROMPTS = [
  'Назови что-то тяжёлое',
  'Назови что-то быстрое',
  'Назови что-то горячее',
  'Назови что-то страшное',
  'Назови что-то дорогое',
  'Назови что-то громкое',
  'Назови что-то старое',
  'Назови что-то большое',
  'Назови что-то холодное',
  'Назови что-то опасное',
  'Назови что-то вонючее',
  'Назови что-то мягкое',
  'Назови что-то редкое',
  'Назови что-то липкое',
  'Назови что-то острое',
  'Назови что-то длинное',
  'Назови что-то скользкое',
  'Назови что-то яркое',
  'Назови что-то сладкое',
  'Назови что-то медленное',
  'Назови что-то глубокое',
  'Назови что-то высокое',
];

export class EscalationEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.playerById = new Map(this.players.map(p => [p.id, p]));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 1;
    this.maxRounds = this.settings.maxRounds ?? 8;
    this.currentPrompt = null;
    this.usedPrompts = new Set();
    this.turnTime = this.settings.turnTime ?? 15;
    this.voteTime = this.settings.voteTime ?? 10;

    this.alivePlayers = [];
    this.currentTurnIndex = 0;
    this.lastAnswer = null;
    this.currentAnswer = null;
    this.votes = new Map();
    this._aborted = false;
    this._roundDelayTimeout = null;
    this._turnDelayTimeout = null;
  }

  start() {
    if (this._aborted) return;
    this.phase = 'playing';
    this.round = 1;
    this.nextRound();
  }

  nextRound() {
    if (this._aborted) return;
    this.stopTimer();
    this._clearDelays();

    if (this.round > this.maxRounds) {
      this.endGame();
      return;
    }

    this.alivePlayers = this.players.map(p => p.id);
    this.currentTurnIndex = 0;
    this.lastAnswer = null;

    let availableIndices = PROMPTS.map((_, i) => i).filter((i) => !this.usedPrompts.has(i));
    if (availableIndices.length === 0) {
      this.usedPrompts.clear();
      availableIndices = PROMPTS.map((_, i) => i);
    }
    const promptIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedPrompts.add(promptIdx);
    this.currentPrompt = PROMPTS[promptIdx];

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      prompt: this.currentPrompt,
      players: this.alivePlayers.map((id) => ({
        id,
        name: this.playerById.get(id)?.name ?? '?',
      })),
    });

    this.nextTurn();
  }

  _clearDelays() {
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    if (this._turnDelayTimeout) {
      clearTimeout(this._turnDelayTimeout);
      this._turnDelayTimeout = null;
    }
  }

  nextTurn() {
    if (this._aborted) return;
    this.stopTimer();
    if (this._turnDelayTimeout) {
      clearTimeout(this._turnDelayTimeout);
      this._turnDelayTimeout = null;
    }

    if (this.alivePlayers.length <= 1) {
      this.resolveRound();
      return;
    }

    const currentId = this.alivePlayers[this.currentTurnIndex % this.alivePlayers.length];
    const player = this.playerById.get(currentId);
    this.currentAnswer = null;
    this.votes.clear();

    this.phase = 'answering';
    this.timeLeft = this.turnTime;

    this.emit('turn:started', {
      playerId: currentId,
      playerName: player?.name ?? '?',
      prompt: this.currentPrompt,
      lastAnswer: this.lastAnswer,
      timeLeft: this.timeLeft,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.eliminateCurrentPlayer();
      }
    }, 1000);
  }

  submitAnswer(playerId, answer) {
    if (this._aborted) return false;
    if (this.phase !== 'answering') return false;
    const currentId = this.alivePlayers[this.currentTurnIndex % this.alivePlayers.length];
    if (playerId !== currentId) return false;

    const trimmed = (answer ?? '').trim().slice(0, 200);
    if (trimmed.length === 0) return false;

    this.currentAnswer = trimmed;
    this.stopTimer();

    this.emit('answer:submitted', {
      playerId,
      answer: trimmed,
    });

    if (!this._aborted) this.startVoting();
    return true;
  }

  startVoting() {
    if (this._aborted) return;
    this.phase = 'voting';
    this.votes.clear();
    this.timeLeft = this.voteTime;

    const currentId = this.alivePlayers[this.currentTurnIndex % this.alivePlayers.length];
    const eligibleVoters = this.alivePlayers.filter(id => id !== currentId);

    this.emit('voting:started', {
      answer: this.currentAnswer,
      lastAnswer: this.lastAnswer,
      prompt: this.currentPrompt,
      timeLeft: this.timeLeft,
    });

    if (eligibleVoters.length === 0) {
      if (this.currentAnswer) {
        this.acceptAnswer();
      } else {
        this.eliminateCurrentPlayer();
      }
      return;
    }

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.resolveVote();
      }
    }, 1000);
  }

  castVote(voterId, accept) {
    if (this._aborted) return false;
    if (this.phase !== 'voting') return false;
    const currentId = this.alivePlayers[this.currentTurnIndex % this.alivePlayers.length];
    if (voterId === currentId) return false;
    if (!this.alivePlayers.includes(voterId)) return false;
    if (this.votes.has(voterId)) return false;

    this.votes.set(voterId, !!accept);
    this.emit('vote:cast', { voterId, total: this.votes.size });

    const eligible = this.alivePlayers.filter(id => id !== currentId);
    if (this.votes.size >= eligible.length) {
      this.stopTimer();
      if (!this._aborted) this.resolveVote();
    }
    return true;
  }

  resolveVote() {
    if (this._aborted) return;
    if (this.phase !== 'voting') return;
    let accepts = 0;
    let rejects = 0;
    for (const v of this.votes.values()) {
      if (v) accepts++;
      else rejects++;
    }

    const currentId = this.alivePlayers[this.currentTurnIndex % this.alivePlayers.length];
    const eligible = this.alivePlayers.filter((id) => id !== currentId).length;
    const half = eligible / 2;
    if (accepts > half) {
      this.acceptAnswer();
    } else if (rejects > half) {
      this.eliminateCurrentPlayer();
    } else {
      (Math.random() < 0.5 ? this.acceptAnswer : this.eliminateCurrentPlayer).call(this);
    }
  }

  acceptAnswer() {
    if (this._aborted) return;
    this.phase = 'transition';
    this.lastAnswer = this.currentAnswer;
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.alivePlayers.length;

    if (this.alivePlayers.length <= 1) {
      this.resolveRound();
    } else {
      if (this._turnDelayTimeout) {
        clearTimeout(this._turnDelayTimeout);
        this._turnDelayTimeout = null;
      }
      this._turnDelayTimeout = setTimeout(() => {
        this._turnDelayTimeout = null;
        if (!this._aborted) this.nextTurn();
      }, 1500);
    }
  }

  eliminateCurrentPlayer() {
    if (this._aborted) return;
    this.phase = 'transition';
    const idx = this.currentTurnIndex % this.alivePlayers.length;
    const eliminatedId = this.alivePlayers[idx];
    this.alivePlayers.splice(idx, 1);

    if (idx < this.currentTurnIndex) {
      this.currentTurnIndex--;
    }
    this.currentTurnIndex = this.currentTurnIndex >= this.alivePlayers.length ? 0 : this.currentTurnIndex;

    this.emit('player:eliminated', {
      playerId: eliminatedId,
      playerName: this.playerById.get(eliminatedId)?.name ?? '?',
      remaining: this.alivePlayers.length,
    });

    if (this.alivePlayers.length <= 1) {
      this.resolveRound();
    } else {
      if (this._turnDelayTimeout) {
        clearTimeout(this._turnDelayTimeout);
        this._turnDelayTimeout = null;
      }
      this._turnDelayTimeout = setTimeout(() => {
        this._turnDelayTimeout = null;
        if (!this._aborted) this.nextTurn();
      }, 1500);
    }
  }

  resolveRound() {
    if (this._aborted) return;
    this.stopTimer();
    this._clearDelays();

    const pointsForWin = this.settings.pointsForWin ?? 3;
    if (this.alivePlayers.length === 1) {
      const winnerId = this.alivePlayers[0];
      const winner = this.playerById.get(winnerId);
      if (winner) winner.score += pointsForWin;
    }

    this.emit('round:ended', {
      round: this.round,
      winnerId: this.alivePlayers[0] ?? null,
      winnerName: this.playerById.get(this.alivePlayers[0])?.name ?? null,
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
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  cleanup() {
    this._aborted = true;
    this.stopTimer();
    this._clearDelays();
    this.removeAllListeners();
  }

  getState() {
    return {
      phase: this.phase,
      players: this.players,
      round: this.round,
      maxRounds: this.maxRounds,
      timeLeft: this.timeLeft,
      currentPrompt: this.currentPrompt,
      alivePlayers: this.alivePlayers,
      lastAnswer: this.lastAnswer,
    };
  }
}
