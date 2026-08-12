import { EventEmitter } from 'events';

export class ReactionEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.players = new Map(); // id -> { id, name, score, ready }
    this.state = 'waiting'; // waiting, countdown, active, finished
    this.countdown = 3;
    this.winner = null;
    this.startTime = null;
    this.reactionTime = null;
    this.gameId = 'reaction_' + Date.now();
    this._aborted = false;
    this._countdownInterval = null;
    this._signalTimeout = null;
    this._roundEndTimeout = null;
  }

  start() {
    if (this._aborted) return;
    const roomPlayers = (this.room?.players ?? []).filter((p) => !p.isSpectator);
    for (const p of roomPlayers) {
      if (!this.players.has(p.id)) {
        this.players.set(p.id, { id: p.id, name: p.name, score: 0, ready: false, reacted: false, reactionTime: null });
      }
    }
    this.state = 'waiting';
  }

  addPlayer(player) {
    this.players.set(player.id, {
      id: player.id,
      name: player.name,
      score: 0,
      ready: false,
      reacted: false,
      reactionTime: null
    });
    this.emit('player:joined', { playerId: player.id, playerName: player.name });
  }

  removePlayer(playerId) {
    if (this.players.has(playerId)) {
      const player = this.players.get(playerId);
      this.players.delete(playerId);
      this.emit('player:left', { playerId, playerName: player.name });
    }
  }

  setReady(playerId, ready) {
    const player = this.players.get(playerId);
    if (player) {
      player.ready = ready;
      this.emit('player:ready', { playerId, ready });
      
      // Если все готовы и минимум 2 игрока
      const allReady = Array.from(this.players.values()).every(p => p.ready);
      if (allReady && this.players.size >= 2 && this.state === 'waiting') {
        this.startCountdown();
      }
    }
  }

  startCountdown() {
    if (this._aborted) return;
    this.state = 'countdown';
    this.countdown = 3;
    this.emit('game:countdown', { countdown: this.countdown });

    if (this._countdownInterval) { clearInterval(this._countdownInterval); this._countdownInterval = null; }
    this._countdownInterval = setInterval(() => {
      if (this._aborted) { clearInterval(this._countdownInterval); this._countdownInterval = null; return; }
      this.countdown--;
      this.emit('game:countdown', { countdown: this.countdown });

      if (this.countdown <= 0) {
        clearInterval(this._countdownInterval);
        this._countdownInterval = null;
        if (!this._aborted) this.startGame();
      }
    }, 1000);
  }

  startGame() {
    if (this._aborted) return;
    this.state = 'active';
    this.startTime = Date.now();
    this.reactionTime = Math.random() * 3000 + 1000; // 1-4 секунды
    this.winner = null;

    for (const player of this.players.values()) {
      player.reacted = false;
      player.reactionTime = null;
    }

    this.emit('game:started', {
      players: Array.from(this.players.values()).map(p => ({ id: p.id, name: p.name, score: p.score })),
      reactionTime: Math.round(this.reactionTime)
    });

    if (this._signalTimeout) { clearTimeout(this._signalTimeout); this._signalTimeout = null; }
    this._signalTimeout = setTimeout(() => {
      this._signalTimeout = null;
      if (!this._aborted && this.state === 'active') {
        this.emit('game:signal', { timestamp: Date.now() });
      }
    }, this.reactionTime);
  }

  handleReaction(playerId) {
    if (this.state !== 'active') return false;
    
    const player = this.players.get(playerId);
    if (!player || player.reacted) return false;
    
    const now = Date.now();
    const elapsed = now - this.startTime - this.reactionTime;
    
    player.reacted = true;
    player.reactionTime = elapsed;
    
    // Первый нажавший становится победителем
    if (!this.winner) {
      this.winner = playerId;
      player.score += 10;

      this.emit('game:winner', {
        winnerId: playerId,
        winnerName: player.name,
        reactionTime: elapsed,
        score: player.score,
        scores: Array.from(this.players.values()).map(p => ({ id: p.id, name: p.name, score: p.score })),
      });

      if (this._roundEndTimeout) { clearTimeout(this._roundEndTimeout); this._roundEndTimeout = null; }
      this._roundEndTimeout = setTimeout(() => {
        this._roundEndTimeout = null;
        if (!this._aborted) this.finishRound();
      }, 3000);
    } else {
      // Остальные игроки
      this.emit('player:reacted', {
        playerId,
        playerName: player.name,
        reactionTime: elapsed,
        isWinner: false
      });
    }
    
    return true;
  }

  finishRound() {
    this.state = 'waiting';
    
    // Сбросить готовность
    for (const player of this.players.values()) {
      player.ready = false;
      player.reacted = false;
    }
    
    this.emit('game:round-ended', {
      scores: Array.from(this.players.values()).map(p => ({ 
        id: p.id, 
        name: p.name, 
        score: p.score,
        reactionTime: p.reactionTime 
      }))
    });
  }

  cleanup() {
    this._aborted = true;
    if (this._countdownInterval) { clearInterval(this._countdownInterval); this._countdownInterval = null; }
    if (this._signalTimeout) { clearTimeout(this._signalTimeout); this._signalTimeout = null; }
    if (this._roundEndTimeout) { clearTimeout(this._roundEndTimeout); this._roundEndTimeout = null; }
    this.removeAllListeners();
  }

  getState() {
    return {
      state: this.state,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        ready: p.ready,
        reacted: p.reacted,
        reactionTime: p.reactionTime
      })),
      countdown: this.countdown,
      winner: this.winner,
      startTime: this.startTime,
      reactionTime: this.reactionTime
    };
  }
}