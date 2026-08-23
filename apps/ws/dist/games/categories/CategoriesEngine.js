import { EventEmitter } from 'events';
import { RUSSIAN_NOUNS, getRandomWords } from '../../utils/wordDictionary.js';

export class CategoriesEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 0;
    this.maxRounds = this.settings.maxRounds ?? 8;
    this.roundTime = this.settings.fillTime ?? this.settings.roundTime ?? 60;
    this.pointsForValid = this.settings.pointsForValid ?? 1;
    this.uniquenessBonus = this.settings.uniquenessBonus ?? 2;
    this.speedBonus = this.settings.speedBonus ?? 3;
    this.submissionTimes = new Map();
    this.completionTimes = new Map();
    this.currentLetter = null;
    this.currentCategories = null;
    this.playerAnswers = new Map();
    this.completedPlayers = new Set();
    this.usedLetters = new Set();
    this.usedCategories = new Set();
    this.dictionaryLoaded = false;
    this._aborted = false;
    this._roundDelayTimeout = null;
    this._dictionaryStatusTimeout = null;

    this.categoryPool = [
      'Город', 'Животное', 'Еда', 'Имя', 'Профессия',
      'Страна', 'Растение', 'Река', 'Фильм', 'Писатель',
      'Марка автомобиля', 'Спорт', 'Напиток', 'Одежда', 'Музыкант',
      'Птица', 'Цветок', 'Сладость', 'Инструмент', 'Мебель',
    ];

    this.letters = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'З', 'И', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ш'];
  }

  loadDictionary() {
    if (this._aborted) return;
    if (this.dictionaryLoaded) return;
    
    this.emit('dictionary:status', { status: 'loading', message: 'Подключаю словарь...' });
    
    // Enhance categories with dictionary words for validation
    this.validWords = {
      'Город': getRandomWords(100, 'medium').filter(w => w.length >= 3),
      'Животное': ['кот', 'собака', 'корова', 'лошадь', 'овца', 'коза', 'свинья', 'курица', 'утка', 'гусь', 'кролик', 'хомяк', 'морская свинка', 'попугай', 'канарейка', 'рыбка', 'черепаха', 'ящерица', 'змея', 'лягушка', 'жаба', 'берёза', 'дуб', 'сосна', 'ель', 'липа', 'клён', 'ясень', 'рябина', 'сирень', 'лилия', 'роза', 'ромашка', 'одуванчик', 'подсолнух', 'тюльпан', 'гвоздика', 'орхидея', 'кактус', 'алоэ', 'фикус'],
      'Еда': getRandomWords(80, 'easy').filter(w => w.length >= 3),
      'Имя': ['Александр', 'Алексей', 'Андрей', 'Антон', 'Аркадий', 'Артём', 'Борис', 'Вадим', 'Валентин', 'Валерий', 'Василий', 'Виктор', 'Виталий', 'Владимир', 'Владислав', 'Вячеслав', 'Геннадий', 'Георгий', 'Григорий', 'Даниил', 'Денис', 'Дмитрий', 'Евгений', 'Егор', 'Иван', 'Игорь', 'Илья', 'Кирилл', 'Константин', 'Лев', 'Леонид', 'Максим', 'Михаил', 'Никита', 'Николай', 'Олег', 'Павел', 'Пётр', 'Роман', 'Руслан', 'Сергей', 'Семён', 'Станислав', 'Степан', 'Тимофей', 'Фёдор', 'Эдуард', 'Юрий', 'Ярослав', 'Александра', 'Алина', 'Алиса', 'Алла', 'Анастасия', 'Ангелина', 'Анна', 'Антонина', 'Валентина', 'Валерия', 'Варвара', 'Василиса', 'Вера', 'Вероника', 'Виктория', 'Галина', 'Дарья', 'Диана', 'Ева', 'Евгения', 'Екатерина', 'Елена', 'Елизавета', 'Жанна', 'Зинаида', 'Зоя', 'Инна', 'Ирина', 'Карина', 'Кира', 'Кристина', 'Ксения', 'Лариса', 'Лидия', 'Лилия', 'Любовь', 'Людмила', 'Маргарита', 'Марина', 'Мария', 'Надежда', 'Наталья', 'Нина', 'Оксана', 'Ольга', 'Полина', 'Раиса', 'Светлана', 'София', 'Тамара', 'Татьяна', 'Ульяна', 'Фаина', 'Эльвира', 'Юлия', 'Яна'],
      'Профессия': ['учитель', 'врач', 'инженер', 'программист', 'водитель', 'повар', 'продавец', 'бухгалтер', 'юрист', 'менеджер', 'директор', 'секретарь', 'охранник', 'уборщица', 'строитель', 'сварщик', 'электрик', 'сантехник', 'плотник', 'маляр', 'штукатур', 'каменщик', 'арматурщик', 'монтажник', 'наладчик', 'оператор', 'контролёр', 'мастер', 'технолог', 'экономист', 'маркетолог', 'логист', 'кадровик', 'делопроизводитель', 'архивариус', 'курьер', 'кассир', 'грузчик', 'комплектовщик'],
    };
    
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
    this.round = 0;
    this.emit('score:updated', {
      players: this.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
    });
    this.nextRound();
  }

  nextRound() {
    if (this._aborted) return;
    this.stopTimer();
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.round++;
    if (this.round > this.maxRounds) { this.endGame(); return; }

    this.playerAnswers.clear();
    this.completedPlayers.clear();
    this.submissionTimes.clear();
    this.completionTimes.clear();
    for (const p of this.players) {
      this.playerAnswers.set(p.id, new Map());
    }

    let availableLetters = this.letters.filter(l => !this.usedLetters.has(l));
    if (availableLetters.length === 0) { this.usedLetters.clear(); availableLetters = [...this.letters]; }
    this.currentLetter = availableLetters[Math.floor(Math.random() * availableLetters.length)];
    this.usedLetters.add(this.currentLetter);

    let availableCategories = this.categoryPool.filter(c => !this.usedCategories.has(c));
    if (availableCategories.length < 5) {
      this.usedCategories.clear();
      availableCategories = [...this.categoryPool];
    }
    const shuffled = [...availableCategories].sort(() => Math.random() - 0.5);
    this.currentCategories = shuffled.slice(0, 5);
    this.currentCategories.forEach(c => this.usedCategories.add(c));

    this.phase = 'playing';
    this.timeLeft = this.roundTime;
    this.emit('round:started', {
      round: this.round, maxRounds: this.maxRounds,
      letter: this.currentLetter,
      categories: this.currentCategories,
      timeLeft: this.timeLeft,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.endRound();
      }
    }, 1000);
  }

  submitAnswer(playerId, text) { return this.handleChat(playerId, text); }
  handleChat(playerId, message) {
    if (this._aborted) return false;
    if (this.phase !== 'playing' || !this.currentCategories) return false;
    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;
    if (this.completedPlayers.has(playerId)) return false;

    const msg = message.trim();
    const idx = msg.indexOf(':');
    if (idx === -1) return false;
    const categoryInput = msg.slice(0, idx).trim();
    const answer = msg.slice(idx + 1).trim();

    const category = this.currentCategories.find(
      c => c.toLowerCase().trim() === categoryInput.toLowerCase().trim()
    );
    if (!category) {
      this.emit('answer:rejected', { playerId, playerName: player.name, reason: 'invalid_category', input: msg });
      return true;
    }

    const normalizeLetter = (l) => (l || '').toLowerCase().replace('ё', 'е');
    const normalizeAnswer = (a) => (a || '').toLowerCase().replace('ё', 'е').replace(/^[ьъ]+/, '');
    if (!normalizeAnswer(answer).startsWith(normalizeLetter(this.currentLetter))) {
      this.emit('answer:rejected', {
        playerId, playerName: player.name,
        reason: 'wrong_letter', category, answer,
      });
      return true;
    }

    const playerMap = this.playerAnswers.get(playerId);
    if (playerMap.has(category)) {
      this.emit('answer:rejected', { playerId, playerName: player.name, reason: 'already_answered', category });
      return true;
    }

    if (!this.submissionTimes.has(playerId)) {
      this.submissionTimes.set(playerId, Date.now());
    }

    playerMap.set(category, answer);

    this.emit('answer:accepted', {
      playerId, playerName: player.name, category, answer,
      filled: playerMap.size, total: this.currentCategories.length,
    });

    if (playerMap.size >= this.currentCategories.length) {
      this.completionTimes.set(playerId, Date.now());
      this.completedPlayers.add(playerId);
      if (this.completedPlayers.size === 1) {
        this.emit('bonus:first', { playerId, playerName: player.name });
      }
      if (this.completedPlayers.size >= this.players.length) {
        this.stopTimer();
        if (!this._aborted) this.endRound();
      }
    }
    return true;
  }

  endRound() {
    if (this._aborted) return;
    if (this.phase === 'results') return;
    this.phase = 'results';
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    const allAnswersByCategory = new Map();
    for (const cat of this.currentCategories) {
      allAnswersByCategory.set(cat, new Map());
    }
    for (const p of this.players) {
      const answers = this.playerAnswers.get(p.id);
      if (answers) {
        for (const [cat, ans] of answers) {
          const normalized = (ans || '').trim().toLowerCase();
          if (!normalized) continue;
          const byAnswer = allAnswersByCategory.get(cat);
          if (!byAnswer.has(normalized)) byAnswer.set(normalized, []);
          byAnswer.get(normalized).push(p.id);
        }
      }
    }

    const times = [...this.completionTimes.entries()].filter(([, t]) => t != null);
    const firstEntry = times.length ? times.reduce((a, b) => (a[1] < b[1] ? a : b)) : null;
    const firstPlayerId = firstEntry?.[0] ?? null;

    for (const p of this.players) {
      const answers = this.playerAnswers.get(p.id);
      if (!answers) continue;
      let earned = 0;
      for (const [cat, ans] of answers) {
        const normalized = (ans || '').trim().toLowerCase();
        if (!normalized) continue;
        const whoSaid = allAnswersByCategory.get(cat)?.get(normalized) ?? [];
        earned += this.pointsForValid;
        if (whoSaid.length === 1) earned += this.uniquenessBonus;
      }
      if (firstPlayerId && p.id === firstPlayerId) earned += this.speedBonus;
      p.score += earned;
    }

    const results = this.players.map(p => {
      const answers = this.playerAnswers.get(p.id);
      return {
        id: p.id, name: p.name,
        answers: answers ? Object.fromEntries(answers) : {},
        filled: answers ? answers.size : 0,
      };
    });

    this.emit('round:ended', {
      round: this.round, letter: this.currentLetter,
      categories: this.currentCategories, results,
    });
    this.emit('score:updated', {
      players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
    });

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
    this.emit('game:ended', {
      gameType: 'categories',
      winner: sorted[0] ? { id: sorted[0].id, name: sorted[0].name, score: sorted[0].score } : null,
      players: sorted.map((p) => ({ id: p.id, name: p.name, score: p.score })),
    });
  }

  stopTimer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
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
      phase: this.phase, players: this.players,
      round: this.round, maxRounds: this.maxRounds,
      timeLeft: this.timeLeft,
      currentLetter: this.currentLetter,
      currentCategories: this.currentCategories,
    };
  }
}
