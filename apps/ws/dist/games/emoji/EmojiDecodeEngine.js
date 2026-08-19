import { EventEmitter } from 'events';

const PUZZLES = [
  { emojis: '🦁👑', answer: 'Король Лев', category: 'фильм' },
  { emojis: '⭐💫🔫', answer: 'Звёздные войны', category: 'фильм' },
  { emojis: '🧊❄️👸', answer: 'Холодное сердце', category: 'фильм' },
  { emojis: '🕷️🧑', answer: 'Человек-паук', category: 'фильм' },
  { emojis: '🧙‍♂️💍🌋', answer: 'Властелин колец', category: 'фильм' },
  { emojis: '🦇🌃🦸', answer: 'Бэтмен', category: 'фильм' },
  { emojis: '👻🔫👨‍👨‍👦', answer: 'Охотники за привидениями', category: 'фильм' },
  { emojis: '🐀👨‍🍳🇫🇷', answer: 'Рататуй', category: 'фильм' },
  { emojis: '🏠👦🔫💀', answer: 'Один дома', category: 'фильм' },
  { emojis: '🦈🌊😱', answer: 'Челюсти', category: 'фильм' },
  { emojis: '🤖👍🔥', answer: 'Терминатор', category: 'фильм' },
  { emojis: '🧟‍♂️🌍🔫', answer: 'Обитель зла', category: 'фильм' },
  { emojis: '👸🐸💋', answer: 'Принцесса и лягушка', category: 'фильм' },
  { emojis: '🚢💑❄️🌊', answer: 'Титаник', category: 'фильм' },
  { emojis: '🐍✈️', answer: 'Змеиный полёт', category: 'фильм' },
  { emojis: '🧙‍♂️⚡👦', answer: 'Гарри Поттер', category: 'фильм' },
  { emojis: '🐠🔍', answer: 'В поисках Немо', category: 'фильм' },
  { emojis: '👨‍🚀🌑', answer: 'Интерстеллар', category: 'фильм' },
  { emojis: '🎭😈👼', answer: 'Ангелы и демоны', category: 'книга' },
  { emojis: '🏰👹🌹', answer: 'Красавица и чудовище', category: 'фильм' },
  { emojis: '🐕🛷❄️', answer: 'Белый клык', category: 'книга' },
  { emojis: '🐱👢👑', answer: 'Кот в сапогах', category: 'фильм' },
  { emojis: '🎪🤡🎈', answer: 'Оно', category: 'фильм' },
  { emojis: '🍎👸😴', answer: 'Белоснежка', category: 'фильм' },
  { emojis: '🐒🌴👦', answer: 'Маугли', category: 'книга' },
  { emojis: '🚗⚡🏁', answer: 'Тачки', category: 'фильм' },
  { emojis: '👴⬆️🎈🏠', answer: 'Вверх', category: 'фильм' },
  { emojis: '🤥👃🪵', answer: 'Пиноккио', category: 'фильм' },
  { emojis: '🧊🦣', answer: 'Ледниковый период', category: 'фильм' },
  { emojis: '🏴‍☠️💀⚓', answer: 'Пираты Карибского моря', category: 'фильм' },
  { emojis: '🐉🧑‍🤝‍🧑🔥', answer: 'Как приручить дракона', category: 'фильм' },
  { emojis: '🔪🚿😱', answer: 'Психо', category: 'фильм' },
  { emojis: '🐻🍯🐷', answer: 'Винни-Пух', category: 'книга' },
  { emojis: '👽📞🏠', answer: 'Инопланетянин', category: 'фильм' },
  { emojis: '🧛💉❤️', answer: 'Сумерки', category: 'фильм' },
  { emojis: '🏎️💨🏁', answer: 'Форсаж', category: 'фильм' },
  { emojis: '🤴⚔️🐉', answer: 'Шрек', category: 'фильм' },
  { emojis: '👩‍🔬🧪💀', answer: 'Во все тяжкие', category: 'сериал' },
  { emojis: '🎵🎤👨‍👩‍👧‍👦🏔️', answer: 'Звуки музыки', category: 'фильм' },
  { emojis: '🎩🐇⏰', answer: 'Алиса в стране чудес', category: 'книга' },
  { emojis: '🧜‍♀️🌊🏰', answer: 'Русалочка', category: 'фильм' },
  { emojis: '👨‍👩‍👧💀📓', answer: 'Тетрадь смерти', category: 'аниме' },
];

export class EmojiDecodeEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.round = 0;
    this.maxRounds = this.settings.maxRounds ?? 12;
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.roundTime = this.settings.roundTime ?? 30;
    this.pointsFirst = this.settings.pointsFirst ?? 3;
    this.pointsSecond = this.settings.pointsSecond ?? 2;
    this.pointsThird = this.settings.pointsThird ?? 1;
    this.currentPuzzle = null;
    this.usedPuzzles = new Set();
    this.guessedThisRound = new Set();
    /** После первой верной отгадки в раунде — дальнейшие совпадения не дают очков и не показываются в чате (антиспойлер). */
    this.roundResolved = false;
    this._aborted = false;
    this._roundDelayTimeout = null;
  }

  start() {
    if (this._aborted) return;
    if (this.players.length < 2) {
      this.emit('error', { message: 'Нужно минимум 2 игрока' });
      return;
    }
    this.phase = 'playing';
    this.nextRound();
  }

  nextRound() {
    if (this._aborted) return;
    this.round++;
    if (this.round > this.maxRounds) {
      this.endGame();
      return;
    }

    this.guessedThisRound.clear();
    this.roundResolved = false;
    this.currentPuzzle = this.pickPuzzle();

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      emojis: this.currentPuzzle.emojis,
      category: this.currentPuzzle.category,
      timeLeft: this.roundTime,
    });

    this.startTimer(this.roundTime, () => {
      if (this._aborted) return;
      this.emit('round:timeout', {
        round: this.round,
        answer: this.currentPuzzle.answer,
        emojis: this.currentPuzzle.emojis,
      });
      this.emit('score:updated', {
        players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
      });
      if (this._roundDelayTimeout) {
        clearTimeout(this._roundDelayTimeout);
        this._roundDelayTimeout = null;
      }
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.nextRound();
      }, 4000);
    });
  }

  pickPuzzle() {
    let availableIndices = PUZZLES.map((_, i) => i).filter((i) => !this.usedPuzzles.has(i));
    if (availableIndices.length === 0) {
      this.usedPuzzles.clear();
      availableIndices = PUZZLES.map((_, i) => i);
    }
    const idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedPuzzles.add(idx);
    const p = PUZZLES[idx];
    return { emojis: p.emojis, answer: p.answer, category: p.category };
  }

  submitAnswer(playerId, text) { return this.handleChat(playerId, text); }
  handleChat(playerId, message) {
    if (this._aborted) return false;
    if (this.phase !== 'playing' || !this.currentPuzzle) return false;
    if (this.guessedThisRound.has(playerId)) return false;

    const guess = message.trim().toLowerCase();
    const answer = this.currentPuzzle.answer.toLowerCase();
    const isCorrect = guess === answer || this.fuzzyMatch(guess, answer);

    if (this.roundResolved && isCorrect) {
      return true;
    }

    if (isCorrect) {
      this.roundResolved = true;
      this.guessedThisRound.add(playerId);
      const points = this.pointsFirst;
      const guesser = this.players.find((p) => p.id === playerId);
      if (guesser) guesser.score += points;

      this.emit('word:guessed', {
        guesserId: playerId,
        guesserName: guesser?.name ?? '',
        answer: this.currentPuzzle.answer,
        emojis: this.currentPuzzle.emojis,
        points,
        order: 1,
        round: this.round,
      });

      this.emit('score:updated', {
        players: this.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
      });

      this.stopTimer();
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
      return true;
    }
    return false;
  }

  fuzzyMatch(guess, answer) {
    const clean = (s) =>
      (s || '')
        .replace(/[ёЁ]/g, 'е')
        .replace(/\s+/g, '')
        .replace(/[^а-яa-z0-9]/gi, '')
        .toLowerCase();
    return clean(guess) === clean(answer);
  }

  startTimer(seconds, onEnd) {
    this.stopTimer();
    this.timeLeft = seconds;
    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) onEnd();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  endGame() {
    if (this._aborted) return;
    this.stopTimer();
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.phase = 'finished';
    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    this.emit('game:ended', {
      gameType: 'emoji',
      winner: sorted[0] ?? null,
      players: sorted.map((p) => ({ id: p.id, name: p.name, score: p.score ?? 0 })),
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
      round: this.round,
      maxRounds: this.maxRounds,
      players: this.players,
      currentEmojis: this.currentPuzzle?.emojis ?? null,
      currentCategory: this.currentPuzzle?.category ?? null,
      timeLeft: this.timeLeft,
    };
  }
}
