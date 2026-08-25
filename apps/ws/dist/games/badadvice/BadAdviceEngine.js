import { EventEmitter } from 'events';
import { BAD_ADVICE_PROMPTS } from './badAdvicePrompts.js';

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const num = (v, def) => (Number(v) > 0 ? Number(v) : def);

/**
 * Плохой совет (Bad Advice / Patently Stupid стиль).
 * Проблема → все пишут худший/смешной совет → голосование за лучший.
 * Фазы: answering → voting → finished.
 */
export class BadAdviceEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter((p) => !p.isSpectator).map((p) => ({ id: p.id, name: p.name, score: 0 }));
    this.answerTime = num(this.settings.answerTime, 50);
    this.voteTime = num(this.settings.voteTime, 20);
    this.rounds = num(this.settings.rounds, Math.min(5, BAD_ADVICE_PROMPTS.length));
    this.phase = 'waiting';
    this.round = 0;
    this.promptOrder = shuffle(BAD_ADVICE_PROMPTS.map((_, i) => i)).slice(0, this.rounds);
    this.current = null;
    this.timer = null;
    this.timeLeft = 0;
    this._aborted = false;
    this._delay = null;
  }

  start() {
    if (this._aborted) return;
    if (this.players.length < 3) {
      this.phase = 'finished';
      this.emit('game:ended', { winner: null, players: [], reason: 'not-enough-players' });
      return;
    }
    this.phase = 'answering';
    this._startRound();
  }

  _startRound() {
    if (this._aborted) return;
    if (this.round >= this.promptOrder.length) { this.endGame(); return; }
    const prompt = BAD_ADVICE_PROMPTS[this.promptOrder[this.round]];
    this.round++;
    this.current = { prompt, answers: {}, picks: {} };
    this.phase = 'answering';

    this.emit('round:started', {
      round: this.round,
      total: this.promptOrder.length,
      problem: prompt.problem,
      category: prompt.category,
      answerTime: this.answerTime,
    });

    this._clearTimer();
    this.timeLeft = this.answerTime;
    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this._clearTimer();
        if (!this._aborted) this._beginVoting();
      }
    }, 1000);
  }

  submitAnswer(playerId, text) {
    if (this._aborted || this.phase !== 'answering' || !this.current) {
      return { success: false, error: 'Сейчас нельзя' };
    }
    if (!this.players.find((p) => p.id === playerId)) {
      return { success: false, error: 'Вы не в игре' };
    }
    const clean = String(text ?? '').trim().slice(0, 120);
    if (!clean) {
      return { success: false, error: 'Введите совет' };
    }
    if (playerId in this.current.answers) {
      return { success: false, error: 'Вы уже отправили совет' };
    }
    this.current.answers[playerId] = clean;
    this.emit('answer:submitted', { submitted: Object.keys(this.current.answers).length, total: this.players.length });
    if (Object.keys(this.current.answers).length >= this.players.length) {
      this._clearTimer();
      this._beginVoting();
    }
    return { success: true };
  }

  _beginVoting() {
    if (this._aborted || !this.current) return;
    this.phase = 'voting';
    const entries = Object.entries(this.current.answers).map(([authorId, text]) => ({ authorId, text }));
    const shuffled = shuffle(entries);
    this.current.options = shuffled.map((e, i) => ({ id: `o${i}`, text: e.text, authorId: e.authorId }));

    this.emit('voting:started', {
      problem: this.current.prompt.problem,
      category: this.current.prompt.category,
      options: this.current.options.map((o) => ({ id: o.id, text: o.text })),
      voteTime: this.voteTime,
    });

    this._clearTimer();
    this.timeLeft = this.voteTime;
    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this._clearTimer();
        if (!this._aborted) this._resolve();
      }
    }, 1000);
  }

  vote(playerId, optionId) {
    if (this._aborted || this.phase !== 'voting' || !this.current?.options) return { success: false };
    const opt = this.current.options.find((o) => o.id === optionId);
    if (!opt) return { success: false };
    if (opt.authorId === playerId) return { success: false, error: 'Нельзя голосовать за свой совет' };
    if (playerId in this.current.picks) return { success: false, error: 'Вы уже проголосовали' };
    this.current.picks[playerId] = optionId;
    this.emit('vote:cast', { voted: Object.keys(this.current.picks).length, total: this.players.length });
    if (Object.keys(this.current.picks).length >= this.players.length) {
      this._clearTimer();
      this._resolve();
    }
    return { success: true };
  }

  _resolve() {
    if (this._aborted || !this.current?.options) return;
    const { options, picks, prompt } = this.current;
    const nameOf = (id) => this.players.find((p) => p.id === id)?.name ?? '—';

    const tally = {};
    for (const oid of Object.values(picks)) {
      tally[oid] = (tally[oid] || 0) + 1;
    }

    for (const o of options) {
      const votes = tally[o.id] || 0;
      const author = this.players.find((p) => p.id === o.authorId);
      if (author) author.score += votes * 100;
    }

    const results = options
      .map((o) => ({
        id: o.id,
        text: o.text,
        authorId: o.authorId,
        authorName: nameOf(o.authorId),
        votes: tally[o.id] || 0,
        points: (tally[o.id] || 0) * 100,
      }))
      .sort((a, b) => b.votes - a.votes);

    this.current = null;

    this.emit('round:resolved', {
      round: this.round,
      total: this.promptOrder.length,
      problem: prompt.problem,
      category: prompt.category,
      results,
      scoreboard: this._scoreboard(),
    });

    this._delay = setTimeout(() => {
      this._delay = null;
      if (!this._aborted) this._startRound();
    }, 5000);
  }

  _scoreboard() {
    return [...this.players]
      .map((p) => ({ id: p.id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }

  endGame() {
    if (this._aborted) return;
    this.phase = 'finished';
    this._clearTimer();
    if (this._delay) { clearTimeout(this._delay); this._delay = null; }
    const sorted = this._scoreboard();
    this.emit('game:ended', { winner: sorted[0] ?? null, players: sorted });
  }

  _clearTimer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  cleanup() {
    this._aborted = true;
    this._clearTimer();
    if (this._delay) { clearTimeout(this._delay); this._delay = null; }
    this.removeAllListeners();
  }

  getState() {
    return {
      phase: this.phase,
      players: this._scoreboard(),
      round: this.round,
      total: this.promptOrder.length,
      timeLeft: this.timeLeft,
    };
  }
}
