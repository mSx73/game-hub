import { EventEmitter } from 'events';
import { getRandomWords } from '../../utils/wordDictionary.js';

// Hard words for bluff game - will be supplemented with dictionary
const RARE_WORDS = [
  { word: 'Амбивалентность', definition: 'Двойственность отношения к чему-либо, одновременное существование противоположных чувств' },
  { word: 'Обскурантизм', definition: 'Враждебное отношение к просвещению и науке, мракобесие' },
  { word: 'Палимпсест', definition: 'Рукопись на пергаменте поверх смытого или соскобленного текста' },
  { word: 'Сибарит', definition: 'Человек, живущий в роскоши и праздности, изнеженный' },
  { word: 'Эпигон', definition: 'Последователь какого-либо направления, лишённый оригинальности' },
  { word: 'Аберрация', definition: 'Отклонение от нормы, ошибка, заблуждение' },
  { word: 'Ретроград', definition: 'Противник прогресса, человек с отсталыми взглядами' },
  { word: 'Панацея', definition: 'Средство, якобы исцеляющее от всех болезней' },
  { word: 'Синекура', definition: 'Должность, дающая доход без обязательной работы' },
  { word: 'Ригоризм', definition: 'Чрезмерная строгость в соблюдении нравственных принципов' },
  { word: 'Апокриф', definition: 'Произведение с библейским сюжетом, не признанное церковью каноническим' },
  { word: 'Каллиграфия', definition: 'Искусство красивого и чёткого письма' },
  { word: 'Деструкция', definition: 'Разрушение, нарушение нормальной структуры чего-либо' },
  { word: 'Филистер', definition: 'Человек с узкими взглядами, живущий мещанскими интересами' },
  { word: 'Консеквентный', definition: 'Последовательный, логически закономерный' },
  { word: 'Одиозный', definition: 'Вызывающий крайне негативное отношение, ненавистный' },
  { word: 'Пертурбация', definition: 'Внезапное изменение, нарушение нормального хода событий' },
  { word: 'Эвфемизм', definition: 'Нейтральное слово, заменяющее грубое или непристойное выражение' },
  { word: 'Апломб', definition: 'Излишняя самоуверенность в поведении и речи' },
  { word: 'Бутафория', definition: 'Поддельные предметы, имитирующие настоящие' },
  { word: 'Инвектива', definition: 'Резкое обличительное выступление, оскорбительная речь' },
  { word: 'Казуистика', definition: 'Изворотливость в аргументации, умение обходить сложные вопросы' },
  { word: 'Обструкция', definition: 'Намеренный срыв чего-либо путём создания помех' },
  { word: 'Ремарка', definition: 'Замечание автора в тексте пьесы, поясняющее действие' },
  { word: 'Софизм', definition: 'Формально правильное, но ложное по сути умозаключение' },
  { word: 'Фрустрация', definition: 'Психическое состояние из-за невозможности достичь цели' },
  { word: 'Цейтнот', definition: 'Острый недостаток времени для выполнения задачи' },
];

export class BluffEngine extends EventEmitter {
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
    this.currentWord = null;
    this.definitions = new Map();
    this.votes = new Map();
    this.usedWords = new Set();
    this.definitionTime = this.settings.definitionTime ?? this.settings.writingTime ?? 60;
    this.voteTime = this.settings.voteTime ?? this.settings.votingTime ?? 30;
    this.pointsForCorrectGuess = this.settings.pointsForCorrectGuess ?? 2;
    this.pointsForFooling = this.settings.pointsForFooling ?? 3;
    this._allDefinitions = [];
    this.dictionaryLoaded = false;
    this._aborted = false;
    this._roundDelayTimeout = null;
    this._dictionaryStatusTimeout = null;
  }

  loadDictionary() {
    if (this._aborted) return;
    if (this.dictionaryLoaded) return;
    
    this.emit('dictionary:status', { status: 'loading', message: 'Подключаю словарь...' });
    
    const hardWords = getRandomWords(50, 'hard');
    const newWords = hardWords.map(word => ({
      word: word.charAt(0).toUpperCase() + word.slice(1),
      definition: 'Сложное слово из словаря'
    }));

    this.words = [...RARE_WORDS, ...newWords.slice(0, 20)];
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

    this.definitions.clear();
    this.votes.clear();
    this._allDefinitions = [];

    const wordBank = this.words || RARE_WORDS;
    let available = wordBank.filter(w => !this.usedWords.has(w.word));
    if (available.length === 0) {
      this.usedWords.clear();
      available = [...wordBank];
    }
    this.currentWord = available[Math.floor(Math.random() * available.length)];
    this.usedWords.add(this.currentWord.word);

    this.phase = 'writing';
    this.timeLeft = this.definitionTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      word: this.currentWord.word,
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

  submitDefinition(playerId, text) {
    if (this._aborted) return false;
    if (this.phase !== 'writing') return false;
    if (this.definitions.has(playerId)) return false;
    if (!this.players.find(p => p.id === playerId)) return false;

    const trimmed = (text ?? '').trim().slice(0, 300);
    if (trimmed.length === 0) return false;

    const wordLower = this.currentWord?.word?.toLowerCase() ?? '';
    if (wordLower && trimmed.toLowerCase().includes(wordLower)) return false;
    const wordParts = wordLower.split(/\s+/).filter(Boolean);
    if (wordParts.some(part => part.length >= 3 && trimmed.toLowerCase().includes(part))) return false;

    const realDefText = this.currentWord?.definition?.toLowerCase().trim();
    if (realDefText && trimmed.toLowerCase() === realDefText) return false;
    const existingTexts = [...this.definitions.values()];
    if (existingTexts.includes(trimmed)) return false;

    this.definitions.set(playerId, trimmed);
    this.emit('definition:submitted', { playerId, total: this.definitions.size, required: this.players.length });

    if (this.definitions.size >= this.players.length) {
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

    this._allDefinitions = [];
    let idx = 0;

    this._allDefinitions.push({ idx, text: this.currentWord.definition, authorId: '__real__' });
    idx++;

    for (const [playerId, text] of this.definitions) {
      this._allDefinitions.push({ idx, text, authorId: playerId });
      idx++;
    }

    this._allDefinitions.sort(() => Math.random() - 0.5);
    this._allDefinitions.forEach((d, i) => { d.idx = i; });

    this.timeLeft = this.voteTime;
    this.emit('voting:started', {
      word: this.currentWord.word,
      definitions: this._allDefinitions.map(d => ({ idx: d.idx, text: d.text })),
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

  castVote(voterId, defIdx) {
    if (this._aborted) return false;
    if (this.phase !== 'voting') return false;
    if (this.votes.has(voterId)) return false;
    if (!this.players.find(p => p.id === voterId)) return false;

    const target = this._allDefinitions.find(d => d.idx === defIdx);
    if (!target) return false;
    const playerDef = this._allDefinitions.find(d => d.authorId === voterId);
    if (playerDef && playerDef.idx === defIdx) return false;

    this.votes.set(voterId, defIdx);
    this.emit('vote:cast', { voterId, total: this.votes.size });

    const submitters = this.players.filter(p => this.definitions.has(p.id));
    const allSubmittersVoted = submitters.length > 0 && submitters.every(p => this.votes.has(p.id));
    if (allSubmittersVoted) {
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

    const playerById = new Map(this.players.map(p => [p.id, p]));
    const realDef = this._allDefinitions.find(d => d.authorId === '__real__');
    const realIdx = realDef ? realDef.idx : -1;

    const fooledBy = new Map();
    let correctVoters = [];

    for (const [voterId, defIdx] of this.votes) {
      if (defIdx === realIdx) {
        const p = playerById.get(voterId);
        if (p) {
          p.score += this.pointsForCorrectGuess;
          correctVoters.push(voterId);
        }
      } else {
        const fakeAuthor = this._allDefinitions.find(d => d.idx === defIdx);
        if (fakeAuthor && fakeAuthor.authorId !== '__real__') {
          fooledBy.set(fakeAuthor.authorId, (fooledBy.get(fakeAuthor.authorId) ?? 0) + 1);
        }
      }
    }

    for (const [authorId, count] of fooledBy) {
      const p = playerById.get(authorId);
      if (p) p.score += count * this.pointsForFooling;
    }

    const allFooledBonus = this.settings.allFooledBonus ?? this.settings.nobodyGuessedBonus ?? 1;
    if (correctVoters.length === 0 && fooledBy.size > 0) {
      for (const [authorId] of fooledBy) {
        const p = playerById.get(authorId);
        if (p) p.score += allFooledBonus;
      }
    }

    const results = this.players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      votedCorrectly: correctVoters.includes(p.id),
      fooledCount: fooledBy.get(p.id) ?? 0,
    }));

    this.emit('round:ended', {
      round: this.round,
      word: this.currentWord.word,
      realDefinition: this.currentWord.definition,
      realIdx,
      results,
    });
    this.emit('score:updated', {
      players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
    });

    this.round++;
    if (this.round > this.maxRounds) {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.endGame();
      }, 4000);
    } else {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.nextRound();
      }, 4000);
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
      currentWord: this.currentWord ? this.currentWord.word : null,
      definitionsCount: this.definitions.size,
      votesCount: this.votes.size,
    };
  }
}
