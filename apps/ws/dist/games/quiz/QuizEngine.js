import { EventEmitter } from 'events';

export class QuizEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.questionIndex = 0;
    this.currentQuestion = null;
    this.answers = new Map();
    this.questionTime = this.settings.questionTime ?? 15;
    this.maxQuestions = this.settings.maxQuestions ?? 15;
    this.speedBonusMax = this.settings.speedBonusMax ?? 5;
    this.allowChangeAnswer = this.settings.allowChangeAnswer === true;
    this.usedQuestions = new Set();
    this.questionStartedAt = 0;
    this._aborted = false;
    this._afterQuestionTimeout = null;
    this._resolvingQuestion = false;

    const defaultBank = [
      { q: 'Какая планета ближайшая к Солнцу?', options: ['Венера', 'Меркурий', 'Марс', 'Земля'], correct: 1 },
      { q: 'Сколько костей в теле взрослого человека?', options: ['196', '206', '216', '226'], correct: 1 },
      { q: 'Какой элемент обозначается символом O?', options: ['Золото', 'Осмий', 'Кислород', 'Олово'], correct: 2 },
      { q: 'В каком году человек впервые полетел в космос?', options: ['1957', '1961', '1965', '1969'], correct: 1 },
      { q: 'Какая самая длинная река в мире?', options: ['Амазонка', 'Нил', 'Миссисипи', 'Янцзы'], correct: 1 },
      { q: 'Какое животное самое быстрое на суше?', options: ['Лев', 'Гепард', 'Газель', 'Антилопа'], correct: 1 },
      { q: 'Столица Австралии?', options: ['Сидней', 'Мельбурн', 'Канберра', 'Брисбен'], correct: 2 },
      { q: 'Кто написал «Войну и мир»?', options: ['Достоевский', 'Пушкин', 'Толстой', 'Чехов'], correct: 2 },
      { q: 'Какой газ составляет большую часть атмосферы Земли?', options: ['Кислород', 'Азот', 'Углекислый газ', 'Аргон'], correct: 1 },
      { q: 'Сколько материков на Земле?', options: ['5', '6', '7', '8'], correct: 2 },
      { q: 'В какой стране находится Мачу-Пикчу?', options: ['Мексика', 'Бразилия', 'Перу', 'Чили'], correct: 2 },
      { q: 'Какой витамин вырабатывается под действием солнечного света?', options: ['A', 'B', 'C', 'D'], correct: 3 },
      { q: 'Кто изобрёл лампочку?', options: ['Никола Тесла', 'Томас Эдисон', 'Александр Белл', 'Генри Форд'], correct: 1 },
      { q: 'Сколько зубов у взрослого человека?', options: ['28', '30', '32', '34'], correct: 2 },
      { q: 'В каком океане находится Марианская впадина?', options: ['Атлантический', 'Индийский', 'Тихий', 'Северный Ледовитый'], correct: 2 },
      { q: 'Какая формула воды?', options: ['CO2', 'H2O', 'NaCl', 'O2'], correct: 1 },
      { q: 'Кто первый ступил на Луну?', options: ['Базз Олдрин', 'Юрий Гагарин', 'Нил Армстронг', 'Джон Гленн'], correct: 2 },
      { q: 'Какое самое большое млекопитающее?', options: ['Слон', 'Синий кит', 'Жираф', 'Бегемот'], correct: 1 },
      { q: 'Столица Японии?', options: ['Осака', 'Киото', 'Токио', 'Хиросима'], correct: 2 },
      { q: 'Какой химический элемент имеет символ Fe?', options: ['Фтор', 'Железо', 'Франций', 'Фосфор'], correct: 1 },
      { q: 'В каком году началась Вторая мировая война?', options: ['1937', '1938', '1939', '1941'], correct: 2 },
      { q: 'Какая планета имеет кольца?', options: ['Юпитер', 'Марс', 'Сатурн', 'Нептун'], correct: 2 },
      { q: 'Как называется столица Египта?', options: ['Каир', 'Александрия', 'Луксор', 'Асуан'], correct: 0 },
      { q: 'Какой цвет получается при смешении красного и синего?', options: ['Зелёный', 'Оранжевый', 'Фиолетовый', 'Коричневый'], correct: 2 },
      { q: 'Кто написал «Мастера и Маргариту»?', options: ['Гоголь', 'Булгаков', 'Тургенев', 'Лермонтов'], correct: 1 },
      { q: 'Из какого дерева делают бейсбольные биты?', options: ['Дуб', 'Берёза', 'Ясень', 'Клён'], correct: 2 },
      { q: 'Какой инструмент имеет 88 клавиш?', options: ['Гитара', 'Аккордеон', 'Пианино', 'Орган'], correct: 2 },
      { q: 'Сколько цветов в радуге?', options: ['5', '6', '7', '8'], correct: 2 },
      { q: 'Какая страна самая большая по площади?', options: ['Канада', 'Китай', 'США', 'Россия'], correct: 3 },
      { q: 'В каком городе находится Колизей?', options: ['Афины', 'Рим', 'Стамбул', 'Мадрид'], correct: 1 },
      { q: 'Какой металл самый дорогой?', options: ['Золото', 'Платина', 'Родий', 'Серебро'], correct: 2 },
      { q: 'Как называется наука о звёздах?', options: ['Астрология', 'Астрономия', 'Космология', 'Физика'], correct: 1 },
      { q: 'Какая кость самая длинная в теле человека?', options: ['Плечевая', 'Берцовая', 'Бедренная', 'Лучевая'], correct: 2 },
      { q: 'Кто нарисовал Мону Лизу?', options: ['Микеланджело', 'Рафаэль', 'Леонардо да Винчи', 'Рембрандт'], correct: 2 },
      { q: 'Сколько хромосом у человека?', options: ['44', '46', '48', '50'], correct: 1 },
      { q: 'Какой язык самый распространённый по числу носителей?', options: ['Английский', 'Испанский', 'Хинди', 'Китайский'], correct: 3 },
      { q: 'Из какой страны родом суши?', options: ['Китай', 'Корея', 'Япония', 'Таиланд'], correct: 2 },
      { q: 'Какой орган фильтрует кровь?', options: ['Печень', 'Почки', 'Сердце', 'Лёгкие'], correct: 1 },
      { q: 'Кто открыл пенициллин?', options: ['Пастер', 'Флеминг', 'Кох', 'Дженнер'], correct: 1 },
      { q: 'Какой спорт называют «королём спорта»?', options: ['Хоккей', 'Теннис', 'Футбол', 'Баскетбол'], correct: 2 },
      { q: 'Из чего делают шоколад?', options: ['Кофейные бобы', 'Какао-бобы', 'Орехи', 'Тростник'], correct: 1 },
      { q: 'Столица Франции?', options: ['Марсель', 'Лион', 'Париж', 'Ницца'], correct: 2 },
      { q: 'Какой знак зодиака идёт первым?', options: ['Телец', 'Овен', 'Рыбы', 'Водолей'], correct: 1 },
      { q: 'Сколько минут в сутках?', options: ['1200', '1440', '1560', '1680'], correct: 1 },
      { q: 'Какой витамин содержится в моркови?', options: ['A', 'B', 'C', 'K'], correct: 0 },
      { q: 'Кто придумал теорию относительности?', options: ['Ньютон', 'Эйнштейн', 'Бор', 'Хокинг'], correct: 1 },
      { q: 'Какое озеро самое глубокое в мире?', options: ['Каспийское', 'Байкал', 'Танганьика', 'Виктория'], correct: 1 },
      { q: 'Какая валюта в Великобритании?', options: ['Евро', 'Доллар', 'Фунт стерлингов', 'Крона'], correct: 2 },
      { q: 'Как называется детёныш лошади?', options: ['Телёнок', 'Жеребёнок', 'Ягнёнок', 'Козлёнок'], correct: 1 },
      { q: 'В какой стране изобрели порох?', options: ['Индия', 'Япония', 'Китай', 'Египет'], correct: 2 },
    ];

    const custom = this.settings.quizCustomQuestions;
    if (Array.isArray(custom) && custom.length > 0) {
      const normalized = custom
        .map((x) => {
          const c = parseInt(x?.correct, 10);
          const correct = Number.isFinite(c) ? Math.min(3, Math.max(0, c)) : -1;
          return {
            q: String(x?.q || '').slice(0, 500).trim(),
            options: (Array.isArray(x?.options) ? x.options : []).slice(0, 4).map((o) => String(o || '').slice(0, 200).trim()),
            correct,
          };
        })
        .filter((x) => x.q && x.options.length === 4 && x.options.every(Boolean) && x.correct >= 0);
      this.questions = normalized.length > 0 ? normalized : defaultBank;
    } else {
      this.questions = defaultBank;
    }
  }

  start() {
    if (this._aborted) return;
    this.phase = 'playing';
    this.questionIndex = 0;
    this._resolvingQuestion = false;
    const cap = this.settings.maxQuestions ?? 15;
    this.maxQuestions = Math.min(Math.max(1, cap), this.questions.length);
    this.usedQuestions.clear();
    this.emit('score:updated', {
      players: this.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
    });
    this.nextQuestion();
  }

  nextQuestion() {
    if (this._aborted) return;
    if (this.timer) clearInterval(this.timer);
    this._resolvingQuestion = false;
    this.phase = 'playing';

    if (this.questionIndex >= this.maxQuestions) {
      this.endGame();
      return;
    }

    let availableIndices = this.questions.map((_, i) => i).filter((i) => !this.usedQuestions.has(i));
    if (availableIndices.length === 0) {
      this.usedQuestions.clear();
      availableIndices = this.questions.map((_, i) => i);
    }
    const idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedQuestions.add(idx);
    this.currentQuestion = this.questions[idx];
    this.answers.clear();
    this.questionStartedAt = Date.now();

    this.timeLeft = this.questionTime;

    this.emit('question:started', {
      questionNumber: this.questionIndex + 1,
      totalQuestions: this.maxQuestions,
      question: this.currentQuestion.q,
      options: this.currentQuestion.options,
      timeLeft: this.timeLeft,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.resolveQuestion();
      }
    }, 1000);
  }

  submitAnswer(playerId, answerIndex) {
    if (this._aborted) return false;
    if (this.phase !== 'playing' || this._resolvingQuestion || !this.currentQuestion) return false;
    if (answerIndex < 0 || answerIndex >= this.currentQuestion.options.length) return false;
    if (!this.allowChangeAnswer && this.answers.has(playerId)) return false;

    this.answers.set(playerId, { answerIndex, timestamp: Date.now() });
    this.emit('answer:submitted', { playerId, total: this.answers.size, required: this.players.length });

    if (this.answers.size >= this.players.length) {
      this.stopTimer();
      this.resolveQuestion();
    }
    return true;
  }

  resolveQuestion() {
    if (this._aborted) return;
    if (!this.currentQuestion || this._resolvingQuestion) return;
    this._resolvingQuestion = true;
    this.phase = 'revealing';
    this.stopTimer();

    const correct = this.currentQuestion.correct;

    const results = this.players.map(p => {
      const answer = this.answers.get(p.id);
      let earned = 0;
      if (answer && answer.answerIndex === correct) {
        const elapsed = (answer.timestamp - this.questionStartedAt) / 1000;
        const speedBonus = Math.min(this.speedBonusMax, Math.max(0, Math.floor((this.questionTime - elapsed) / this.questionTime * this.speedBonusMax)));
        earned = 10 + speedBonus;
        p.score += earned;
      }
      return {
        id: p.id,
        name: p.name,
        answerIndex: answer?.answerIndex ?? null,
        correct: answer ? answer.answerIndex === correct : false,
        earned,
      };
    });

    this.emit('question:ended', {
      correctAnswer: correct,
      correctText: this.currentQuestion.options[correct],
      results,
    });
    this.emit('score:updated', {
      players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
    });

    this.questionIndex++;
    if (this._afterQuestionTimeout) {
      clearTimeout(this._afterQuestionTimeout);
      this._afterQuestionTimeout = null;
    }
    if (this.questionIndex >= this.maxQuestions) {
      this._afterQuestionTimeout = setTimeout(() => {
        this._afterQuestionTimeout = null;
        if (!this._aborted) this.endGame();
      }, 3000);
    } else {
      this._afterQuestionTimeout = setTimeout(() => {
        this._afterQuestionTimeout = null;
        if (!this._aborted) this.nextQuestion();
      }, 3000);
    }
  }

  endGame() {
    if (this._aborted) return;
    this.phase = 'finished';
    this.stopTimer();
    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    this.emit('game:ended', {
      gameType: 'quiz',
      winner: sorted[0] ?? null,
      players: sorted.map((p) => ({ id: p.id, name: p.name, score: p.score })),
    });
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
    if (this._afterQuestionTimeout) {
      clearTimeout(this._afterQuestionTimeout);
      this._afterQuestionTimeout = null;
    }
    this.removeAllListeners();
  }

  getState() {
    return {
      phase: this.phase,
      players: this.players,
      questionIndex: this.questionIndex,
      maxQuestions: this.maxQuestions,
      timeLeft: this.timeLeft,
      currentQuestion: this.currentQuestion ? {
        question: this.currentQuestion.q,
        options: this.currentQuestion.options,
      } : null,
    };
  }
}
