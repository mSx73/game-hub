import { EventEmitter } from 'events';
import { getRandomWords } from '../../utils/wordDictionary.js';

// Default word pairs - will be supplemented with dictionary
const WORD_PAIRS = [
  ['Слон', 'Ключ'],
  ['Луна', 'Зонтик'],
  ['Пианино', 'Крокодил'],
  ['Молоко', 'Космос'],
  ['Карандаш', 'Океан'],
  ['Подушка', 'Вулкан'],
  ['Ножницы', 'Радуга'],
  ['Часы', 'Бабочка'],
  ['Зеркало', 'Кактус'],
  ['Лампочка', 'Пингвин'],
  ['Чемодан', 'Дождь'],
  ['Кошка', 'Ракета'],
  ['Шоколад', 'Пустыня'],
  ['Телефон', 'Динозавр'],
  ['Ботинок', 'Звезда'],
  ['Магнит', 'Торт'],
  ['Снежинка', 'Гитара'],
  ['Лестница', 'Апельсин'],
  ['Компас', 'Мороженое'],
  ['Перо', 'Трактор'],
  ['Свеча', 'Медведь'],
  ['Книга', 'Самолёт'],
  ['Шляпа', 'Река'],
  ['Скрепка', 'Вечность'],
  ['Банан', 'Робот'],
  ['Паутина', 'Алмаз'],
  ['Облако', 'Скрипка'],
  ['Колесо', 'Сон'],
  ['Маяк', 'Муравей'],
  ['Якорь', 'Календарь'],
  ['Воздушный шар', 'Шахматы'],
  ['Замок', 'Ложка'],
];

export class ConnectEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 1;
    this.maxRounds = this.settings.maxRounds ?? 8;
    this.currentPair = null;
    this.answers = new Map();
    this.votes = new Map();
    this.usedPairs = new Set();
    this.answerTime = this.settings.answerTime ?? this.settings.creationTime ?? 60;
    this.voteTime = this.settings.votingTime ?? this.settings.voteTime ?? 30;
    this.pointsForWin = this.settings.pointsForWin ?? 2;
    this._answerIndex = [];
    this.dictionaryLoaded = false;
    this._aborted = false;
    this._roundDelayTimeout = null;
    this._dictionaryStatusTimeout = null;
  }

  loadDictionary() {
    if (this._aborted) return;
    if (this.dictionaryLoaded) return;
    
    this.emit('dictionary:status', { status: 'loading', message: 'Подключаю словарь...' });
    
    const words = getRandomWords(100, 'medium');
    const extraPairs = [];
    for (let i = 0; i < words.length - 1; i += 2) {
      const word1 = words[i].charAt(0).toUpperCase() + words[i].slice(1);
      const word2 = words[i + 1].charAt(0).toUpperCase() + words[i + 1].slice(1);
      extraPairs.push([word1, word2]);
    }
    this.wordPairs = [...WORD_PAIRS, ...extraPairs];
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
    this.round = 1;
    this.usedPairs.clear();
    this.nextRound();
  }

  nextRound() {
    if (this._aborted) return;
    this.stopTimer();
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }

    if (this.round > this.maxRounds) {
      this.endGame();
      return;
    }

    this.answers.clear();
    this.votes.clear();
    this._answerIndex = [];

    const bank = this.wordPairs || WORD_PAIRS;
    let availableIndices = bank.map((_, i) => i).filter((i) => !this.usedPairs.has(i));
    if (availableIndices.length === 0) {
      this.usedPairs.clear();
      availableIndices = bank.map((_, i) => i);
    }
    const idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedPairs.add(idx);
    this.currentPair = bank[idx];

    this.phase = 'answering';
    this.timeLeft = this.answerTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      word1: this.currentPair[0],
      word2: this.currentPair[1],
      timeLeft: this.timeLeft,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.startVoting();
      }
    }, 1000);
  }

  submitAnswer(playerId, text) {
    if (this._aborted) return false;
    if (this.phase !== 'answering') return false;
    if (this.answers.has(playerId)) return false;
    if (!this.players.find(p => p.id === playerId)) return false;

    const trimmed = (text ?? '').trim().slice(0, 300);
    if (trimmed.length === 0) return false;

    this.answers.set(playerId, trimmed);
    this.emit('answer:submitted', { playerId, total: this.answers.size, required: this.players.length });

    if (this.answers.size >= this.players.length) {
      this.stopTimer();
      if (!this._aborted) this.startVoting();
    }
    return true;
  }

  startVoting() {
    if (this._aborted) return;
    if (this.phase === 'voting') return;
    this.phase = 'voting';
    this.votes.clear();

    this._answerIndex = [];
    let idx = 0;
    for (const [playerId, text] of this.answers) {
      this._answerIndex.push({ idx, text, authorId: playerId });
      idx++;
    }
    this._answerIndex.sort(() => Math.random() - 0.5);
    this._answerIndex.forEach((a, i) => { a.idx = i; });

    this.timeLeft = this.voteTime;

    this.emit('voting:started', {
      word1: this.currentPair[0],
      word2: this.currentPair[1],
      answers: this._answerIndex.map(a => ({ idx: a.idx, text: a.text })),
      timeLeft: this.timeLeft,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.resolveRound();
      }
    }, 1000);
  }

  castVote(voterId, answerIdx) {
    if (this._aborted) return false;
    if (this.phase !== 'voting') return false;
    if (this.votes.has(voterId)) return false;
    if (!this.players.find(p => p.id === voterId)) return false;

    const target = this._answerIndex.find(a => a.idx === answerIdx);
    if (!target) return false;
    const voterEntry = this._answerIndex.find(a => a.authorId === voterId);
    if (voterEntry && voterEntry.idx === answerIdx) return false;

    this.votes.set(voterId, answerIdx);
    this.emit('vote:cast', { voterId, total: this.votes.size });

    const eligible = this.players.filter(p => this.answers.has(p.id)).length;
    const minVotes = eligible > 0 ? Math.floor(eligible / 2) + 1 : 1;
    if (this.votes.size >= eligible || this.votes.size >= minVotes) {
      this.stopTimer();
      if (!this._aborted) this.resolveRound();
    }
    return true;
  }

  resolveRound() {
    if (this._aborted) return;
    if (this.phase === 'results') return;
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.phase = 'results';

    const tally = new Map();
    for (const ansIdx of this.votes.values()) {
      tally.set(ansIdx, (tally.get(ansIdx) ?? 0) + 1);
    }

    let maxVotes = 0;
    const winners = [];
    for (const [aIdx, count] of tally) {
      if (count > maxVotes) {
        maxVotes = count;
        winners.length = 0;
        winners.push(aIdx);
      } else if (count === maxVotes) {
        winners.push(aIdx);
      }
    }
    const winnerIdx = winners.length === 1 ? winners[0] : (winners.length > 0 ? winners[Math.floor(Math.random() * winners.length)] : null);

    const nameById = new Map(this.players.map(p => [p.id, p.name]));
    const winnerEntry = winnerIdx !== null ? this._answerIndex.find(a => a.idx === winnerIdx) : null;
    if (winnerEntry) {
      const player = this.players.find(p => p.id === winnerEntry.authorId);
      if (player) player.score += this.pointsForWin;
    }

    this.emit('round:ended', {
      round: this.round,
      word1: this.currentPair[0],
      word2: this.currentPair[1],
      winner: winnerEntry ? {
        authorId: winnerEntry.authorId,
        authorName: nameById.get(winnerEntry.authorId) ?? '—',
        text: winnerEntry.text,
        votes: maxVotes,
      } : null,
      allAnswers: this._answerIndex.map(a => ({
        authorId: a.authorId,
        authorName: nameById.get(a.authorId) ?? '—',
        text: a.text,
        votes: tally.get(a.idx) ?? 0,
      })),
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
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    if (this._dictionaryStatusTimeout) {
      clearTimeout(this._dictionaryStatusTimeout);
      this._dictionaryStatusTimeout = null;
    }
    this.removeAllListeners();
  }

  getState() {
    return {
      phase: this.phase,
      players: this.players,
      round: this.round,
      maxRounds: this.maxRounds,
      timeLeft: this.timeLeft,
      currentPair: this.currentPair ? { word1: this.currentPair[0], word2: this.currentPair[1] } : null,
      answersCount: this.answers.size,
      votesCount: this.votes.size,
    };
  }
}
