import { EventEmitter } from 'events';

const PRODUCTS = [
  { name: 'iPhone 15 Pro 256GB', price: 129990 },
  { name: '1 кг бананов', price: 109 },
  { name: 'Билет в кино (IMAX)', price: 650 },
  { name: 'PlayStation 5', price: 54990 },
  { name: 'Проезд в метро (1 поездка, Москва)', price: 57 },
  { name: 'Литр бензина АИ-95', price: 58 },
  { name: 'Кроссовки Nike Air Max', price: 12990 },
  { name: 'Большая пицца Пепперони (Додо)', price: 699 },
  { name: 'MacBook Air M2', price: 109990 },
  { name: 'Авиабилет Москва — Сочи (туда)', price: 5500 },
  { name: 'Подписка Яндекс.Плюс (месяц)', price: 299 },
  { name: 'Samsung Galaxy S24', price: 89990 },
  { name: 'Литр молока 3.2%', price: 89 },
  { name: 'Шоколадка Алёнка 100г', price: 109 },
  { name: 'Букет из 11 роз', price: 3500 },
  { name: 'Стрижка в барбершопе', price: 1500 },
  { name: 'Средний капучино (кофейня)', price: 350 },
  { name: 'Набор LEGO Technic (500+ деталей)', price: 7990 },
  { name: 'Книга (новинка, мягкая обложка)', price: 650 },
  { name: 'Годовой абонемент в фитнес-зал', price: 30000 },
  { name: 'Nintendo Switch OLED', price: 34990 },
  { name: 'Билет в Большой театр (балкон)', price: 3000 },
  { name: '1 кг куриного филе', price: 340 },
  { name: 'Такси 10 км по Москве', price: 450 },
  { name: 'Робот-пылесос Xiaomi', price: 19990 },
  { name: 'Доставка суши-сета на двоих', price: 2200 },
  { name: 'AirPods Pro 2', price: 22990 },
  { name: 'Хлеб белый батон', price: 65 },
  { name: 'Десяток яиц С1', price: 120 },
  { name: 'Электросамокат Xiaomi', price: 34990 },
  { name: 'Футболка Uniqlo', price: 1499 },
  { name: 'Абонемент на 8 уроков английского', price: 8000 },
  { name: 'Торт на заказ (2 кг)', price: 4500 },
  { name: 'JBL-колонка портативная', price: 5990 },
  { name: 'Билет на концерт популярного артиста', price: 5000 },
];

export class PriceEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 1;
    this.maxRounds = this.settings.maxRounds ?? 10;
    this.currentProduct = null;
    this.guesses = new Map();
    this.usedProducts = new Set();
    this.guessTime = this.settings.guessTime ?? 30;
    this.pointsForClosest = this.settings.pointsForClosest ?? 2;
    this.pointsForExact = this.settings.pointsForExact ?? 5;
    this.noOverbidRule = this.settings.noOverbidRule !== false;
    this._aborted = false;
    this._roundDelayTimeout = null;
  }

  start() {
    if (this._aborted) return;
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

    this.guesses.clear();

    let availableIndices = PRODUCTS.map((_, i) => i).filter((i) => !this.usedProducts.has(i));
    if (availableIndices.length === 0) {
      this.usedProducts.clear();
      availableIndices = PRODUCTS.map((_, i) => i);
    }
    const prodIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedProducts.add(prodIdx);
    this.currentProduct = PRODUCTS[prodIdx];

    this.phase = 'guessing';
    this.timeLeft = this.guessTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      product: this.currentProduct.name,
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

  submitGuess(playerId, price) {
    if (this._aborted) return false;
    if (this.phase !== 'guessing') return false;
    if (this.guesses.has(playerId)) return false;
    if (!this.players.find(p => p.id === playerId)) return false;

    const numericPrice = parseInt(price, 10);
    if (isNaN(numericPrice) || numericPrice < 0) return false;

    this.guesses.set(playerId, numericPrice);
    this.emit('answer:submitted', { playerId, total: this.guesses.size, required: this.players.length });

    if (this.guesses.size >= this.players.length) {
      this.stopTimer();
      if (!this._aborted) this.resolveRound();
    }
    return true;
  }

  resolveRound() {
    if (this._aborted) return;
    if (!this.currentProduct) return;
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    const actual = this.currentProduct.price;

    const withGuesses = this.players
      .filter((p) => this.guesses.has(p.id))
      .map((p) => ({
        player: p,
        guess: this.guesses.get(p.id),
        diff: this.guesses.get(p.id) - actual,
        over: this.guesses.get(p.id) > actual,
      }));

    let winners = [];
    if (withGuesses.length > 0) {
      if (this.noOverbidRule) {
        const under = withGuesses.filter((g) => !g.over);
        const pool = under.length > 0 ? under : withGuesses.filter((g) => g.over);
        // When all overbid: winner = smallest overbid (closest to price)
        if (pool.length > 0) {
          const bestDiff = under.length > 0
            ? Math.min(...pool.map((g) => Math.abs(g.diff)))
            : Math.min(...pool.map((g) => g.diff));
          winners = pool.filter((g) =>
            under.length > 0 ? Math.abs(g.diff) === bestDiff : g.diff === bestDiff
          );
        }
      } else {
        const bestDiff = Math.min(...withGuesses.map((g) => Math.abs(g.diff)));
        winners = withGuesses.filter((g) => Math.abs(g.diff) === bestDiff);
      }
    }

    const results = this.players.map((p) => {
      const g = withGuesses.find((w) => w.player.id === p.id);
      const diff = g?.diff ?? null;
      const over = g?.over ?? false;
      let earned = 0;
      const isWinner = winners.some((w) => w.player.id === p.id);
      if (isWinner && g) {
        earned = g.guess === actual ? this.pointsForExact : this.pointsForClosest;
        p.score += earned;
      }
      return { id: p.id, name: p.name, guess: g?.guess ?? null, diff, over, earned };
    });

    this.emit('round:ended', {
      round: this.round,
      product: this.currentProduct.name,
      actualPrice: actual,
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
    this.removeAllListeners();
  }

  getState() {
    return {
      phase: this.phase,
      players: this.players,
      round: this.round,
      maxRounds: this.maxRounds,
      timeLeft: this.timeLeft,
      currentProduct: this.currentProduct ? this.currentProduct.name : null,
      guessesCount: this.guesses.size,
    };
  }
}
