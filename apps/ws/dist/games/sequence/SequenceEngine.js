import { EventEmitter } from 'events';

const SEQUENCES = [
  { seq: [2, 4, 6, 8], answer: 10, hint: '2, 4, 6, 8, ?' },
  { seq: [1, 2, 4, 8], answer: 16, hint: '1, 2, 4, 8, ?' },
  { seq: [1, 1, 2, 3, 5], answer: 8, hint: '1, 1, 2, 3, 5, ?' },
  { seq: [3, 6, 9, 12], answer: 15, hint: '3, 6, 9, 12, ?' },
  { seq: [1, 4, 9, 16], answer: 25, hint: '1, 4, 9, 16, ?' },
  { seq: [5, 10, 15, 20], answer: 25, hint: '5, 10, 15, 20, ?' },
  { seq: [1, 3, 6, 10], answer: 15, hint: '1, 3, 6, 10, ?' },
  { seq: [2, 3, 5, 7], answer: 11, hint: '2, 3, 5, 7, ?' },
  { seq: [1, 2, 3, 5, 8], answer: 13, hint: '1, 2, 3, 5, 8, ?' },
  { seq: [10, 20, 30, 40], answer: 50, hint: '10, 20, 30, 40, ?' },
  { seq: [1, 8, 27, 64], answer: 125, hint: '1, 8, 27, 64, ?' },
  { seq: [2, 6, 12, 20], answer: 30, hint: '2, 6, 12, 20, ?' },
  { seq: [1, 4, 7, 10], answer: 13, hint: '1, 4, 7, 10, ?' },
  { seq: [100, 90, 80, 70], answer: 60, hint: '100, 90, 80, 70, ?' },
  { seq: [1, 2, 4, 7, 11], answer: 16, hint: '1, 2, 4, 7, 11, ?' },
  { seq: [1, 2, 3, 4], answer: 5, hint: '1, 2, 3, 4, ?' },
];

function parseAnswer(msg) {
  const s = String(msg || '').trim();
  const num = parseInt(s, 10);
  if (!isNaN(num)) return num;
  return null;
}

export class SequenceEngine extends EventEmitter {
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
    this.answerTime = this.settings.answerTime ?? 15;
    this.currentSeq = null;
    this.usedIndices = new Set();
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
    // После endRound() фаза «results» — без этого handleChat не принимает ответы со 2-го раунда
    this.phase = 'playing';
    this.round++;
    if (this.round > this.maxRounds) {
      this.endGame();
      return;
    }

    let available = SEQUENCES.map((_, i) => i).filter(i => !this.usedIndices.has(i));
    if (available.length === 0) {
      this.usedIndices.clear();
      available = SEQUENCES.map((_, i) => i);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    this.usedIndices.add(idx);
    this.currentSeq = SEQUENCES[idx];
    this.timeLeft = this.answerTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      hint: this.currentSeq.hint,
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
    if (this.phase !== 'playing' || !this.currentSeq) return false;

    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;

    const ans = parseAnswer(message);
    if (ans === null) return false;

    if (ans !== this.currentSeq.answer) return false;

    this.stopTimer();
    if (this._aborted) return false;
    player.score = (player.score || 0) + 1;

    this.emit('answer:accepted', {
      playerId,
      playerName: player.name,
      answer: ans,
    });
    this.emit('score:updated', { players: this.players });
    this.endRound();
    return true;
  }

  endRound() {
    if (this._aborted) return;
    if (this.phase === 'results') return;
    this.phase = 'results';
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.emit('round:ended', {
      round: this.round,
      hint: this.currentSeq?.hint,
      answer: this.currentSeq?.answer,
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
