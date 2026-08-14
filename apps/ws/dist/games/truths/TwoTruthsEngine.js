import { EventEmitter } from 'events';

export class TwoTruthsEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.facts = new Map();
    this.guesses = new Map();
    this.pointsForCorrect = this.settings.pointsForCorrect ?? 2;
    this.pointsForFooled = this.settings.pointsForFooled ?? 1;
    this.currentPlayerIndex = -1;
    this.currentFacts = null;
    this.results = [];
    this._aborted = false;
    this._roundDelayTimeout = null;
  }

  start() {
    if (this._aborted) return;
    if (this.players.length < 3) {
      this.emit('error', { message: 'Нужно минимум 3 игрока' });
      return;
    }
    this.facts.clear();
    this.results = [];
    this.phase = 'collecting';
    this.emit('collecting:started', {
      timeLeft: 120,
      instructions: 'Напишите 2 правды и 1 ложь о себе',
    });

    this.startTimer(120, () => {
      if (this._aborted) return;
      if (this.facts.size >= 2) {
        this.startGuessingPhase();
      } else {
        this.endGame();
      }
    });
  }

  submitFacts(playerId, factsList, lieIndexParam) {
    if (this._aborted) return false;
    if (this.phase !== 'collecting') return false;
    if (this.facts.has(playerId)) return false;
    if (!Array.isArray(factsList) || factsList.length !== 3) return false;

    const normalized = factsList.map(f => String(f || '').trim()).filter(f => f.length >= 2);
    if (normalized.length !== 3) return false;
    if (new Set(normalized).size !== 3) return false;

    const lieIndex = typeof lieIndexParam === 'number' && [0, 1, 2].includes(lieIndexParam)
      ? lieIndexParam
      : (typeof factsList.lieIndex === 'number' && [0, 1, 2].includes(factsList.lieIndex) ? factsList.lieIndex : 2);

    this.facts.set(playerId, {
      facts: normalized,
      lieIndex,
    });

    this.emit('facts:submitted', {
      playerId,
      playerName: this.players.find(p => p.id === playerId)?.name ?? '',
      totalSubmitted: this.facts.size,
      totalPlayers: this.players.length,
    });

    if (this.facts.size >= this.players.length) {
      this.stopTimer();
      if (this._roundDelayTimeout) {
        clearTimeout(this._roundDelayTimeout);
        this._roundDelayTimeout = null;
      }
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.startGuessingPhase();
      }, 2000);
    }
    return true;
  }

  startGuessingPhase() {
    if (this._aborted) return;
    this.phase = 'guessing';
    this.currentPlayerIndex = -1;
    this.nextGuessRound();
  }

  nextGuessRound() {
    if (this._aborted) return;
    this.currentPlayerIndex++;

    const playersWithFacts = this.players.filter(p => this.facts.has(p.id));
    if (this.currentPlayerIndex >= playersWithFacts.length) {
      this.endGame();
      return;
    }

    const aboutPlayer = playersWithFacts[this.currentPlayerIndex];
    const entry = this.facts.get(aboutPlayer.id);
    this.currentFacts = { playerId: aboutPlayer.id, ...entry };
    this.guesses.clear();

    this.emit('guessing:started', {
      aboutPlayer: { id: aboutPlayer.id, name: aboutPlayer.name },
      facts: entry.facts,
      timeLeft: 30,
      roundIndex: this.currentPlayerIndex + 1,
      totalRounds: playersWithFacts.length,
    });

    this.startTimer(30, () => {
      if (!this._aborted) this.resolveGuesses();
    });
  }

  submitGuess(playerId, guessIndex) {
    if (this._aborted) return false;
    if (this.phase !== 'guessing') return false;
    if (!this.currentFacts) return false;
    if (playerId === this.currentFacts.playerId) return false;
    if (this.guesses.has(playerId)) return false;
    if (![0, 1, 2].includes(guessIndex)) return false;

    this.guesses.set(playerId, guessIndex);
    this.emit('guess:submitted', {
      playerId,
      total: this.guesses.size,
    });

    const eligibleGuessers = this.players.filter(p => p.id !== this.currentFacts.playerId);
    if (this.guesses.size >= eligibleGuessers.length) {
      this.stopTimer();
      if (!this._aborted) this.resolveGuesses();
    }
    return true;
  }

  resolveGuesses() {
    if (this._aborted) return;
    if (this.phase === 'results') return;
    this.phase = 'results';
    this.stopTimer();
    if (!this.currentFacts) return;
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }

    const { playerId, facts, lieIndex } = this.currentFacts;
    const aboutPlayer = this.players.find(p => p.id === playerId);
    let fooledCount = 0;

    const guessResults = [];
    for (const [guesserId, guessIdx] of this.guesses.entries()) {
      const guesser = this.players.find(p => p.id === guesserId);
      const correct = guessIdx === lieIndex;
      if (correct && guesser) {
        guesser.score += this.pointsForCorrect;
      } else {
        fooledCount++;
      }
      guessResults.push({
        playerId: guesserId,
        playerName: guesser?.name ?? '',
        guess: guessIdx,
        correct,
      });
    }

    if (aboutPlayer) {
      aboutPlayer.score += fooledCount * this.pointsForFooled;
    }

    this.emit('guessing:ended', {
      aboutPlayer: { id: playerId, name: aboutPlayer?.name ?? '' },
      facts,
      correctAnswer: lieIndex,
      results: guessResults,
      fooledCount,
    });

    this.emit('score:updated', {
      players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
    });

    this.results.push({
      playerId,
      facts,
      lieIndex,
      guessResults,
    });

    this._roundDelayTimeout = setTimeout(() => {
      this._roundDelayTimeout = null;
      if (!this._aborted) this.nextGuessRound();
    }, 5000);
  }

  startTimer(seconds, onEnd) {
    this.stopTimer();
    this.timeLeft = seconds;
    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) onEnd();
      }
    }, 1000);
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
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.phase = 'finished';
    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    this.emit('game:ended', {
      winner: sorted[0] ?? null,
      players: sorted,
      results: this.results,
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

  getState() {
    return {
      phase: this.phase,
      players: this.players,
      currentPlayerIndex: this.currentPlayerIndex,
      currentFacts: this.currentFacts ? { playerId: this.currentFacts.playerId, facts: this.currentFacts.facts } : null,
      timeLeft: this.timeLeft,
      submittedCount: this.facts.size,
    };
  }
}
