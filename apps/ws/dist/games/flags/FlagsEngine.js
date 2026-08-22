import { EventEmitter } from 'events';

const FLAGS = [
  { emoji: '🇷🇺', country: 'Россия' },
  { emoji: '🇺🇸', country: 'США' },
  { emoji: '🇬🇧', country: 'Великобритания' },
  { emoji: '🇫🇷', country: 'Франция' },
  { emoji: '🇩🇪', country: 'Германия' },
  { emoji: '🇮🇹', country: 'Италия' },
  { emoji: '🇪🇸', country: 'Испания' },
  { emoji: '🇨🇳', country: 'Китай' },
  { emoji: '🇯🇵', country: 'Япония' },
  { emoji: '🇧🇷', country: 'Бразилия' },
  { emoji: '🇮🇳', country: 'Индия' },
  { emoji: '🇨🇦', country: 'Канада' },
  { emoji: '🇦🇺', country: 'Австралия' },
  { emoji: '🇲🇽', country: 'Мексика' },
  { emoji: '🇰🇷', country: 'Южная Корея' },
  { emoji: '🇳🇱', country: 'Нидерланды' },
  { emoji: '🇧🇪', country: 'Бельгия' },
  { emoji: '🇵🇱', country: 'Польша' },
  { emoji: '🇺🇦', country: 'Украина' },
  { emoji: '🇹🇷', country: 'Турция' },
  { emoji: '🇪🇬', country: 'Египет' },
  { emoji: '🇸🇪', country: 'Швеция' },
  { emoji: '🇳🇴', country: 'Норвегия' },
  { emoji: '🇫🇮', country: 'Финляндия' },
  { emoji: '🇨🇭', country: 'Швейцария' },
  { emoji: '🇦🇹', country: 'Австрия' },
  { emoji: '🇦🇷', country: 'Аргентина' },
  { emoji: '🇿🇦', country: 'ЮАР' },
  { emoji: '🇵🇹', country: 'Португалия' },
];

function normalize(s) {
  return String(s ?? '').trim().toLowerCase().replace(/ё/g, 'е');
}

export class FlagsEngine extends EventEmitter {
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
    this.currentFlag = null;
    this.usedIndices = new Set();
    this.roundTime = this.settings.roundTime ?? 15;
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

    let available = FLAGS.map((_, i) => i).filter(i => !this.usedIndices.has(i));
    if (available.length === 0) {
      this.usedIndices.clear();
      available = FLAGS.map((_, i) => i);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    this.usedIndices.add(idx);
    this.currentFlag = FLAGS[idx];

    this.phase = 'guessing';
    this.timeLeft = this.roundTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      emoji: this.currentFlag.emoji,
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
    const correct = normalize(this.currentFlag.country) === guess || guess === normalize(this.currentFlag.country);

    if (correct) {
      this.stopTimer();
      const p = this.players.find(x => x.id === playerId);
      if (p) p.score = (p.score || 0) + Math.max(1, Math.floor(this.timeLeft / 3));

      this.emit('word:guessed', {
        playerId,
        playerName: p?.name,
        answer: this.currentFlag.country,
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
      country: this.currentFlag?.country,
      emoji: this.currentFlag?.emoji,
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
