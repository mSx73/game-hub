import { EventEmitter } from 'events';

const PROMPTS = [
  'Кот в коробке',
  'Собака на диване',
  'Человек под дождём',
  'Торт на столе',
  'Телефон в руке',
  'Книга на полке',
  'Машина в гараже',
  'Цветок в вазе',
  'Птица на ветке',
  'Рыба в аквариуме',
  'Пицца в коробке',
  'Кофе на столе',
  'Очки на носу',
  'Шляпа на голове',
  'Ключи в кучке',
  'Будильник утром',
  'Зонт в ливень',
  'Снеговик зимой',
  'Пляж летом',
  'Дедлайн в понедельник',
];

export class CaptionEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 0;
    this.maxRounds = this.settings.maxRounds ?? 6;
    this.currentPrompt = null;
    this.submissions = new Map();
    this.votes = new Map();
    this.judgeId = null;
    this.usedIndices = new Set();
    this.answerTime = this.settings.answerTime ?? 30;
    this.voteTime = this.settings.voteTime ?? 20;
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

    this.submissions.clear();
    this.votes.clear();
    this.judgeId = this.players[this.round % this.players.length].id;

    let available = PROMPTS.map((_, i) => i).filter(i => !this.usedIndices.has(i));
    if (available.length === 0) {
      this.usedIndices.clear();
      available = PROMPTS.map((_, i) => i);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    this.usedIndices.add(idx);
    this.currentPrompt = PROMPTS[idx];

    this.phase = 'answering';
    this.timeLeft = this.answerTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      prompt: this.currentPrompt,
      judgeId: this.judgeId,
      judgeName: this.players.find(p => p.id === this.judgeId)?.name,
      timeLeft: this.timeLeft,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.startVoting();
      }
    }, 1000);
  }

  handleChat(playerId, message) {
    if (this._aborted) return false;
    if (this.phase === 'answering' && playerId !== this.judgeId) {
      return this.submitAnswer(playerId, message);
    }
    return false;
  }

  submitAnswer(playerId, text) {
    if (this._aborted) return false;
    if (this.phase !== 'answering') return false;
    if (playerId === this.judgeId) return false;
    if (this.submissions.has(playerId)) return false;

    const trimmed = String(text ?? '').trim().slice(0, 200);
    if (!trimmed) return false;

    this.submissions.set(playerId, trimmed);
    this.emit('answer:submitted', { playerId, total: this.submissions.size, required: this.players.length - 1 });

    if (this.submissions.size >= this.players.length - 1) {
      this.stopTimer();
      if (!this._aborted) this.startVoting();
    }
    return true;
  }

  startVoting() {
    if (this._aborted) return;
    this.phase = 'voting';
    const entries = [...this.submissions.entries()].sort(() => Math.random() - 0.5);
    this.timeLeft = this.voteTime;

    this.emit('voting:started', {
      prompt: this.currentPrompt,
      submissions: entries.map(([id, text], i) => ({
        index: i,
        playerId: id,
        playerName: this.players.find(p => p.id === id)?.name,
        text,
      })),
      judgeId: this.judgeId,
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

  castVote(playerId, answerIdx) {
    if (this._aborted) return false;
    if (this.phase !== 'voting' || playerId !== this.judgeId) return false;
    const idx = Number(answerIdx ?? -1);
    const entries = [...this.submissions.entries()];
    if (!Number.isFinite(idx) || idx < 0 || idx >= entries.length) return false;

    this.votes.set(playerId, entries[idx][0]);
    this.stopTimer();
    if (!this._aborted) this.resolveRound();
    return true;
  }

  resolveRound() {
    if (this._aborted) return;
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    const winnerId = this.votes.get(this.judgeId);
    if (winnerId) {
      const p = this.players.find(x => x.id === winnerId);
      if (p) p.score = (p.score || 0) + 3;
    }

    this.emit('round:ended', {
      round: this.round,
      prompt: this.currentPrompt,
      winnerId,
      winnerName: winnerId ? this.players.find(p => p.id === winnerId)?.name : null,
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
