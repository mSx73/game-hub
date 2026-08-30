import { EventEmitter } from 'events';
import { isPlayerOnline, pruneOfflineFromMap } from '../../core/playerOnline.js';

export class SyncEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.players = new Map();
    this.state = 'waiting';
    this.round = 0;
    this.maxRounds = 5;
    this.roundStartTime = null;
    this.reactions = new Map();
    this.roundResults = [];
    this.countdownVal = 0;
    this._aborted = false;
    this._countdownInterval = null;
    this._roundTimeout = null;
    this.gameId = 'sync_' + Date.now();
  }

  start() {
    if (this._aborted) return;
    const roomPlayers = (this.room?.players ?? []).filter(p => !p.isSpectator && isPlayerOnline(p, this.room));
    for (const p of roomPlayers) {
      if (!this.players.has(p.id)) {
        this.players.set(p.id, { id: p.id, name: p.name, score: 0, ready: false });
      }
    }
    this.state = 'waiting';
    this.round = 0;
    this.roundResults = [];
  }

  addPlayer(player) {
    this.players.set(player.id, { id: player.id, name: player.name, score: 0, ready: false });
    this.emit('player:joined', { playerId: player.id, playerName: player.name });
  }

  removePlayer(playerId) {
    if (this.players.has(playerId)) {
      const p = this.players.get(playerId);
      this.players.delete(playerId);
      this.emit('player:left', { playerId, playerName: p.name });
    }
  }

  setReady(playerId, ready) {
    pruneOfflineFromMap(this.players, this.room);
    const player = this.players.get(playerId);
    if (!player) return;
    player.ready = ready;
    this.emit('player:ready', { playerId, ready });

    const onlinePlayers = Array.from(this.players.values()).filter(p => isPlayerOnline(p, this.room));
    const allReady = onlinePlayers.length >= 2 && onlinePlayers.every(p => p.ready);
    if (allReady && this.state === 'waiting') {
      this.startRound();
    }
  }

  handlePlayerDisconnect(playerId) {
    this.removePlayer(playerId);
    pruneOfflineFromMap(this.players, this.room);
  }

  startRound() {
    if (this._aborted) return;
    this.round++;
    if (this.round > this.maxRounds) {
      this.endGame();
      return;
    }

    this.state = 'countdown';
    this.reactions.clear();
    this.countdownVal = 3;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      players: this.getScoreboard(),
    });
    this.emit('game:countdown', { countdown: this.countdownVal });

    if (this._countdownInterval) { clearInterval(this._countdownInterval); this._countdownInterval = null; }
    this._countdownInterval = setInterval(() => {
      if (this._aborted) { clearInterval(this._countdownInterval); this._countdownInterval = null; return; }
      this.countdownVal--;
      this.emit('game:countdown', { countdown: this.countdownVal });
      if (this.countdownVal <= 0) {
        clearInterval(this._countdownInterval);
        this._countdownInterval = null;
        if (!this._aborted) this.activateRound();
      }
    }, 1000);
  }

  activateRound() {
    if (this._aborted) return;
    this.state = 'active';
    this.roundStartTime = Date.now();
    this.reactions.clear();

    this.emit('game:signal', { timestamp: this.roundStartTime });

    if (this._roundTimeout) { clearTimeout(this._roundTimeout); this._roundTimeout = null; }
    this._roundTimeout = setTimeout(() => {
      this._roundTimeout = null;
      if (!this._aborted && this.state === 'active') {
        this.resolveRound();
      }
    }, 10000);
  }

  handleReaction(playerId) {
    if (this.state !== 'active') return false;
    if (this.reactions.has(playerId)) return false;

    const now = Date.now();
    const elapsed = now - this.roundStartTime;
    this.reactions.set(playerId, elapsed);

    this.emit('player:reacted', {
      playerId,
      playerName: this.players.get(playerId)?.name,
      reactionTime: elapsed,
    });

    const activePlayers = Array.from(this.players.keys()).filter(id => !this.reactions.has(id));
    const allReacted = activePlayers.length === 0;

    if (allReacted) {
      if (this._roundTimeout) { clearTimeout(this._roundTimeout); this._roundTimeout = null; }
      this.resolveRound();
    }

    return true;
  }

  resolveRound() {
    if (this.state !== 'active') return;
    this.state = 'round-result';

    const allTimes = Array.from(this.reactions.values());
    const allPlayerIds = Array.from(this.players.keys());
    const avg = allTimes.length > 0 ? allTimes.reduce((a, b) => a + b, 0) / allTimes.length : 0;

    const reactedSet = new Set(this.reactions.keys());
    const notReacted = allPlayerIds.filter(id => !reactedSet.has(id));

    const roundScores = [];
    for (const [playerId, time] of this.reactions) {
      const diff = Math.abs(time - avg);
      let pts = 0;
      if (diff < 50) pts = 100;
      else if (diff < 150) pts = 75;
      else if (diff < 300) pts = 50;
      else if (diff < 500) pts = 25;
      else pts = 10;

      const player = this.players.get(playerId);
      if (player) player.score += pts;
      roundScores.push({ id: playerId, name: player?.name, time, diff: Math.round(diff), points: pts, score: player?.score });
    }

    for (const pid of notReacted) {
      const player = this.players.get(pid);
      if (player) {
        player.score += 0;
        roundScores.push({ id: pid, name: player?.name, time: null, diff: null, points: 0, score: player.score, missed: true });
      }
    }

    this.roundResults.push({ round: this.round, average: Math.round(avg), scores: roundScores });

    this.emit('round:ended', {
      round: this.round,
      maxRounds: this.maxRounds,
      average: Math.round(avg),
      scores: roundScores,
      allScores: this.getScoreboard(),
    });

    if (this.round < this.maxRounds) {
      setTimeout(() => {
        if (!this._aborted) {
          for (const p of this.players.values()) p.ready = false;
          this.state = 'waiting';
          this.emit('round:transition', { nextRound: this.round + 1 });
        }
      }, 4000);
    } else {
      setTimeout(() => {
        if (!this._aborted) this.endGame();
      }, 4000);
    }
  }

  endGame() {
    this.state = 'ended';
    const scores = this.getScoreboard();
    const winner = scores[0];

    this.emit('game:ended', {
      winnerId: winner?.id,
      winnerName: winner?.name,
      scores,
      rounds: this.roundResults,
    }, { scores });
  }

  getScoreboard() {
    return Array.from(this.players.values())
      .map(p => ({ id: p.id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }

  cleanup() {
    this._aborted = true;
    if (this._countdownInterval) { clearInterval(this._countdownInterval); this._countdownInterval = null; }
    if (this._roundTimeout) { clearTimeout(this._roundTimeout); this._roundTimeout = null; }
    this.removeAllListeners();
  }

  getState() {
    return {
      state: this.state,
      round: this.round,
      maxRounds: this.maxRounds,
      players: this.getScoreboard(),
      countdown: this.countdownVal,
      roundResults: this.roundResults,
    };
  }
}
