import { EventEmitter } from 'events';
export class LastWordEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 0;
    this.maxRounds = this.settings.maxRounds ?? 10;
    this.roundTime = this.settings.roundTime ?? 45;
    this.currentCategory = null;
    this.usedWords = new Set();
    this.lastValidPlayer = null;
    this.wordsThisRound = [];
    this.usedCategories = new Set();
    this.validationStrictness = this.settings.validationStrictness ?? 'loose';
    this.pointsPerValidWord = this.settings.pointsPerValidWord ?? 1;
    this.lastWordBonus = this.settings.lastWordBonus ?? 3;
    this.dictionaryLoaded = false;
    this._aborted = false;
    this._roundDelayTimeout = null;
    this._dictionaryStatusTimeout = null;

    this.categories = [
      'Фрукты', 'Страны', 'Профессии', 'Животные', 'Города',
      'Цветы', 'Марки автомобилей', 'Виды спорта', 'Музыкальные инструменты', 'Напитки',
      'Овощи', 'Породы собак', 'Реки', 'Фильмы', 'Писатели',
      'Деревья', 'Птицы', 'Сладости', 'Одежда', 'Мебель',
      'Рыбы', 'Цвета', 'Ягоды', 'Специи', 'Танцы',
      'Планеты', 'Языки программирования', 'Школьные предметы', 'Инструменты', 'Бытовая техника',
      'Супы', 'Грибы', 'Насекомые', 'Столицы', 'Праздники',
      'Породы кошек', 'Океаны и моря', 'Драгоценные камни', 'Виды транспорта', 'Молочные продукты',
      'Крупы', 'Единицы измерения', 'Части тела', 'Стихийные бедствия', 'Созвездия',
    ];
    
    // Dictionary for word validation
    this.categoryWords = {};
  }

  loadDictionary() {
    if (this._aborted) return;
    if (this.dictionaryLoaded) return;
    
    this.emit('dictionary:status', { status: 'loading', message: 'Подключаю словарь...' });

    // Справочник по категориям (валидация в движке сейчас не режет по нему — см. handleChat); тяжёлые выборки из словаря убраны — они не использовались и могли зависнуть при запросе > числа уникальных слов в tier.
    this.categoryWords = {
      'Фрукты': ['яблоко', 'груша', 'банан', 'апельсин', 'мандарин', 'лимон', 'грейпфрут', 'персик', 'слива', 'абрикос', 'вишня', 'черешня', 'клубника', 'малина', 'смородина', 'крыжовник', 'виноград', 'арбуз', 'дыня', 'киви', 'манго', 'папайя', 'ананас', 'гранат', 'инжир', 'хурма', 'айва', 'смоква'],
      'Страны': ['россия', 'сша', 'китай', 'индия', 'бразилия', 'австралия', 'канада', 'япония', 'германия', 'франция', 'великобритания', 'италия', 'испания', 'мексика', 'аргентина', 'египет', 'турция', 'иран', 'ирак', 'саудовская аравия', 'южная корея', 'индонезия', 'тайланд', 'вьетнам', 'польша', 'украина', 'беларусь', 'казахстан', 'узбекистан'],
      'Профессии': ['врач', 'учитель', 'инженер', 'программист', 'водитель', 'повар', 'строитель', 'сварщик', 'электрик', 'сантехник', 'юрист', 'бухгалтер', 'менеджер', 'директор', 'секретарь', 'охранник', 'продавец', 'кассир', 'грузчик', 'курьер'],
      'Животные': ['кот', 'собака', 'корова', 'лошадь', 'овца', 'коза', 'свинья', 'курица', 'утка', 'гусь', 'кролик', 'хомяк', 'морская свинка', 'попугай', 'канарейка', 'рыбка', 'черепаха', 'ящерица', 'змея', 'лягушка'],
      'Города': ['москва', 'санкт-петербург', 'новосибирск', 'екатеринбург', 'казань', 'нижний новгород', 'челябинск', 'самара', 'омск', 'ростов-на-дону', 'уфа', 'красноярск', 'воронеж', 'пермь', 'волгоград', 'краснодар', 'саратов', 'тюмень', 'тольятти', 'ижевск'],
      'Цветы': ['роза', 'ромашка', 'василёк', 'одуванчик', 'подсолнух', 'тюльпан', 'гвоздика', 'орхидея', 'лилия', 'пион', 'нарцисс', 'ирис', 'гладиолус', 'хризантема', 'георгин', 'космея', 'колокольчик', 'ландыш', 'незабудка', 'фиалка'],
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
    this.nextRound();
  }

  nextRound() {
    if (this._aborted) return;
    this.stopTimer();
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    // После endRound() фаза «results» — без этого handleChat не принимает слова со 2-го раунда
    this.phase = 'playing';
    this.round++;
    if (this.round > this.maxRounds) { this.endGame(); return; }

    this.usedWords.clear();
    this.lastValidPlayer = null;
    this.wordsThisRound = [];

    let availableIndices = this.categories.map((_, i) => i).filter((i) => !this.usedCategories.has(i));
    if (availableIndices.length === 0) {
      this.usedCategories.clear();
      availableIndices = this.categories.map((_, i) => i);
    }
    const catIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedCategories.add(catIdx);
    this.currentCategory = this.categories[catIdx];

    this.timeLeft = this.roundTime;
    this.emit('round:started', {
      round: this.round, maxRounds: this.maxRounds,
      category: this.currentCategory, timeLeft: this.timeLeft,
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
    if (this.phase !== 'playing' || !this.currentCategory) return false;
    const word = String(message ?? '').trim().toLowerCase();
    if (!word || word.length < 2) return false;

    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;

    if (this.usedWords.has(word)) {
      this.emit('word:rejected', {
        playerId, playerName: player.name, word: message.trim(), reason: 'duplicate',
      });
      return true;
    }

    this.usedWords.add(word);
    player.score += this.pointsPerValidWord;
    this.lastValidPlayer = playerId;
    this.wordsThisRound.push({ playerId, word: message.trim() });

    this.emit('word:accepted', {
      playerId, playerName: player.name, word: message.trim(),
      wordsCount: this.wordsThisRound.length,
    });
    return true;
  }

  endRound() {
    if (this._aborted) return;
    this.phase = 'results';
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    if (this.lastValidPlayer) {
      const lastPlayer = this.players.find((p) => p.id === this.lastValidPlayer);
      if (lastPlayer && lastPlayer.isOnline !== false) lastPlayer.score += this.lastWordBonus;
    }

    this.emit('round:ended', {
      round: this.round, category: this.currentCategory,
      wordsCount: this.wordsThisRound.length,
      lastWord: this.wordsThisRound[this.wordsThisRound.length - 1] ?? null,
      lastPlayerId: this.lastValidPlayer,
      lastPlayerName: this.players.find(p => p.id === this.lastValidPlayer)?.name ?? null,
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
    this.emit('game:ended', { winner: sorted[0] ?? null, players: sorted });
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
      timeLeft: this.timeLeft, currentCategory: this.currentCategory,
      wordsCount: this.wordsThisRound.length,
    };
  }
}
