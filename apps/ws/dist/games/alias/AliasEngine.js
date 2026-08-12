import { EventEmitter } from 'events';
import { getGameWords } from '../../utils/wordDictionary.js';

export class AliasEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.currentPlayerIndex = 0;
    this.currentWord = '';
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.usedWords = new Set();
    this.round = 1;
    this.maxRounds = this.settings.maxRounds ?? 12;
    this.pointsGuesser = this.settings.pointsGuesser ?? 3;
    this.pointsExplainer = this.settings.pointsExplainer ?? 2;
    this.speedBonusMax = this.settings.speedBonusMax ?? 2;
    this.turnStartedAt = 0;
    this._aborted = false;
    this._transitionTimer = null;
    this._dictionaryStatusTimeout = null;

    // Use dictionary instead of hardcoded words
    this.words = [];
    this.dictionaryLoaded = false;
  }

  loadDictionary() {
    if (this.dictionaryLoaded) return;
    
    this.emit('dictionary:status', { status: 'loading', message: 'Подключаю словарь...' });
    
    const difficulty = this.settings.difficulty ?? 'medium';
    this.words = getGameWords('alias', difficulty, 100);
    this.dictionaryLoaded = true;
    
    this.emit('dictionary:status', { status: 'loaded', message: 'Словарь подключен!' });
    if (this._dictionaryStatusTimeout) {
      clearTimeout(this._dictionaryStatusTimeout);
      this._dictionaryStatusTimeout = null;
    }
    this._dictionaryStatusTimeout = setTimeout(() => {
      this._dictionaryStatusTimeout = null;
      if (!this._aborted) this.emit('dictionary:status', null);
    }, 3000);
  }

  start() {
    if (this._aborted) return;
    this.loadDictionary();
    this.phase = 'playing';
    this.nextTurn();
  }

  nextTurn() {
    if (this._aborted) return;
    if (this.timer) clearInterval(this.timer);

    const activeIds = new Set(
      (this.room?.players ?? [])
        .filter(p => !p.isSpectator && p.isOnline !== false)
        .map(p => p.id),
    );
    if (activeIds.size > 0) {
      this.players = this.players.filter(p => activeIds.has(p.id));
    }
    if (this.players.length === 0) {
      this.phase = 'finished';
      this.emit('game:ended', { winner: null, players: [], reason: 'no_players' });
      return;
    }
    if (this.currentPlayerIndex >= this.players.length) {
      this.currentPlayerIndex = 0;
    }

    const explainer = this.players[this.currentPlayerIndex];
    if (!explainer) {
      this.phase = 'finished';
      this.emit('game:ended', { winner: null, players: this.players, reason: 'no_explainer' });
      return;
    }

    let availableWords = this.words.filter(w => !this.usedWords.has(w));
    if (availableWords.length === 0) {
      this.usedWords.clear();
      availableWords = [...this.words];
    }
    this.currentWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    this.usedWords.add(this.currentWord);
    this.turnStartedAt = Date.now();

    this.timeLeft = this.settings.roundTime ?? 60;

    this.emit('turn:started', {
      explainerId: explainer.id,
      explainerName: explainer.name,
      timeLeft: this.timeLeft,
      round: this.round,
      maxRounds: this.maxRounds,
    });

    this.emit('word:pick', {
      playerId: explainer.id,
      word: this.currentWord,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) {
          this.emit('turn:timeout', { word: this.currentWord });
          this.advanceTurn();
        }
      }
    }, 1000);
  }

  handleChat(playerId, message) {
    if (this._aborted) return false;
    if (this.phase !== 'playing') return false;
    const explainer = this.players[this.currentPlayerIndex];
    if (!explainer || playerId === explainer.id) return false;

    const guess = message.trim().toLowerCase();
    if (!guess) return false;
    if (guess === this.currentWord.toLowerCase()) {
      this.stopTimer();
      const elapsed = (Date.now() - this.turnStartedAt) / 1000;
      const roundTime = this.settings.roundTime ?? 60;
      const speedBonus = roundTime > 0
        ? Math.min(this.speedBonusMax, Math.max(0, Math.floor((roundTime - elapsed) / roundTime * this.speedBonusMax)))
        : 0;
      const guesser = this.players.find(p => p.id === playerId);
      if (guesser) guesser.score += this.pointsGuesser + speedBonus;
      if (explainer) explainer.score += this.pointsExplainer;

      this.emit('word:guessed', {
        guesserId: playerId,
        guesserName: guesser?.name ?? 'Кто-то',
        word: this.currentWord,
      });
      this.emit('score:updated', {
        players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
      });

      this.advanceTurn();
      return true;
    }
    return false;
  }

  advanceTurn() {
    if (this._aborted) return;
    if (this.players.length === 0) {
      this.phase = 'finished';
      this.emit('game:ended', { winner: null, players: [], reason: 'no_players' });
      return;
    }
    const prevIndex = this.currentPlayerIndex;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    if (this.currentPlayerIndex <= prevIndex) {
      this.round += 1;
    }
    const nextPlayer = this.players[this.currentPlayerIndex];
    if (this.round > this.maxRounds) {
      this.phase = 'finished';
      this.emit('game:ended', {
        winner: [...this.players].sort((a, b) => b.score - a.score)[0] ?? null,
        players: this.players,
      });
      return;
    }
    this.emit('turn:transition', { nextPlayer, delay: 2000 });
    if (this._transitionTimer) clearTimeout(this._transitionTimer);
    this._transitionTimer = setTimeout(() => {
      this._transitionTimer = null;
      if (!this._aborted) this.nextTurn();
    }, 2000);
  }

  confirmGuess(explainerId, guesserId) {
    if (this._aborted) return false;
    if (this.phase !== 'playing') return false;
    const explainer = this.players[this.currentPlayerIndex];
    if (!explainer || explainer.id !== explainerId) return false;
    const guesser = this.players.find(p => p.id === guesserId);
    if (!guesser || guesser.id === explainerId) return false;
    return this.handleChat(guesserId, this.currentWord);
  }

  cleanup() {
    this._aborted = true;
    this.stopTimer();
    if (this._transitionTimer) {
      clearTimeout(this._transitionTimer);
      this._transitionTimer = null;
    }
    if (this._dictionaryStatusTimeout) {
      clearTimeout(this._dictionaryStatusTimeout);
      this._dictionaryStatusTimeout = null;
    }
    this.removeAllListeners();
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getState() {
    return {
      phase: this.phase,
      players: this.players,
      currentPlayerIndex: this.currentPlayerIndex,
      timeLeft: this.timeLeft,
      round: this.round,
      maxRounds: this.maxRounds,
    };
  }
}
