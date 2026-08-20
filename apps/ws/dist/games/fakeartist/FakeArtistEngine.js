import { EventEmitter } from 'events';
import { getGameWords, getRandomWords } from '../../utils/wordDictionary.js';

export class FakeArtistEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.fakeArtistId = null;
    this.currentPair = null;
    this.hints = new Map();
    this.votes = new Map();
    this.hintOrder = [];
    this.hintIndex = 0;
    this.round = 0;
    this.maxRounds = this.settings.maxRounds ?? 6;
    this.hintTime = this.settings.hintTime ?? 20;
    this.usedPairs = new Set();
    this.dictionaryLoaded = false;
    this._aborted = false;
    this._dictionaryStatusTimeout = null;
    this._roundDelayTimeout = null;

    // Default pairs - will be supplemented with dictionary
    this.pairs = [
      { category: 'Животные', word: 'Крокодил' },
      { category: 'Животные', word: 'Пингвин' },
      { category: 'Животные', word: 'Жираф' },
      { category: 'Еда', word: 'Пельмени' },
      { category: 'Еда', word: 'Борщ' },
      { category: 'Еда', word: 'Шашлык' },
      { category: 'Еда', word: 'Блины' },
      { category: 'Транспорт', word: 'Троллейбус' },
      { category: 'Транспорт', word: 'Вертолёт' },
      { category: 'Транспорт', word: 'Подводная лодка' },
      { category: 'Профессии', word: 'Космонавт' },
      { category: 'Профессии', word: 'Пожарный' },
      { category: 'Профессии', word: 'Дирижёр' },
      { category: 'Спорт', word: 'Фигурное катание' },
      { category: 'Спорт', word: 'Бокс' },
      { category: 'Спорт', word: 'Шахматы' },
      { category: 'Города', word: 'Венеция' },
      { category: 'Города', word: 'Токио' },
      { category: 'Города', word: 'Москва' },
      { category: 'Природа', word: 'Вулкан' },
      { category: 'Природа', word: 'Водопад' },
      { category: 'Природа', word: 'Северное сияние' },
      { category: 'Музыка', word: 'Балалайка' },
      { category: 'Музыка', word: 'Барабан' },
      { category: 'Одежда', word: 'Валенки' },
      { category: 'Одежда', word: 'Шуба' },
      { category: 'Праздники', word: 'Новый год' },
      { category: 'Праздники', word: 'Масленица' },
      { category: 'Сказки', word: 'Баба Яга' },
      { category: 'Сказки', word: 'Кощей Бессмертный' },
      { category: 'Техника', word: 'Микроволновка' },
      { category: 'Техника', word: 'Пылесос' },
      { category: 'Напитки', word: 'Квас' },
      { category: 'Напитки', word: 'Компот' },
    ];
  }

  loadDictionary() {
    if (this.dictionaryLoaded) return;
    
    this.emit('dictionary:status', { status: 'loading', message: 'Подключаю словарь...' });
    
    // Supplement pairs with dictionary words
    const categories = ['Предметы', 'Животные', 'Еда', 'Профессии'];
    const words = getRandomWords(40, 'medium');
    
    words.forEach((word, i) => {
      const category = categories[i % categories.length];
      this.pairs.push({
        category,
        word: word.charAt(0).toUpperCase() + word.slice(1)
      });
    });
    
    this.dictionaryLoaded = true;
    
    this.emit('dictionary:status', { status: 'loaded', message: 'Словарь подключен!' });
    if (this._dictionaryStatusTimeout) clearTimeout(this._dictionaryStatusTimeout);
    this._dictionaryStatusTimeout = setTimeout(() => {
      this._dictionaryStatusTimeout = null;
      if (!this._aborted) this.emit('dictionary:status', null);
    }, 3000);
  }

  start() {
    if (this._aborted) return;
    this.loadDictionary();
    this.phase = 'playing';
    this.round = 0;
    this.nextRound();
  }

  nextRound() {
    if (this._aborted) return;
    this.stopTimer();
    this.round++;
    if (this.round > this.maxRounds) { this.endGame(); return; }

    this.hints.clear();
    this.votes.clear();
    this.hintIndex = 0;

    const fakeIdx = Math.floor(Math.random() * this.players.length);
    this.fakeArtistId = this.players[fakeIdx].id;

    let availableIndices = this.pairs.map((_, i) => i).filter((i) => !this.usedPairs.has(i));
    if (availableIndices.length === 0) {
      this.usedPairs.clear();
      availableIndices = this.pairs.map((_, i) => i);
    }
    const pairIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedPairs.add(pairIdx);
    this.currentPair = this.pairs[pairIdx];

    this.hintOrder = [...this.players].sort(() => Math.random() - 0.5);

    this.emit('game:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      players: this.players.map(p => ({
        id: p.id, name: p.name,
        role: p.id === this.fakeArtistId ? 'fakeartist' : 'artist',
        category: this.currentPair.category,
        word: p.id === this.fakeArtistId ? null : this.currentPair.word,
      })),
    });

    this.phase = 'hinting';
    this.promptNextHint();
  }

  promptNextHint() {
    if (this._aborted) return;
    if (this.hintIndex >= this.hintOrder.length) { this.startVoting(); return; }
    const current = this.hintOrder[this.hintIndex];
    this.timeLeft = this.hintTime;

    this.emit('hint:started', {
      playerId: current.id, playerName: current.name,
      hintNumber: this.hintIndex + 1, totalHints: this.hintOrder.length,
      timeLeft: this.timeLeft,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (this._aborted) return;
        this.hints.set(current.id, '—');
        this.emit('hint:submitted', { playerId: current.id, playerName: current.name, hint: '—' });
        this.hintIndex++;
        this.promptNextHint();
      }
    }, 1000);
  }

  submitHint(playerId, hint) {
    if (this._aborted) return false;
    if (this.phase !== 'hinting') return false;
    const current = this.hintOrder[this.hintIndex];
    if (!current || playerId !== current.id) return false;
    if (this.hints.has(playerId)) return false;

    this.stopTimer();
    const cleanHint = hint.trim().slice(0, 50) || '—';
    this.hints.set(playerId, cleanHint);
    this.emit('hint:submitted', { playerId, playerName: current.name, hint: cleanHint });
    this.hintIndex++;
    this.promptNextHint();
    return true;
  }

  startVoting() {
    if (this._aborted) return;
    this.stopTimer();
    this.phase = 'voting';
    this.votes.clear();

    const allHints = this.hintOrder.map(p => ({
      id: p.id, name: p.name, hint: this.hints.get(p.id) ?? '—',
    }));

    this.emit('voting:started', {
      hints: allHints,
      players: this.players.map(p => ({ id: p.id, name: p.name })),
      timeLeft: 30,
    });

    this.timeLeft = 30;
    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.resolveVotes();
      }
    }, 1000);
  }

  vote(voterId, targetId) {
    if (this._aborted) return false;
    if (this.phase !== 'voting') return false;
    if (voterId === targetId) return false;
    if (!this.players.find(p => p.id === voterId)) return false;
    if (!this.players.find(p => p.id === targetId)) return false;
    if (this.votes.has(voterId)) return false;

    this.votes.set(voterId, targetId);
    this.emit('vote:cast', { voterId, total: this.votes.size, required: this.players.length });
    if (this.votes.size >= this.players.length) { this.stopTimer(); this.resolveVotes(); }
    return true;
  }

  resolveVotes() {
    if (this._aborted) return;
    if (this.phase === 'guessing' || this.phase === 'finished') return;

    const tally = new Map();
    for (const targetId of this.votes.values()) {
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    }
    let maxVotes = 0;
    const tied = [];
    for (const [id, count] of tally) {
      if (count > maxVotes) {
        maxVotes = count;
        tied.length = 0;
        tied.push(id);
      } else if (count === maxVotes) {
        tied.push(id);
      }
    }
    const accused = tied.length > 0 ? tied[Math.floor(Math.random() * tied.length)] : null;

    const caught = accused === this.fakeArtistId;
    this.emit('voting:ended', {
      accused, accusedName: this.players.find(p => p.id === accused)?.name ?? '—',
      votes: maxVotes, caught,
      fakeArtistId: this.fakeArtistId,
      fakeArtistName: this.players.find(p => p.id === this.fakeArtistId)?.name ?? '—',
    });

    if (caught) {
      this.phase = 'guessing';
      this.emit('fakeartist:guess', { fakeArtistId: this.fakeArtistId, timeLeft: 15 });
      this.timeLeft = 15;
      this.timer = setInterval(() => {
        if (this._aborted) return;
        this.timeLeft--;
        this.emit('timer:tick', this.timeLeft);
        if (this.timeLeft <= 0) {
          this.stopTimer();
          if (!this._aborted) this.scoreRound(true, false);
        }
      }, 1000);
    } else {
      this.scoreRound(false, false);
    }
  }

  submitGuess(playerId, guess) {
    if (this._aborted) return false;
    if (this.phase !== 'guessing') return false;
    if (playerId !== this.fakeArtistId) return false;
    this.stopTimer();
    const correct = guess.trim().toLowerCase() === this.currentPair.word.toLowerCase();
    this.emit('fakeartist:guess', {
      fakeArtistId: this.fakeArtistId, guess, correct, actualWord: this.currentPair.word,
    });
    this.scoreRound(true, correct);
    return true;
  }

  scoreRound(wasCaught, guessedCorrectly) {
    if (this._aborted) return;
    if (this.phase === 'results') return;
    this.phase = 'results';
    if (wasCaught && !guessedCorrectly) {
      for (const p of this.players) { if (p.id !== this.fakeArtistId) p.score += 10; }
    } else {
      const fake = this.players.find(p => p.id === this.fakeArtistId);
      if (fake) fake.score += (guessedCorrectly ? 20 : 15);
    }
    this.emit('score:updated', {
      players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
    });
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    if (this.round >= this.maxRounds) {
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
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
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
      phase: this.phase, players: this.players,
      round: this.round, maxRounds: this.maxRounds,
      timeLeft: this.timeLeft,
      fakeArtistId: this.phase === 'finished' ? this.fakeArtistId : null,
      hintsCount: this.hints.size, votesCount: this.votes.size,
    };
  }
}
