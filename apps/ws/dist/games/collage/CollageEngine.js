import { EventEmitter } from 'events';

/** Заготовки — общая «рамка», к которой все добавляют по фрагменту */
const COLLAGE_SEEDS = [
  'На старте: город, где никто не помнит вчерашний день.',
  'Сцена: последний трамвай, который едет только в прошлое.',
  'Завязка: герой находит в кармане ключ без замка.',
  'В начале: дождь из конфетти, который никто не заказывал.',
  'Старт: кафе, где вместо меню — загадки.',
  'Пролог: робот просит отгадать, человек ли он.',
  'Точка отсчёта: остров, нарисованный на салфетке.',
  'Вход: лифт с кнопками «вверх», «ещё выше» и «случайно».',
];

export class CollageEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.maxRounds = Math.min(8, Math.max(1, this.settings.maxRounds ?? 3));
    this.turnTime = Math.min(120, Math.max(15, this.settings.turnTime ?? 45));
    this.voteTime = Math.min(90, Math.max(15, this.settings.voteTime ?? 35));
    this.pieceMin = Math.max(1, Math.min(20, this.settings.pieceMinLen ?? 2));
    this.pieceMax = Math.min(280, Math.max(this.pieceMin + 1, this.settings.pieceMaxLen ?? 160));
    this.pointsPerVote = Math.max(0, this.settings.pointsPerVote ?? 2);
    this.bonusRoundWinner = Math.max(0, this.settings.bonusRoundWinner ?? 3);

    this.scoreById = new Map();
    this.phase = 'waiting';
    this.round = 0;
    this.currentTurnIndex = 0;
    this.seed = '';
    this.pieces = [];
    this.votes = new Map();
    this.timer = null;
    this.timeLeft = 0;
    this.usedSeedIdx = new Set();
    this._aborted = false;
    this._betweenTimeout = null;
    this._resolving = false;

    this._syncRosterFromRoom();
  }

  _syncRosterFromRoom() {
    const active = (this.room.players || []).filter((p) => !p.isSpectator);
    for (const p of active) {
      if (!this.scoreById.has(p.id)) this.scoreById.set(p.id, 0);
    }
    this.players = active.map((p) => ({
      id: p.id,
      name: p.name,
      score: this.scoreById.get(p.id) ?? 0,
    }));
  }

  _pickSeed() {
    let idxs = COLLAGE_SEEDS.map((_, i) => i).filter((i) => !this.usedSeedIdx.has(i));
    if (idxs.length === 0) {
      this.usedSeedIdx.clear();
      idxs = COLLAGE_SEEDS.map((_, i) => i);
    }
    const i = idxs[Math.floor(Math.random() * idxs.length)];
    this.usedSeedIdx.add(i);
    return COLLAGE_SEEDS[i];
  }

  buildCollageText() {
    const parts = [this.seed, ...this.pieces.map((x) => x.text)];
    return parts.join(' ');
  }

  emitScores() {
    this._syncRosterFromRoom();
    for (const p of this.players) {
      p.score = this.scoreById.get(p.id) ?? 0;
    }
    this.emit('score:updated', {
      players: this.players.map((p) => ({ id: p.id, name: p.name, score: p.score ?? 0 })),
    });
  }

  start() {
    if (this._aborted) return;
    this._syncRosterFromRoom();
    if (this.players.length < 2) {
      this.emit('error', { message: 'Нужно минимум 2 игрока' });
      return;
    }
    this.phase = 'playing';
    this.round = 0;
    this.emit('game:started', { maxRounds: this.maxRounds, turnTime: this.turnTime, voteTime: this.voteTime });
    this.emitScores();
    if (this._betweenTimeout) clearTimeout(this._betweenTimeout);
    this._betweenTimeout = setTimeout(() => {
      this._betweenTimeout = null;
      if (!this._aborted) this.beginRound();
    }, 800);
  }

  beginRound() {
    if (this._aborted) return;
    this.stopTimer();
    this._resolving = false;
    this._syncRosterFromRoom();
    if (this.players.length < 2) {
      this.endGame();
      return;
    }

    this.round++;
    if (this.round > this.maxRounds) {
      this.endGame();
      return;
    }

    this.currentTurnIndex = 0;
    this.pieces = [];
    this.votes.clear();
    this.seed = this._pickSeed();

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      seed: this.seed,
      turnTime: this.turnTime,
      voteTime: this.voteTime,
      pointsPerVote: this.pointsPerVote,
      bonusRoundWinner: this.bonusRoundWinner,
    });

    if (this._betweenTimeout) clearTimeout(this._betweenTimeout);
    this._betweenTimeout = setTimeout(() => {
      this._betweenTimeout = null;
      if (!this._aborted) this.startContributeTurn();
    }, 1600);
  }

  startContributeTurn() {
    if (this._aborted) return;
    if (this.phase !== 'playing') return;
    this.stopTimer();

    if (this.currentTurnIndex >= this.players.length) {
      this.startVotingPhase();
      return;
    }

    const player = this.players[this.currentTurnIndex];
    this.timeLeft = this.turnTime;
    this.emit('turn:started', {
      player: { id: player.id, name: player.name },
      collageSoFar: this.buildCollageText(),
      seed: this.seed,
      round: this.round,
      maxRounds: this.maxRounds,
      turnIndex: this.currentTurnIndex + 1,
      totalTurns: this.players.length,
      timeLeft: this.timeLeft,
      pieceMin: this.pieceMin,
      pieceMax: this.pieceMax,
    });
    this.emit('timer:tick', this.timeLeft);

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this._addPieceSkipCurrent();
      }
    }, 1000);
  }

  _addPieceSkipCurrent() {
    if (this._aborted || this.phase !== 'playing') return;
    const player = this.players[this.currentTurnIndex];
    if (!player) {
      this.startVotingPhase();
      return;
    }
    const text = '…';
    this.pieces.push({
      authorId: player.id,
      authorName: player.name,
      text,
      skipped: true,
    });
    this.emit('piece:submitted', {
      playerId: player.id,
      playerName: player.name,
      text,
      skipped: true,
      collageSoFar: this.buildCollageText(),
    });
    this.currentTurnIndex++;
    this.startContributeTurn();
  }

  submitPiece(playerId, rawText) {
    if (this._aborted) return false;
    if (this.phase !== 'playing') return false;
    const player = this.players[this.currentTurnIndex];
    if (!player || playerId !== player.id) return false;

    const text = String(rawText ?? '').trim();
    if (text.length < this.pieceMin || text.length > this.pieceMax) return false;

    this.stopTimer();
    this.emit('timer:tick', 0);
    this.pieces.push({
      authorId: player.id,
      authorName: player.name,
      text,
      skipped: false,
    });
    this.emit('piece:submitted', {
      playerId: player.id,
      playerName: player.name,
      text,
      skipped: false,
      collageSoFar: this.buildCollageText(),
    });
    this.currentTurnIndex++;
    this.startContributeTurn();
    return true;
  }

  /** Совместимость с game:action submit-sentence */
  submitSentence(playerId, text) {
    return this.submitPiece(playerId, text);
  }

  startVotingPhase() {
    if (this._aborted) return;
    this.phase = 'vote';
    this.votes.clear();
    this.stopTimer();

    const votingPieces = this.pieces.map((p, index) => ({
      index,
      authorId: p.authorId,
      authorName: p.authorName,
      text: p.text,
      skipped: !!p.skipped,
    }));

    this.timeLeft = this.voteTime;
    this.emit('voting:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      collageFull: this.buildCollageText(),
      pieces: votingPieces,
      timeLeft: this.timeLeft,
      pointsPerVote: this.pointsPerVote,
      bonusRoundWinner: this.bonusRoundWinner,
    });
    this.emit('timer:tick', this.timeLeft);

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.resolveVoting();
      }
    }, 1000);
  }

  submitCollageVote(playerId, pieceIndex) {
    if (this._aborted) return false;
    if (this.phase !== 'vote' || this._resolving) return false;
    if (this.votes.has(playerId)) return false;
    if (!this.players.some((p) => p.id === playerId)) return false;

    const idx = Number(pieceIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.pieces.length) return false;

    const piece = this.pieces[idx];
    if (piece.authorId === playerId) return false;

    this.votes.set(playerId, idx);
    this.emit('vote:cast', { playerId, pieceIndex: idx, totalVotes: this.votes.size, needed: this.players.length });

    if (this.votes.size >= this.players.length) {
      this.stopTimer();
      if (!this._aborted) this.resolveVoting();
    }
    return true;
  }

  resolveVoting() {
    if (this._aborted) return;
    if (this._resolving) return;
    this._resolving = true;
    this.stopTimer();

    const counts = this.pieces.map(() => 0);
    for (const idx of this.votes.values()) {
      if (idx >= 0 && idx < counts.length) counts[idx]++;
    }

    let maxC = 0;
    for (const c of counts) if (c > maxC) maxC = c;

    const tallies = this.pieces.map((p, index) => {
      const votes = counts[index];
      const fromVotes = votes * this.pointsPerVote;
      const bonus = maxC > 0 && votes === maxC ? this.bonusRoundWinner : 0;
      const earned = fromVotes + bonus;
      return {
        index,
        authorId: p.authorId,
        authorName: p.authorName,
        votes,
        earned,
        fromVotes,
        bonus,
      };
    });

    for (const t of tallies) {
      const prev = this.scoreById.get(t.authorId) ?? 0;
      this.scoreById.set(t.authorId, prev + t.earned);
    }

    this.emitScores();

    const winners = tallies.filter((t) => maxC > 0 && t.votes === maxC).map((t) => t.authorName);
    this.emit('voting:ended', {
      round: this.round,
      maxRounds: this.maxRounds,
      tallies,
      pointsPerVote: this.pointsPerVote,
      bonusRoundWinner: this.bonusRoundWinner,
      topVoteCount: maxC,
      winnerNames: winners,
      collageFull: this.buildCollageText(),
    });

    this.emit('round:ended', {
      round: this.round,
      maxRounds: this.maxRounds,
      tallies,
      collageFull: this.buildCollageText(),
    });

    this.phase = 'playing';

    if (this.round >= this.maxRounds) {
      if (this._betweenTimeout) clearTimeout(this._betweenTimeout);
      this._betweenTimeout = setTimeout(() => {
        this._betweenTimeout = null;
        if (!this._aborted) this.endGame();
      }, 3200);
    } else {
      if (this._betweenTimeout) clearTimeout(this._betweenTimeout);
      this._betweenTimeout = setTimeout(() => {
        this._betweenTimeout = null;
        if (!this._aborted) this.beginRound();
      }, 3800);
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
    this.stopTimer();
    this.phase = 'finished';
    this._syncRosterFromRoom();
    for (const p of this.players) {
      p.score = this.scoreById.get(p.id) ?? 0;
    }
    const sorted = [...this.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || String(a.name).localeCompare(String(b.name), 'ru'));
    const top = sorted[0];
    const winner =
      sorted.length && (sorted.length === 1 || (sorted[0].score ?? 0) > (sorted[1].score ?? 0))
        ? { id: top.id, name: top.name, score: top.score }
        : null;

    this.emit('game:ended', {
      gameType: 'collage',
      winner,
      players: sorted.map((p) => ({ id: p.id, name: p.name, score: p.score ?? 0 })),
    });
  }

  cleanup() {
    this._aborted = true;
    this.stopTimer();
    if (this._betweenTimeout) {
      clearTimeout(this._betweenTimeout);
      this._betweenTimeout = null;
    }
    if (typeof this.removeAllListeners === 'function') this.removeAllListeners();
  }

  getState() {
    return {
      phase: this.phase,
      round: this.round,
      maxRounds: this.maxRounds,
      seed: this.seed,
      pieces: this.pieces,
      players: this.players,
      timeLeft: this.timeLeft,
    };
  }
}
