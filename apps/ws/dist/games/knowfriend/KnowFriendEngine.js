import { EventEmitter } from 'events';
import { KNOWFRIEND_QUESTIONS } from './knowfriendQuestions.js';

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
 * Узнай друга. Каждый раунд один игрок — «субъект». Показывается личный вопрос.
 * Субъект отвечает честно, остальные одновременно угадывают его ответ.
 * Очки получают те, кто угадал. Каждый игрок — субъект ровно один раз.
 */
export class KnowFriendEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter((p) => !p.isSpectator).map((p) => ({ id: p.id, name: p.name, score: 0 }));
    this.answerTime = num(this.settings.answerTime, 25);
    this.phase = 'waiting';
    this.round = 0;
    this.subjectOrder = [];
    this.question = null;       // { q, options }
    this.answers = {};          // playerId -> optionIndex
    this.usedQuestions = new Set();
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
    this.subjectOrder = shuffle(this.players.map((p) => p.id));
    this.phase = 'playing';
    this._startRound();
  }

  _pickQuestion() {
    let pool = KNOWFRIEND_QUESTIONS.map((_, i) => i).filter((i) => !this.usedQuestions.has(i));
    if (pool.length === 0) { this.usedQuestions.clear(); pool = KNOWFRIEND_QUESTIONS.map((_, i) => i); }
    const idx = pool[Math.floor(Math.random() * pool.length)];
    this.usedQuestions.add(idx);
    return KNOWFRIEND_QUESTIONS[idx];
  }

  _startRound() {
    if (this._aborted) return;
    if (this.round >= this.subjectOrder.length) { this.endGame(); return; }
    const subjectId = this.subjectOrder[this.round];
    const subject = this.players.find((p) => p.id === subjectId);
    if (!subject) { this.round++; this._startRound(); return; }
    this.round++;
    this.question = this._pickQuestion();
    this.answers = {};

    this.emit('round:started', {
      subjectId,
      subjectName: subject.name,
      question: this.question.q,
      options: this.question.options,
      round: this.round,
      total: this.subjectOrder.length,
      answerTime: this.answerTime,
    });

    this._clearTimer();
    this.timeLeft = this.answerTime;
    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) { this._clearTimer(); if (!this._aborted) this._resolveRound(); }
    }, 1000);
  }

  submitAnswer(playerId, optionIndex) {
    if (this._aborted || this.phase !== 'playing' || !this.question) return false;
    if (!this.players.find((p) => p.id === playerId)) return false;
    const idx = Number(optionIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.question.options.length) return false;
    if (playerId in this.answers) return false;
    this.answers[playerId] = idx;
    this.emit('answer:submitted', { playerId, answered: Object.keys(this.answers).length, total: this.players.length });
    if (Object.keys(this.answers).length >= this.players.length) {
      this._clearTimer();
      this._resolveRound();
    }
    return true;
  }

  _resolveRound() {
    if (this._aborted || !this.question) return;
    const subjectId = this.subjectOrder[this.round - 1];
    const subject = this.players.find((p) => p.id === subjectId);
    const subjectAnswer = this.answers[subjectId];
    const hasTruth = Number.isInteger(subjectAnswer);

    const results = this.players
      .filter((p) => p.id !== subjectId)
      .map((p) => {
        const guess = this.answers[p.id];
        const guessed = Number.isInteger(guess);
        const correct = hasTruth && guessed && guess === subjectAnswer;
        if (correct) p.score += 100;
        return {
          id: p.id,
          name: p.name,
          guess: guessed ? this.question.options[guess] : '—',
          correct,
        };
      });

    this.emit('round:ended', {
      subjectName: subject?.name ?? '—',
      question: this.question.q,
      subjectAnswer: hasTruth ? this.question.options[subjectAnswer] : null,
      results,
      scoreboard: this._scoreboard(),
    });

    if (this._delay) clearTimeout(this._delay);
    this._delay = setTimeout(() => {
      this._delay = null;
      if (!this._aborted) this._startRound();
    }, 5000);
  }

  _scoreboard() {
    return [...this.players].map((p) => ({ id: p.id, name: p.name, score: p.score })).sort((a, b) => b.score - a.score);
  }

  endGame() {
    if (this._aborted) return;
    this.phase = 'finished';
    this._clearTimer();
    if (this._delay) { clearTimeout(this._delay); this._delay = null; }
    const sorted = this._scoreboard();
    this.emit('game:ended', { winner: sorted[0] ?? null, players: sorted });
  }

  _clearTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  cleanup() {
    this._aborted = true;
    this._clearTimer();
    if (this._delay) { clearTimeout(this._delay); this._delay = null; }
    this.removeAllListeners();
  }

  getState() {
    return { phase: this.phase, players: this._scoreboard(), round: this.round, total: this.subjectOrder.length, timeLeft: this.timeLeft };
  }
}
