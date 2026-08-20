import { EventEmitter } from 'events';
import { getGameWords, generatePhraseForExplanation } from '../../utils/wordDictionary.js';

const MIN_DICTIONARY_WORDS = 10;

export class HatEngine extends EventEmitter {
  constructor(room) {
    super();
    this.words = [];
    this.teams = new Map();
    this.currentTeam = 0;
    this.currentExplainer = '';
    this.currentWord = null;
    this.roundScore = 0;
    this.currentRound = 1;
    this.roundTimer = null;
    this.room = room;
    this.settings = room.settings ?? {};
    this.roundTime = Number(this.settings.roundTime) > 0 ? Number(this.settings.roundTime) : 60;
    this.pointsToWin = this.settings.pointsToWin ?? null;
    this.skipPenalty = this.settings.skipPenalty === true ? -1 : 0;
    this.difficulty = this.settings.difficulty ?? 'medium';
    this.wordsPerRound = Math.min(20, Math.max(10, this.settings.wordsPerRound ?? 15));
    this.wordSource = this.settings.wordSource ?? 'players';
    this._aborted = false;
    this._dictionaryStatusTimeout = null;
    this._roundDelayTimeout = null;
    /** Счётчик хода внутри одного таймерного раунда: после каждого слова объясняет следующий из команды */
    this._explainTurnIndex = 0;
    this.setupTeams();
  }
    start() {
    if (this._aborted) return;
    if (this.wordSource === 'dictionary') {
      const count = this.wordsPerRound;
      // Use dictionary with status notification
      this.emit('dictionary:status', { status: 'loading', message: 'Подключаю словарь...' });
      
      const words = getGameWords('hat', this.difficulty, count);
      
      words.forEach((text) => {
        this.words.push({ text, guessed: false, skipped: false, author: null });
      });
      
      this.emit('dictionary:status', { status: 'loaded', message: 'Словарь подключен!' });
      if (this._dictionaryStatusTimeout) {
        clearTimeout(this._dictionaryStatusTimeout);
        this._dictionaryStatusTimeout = null;
      }
      this._dictionaryStatusTimeout = setTimeout(() => {
        this._dictionaryStatusTimeout = null;
        if (!this._aborted) this.emit('dictionary:status', null);
      }, 3000);

      this.emit('words:complete', this.words.length);
      if (this._roundDelayTimeout) {
        clearTimeout(this._roundDelayTimeout);
        this._roundDelayTimeout = null;
      }
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.startRound();
      }, 2000);
    } else {
      // Слова от игроков: не путать с wordsPerRound (10–20) — в UI и в HatGame по умолчанию 3 слова на игрока.
      const required = Math.min(20, Math.max(3, this.settings.wordsPerPlayer ?? 3));
      this.emit('phase:changed', { phase: 'collecting-words', requiredWordsPerPlayer: required });
    }
  }

  setupTeams() {
    const players = this.room.players.filter((p) => !p.isSpectator);
    const mid = Math.ceil(players.length / 2);
    const team0 = players.slice(0, mid).map((p) => ({ id: p.id, name: p.name, score: 0 }));
    const team1 = players.slice(mid).map((p) => ({ id: p.id, name: p.name, score: 0 }));
    this.teams.set(0, team0);
    this.teams.set(1, team1);
  }

  /** Имя текущего объясняющего в активной команде */
  _explainerDisplayName() {
    const teamPlayers = this.teams.get(this.currentTeam) ?? [];
    return teamPlayers.find((p) => p.id === this.currentExplainer)?.name ?? '';
  }

  _activeTeamPlayers() {
    return (this.teams.get(this.currentTeam) ?? []).filter(
      (p) => this.room.players.find((r) => r.id === p.id)?.isOnline !== false
    );
  }

  /** Кто может угадать (команда хода без текущего объясняющего) — для кнопки «Угадали» */
  _guessCandidates() {
    return this._activeTeamPlayers()
      .filter((p) => p.id !== this.currentExplainer)
      .map((p) => ({ id: p.id, name: p.name }));
  }

  _setExplainerFromTurnIndex(teamPlayers) {
    if (!teamPlayers.length) {
      this.currentExplainer = '';
      return;
    }
    const i = this._explainTurnIndex % teamPlayers.length;
    this.currentExplainer = teamPlayers[i]?.id ?? '';
  }

  _emitWordNewPayload(wordText) {
    const explainerName = this._explainerDisplayName();
    this.emit('word:new', {
      explainer: this.currentExplainer,
      explainerName,
      word: wordText,
      guessCandidates: this._guessCandidates(),
    });
  }

  /** Снимок счёта для клиентов: личные очки, суммы по командам, чей ход */
  _buildScoreboardPayload() {
    const teams = [0, 1].map((teamId) => {
      const raw = this.teams.get(teamId) ?? [];
      const players = raw.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
      }));
      const teamTotal = players.reduce((s, p) => s + p.score, 0);
      return { teamId, players, teamTotal };
    });
    return {
      teams,
      currentTeam: this.currentTeam,
      roundScore: this.roundScore,
      gameRound: this.currentRound,
      pointsToWin: this.pointsToWin != null ? this.pointsToWin : undefined,
      skipPenaltyActive: this.skipPenalty !== 0,
    };
  }

  _emitScoreboard() {
    if (this._aborted) return;
    this.emit('scores:update', this._buildScoreboardPayload());
  }

  /** Общая логика после верного угадания (чат или вручную) */
  _afterCorrectGuess(guesserId) {
    const teamPlayers = this.teams.get(this.currentTeam) ?? [];
    const guesser = teamPlayers.find((p) => p.id === guesserId);
    const explainer = teamPlayers.find((p) => p.id === this.currentExplainer);
    if (guesser) guesser.score += 1;
    if (explainer) explainer.score += 1;
    if (this.pointsToWin != null) {
      const teamScore = (this.teams.get(this.currentTeam) ?? []).reduce((s, p) => s + p.score, 0);
      if (teamScore >= this.pointsToWin) {
        if (this.roundTimer) {
          clearInterval(this.roundTimer);
          this.roundTimer = null;
        }
        this._emitScoreboard();
        this.endGame();
        return true;
      }
    }
    this.emit('word:guessed', {
      guesserId,
      guesserName: guesser?.name ?? '—',
      word: this.currentWord.text,
      roundScore: this.roundScore,
    });
    this._emitScoreboard();
    const available = this.words.filter((w) => !w.guessed && !w.skipped);
    if (available.length === 0) {
      if (this.roundTimer) {
        clearInterval(this.roundTimer);
        this.roundTimer = null;
      }
      this.endRound();
    } else {
      const tp = this._activeTeamPlayers();
      this._explainTurnIndex = (this._explainTurnIndex + 1) % Math.max(1, tp.length);
      this._setExplainerFromTurnIndex(tp);
      this.currentWord = available[Math.floor(Math.random() * available.length)];
      this._emitWordNewPayload(this.currentWord.text);
    }
    return false;
  }

  /** Объясняющий засчитывает угадывание напрямую (без точного совпадения в чате) */
  confirmManualGuess(explainerSocketId, guesserId) {
    if (this._aborted || !this.currentWord) return { ok: false, error: 'Нет активного слова' };
    if (explainerSocketId !== this.currentExplainer) return { ok: false, error: 'Только объясняющий может засчитать угадывание' };
    if (guesserId === this.currentExplainer) return { ok: false, error: 'Нельзя засчитать себя' };
    const teamPlayers = this._activeTeamPlayers();
    if (!teamPlayers.some((p) => p.id === guesserId)) return { ok: false, error: 'Засчитывайте игрока из своей команды' };
    this.currentWord.guessed = true;
    this.roundScore++;
    const ended = this._afterCorrectGuess(guesserId);
    return { ok: true, gameEnded: ended };
  }
  addWords(playerId, words) {
    if (this._aborted) return { ok: false, error: 'Игра остановлена' };
    const required = Math.min(20, Math.max(3, this.settings.wordsPerPlayer ?? 3));
    // Допускаем буквы любого алфавита (Unicode), цифры, пробелы и дефисы — старый [а-яёa-z] отбрасывал нормальные слова.
    const wordOk = (w) =>
      w.length >= 2 &&
      w.length <= 30 &&
      /^[\p{L}\p{M}\p{N}\s\p{Pd}]+$/u.test(w) &&
      /[\p{L}\p{N}]/u.test(w);
    const filtered = (Array.isArray(words) ? words : [])
      .map((w) => (typeof w === 'string' ? w.trim() : ''))
      .filter((w) => wordOk(w));
    const seen = new Set();
    const normalized = [];
    for (const w of filtered) {
      const key = w.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(w);
      if (normalized.length >= required) break;
    }
    if (normalized.length < required) {
      return {
        ok: false,
        error: `Нужно ${required} разных слова по 2–30 символов (кириллица или латиница, пробел, дефис). Сейчас подошло: ${normalized.length}.`,
      };
    }
    const alreadyAdded = this.words.some((w) => w.author === playerId);
    if (alreadyAdded) return { ok: false, error: 'Вы уже отправили слова' };
    normalized.forEach((text) => {
      this.words.push({ text, guessed: false, skipped: false, author: playerId });
    });
    this.emit('words:added', { playerId, count: normalized.length });
    const allSubmitted = this.room.players
      .filter((p) => !p.isSpectator)
      .every((p) => this.words.filter((w) => w.author === p.id).length >= required);
    if (allSubmitted && this.words.length >= 4) {
      this.emit('words:complete', this.words.length);
      if (this._roundDelayTimeout) {
        clearTimeout(this._roundDelayTimeout);
        this._roundDelayTimeout = null;
      }
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.startRound();
      }, 2000);
    }
    return { ok: true };
  }
  startRound() {
    if (this._aborted) return;
    const teamPlayers = (this.teams.get(this.currentTeam) ?? []).filter(
      (p) => this.room.players.find((r) => r.id === p.id)?.isOnline !== false
    );
    if (teamPlayers.length === 0) {
      this.endGame();
      return;
    }
    this._explainTurnIndex = 0;
    this._setExplainerFromTurnIndex(teamPlayers);
    this.roundScore = 0;
    const available = this.words.filter((w) => !w.guessed && !w.skipped);
    if (available.length === 0) {
      this.endRound();
      return;
    }
    this.currentWord = available[Math.floor(Math.random() * available.length)];
    const explainerName = teamPlayers.find((p) => p.id === this.currentExplainer)?.name ?? '';
    this.emit('round:started', {
      explainer: this.currentExplainer,
      explainerName,
      word: this.currentWord.text,
      team: this.currentTeam,
      timeLeft: this.roundTime,
      guessCandidates: this._guessCandidates(),
    });
    this._emitWordNewPayload(this.currentWord.text);
    let timeLeft = this.roundTime;
    this.roundTimer = setInterval(() => {
      if (this._aborted) return;
      timeLeft--;
      this.emit('timer:tick', timeLeft);
      if (timeLeft <= 0) {
        if (this.roundTimer) {
          clearInterval(this.roundTimer);
          this.roundTimer = null;
        }
        if (!this._aborted) this.endRound();
      }
    }, 1000);
    this._emitScoreboard();
  }
  guessWord(guesserId, guess) {
    if (!this.currentWord) return false;
    if (guesserId === this.currentExplainer) return false;
    const normalize = (s) => (s || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
    const normalized = normalize(guess);
    const target = normalize(this.currentWord.text);
    if (normalized !== target) return false;
    this.currentWord.guessed = true;
    this.roundScore++;
    this._afterCorrectGuess(guesserId);
    return true;
  }
  handleChat(playerId, message) {
    return this.guessWord(playerId, message);
  }

  skipWord() {
    if (!this.currentWord) return;
    this.currentWord.skipped = true;
    if (this.skipPenalty !== 0) {
      const teamPlayers = this.teams.get(this.currentTeam) ?? [];
      teamPlayers.forEach((p) => { p.score = Math.max(0, p.score + this.skipPenalty); });
      this.emit('score:updated', { team: this.currentTeam, penalty: this.skipPenalty });
    }
    this.emit('word:skipped', this.currentWord.text);
    this._emitScoreboard();
    const available = this.words.filter((w) => !w.guessed && !w.skipped);
    if (available.length > 0) {
      const tp = this._activeTeamPlayers();
      this._explainTurnIndex = (this._explainTurnIndex + 1) % Math.max(1, tp.length);
      this._setExplainerFromTurnIndex(tp);
      this.currentWord = available[Math.floor(Math.random() * available.length)];
      this._emitWordNewPayload(this.currentWord.text);
    } else {
      if (this.roundTimer) {
        clearInterval(this.roundTimer);
        this.roundTimer = null;
      }
      this.endRound();
    }
  }
  endRound() {
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
    const teamPlayers = this.teams.get(this.currentTeam) ?? [];
    const totalScore = teamPlayers.reduce((sum, p) => sum + p.score, 0);
    this._emitScoreboard();
    this.emit('round:ended', {
      team: this.currentTeam,
      score: this.roundScore,
      totalScore,
    });
    this.currentTeam = (this.currentTeam + 1) % this.teams.size;
    if (this.currentTeam === 0) {
      this.currentRound++;
    }
    const allWordsDone = this.words.every((w) => w.guessed || w.skipped);
    const maxRounds = 3;
    if (allWordsDone || this.currentRound > maxRounds) {
      this.endGame();
    } else if (!this._aborted) {
      if (this._roundDelayTimeout) {
        clearTimeout(this._roundDelayTimeout);
        this._roundDelayTimeout = null;
      }
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.startRound();
      }, 5000);
    }
  }
  checkGameEnd() {
    const allWordsDone = this.words.every((w) => w.guessed || w.skipped);
    const maxRounds = 3;
    if (allWordsDone || this.currentRound > maxRounds) {
      this.endGame();
    }
  }
  endGame() {
    if (this._aborted) return;
    if (this._dictionaryStatusTimeout) {
      clearTimeout(this._dictionaryStatusTimeout);
      this._dictionaryStatusTimeout = null;
    }
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
    const results = Array.from(this.teams.entries()).map(([id, players]) => ({
      teamId: id,
      players: players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
      score: players.reduce((sum, p) => sum + p.score, 0),
    }));
    results.sort((a, b) => b.score - a.score);
    this.emit('game:ended', {
      winner: results[0],
      results,
    });
  }
  handlePlayerDisconnect(playerId) {
    if (this.currentExplainer === playerId) {
      if (this.roundTimer) { clearInterval(this.roundTimer); this.roundTimer = null; }
      this.currentWord && (this.currentWord.skipped = true);
      this.emit('player:disconnected', { playerId, wasExplainer: true });
      this.endRound();
    }
  }

  stopTimer() {
    if (this.roundTimer) {
      clearInterval(this.roundTimer);
      this.roundTimer = null;
    }
  }

  cleanup() {
    this._aborted = true;
    this.stopTimer();
    if (this._dictionaryStatusTimeout) {
      clearTimeout(this._dictionaryStatusTimeout);
      this._dictionaryStatusTimeout = null;
    }
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.removeAllListeners();
  }

  getState() {
    return {
      words: this.words,
      teams: Array.from(this.teams.entries()),
      currentTeam: this.currentTeam,
      currentExplainer: this.currentExplainer,
      currentWord: this.currentWord,
      currentRound: this.currentRound,
      roundScore: this.roundScore,
      pointsToWin: this.pointsToWin,
      skipPenalty: this.skipPenalty,
    };
  }
}
