import { EventEmitter } from 'events';

const BRANDS = [
  { hint: 'Газировка с красной этикеткой', answer: 'Кока-Кола' },
  { hint: 'Гаджеты с яблоком', answer: 'Apple' },
  { hint: 'Поисковик и браузер', answer: 'Google' },
  { hint: 'Соцсеть с голубым F', answer: 'Facebook' },
  { hint: 'Кроссовки с галочкой', answer: 'Nike' },
  { hint: 'Три полоски на спортивной одежде', answer: 'Adidas' },
  { hint: 'Фастфуд с золотыми арками', answer: 'Макдональдс' },
  { hint: 'Кофе с русалкой', answer: 'Starbucks' },
  { hint: 'Телефон с самсунгом', answer: 'Samsung' },
  { hint: 'Машины с четырьмя кольцами', answer: 'Audi' },
  { hint: 'Машины с тройкой', answer: 'BMW' },
  { hint: 'Машины с трёхлучевой звездой', answer: 'Mercedes' },
  { hint: 'Видео с красным play', answer: 'YouTube' },
  { hint: 'Мессенджер с самолётиком', answer: 'Telegram' },
  { hint: 'Мессенджер с зелёным пузырём', answer: 'WhatsApp' },
  { hint: 'Магазин с улыбкой', answer: 'Amazon' },
  { hint: 'Микрософт с окнами', answer: 'Microsoft' },
  { hint: 'Соцсеть с камерой', answer: 'Instagram' },
  { hint: 'Пицца с хитом', answer: 'Додо Пицца' },
  { hint: 'Такси с жёлтым', answer: 'Яндекс' },
  { hint: 'Банк с зелёным', answer: 'Сбербанк' },
  { hint: 'Еда с оранжевым', answer: 'Delivery Club' },
  { hint: 'Видео с красным', answer: 'VK Видео' },
  { hint: 'Музыка с зелёным', answer: 'Spotify' },
  { hint: 'Кроссовки с пузырем', answer: 'Reebok' },
];

function normalize(s) {
  return String(s ?? '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

export class LogosEngine extends EventEmitter {
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
    this.currentBrand = null;
    this.usedIndices = new Set();
    this.roundTime = this.settings.roundTime ?? 20;
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

    let available = BRANDS.map((_, i) => i).filter(i => !this.usedIndices.has(i));
    if (available.length === 0) {
      this.usedIndices.clear();
      available = BRANDS.map((_, i) => i);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    this.usedIndices.add(idx);
    this.currentBrand = BRANDS[idx];

    this.phase = 'guessing';
    this.timeLeft = this.roundTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      hint: this.currentBrand.hint,
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
    const correct = normalize(this.currentBrand.answer) === guess;

    if (correct) {
      this.stopTimer();
      const p = this.players.find(x => x.id === playerId);
      if (p) p.score = (p.score || 0) + Math.max(1, Math.floor(this.timeLeft / 5));

      this.emit('word:guessed', {
        playerId,
        playerName: p?.name,
        answer: this.currentBrand.answer,
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
      answer: this.currentBrand?.answer,
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
