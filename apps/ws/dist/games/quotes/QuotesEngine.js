import { EventEmitter } from 'events';

const QUOTES = [
  { quote: 'Я мыслю — следовательно, существую.', author: 'Декарт' },
  { quote: 'Быть или не быть — вот в чём вопрос.', author: 'Шекспир' },
  { quote: 'Знание — сила.', author: 'Бэкон' },
  { quote: 'Чем меньше женщину мы любим, тем легче нравимся мы ей.', author: 'Пушкин' },
  { quote: 'Человек — это то, что он ест.', author: 'Фейербах' },
  { quote: 'Ученье — свет, а неученье — тьма.', author: 'Суворов' },
  { quote: 'Жизнь — это то, что происходит с тобой, пока ты строишь другие планы.', author: 'Леннон' },
  { quote: 'Мы в ответе за тех, кого приручили.', author: 'Сент-Экзюпери' },
  { quote: 'Любовь — это когда хочешь переживать с кем-то все четыре времени года.', author: 'Райан Гослинг' },
  { quote: 'Я знаю, что ничего не знаю.', author: 'Сократ' },
  { quote: 'Всё счастливые семьи похожи друг на друга.', author: 'Толстой' },
  { quote: 'Человек предполагает, а Бог располагает.', author: 'Народная' },
  { quote: 'Краткость — сестра таланта.', author: 'Чехов' },
  { quote: 'Лучше поздно, чем никогда.', author: 'Ливий' },
  { quote: 'После нас хоть потоп.', author: 'Помпадур' },
  { quote: 'Пришёл, увидел, победил.', author: 'Цезарь' },
  { quote: 'Истина в вине.', author: 'Плиний' },
  { quote: 'Всё течёт, всё меняется.', author: 'Гераклит' },
  { quote: 'Платон мне друг, но истина дороже.', author: 'Аристотель' },
  { quote: 'Любовь — это единственная разумная и удовлетворительная деятельность человека.', author: 'Толстой' },
];

function normalize(s) {
  return String(s ?? '').trim().toLowerCase().replace(/ё/g, 'е');
}

export class QuotesEngine extends EventEmitter {
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
    this.currentQuote = null;
    this.usedIndices = new Set();
    this.roundTime = this.settings.roundTime ?? 30;
    this._aborted = false;
    this._roundDelayTimeout = null;
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

    let available = QUOTES.map((_, i) => i).filter(i => !this.usedIndices.has(i));
    if (available.length === 0) {
      this.usedIndices.clear();
      available = QUOTES.map((_, i) => i);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    this.usedIndices.add(idx);
    this.currentQuote = QUOTES[idx];

    this.phase = 'guessing';
    this.timeLeft = this.roundTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      quote: this.currentQuote.quote,
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
    if (this.phase !== 'guessing') return false;

    const guess = normalize(message);
    const correct = normalize(this.currentQuote.author) === guess;

    if (correct) {
      this.stopTimer();
      const p = this.players.find(x => x.id === playerId);
      if (p) p.score = (p.score || 0) + Math.max(1, Math.floor(this.timeLeft / 5));

      this.emit('word:guessed', {
        playerId,
        playerName: p?.name,
        answer: this.currentQuote.author,
      });
      this.emit('score:updated', { players: this.players });
      this.endRound();
    }
    return true;
  }

  endRound() {
    if (this._aborted) return;
    if (this.phase === 'reveal') return;
    this.phase = 'reveal';
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.emit('round:ended', {
      round: this.round,
      quote: this.currentQuote?.quote,
      author: this.currentQuote?.author,
    });

    if (this.round >= this.maxRounds) {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.endGame();
      }, 2000);
    } else {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.nextRound();
      }, 2000);
    }
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  endGame() {
    if (this._aborted) return;
    this.phase = 'finished';
    this.stopTimer();
    const sorted = [...this.players].sort((a, b) => (b.score || 0) - (a.score || 0));
    this.emit('game:ended', { winner: sorted[0] ?? null, players: sorted });
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
}
