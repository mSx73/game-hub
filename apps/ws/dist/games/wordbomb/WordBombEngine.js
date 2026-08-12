import { EventEmitter } from 'events';
import { getGameWords, getRandomWords } from '../../utils/wordDictionary.js';

// Generate mines (forbidden words) for a given word
function generateMines(word) {
  const mineTemplates = {
    'дом': ['крыша', 'жить', 'строение'],
    'кот': ['мяу', 'пушистый', 'животное'],
    'собака': ['гав', 'пес', 'друг'],
    'машина': ['ехать', 'колесо', 'авто'],
    'дерево': ['лист', 'растение', 'лес'],
    'цветок': ['растение', 'сад', 'лепесток'],
    'река': ['вода', 'течь', 'поток'],
    'гора': ['высоко', 'вершина', 'подъём'],
    'книга': ['читать', 'страница', 'текст'],
    'стол': ['мебель', 'кухня', 'поверхность'],
    'компьютер': ['экран', 'клавиатура', 'мышка'],
    'телефон': ['звонить', 'мобильный', 'связь'],
    'окно': ['стекло', 'рамка', 'свет'],
    'дверь': ['открыть', 'проход', 'ручка'],
    'солнце': ['свет', 'тепло', 'звезда'],
    'луна': ['ночь', 'спутник', 'небо'],
    'звезда': ['небо', 'свет', 'космос'],
    'небо': ['голубое', 'облако', 'высоко'],
    'земля': ['планета', 'почва', 'мир'],
    'вода': ['жидкость', 'пить', 'мокро'],
    'огонь': ['гореть', 'пламя', 'тепло'],
    'рыба': ['водоем', 'плавать', 'аквариум'],
    'птица': ['летать', 'крыло', 'перо'],
    'медведь': ['лес', 'большой', 'бурый'],
    'волк': ['лес', 'стая', 'серый'],
    'лиса': ['хитрый', 'рыжий', 'хвост'],
    'заяц': ['длинные уши', 'быстрый', 'белый'],
    'лошадь': ['скакать', 'грива', 'хвост'],
    'корова': ['молоко', 'ферма', 'бык'],
    'овца': ['шерсть', 'баран', 'пасти'],
    'курица': ['яйцо', 'петух', 'ферма'],
    'яблоко': ['фрукт', 'сад', 'красное'],
    'груша': ['фрукт', 'жёлтая', 'сад'],
    'слива': ['фрукт', 'фиолетовая', 'косточка'],
    'вишня': ['ягода', 'красная', 'косточка'],
    'арбуз': ['большой', 'полосатый', 'косточки'],
    'дыня': ['сладкая', 'мякоть', 'семена'],
    'гриб': ['лес', 'дождь', 'ядовитый'],
    'огурец': ['зелёный', 'салат', 'огород'],
    'помидор': ['красный', 'салат', 'овощ'],
    'картошка': ['овощ', 'жареная', 'пюре'],
    'школа': ['учиться', 'учитель', 'урок'],
    'магазин': ['покупать', 'товары', 'цена'],
    'парк': ['отдых', 'деревья', 'скамейка'],
    'сад': ['растения', 'огород', 'цветы'],
    'лес': ['деревья', 'грибы', 'ягу'],
    'поле': ['зерно', 'пшеница', 'колосья'],
    'дорога': ['асфальт', 'машины', 'ехать'],
    'мост': ['река', 'переход', 'арка'],
    'город': ['улица', 'дома', 'люди'],
    'деревня': ['дома', 'природа', 'тихо'],
    'мама': ['родители', 'семья', 'любовь'],
    'папа': ['родители', 'семья', 'отец'],
    'брат': ['родитель', 'семья', 'сестра'],
    'сестра': ['родитель', 'семья', 'брат'],
    'друг': ['товарищ', 'общение', 'дружба'],
    'учитель': ['школа', 'урок', 'знания'],
    'врач': ['больница', 'лечить', 'здоровье'],
    'повар': ['кухня', 'готовить', 'еда'],
    'шапка': ['голова', 'носить', 'тёплая'],
    'пальто': ['верхняя одежда', 'носить', 'тёплое'],
    'платье': ['одежда', 'женское', 'красивое'],
    'рубашка': ['одежда', 'мужская', 'воротник'],
    'брюки': ['одежда', 'штаны', 'ноги'],
    'юбка': ['одежда', 'женская', 'красивая'],
    'кофта': ['одежда', 'тёплая', 'носить'],
    'носки': ['одежда', 'ноги', 'стопы'],
    'ботинки': ['обувь', 'ноги', 'ходить'],
    'перчатки': ['руки', 'тёплые', 'носить'],
    'чашка': ['посуда', 'чай', 'пить'],
    'тарелка': ['посуда', 'еда', 'стол'],
    'ложка': ['посуда', 'есть', 'суп'],
    'вилка': ['посуда', 'есть', 'стол'],
    'нож': ['острый', 'резать', 'кухня'],
    'кастрюля': ['посуда', 'варить', 'суп'],
    'сковорода': ['посуда', 'жарить', 'кухня'],
    'бутылка': ['ёмкость', 'жидкость', 'горлышко'],
    'банка': ['ёмкость', 'консервы', 'крышка'],
    'пакет': ['мешок', 'покупки', 'нести'],
  };
  
  const lowerWord = word.toLowerCase();
  if (mineTemplates[lowerWord]) {
    return mineTemplates[lowerWord];
  }

  // Три случайных слова из словаря (не совпадают с загаданным) — без однотипных «вещь/предмет/объект»
  const seen = new Set([lowerWord]);
  const out = [];
  const tiers = ['medium', 'easy', 'hard'];
  const types = ['nouns', 'adjectives', 'verbs'];
  for (const diff of tiers) {
    for (const t of types) {
      const batch = getRandomWords(24, diff, t);
      for (const raw of batch) {
        if (!raw || typeof raw !== 'string') continue;
        const lw = raw.toLowerCase();
        if (seen.has(lw) || lw.length < 2) continue;
        seen.add(lw);
        out.push(raw.charAt(0).toUpperCase() + raw.slice(1));
        if (out.length >= 3) return out;
      }
    }
  }
  let guard = 0;
  while (out.length < 3 && guard < 300) {
    guard += 1;
    const batch = getRandomWords(1, 'easy', 'nouns');
    const raw = batch[0];
    if (!raw || typeof raw !== 'string') continue;
    const lw = raw.toLowerCase();
    if (seen.has(lw) || lw.length < 2) continue;
    seen.add(lw);
    out.push(raw.charAt(0).toUpperCase() + raw.slice(1));
  }
  return out;
}

export class WordBombEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.currentPlayerIndex = 0;
    this.currentEntry = null;
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.usedWords = new Set();
    this.round = 1;
    this.maxRounds = Number(this.settings.maxRounds) > 0 ? Number(this.settings.maxRounds) : 12;

    // Use dictionary instead of hardcoded words
    this.wordBank = [];
    this.dictionaryLoaded = false;
    this._aborted = false;
    this._dictionaryStatusTimeout = null;
    this._advanceTurnTimeout = null;
  }

  loadDictionary() {
    if (this._aborted) return;
    if (this.dictionaryLoaded) return;
    
    this.emit('dictionary:status', { status: 'loading', message: 'Подключаю словарь...' });
    
    const difficulty = this.settings.difficulty ?? 'medium';
    const words = getRandomWords(50, difficulty);
    
    this.wordBank = words.map(word => ({
      word: word.charAt(0).toUpperCase() + word.slice(1),
      mines: generateMines(word)
    }));
    
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
    this.usedWords.clear();
    this.nextTurn();
  }

  nextTurn() {
    if (this._aborted) return;
    if (this.timer) clearInterval(this.timer);

    if (this.players.length === 0) {
      this.phase = 'finished';
      this.emit('game:ended', { winner: null, players: [], reason: 'no-players' });
      return;
    }
    if (!Number.isInteger(this.currentPlayerIndex) || this.currentPlayerIndex >= this.players.length) {
      this.currentPlayerIndex = 0;
    }
    const explainer = this.players[this.currentPlayerIndex];
    if (!explainer) return;

    let availableIndices = this.wordBank.map((_, i) => i).filter((i) => !this.usedWords.has(i));
    if (availableIndices.length === 0) {
      this.usedWords.clear();
      availableIndices = this.wordBank.map((_, i) => i);
    }
    const idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.currentEntry = this.wordBank[idx];
    this.usedWords.add(idx);

    this.timeLeft = Number(this.settings.roundTime) > 0 ? Number(this.settings.roundTime) : 60;

    this.emit('turn:started', {
      explainerId: explainer.id,
      explainerName: explainer.name,
      timeLeft: this.timeLeft,
      round: this.round,
      maxRounds: this.maxRounds,
    });

    this.emit('word:pick', {
      playerId: explainer.id,
      word: this.currentEntry.word,
      mineWords: this.currentEntry.mines,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (this._aborted) return;
        this.emit('turn:timeout', { word: this.currentEntry.word });
        this.advanceTurn();
      }
    }, 1000);
  }

  submitAnswer(playerId, text) { return this.handleChat(playerId, text); }

  confirmGuess(explainerId, guesserId) {
    if (this._aborted) return false;
    if (this.phase !== 'playing') return false;
    if (!this.currentEntry) return false;
    const explainer = this.players[this.currentPlayerIndex];
    if (!explainer || explainer.id !== explainerId) return false;
    const guesser = this.players.find(p => p.id === guesserId);
    if (!guesser || guesser.id === explainerId) return false;
    return this.handleChat(guesserId, this.currentEntry.word);
  }
  handleChat(playerId, message) {
    if (this._aborted) return false;
    if (this.phase !== 'playing') return false;
    if (!this.currentEntry) return false;

    const explainer = this.players[this.currentPlayerIndex];
    const msgLower = message.trim().toLowerCase();

    const msgWords = msgLower.split(/\s+/);
    const triggeredMine = this.currentEntry.mines.find(m => msgWords.includes(m.toLowerCase()));
    if (triggeredMine) {
      this.stopTimer();
      const offender = this.players.find(p => p.id === playerId);
      if (offender) offender.score = Math.max(0, offender.score - 5);

      this.emit('mine:triggered', {
        playerId,
        playerName: offender?.name ?? 'Кто-то',
        mineWord: triggeredMine,
        isExplainer: playerId === explainer.id,
        roundLost: true,
      });
      this.emit('score:updated', {
        players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
      });
      this.advanceTurn();
      return true;
    }

    if (playerId === explainer.id) return false;

    const guess = msgLower;
    if (guess === this.currentEntry.word.toLowerCase()) {
      this.stopTimer();
      const guesser = this.players.find(p => p.id === playerId);
      if (guesser) guesser.score += this.settings.pointsGuesser ?? 1;
      if (explainer) explainer.score += this.settings.pointsExplainer ?? 2;

      this.emit('word:guessed', {
        guesserId: playerId,
        guesserName: guesser?.name ?? 'Кто-то',
        word: this.currentEntry.word,
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
    // Закрываем окно угадывания: пока не начался новый ход, повторные
    // confirm-guess / угадывания по старому слову не должны начислять очки дважды.
    this.currentEntry = null;
    this.stopTimer();
    const playerCount = this.players.length || 1;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % playerCount;
    this.round += 1;
    if (this.round > this.maxRounds) {
      this.phase = 'finished';
      this.emit('game:ended', {
        winner: [...this.players].sort((a, b) => b.score - a.score)[0] ?? null,
        players: this.players,
      });
      return;
    }
    if (this._advanceTurnTimeout) {
      clearTimeout(this._advanceTurnTimeout);
      this._advanceTurnTimeout = null;
    }
    this._advanceTurnTimeout = setTimeout(() => {
      this._advanceTurnTimeout = null;
      if (!this._aborted) this.nextTurn();
    }, 2000);
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
    if (this._dictionaryStatusTimeout) {
      clearTimeout(this._dictionaryStatusTimeout);
      this._dictionaryStatusTimeout = null;
    }
    if (this._advanceTurnTimeout) {
      clearTimeout(this._advanceTurnTimeout);
      this._advanceTurnTimeout = null;
    }
    this.removeAllListeners();
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
