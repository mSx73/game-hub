import { EventEmitter } from 'events';
import { RUSSIAN_NOUNS, RUSSIAN_ADJECTIVES, RUSSIAN_VERBS, getRandomWord } from '../../utils/wordDictionary.js';

const LETTERS = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('');

function normalize(s) {
  return String(s || '').trim().toUpperCase().replace(/Ё/g, 'Е');
}

function canFormWord(lettersMap, word) {
  const w = normalize(word);
  if (!w || w.length < 2) return false;
  const need = new Map();
  for (const c of w) {
    if (c === ' ' || c === '-') continue;
    need.set(c, (need.get(c) || 0) + 1);
  }
  for (const [c, count] of need) {
    if ((lettersMap.get(c) || 0) < count) return false;
  }
  return true;
}

function buildLettersMap(letters) {
  const m = new Map();
  for (const c of letters) {
    const n = c === 'Ё' ? 'Е' : c;
    m.set(n, (m.get(n) || 0) + 1);
  }
  return m;
}

function buildValidWordsSet() {
  const set = new Set();
  for (const dict of [RUSSIAN_NOUNS, RUSSIAN_ADJECTIVES, RUSSIAN_VERBS]) {
    for (const arr of Object.values(dict)) {
      if (Array.isArray(arr)) {
        for (const w of arr) {
          const n = String(w || '').trim().toLowerCase().replace(/ё/g, 'е');
          if (n.length >= 2 && /^[а-я]+$/.test(n)) set.add(n);
        }
      }
    }
  }
  return set;
}

const VALID_WORDS = buildValidWordsSet();

export class AnagramsEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 0;
    this.maxRounds = this.settings.maxRounds ?? 5;
    this.roundTime = this.settings.roundTime ?? 90;
    this.letters = [];
    this.lettersMap = new Map();
    this.usedWords = new Set();
    this.wordsThisRound = [];
    this.lettersCount = this.settings.lettersCount ?? 8;
    // По умолчанию слово должно быть в словаре (существительные/прилагательные/глаголы из wordDictionary). Отключить: settings.validateDictionary === false
    this.validateDictionary = this.settings.validateDictionary !== false;
    this._aborted = false;
    this._roundDelayTimeout = null;
  }

  pickLetters() {
    const seedWord = getRandomWord('medium', 'nouns');
    const base = normalize(seedWord).split('').filter(c => /[А-Я]/.test(c));
    let letters = [...base];
    while (letters.length < this.lettersCount) {
      letters.push(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
    }
    return letters.sort(() => Math.random() - 0.5).slice(0, this.lettersCount);
  }

  start() {
    if (this._aborted) return;
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
    this.round++;
    if (this.round > this.maxRounds) {
      this.endGame();
      return;
    }

    // После endRound() фаза «results» — без этого handleChat не принимает сообщения со 2-го раунда
    this.phase = 'playing';

    this.usedWords.clear();
    this.wordsThisRound = [];
    this.letters = this.pickLetters();
    this.lettersMap = buildLettersMap(this.letters);
    this.timeLeft = this.roundTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      letters: this.letters,
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

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  submitAnswer(playerId, text) { return this.handleChat(playerId, text); }
  handleChat(playerId, message) {
    if (this._aborted) return false;
    if (this.phase !== 'playing' || !this.letters.length) return false;

    const msg = String(message || '').trim();
    const word = msg.toLowerCase().replace(/ё/g, 'е');
    if (!word || word.length < 2) return false;

    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;

    if (this.usedWords.has(word)) {
      this.emit('word:rejected', {
        playerId,
        playerName: player.name,
        word: msg,
        reason: 'duplicate',
      });
      return true;
    }

    if (!canFormWord(this.lettersMap, word)) {
      this.emit('word:rejected', {
        playerId,
        playerName: player.name,
        word: msg,
        reason: 'invalid_letters',
      });
      return true;
    }

    if (this.validateDictionary && !VALID_WORDS.has(word)) {
      this.emit('word:rejected', {
        playerId,
        playerName: player.name,
        word: msg,
        reason: 'not_in_dictionary',
      });
      return true;
    }

    this.usedWords.add(word);
    const points = word.length >= 6 ? word.length * 2 : word.length;
    player.score = (player.score || 0) + points;
    this.wordsThisRound.push({ playerId, playerName: player.name, word: msg, points });

    this.emit('word:accepted', {
      playerId,
      playerName: player.name,
      word: msg,
      points,
      wordsCount: this.wordsThisRound.length,
    });
    this.emit('score:updated', { players: this.players });

    return true;
  }

  endRound() {
    if (this._aborted) return;
    this.phase = 'results';
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.emit('round:ended', {
      round: this.round,
      letters: this.letters,
      wordsCount: this.wordsThisRound.length,
      words: this.wordsThisRound,
    });
    this.emit('score:updated', { players: this.players });

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
    const sorted = [...this.players].sort((a, b) => (b.score || 0) - (a.score || 0));
    this.emit('game:ended', {
      winner: sorted[0] ?? null,
      players: sorted,
    });
  }

  cleanup() {
    this._aborted = true;
    this.stopTimer();
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
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
      letters: this.letters,
      wordsCount: this.wordsThisRound.length,
    };
  }
}
