import { EventEmitter } from 'events';

const PROFESSIONS = [
  ['Врач', 'Медсестра'],
  ['Учитель', 'Воспитатель'],
  ['Повар', 'Официант'],
  ['Программист', 'Тестировщик'],
  ['Художник', 'Дизайнер'],
  ['Адвокат', 'Судья'],
  ['Журналист', 'Редактор'],
  ['Инженер', 'Техник'],
  ['Пилот', 'Стюардесса'],
  ['Водитель', 'Таксист'],
  ['Актер', 'Режиссер'],
  ['Бухгалтер', 'Экономист'],
  ['Строитель', 'Архитектор'],
  ['Полицейский', 'Детектив'],
  ['Фермер', 'Агроном'],
  ['Фотограф', 'Видеограф'],
  ['Музыкант', 'Композитор'],
  ['Спортсмен', 'Тренер'],
  ['Ученый', 'Исследователь'],
  ['Продавец', 'Менеджер'],
];

export class ImpostorEngine extends EventEmitter {
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
    this.impostorId = null;
    this.realProfession = null;
    this.fakeProfession = null;
    this.votes = new Map();
    this.usedIndices = new Set();
    this.discussionTime = this.settings.discussionTime ?? 90;
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

    this.votes.clear();
    this.impostorId = this.players[Math.floor(Math.random() * this.players.length)].id;

    let available = PROFESSIONS.map((_, i) => i).filter(i => !this.usedIndices.has(i));
    if (available.length === 0) {
      this.usedIndices.clear();
      available = PROFESSIONS.map((_, i) => i);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    const [real, fake] = PROFESSIONS[idx];
    this.usedIndices.add(idx);
    this.realProfession = real;
    this.fakeProfession = fake;

    this.phase = 'discussion';
    this.timeLeft = this.discussionTime;

    this.emit('game:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isImpostor: p.id === this.impostorId,
        profession: p.id === this.impostorId ? this.fakeProfession : this.realProfession,
      })),
    });

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
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

  startVoting() {
    if (this._aborted) return;
    this.phase = 'voting';
    this.timeLeft = this.voteTime;
    this.emit('voting:started', {
      candidates: this.players.filter(p => p.id !== this.impostorId).map(p => ({ id: p.id, name: p.name })),
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

  vote(playerId, targetId) {
    if (this._aborted) return false;
    if (this.phase !== 'voting') return false;
    if (this.votes.has(playerId)) return false;
    if (!this.players.find(p => p.id === targetId)) return false;

    this.votes.set(playerId, targetId);
    this.emit('vote:cast', { playerId, total: this.votes.size, required: this.players.length });

    if (this.votes.size >= this.players.length) {
      this.stopTimer();
      if (!this._aborted) this.resolveRound();
    }
    return true;
  }

  resolveRound() {
    if (this._aborted) return;
    if (this.phase === 'results') return;
    this.phase = 'results';
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    const counts = new Map();
    for (const tid of this.votes.values()) {
      counts.set(tid, (counts.get(tid) || 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const votedOut = sorted[0]?.[0] ?? null;
    const caught = votedOut === this.impostorId;

    if (caught) {
      const p = this.players.find(x => x.id === this.impostorId);
      if (p) p.score = (p.score || 0) - 1;
      this.players.filter(p => p.id !== this.impostorId).forEach(p => {
        p.score = (p.score || 0) + 1;
      });
    } else if (votedOut) {
      const p = this.players.find(x => x.id === this.impostorId);
      if (p) p.score = (p.score || 0) + 2;
    }

    this.emit('round:ended', {
      round: this.round,
      impostorId: this.impostorId,
      votedOut,
      caught,
      realProfession: this.realProfession,
      fakeProfession: this.fakeProfession,
    });
    this.emit('score:updated', { players: this.players });

    if (this.round >= this.maxRounds) {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.endGame();
      }, 4000);
    } else {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.nextRound();
      }, 4000);
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
