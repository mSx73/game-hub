import { getGameWords } from '../../utils/wordDictionary.js';
import { BaseGame } from '../../core/BaseGame.js';

export class CrocodileEngine extends BaseGame {
  constructor(room) {
    super(room);
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

    const gt = room.gameType;
    if (gt === 'crocodile-nouns') {
      this.crocodileWordBank = 'nouns';
    } else if (gt === 'crocodile-verbs') {
      this.crocodileWordBank = 'verbs';
    } else {
      const rawBank = this.settings.crocodileWordBank;
      this.crocodileWordBank = ['verbs', 'nouns', 'mixed'].includes(rawBank) ? rawBank : 'verbs';
    }
    this.words = getGameWords('crocodile', this.settings.difficulty ?? 'medium', 200, {
      wordBank: this.crocodileWordBank,
    });
    this.wordChoices = []; // Stores 3 word options for current turn
    this.pointsFirst = this.settings.pointsFirst ?? 3;
    this.pointsDrawer = this.settings.pointsDrawer ?? 2;
    this.pointsOtherGuessers = this.settings.pointsOtherGuessers ?? 1;
    this.emptyCanvasPenalty = this.settings.emptyCanvasPenalty ?? 1;
    this.penaltyOnNoGuesses = this.settings.penaltyOnNoGuesses === true;
    this.hasDrawnThisTurn = false;
    this.correctGuessers = [];
    this.guessWindowTimer = null;
    this._transitionTimer = null;
    this._selectionTimer = null;
    this.selectionTimeoutSec = this.settings.selectionTimeoutSec ?? 15;
    this._aborted = false;
  }

  recordDraw() {
    this.hasDrawnThisTurn = true;
  }

  start() {
    if (this._aborted) return;
    this.phase = 'playing';
    this.nextTurn();
  }

  nextTurn() {
    if (this._aborted) return;
    if (this.timer) clearInterval(this.timer);
    if (this.guessWindowTimer) {
      this.clearManagedTimeout(this.guessWindowTimer);
      this.guessWindowTimer = null;
    }
    if (this._selectionTimer) {
      this.clearManagedTimeout(this._selectionTimer);
      this._selectionTimer = null;
    }
    this.hasDrawnThisTurn = false;
    this.correctGuessers = [];

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
    if (availableWords.length < 3) {
      this.usedWords.clear();
      availableWords = [...this.words];
    }

    // Fisher-Yates shuffle, take first 3
    const pool = [...availableWords];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.wordChoices = pool.slice(0, 3);
    this.currentWord = '';

    this.timeLeft = this.settings.roundTime ?? 90;

    this.emit('word:choices', {
      playerId: explainer.id,
      choices: this.wordChoices,
      timeLeft: this.timeLeft,
      selectionTimeoutSec: this.selectionTimeoutSec,
    });

    this._selectionTimer = this.registerTimeout(() => {
      this._selectionTimer = null;
      if (this._aborted || this.currentWord) return;
      const idx = Math.floor(Math.random() * this.wordChoices.length);
      this.selectWord(explainer.id, idx);
    }, this.selectionTimeoutSec * 1000);
  }

  /**
   * @returns {{ ok: true } | { ok: false, code: string }}
   */
  selectWord(playerId, wordIndex) {
    const explainer = this.players[this.currentPlayerIndex];
    if (!explainer || explainer.id !== playerId) {
      return { ok: false, code: 'not_explainer' };
    }
    const idx = Number(wordIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= this.wordChoices.length) {
      return { ok: false, code: 'bad_index' };
    }
    if (this.currentWord) {
      return { ok: false, code: 'already_chosen' };
    }

    if (this._selectionTimer) {
      this.clearManagedTimeout(this._selectionTimer);
      this._selectionTimer = null;
    }

    this.currentWord = this.wordChoices[idx];
    this.usedWords.add(this.currentWord);

    this.emit('turn:started', {
      explainerId: explainer.id,
      explainerName: explainer.name,
      word: this.currentWord,
      timeLeft: this.timeLeft,
      round: this.round,
      maxRounds: this.maxRounds,
    });

    this.emit('word:pick', {
      playerId: explainer.id,
      word: this.currentWord
    });

    this.startTimer();
    return { ok: true };
  }

  startTimer() {
    this.timer = this.registerInterval(() => {
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (this._aborted) return;
        this.emit('turn:timeout', { word: this.currentWord });
        const drawer = this.players[this.currentPlayerIndex];
        const applyPenalty = !this.hasDrawnThisTurn || (this.penaltyOnNoGuesses && this.correctGuessers.length === 0);
        if (applyPenalty && drawer && this.emptyCanvasPenalty > 0) {
          drawer.score = Math.max(0, drawer.score - this.emptyCanvasPenalty);
          this.emit('empty:canvas:penalty', { playerId: drawer.id, penalty: this.emptyCanvasPenalty });
        }
        this.emit('score:updated', { players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })) });
        this.advanceTurn();
      }
    }, 1000);
  }

  handleChat(playerId, message) {
    if (this._aborted) return false;
    if (this.phase !== 'playing') return false;
    if (!this.currentWord) return false;
    const drawer = this.players[this.currentPlayerIndex];
    if (!drawer || playerId === drawer.id) return false;

    const normalize = (s) => (s || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
    const guess = normalize(message);
    if (!guess) return false;
    const target = normalize(this.currentWord);
    if (!target || guess !== target) return false;
    if (this.correctGuessers.some((g) => g.id === playerId)) return false;

    const guesser = this.players.find((p) => p.id === playerId);
    this.correctGuessers.push({
      id: playerId,
      name: guesser?.name ?? 'Кто-то',
      ts: Date.now(),
      seq: this.correctGuessers.length,
    });

    this.emit('word:guessed', {
      guesserId: playerId,
      guesserName: guesser?.name ?? 'Кто-то',
      word: this.currentWord,
      totalGuessers: this.correctGuessers.length,
    });

    if (this.correctGuessers.length === 1) {
      this.stopTimer();
      this.guessWindowTimer = this.registerTimeout(() => {
        this.guessWindowTimer = null;
        if (this._aborted) return;
        this.resolveGuessers();
        this.advanceTurn();
      }, 800);
    }
    return true;
  }

  // Рисующий нажал «✓ {имя}» в правой колонке (когда люди угадывают вслух
  // по голосовому чату, а не в тексте). Логика общая с handleChat — те же
  // correctGuessers / guess-window / resolveGuessers — чтобы очки начислялись
  // одинаково независимо от пути подтверждения.
  // Возвращает { ok: true } или { ok: false, code: '...' } для handler-маппинга.
  manualConfirmGuess(explainerId, guesserId) {
    if (this._aborted) return { ok: false, code: 'aborted' };
    if (this.phase !== 'playing') return { ok: false, code: 'not_playing' };
    if (!this.currentWord) return { ok: false, code: 'no_word' };
    const drawer = this.players[this.currentPlayerIndex];
    if (!drawer || drawer.id !== explainerId) {
      return { ok: false, code: 'not_explainer' };
    }
    if (guesserId === explainerId) {
      return { ok: false, code: 'self_guess' };
    }
    const guesser = this.players.find((p) => p.id === guesserId);
    if (!guesser) return { ok: false, code: 'guesser_not_found' };
    if (this.correctGuessers.some((g) => g.id === guesserId)) {
      return { ok: false, code: 'already_guessed' };
    }

    this.correctGuessers.push({
      id: guesserId,
      name: guesser.name ?? 'Кто-то',
      ts: Date.now(),
      seq: this.correctGuessers.length,
    });

    this.emit('word:guessed', {
      guesserId,
      guesserName: guesser.name ?? 'Кто-то',
      word: this.currentWord,
      totalGuessers: this.correctGuessers.length,
    });

    if (this.correctGuessers.length === 1) {
      this.stopTimer();
      this.guessWindowTimer = this.registerTimeout(() => {
        this.guessWindowTimer = null;
        if (this._aborted) return;
        this.resolveGuessers();
        this.advanceTurn();
      }, 800);
    }
    return { ok: true };
  }

  resolveGuessers() {
    if (this._aborted) return;
    const playerById = new Map(this.players.map((p) => [p.id, p]));
    const drawer = this.players[this.currentPlayerIndex];
    const sorted = [...this.correctGuessers].sort((a, b) => a.ts - b.ts || a.seq - b.seq);
    if (sorted.length > 0) {
      const first = playerById.get(sorted[0].id);
      if (first) first.score += this.pointsFirst;
      if (drawer) drawer.score += this.pointsDrawer;
      for (let i = 1; i < sorted.length; i++) {
        const p = playerById.get(sorted[i].id);
        if (p) p.score += this.pointsOtherGuessers;
      }
    }
    this.emit('score:updated', { players: this.players.map((p) => ({ id: p.id, name: p.name, score: p.score })) });
  }

  advanceTurn() {
    if (this._aborted) return;
    if (this.players.length === 0) {
      this.phase = 'finished';
      this.emit('game:ended', { winner: null, players: [], reason: 'no_players' });
      return;
    }
    // Close the guess window: any chat after this point won't be treated as a guess
    this.currentWord = '';

    const prevIndex = this.currentPlayerIndex;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    if (this.currentPlayerIndex <= prevIndex) {
      this.round += 1;
    }
    if (this.round > this.maxRounds) {
      this.phase = 'finished';
      this.emit('game:ended', {
        winner: [...this.players].sort((a, b) => b.score - a.score)[0] ?? null,
        players: this.players,
      });
      return;
    }
    const nextPlayer = this.players[this.currentPlayerIndex];
    this.emit('turn:transition', { nextPlayer, delay: 2000 });
    if (this._transitionTimer) this.clearManagedTimeout(this._transitionTimer);
    this._transitionTimer = this.registerTimeout(() => {
      this._transitionTimer = null;
      if (!this._aborted) this.nextTurn();
    }, 2000);
  }

  cleanup() {
    this._aborted = true;
    this.stopTimer();
    if (this._transitionTimer) {
      this.clearManagedTimeout(this._transitionTimer);
      this._transitionTimer = null;
    }
    if (this._selectionTimer) {
      this.clearManagedTimeout(this._selectionTimer);
      this._selectionTimer = null;
    }
    super.cleanup();
  }

  stopTimer() {
    if (this.timer) {
      this.clearManagedInterval(this.timer);
      this.timer = null;
    }
    if (this.guessWindowTimer) {
      this.clearManagedTimeout(this.guessWindowTimer);
      this.guessWindowTimer = null;
    }
  }

  getState() {
    return {
      phase: this.phase,
      players: this.players,
      currentPlayerIndex: this.currentPlayerIndex,
      timeLeft: this.timeLeft
    };
  }
}
