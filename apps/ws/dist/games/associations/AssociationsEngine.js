import { BaseGame } from '../../core/BaseGame.js';
export class AssociationsEngine extends BaseGame {
  constructor(roomOrPlayers, settings = {}) {
    super();
    const isRoom = !Array.isArray(roomOrPlayers) && roomOrPlayers !== null && typeof roomOrPlayers === 'object';
    const players = isRoom ? (roomOrPlayers.players ?? []).filter((p) => !p.isSpectator) : (roomOrPlayers ?? []);
    const resolvedSettings = isRoom ? (roomOrPlayers.settings ?? {}) : settings;
    this.settings = resolvedSettings;
    this.players = [];
    this.allWords = [];
    this.chain = [];
    this.currentPlayerIndex = 0;
    this.usedWords = new Set();
    this.round = 1;
    this.votingTimeout = null;
    this.seedWord = null;
    this.endWord = null;
    this.useStartEndPair = this.settings?.useStartEndPair === true;
    this.maxRounds = 10;
    this.activeVote = null;
    this.players = players.map((p) => ({ ...p, score: 0, words: [] }));
    this._aborted = false;
    this._roundDelayTimeout = null;
    this._turnTimeout = null;
    this._consecutiveTimeouts = 0;
  }
  start() {
    // Word collection phase starts automatically; players call addWords() to submit their 3 words
  }
  _armTurnTimer(sec) {
    if (this._turnTimeout) { this.clearManagedTimeout(this._turnTimeout); this._turnTimeout = null; }
    const ms = (Number(sec) > 0 ? Number(sec) : 20) * 1000;
    this._turnTimeout = this.registerTimeout(() => {
      this._turnTimeout = null;
      if (!this._aborted) this._handleTurnTimeout();
    }, ms);
  }
  _clearTurnTimer() {
    if (this._turnTimeout) { this.clearManagedTimeout(this._turnTimeout); this._turnTimeout = null; }
  }
  _handleTurnTimeout() {
    // Текущий игрок не дал ассоциацию вовремя — передаём ход дальше, цепочку не рвём.
    if (this._aborted || !this.players.length) return;
    this._consecutiveTimeouts += 1;
    // Никто не ходит целый круг — завершаем игру, чтобы не зависнуть навсегда.
    if (this._consecutiveTimeouts >= this.players.length) {
      this.endGame();
      return;
    }
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.startRound();
  }
  scoreBoard() {
    return this.players.map((p) => ({ id: p.id, name: p.name, score: p.score ?? 0 }));
  }
  cleanup() {
    this._aborted = true;
    if (this.votingTimeout) {
      this.clearManagedTimeout(this.votingTimeout);
      this.votingTimeout = null;
    }
    if (this._roundDelayTimeout) {
      this.clearManagedTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    if (this._turnTimeout) {
      this.clearManagedTimeout(this._turnTimeout);
      this._turnTimeout = null;
    }
    super.cleanup();
  }
  addWords(playerId, words) {
    if (this._aborted) return false;
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return false;
    if (player.words.length > 0) return false;

    const normalized = (Array.isArray(words) ? words : [])
      .map((w) => String(w || '').toLowerCase().trim().slice(0, 30))
      .filter((v, i, a) => v.length >= 2 && a.indexOf(v) === i)
      .slice(0, 3);

    if (normalized.length < 3) return false;

    player.words = normalized;
    for (const w of normalized) {
      if (!this.allWords.includes(w)) this.allWords.push(w);
    }

    if (this.players.every((p) => p.words.length >= 3)) {
      this.emit('words:collected', this.allWords.length);
      if (this._roundDelayTimeout) {
        this.clearManagedTimeout(this._roundDelayTimeout);
        this._roundDelayTimeout = null;
      }
      this._roundDelayTimeout = this.registerTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.startRound();
      }, 800);
    }
    return true;
  }
  startRound() {
    if (this._aborted) return;
    if (!this.players.length || !this.allWords.length) return;

    if (this.chain.length === 0) {
      if (this.useStartEndPair && this.allWords.length >= 2) {
        const shuffled = [...this.allWords].sort(() => Math.random() - 0.5);
        this.seedWord = shuffled[0];
        this.endWord = shuffled[1];
        this.usedWords = new Set([this.seedWord]);
      } else {
        this.seedWord = this.allWords[Math.floor(Math.random() * this.allWords.length)];
        this.endWord = null;
        this.usedWords = new Set([this.seedWord]);
      }
      this.emit('chain:started', {
        firstWord: this.seedWord,
        endWord: this.endWord,
        currentPlayer: this.players[this.currentPlayerIndex].name,
        round: this.round,
      });
    }

    const turnSec = Number(this.settings?.turnTime) > 0 ? Number(this.settings.turnTime) : 20;
    this.emit('turn:started', {
      player: this.players[this.currentPlayerIndex],
      previousWord: this.chain.length > 0 ? this.chain[this.chain.length - 1].word : this.seedWord,
      timeLeft: turnSec,
      round: this.round,
      scoreboard: this.scoreBoard(),
    });
    this._armTurnTimer(turnSec);
  }
  submitAssociation(playerId, word) {
    if (this._aborted) return false;
    if (playerId !== this.players[this.currentPlayerIndex].id) return false;
    const normalized = word.toLowerCase().trim();
    if (this.usedWords.has(normalized)) {
      this.emit('word:rejected', { reason: 'Слово уже использовалось', word });
      return false;
    }
    if (normalized.length < 2) {
      this.emit('word:rejected', { reason: 'Слово слишком короткое', word });
      return false;
    }
    if (!this.allWords.includes(normalized)) {
      this.emit('word:rejected', { reason: 'Слово не из начального набора', word });
      return false;
    }
    const previousWord = this.chain.length > 0 ? this.chain[this.chain.length - 1].word : this.seedWord;
    const link = {
      playerId,
      playerName: this.players[this.currentPlayerIndex].name,
      word: normalized,
      previousWord,
      valid: true,
      votes: 0,
    };
    this.chain.push(link);
    this.usedWords.add(normalized);
    this._clearTurnTimer();
    this._consecutiveTimeouts = 0;
    this.emit('link:added', link);
    if (this.endWord && normalized === this.endWord.toLowerCase()) {
      const player = this.players.find((p) => p.id === link.playerId);
      if (player) player.score += 3;
      this.emit('chain:completed', { endWord: this.endWord });
      this.chain = [];
      this.seedWord = null;
      this.endWord = null;
      this.usedWords.clear();
      this.currentPlayerIndex = 0;
      this.round += 1;
      this.emit('voting:ended', { valid: true, round: this.round, scoreboard: this.scoreBoard(), chainCompleted: true });
      if (this.round > this.maxRounds) {
        this.endGame();
      } else {
        if (this._roundDelayTimeout) {
          this.clearManagedTimeout(this._roundDelayTimeout);
          this._roundDelayTimeout = null;
        }
        this._roundDelayTimeout = this.registerTimeout(() => {
          this._roundDelayTimeout = null;
          if (!this._aborted) this.startRound();
        }, 1800);
      }
      return true;
    }
    this.startVoting(link);
    return true;
  }
  vote(playerId, vote) {
    if (this._aborted) return false;
    if (!this.activeVote) return false;
    const { voters, allowedVoters } = this.activeVote;
    if (!allowedVoters.has(playerId) || voters.has(playerId)) return false;
    voters.add(playerId);
    if (vote) this.activeVote.yesVotes += 1;
    else this.activeVote.noVotes += 1;

    const totalAllowed = allowedVoters.size;
    const yesRatio = totalAllowed > 0 ? this.activeVote.yesVotes / totalAllowed : 0;
    const noRatio = totalAllowed > 0 ? this.activeVote.noVotes / totalAllowed : 0;
    if (yesRatio > 0.5 || noRatio > 0.5 || voters.size === totalAllowed) {
      this.finishVoting();
    }
    return true;
  }
  startVoting(link) {
    const allowedVoters = new Set(this.players.map((p) => p.id).filter((id) => id !== link.playerId));
    this.activeVote = {
      link,
      yesVotes: 0,
      noVotes: 0,
      voters: new Set(),
      allowedVoters,
    };

    this.emit('voting:started', {
      link,
      timeLeft: 10,
      options: ['Связано', 'Не связано'],
    });

    if (this.votingTimeout) this.clearManagedTimeout(this.votingTimeout);
    this.votingTimeout = this.registerTimeout(() => this.finishVoting(), 10000);
  }

  finishVoting() {
    if (this._aborted) return;
    if (!this.activeVote) return;
    if (this.votingTimeout) this.clearManagedTimeout(this.votingTimeout);
    this.votingTimeout = null;

    const { link, yesVotes, noVotes } = this.activeVote;
    this.activeVote = null;

    const valid = yesVotes >= noVotes;
    link.valid = valid;

    if (valid) {
      const player = this.players.find((p) => p.id === link.playerId);
      if (player) player.score += 1;
      const lastFive = this.chain.slice(-5);
      if (lastFive.length === 5 && lastFive.every((l) => l.valid) && player) {
        player.score += 2;
        this.emit('bonus:awarded', { player: player.name, reason: 'Цепочка из 5!' });
      }
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    } else {
      const player = this.players.find((p) => p.id === link.playerId);
      if (player) player.score = Math.max(0, player.score - 1);
      this.emit('chain:broken', { player: player?.name ?? '—', word: link.word });
      this.chain = [];
      this.seedWord = null;
      this.endWord = null;
      this.usedWords.clear();
      this.currentPlayerIndex = 0;
      this.round += 1;
    }

    this.emit('voting:ended', { valid, yesVotes, noVotes, round: this.round, scoreboard: this.scoreBoard() });

    if (this.round > this.maxRounds) {
      this.endGame();
      return;
    }

    if (this._roundDelayTimeout) {
      this.clearManagedTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this._roundDelayTimeout = this.registerTimeout(() => {
      this._roundDelayTimeout = null;
      if (!this._aborted) this.startRound();
    }, valid ? 1200 : 1800);
  }

  endGame() {
    if (this.votingTimeout) {
      this.clearManagedTimeout(this.votingTimeout);
      this.votingTimeout = null;
    }
    if (this._roundDelayTimeout) {
      this.clearManagedTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    if (this._turnTimeout) {
      this.clearManagedTimeout(this._turnTimeout);
      this._turnTimeout = null;
    }
    const sortedPlayers = [...this.players].sort((a, b) => b.score - a.score);
    this.emit('game:ended', {
      winner: sortedPlayers[0] ?? null,
      players: sortedPlayers,
      round: this.round,
    });
  }

  getState() {
    return {
      chain: this.chain,
      players: this.players,
      currentPlayer: this.players[this.currentPlayerIndex],
      round: this.round,
    };
  }
}
