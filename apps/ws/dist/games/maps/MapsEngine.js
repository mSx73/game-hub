import { EventEmitter } from 'events';

const PLACES = [
  { hint: 'Красная площадь, мавзолей, Кремль', answer: 'Москва' },
  { hint: 'Эрмитаж, белые ночи, Нева', answer: 'Санкт-Петербург' },
  { hint: 'Эйфелева башня, Лувр, Сена', answer: 'Париж' },
  { hint: 'Биг-Бен, Тауэр, Темза', answer: 'Лондон' },
  { hint: 'Колизей, Ватикан рядом', answer: 'Рим' },
  { hint: 'Статуя Свободы, Таймс-сквер', answer: 'Нью-Йорк' },
  { hint: 'Парфенон, Акрополь', answer: 'Афины' },
  { hint: 'Саграда Фамилия, Гауди', answer: 'Барселона' },
  { hint: 'Пирамиды, сфинкс', answer: 'Каир' },
  { hint: 'Фудзияма, неон, храмы', answer: 'Токио' },
  { hint: 'Великая стена, Запретный город', answer: 'Пекин' },
  { hint: 'Опера, мост Харбор', answer: 'Сидней' },
  { hint: 'Кремль, Казань', answer: 'Казань' },
  { hint: 'Невский проспект, Дворцовая', answer: 'Санкт-Петербург' },
  { hint: 'Мамаев курган, Волга', answer: 'Волгоград' },
  { hint: 'Олимпийский парк, море', answer: 'Сочи' },
  { hint: 'Кижи, Онежское озеро', answer: 'Петрозаводск' },
  { hint: 'Байкал, Ангара', answer: 'Иркутск' },
  { hint: 'Амстердам, каналы', answer: 'Амстердам' },
  { hint: 'Прага, Карлов мост', answer: 'Прага' },
];

function normalize(s) {
  return String(s ?? '').trim().toLowerCase().replace(/ё/g, 'е');
}

export class MapsEngine extends EventEmitter {
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
    this.currentPlace = null;
    this.usedIndices = new Set();
    this.roundTime = this.settings.roundTime ?? 25;
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

    let available = PLACES.map((_, i) => i).filter(i => !this.usedIndices.has(i));
    if (available.length === 0) {
      this.usedIndices.clear();
      available = PLACES.map((_, i) => i);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    this.usedIndices.add(idx);
    this.currentPlace = PLACES[idx];

    this.phase = 'guessing';
    this.timeLeft = this.roundTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      hint: this.currentPlace.hint,
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
    const correct = normalize(this.currentPlace.answer) === guess;

    if (correct) {
      this.stopTimer();
      const p = this.players.find(x => x.id === playerId);
      if (p) p.score = (p.score || 0) + Math.max(1, Math.floor(this.timeLeft / 5));

      this.emit('word:guessed', {
        playerId,
        playerName: p?.name,
        answer: this.currentPlace.answer,
      });
      this.emit('score:updated', { players: this.players });
      this.endRound();
    }
    return true;
  }

  endRound() {
    if (this._aborted) return;
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.emit('round:ended', {
      round: this.round,
      answer: this.currentPlace?.answer,
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
