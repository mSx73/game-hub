import { EventEmitter } from 'events';
import { getShuffledQuestions } from './triviaQuestions.js';

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
 * Trivia Murder Party — квиз с выбыванием.
 * Фазы: question → kill-screen → reveal → (повтор) → finished.
 * Неверный ответ → мини-игра на выживание. Провал = выбывание.
 * Очки: +100 за верный ответ + бонус за быстроту. За убийство выжившего: +50.
 */
export class TriviaMurderEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players
      .filter((p) => !p.isSpectator)
      .map((p) => ({ id: p.id, name: p.name, score: 0, alive: true }));
    this.answerTime = num(this.settings.answerTime, 20);
    this.killScreenTime = num(this.settings.killScreenTime, 8);
    this.phase = 'waiting';
    this.round = 0;
    this.totalRounds = num(this.settings.rounds, Math.min(10, getShuffledQuestions(50).length));
    this.questions = getShuffledQuestions(this.totalRounds);
    this.current = null;
    this.timer = null;
    this.timeLeft = 0;
    this._aborted = false;
    this._delay = null;
  }

  start() {
    if (this._aborted) return;
    if (this.players.length < 2) {
      this.phase = 'finished';
      this.emit('game:ended', { winner: null, players: [], reason: 'not-enough-players' });
      return;
    }
    this.phase = 'question';
    this._startRound();
  }

  _startRound() {
    if (this._aborted) return;
    if (this.round >= this.questions.length || this._survivors().length === 0) {
      this.endGame();
      return;
    }

    const q = this.questions[this.round];
    this.round++;
    this.current = q;
    this.answers = {};
    this.phase = 'question';

    this.emit('round:started', {
      round: this.round,
      total: this.questions.length,
      question: q.q,
      options: q.options.map((text, i) => ({ id: `o${i}`, text })),
      answerTime: this.answerTime,
      alive: this._survivors().map((p) => ({ id: p.id, name: p.name })),
    });

    this._clearTimer();
    this.timeLeft = this.answerTime;
    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this._clearTimer();
        if (!this._aborted) this._resolveAnswers();
      }
    }, 1000);
  }

  submitAnswer(playerId, optionIndex) {
    if (this._aborted || this.phase !== 'question' || !this.current) return { success: false, error: 'Сейчас нельзя' };
    const p = this.players.find((x) => x.id === playerId);
    if (!p) return { success: false, error: 'Вы не в игре' };
    if (!p.alive) return { success: false, error: 'Вы выбыли' };
    if (playerId in this.answers) return { success: false, error: 'Вы уже ответили' };
    const idx = Number(optionIndex);
    if (Number.isNaN(idx) || idx < 0 || idx > 3) return { success: false, error: 'Неверный вариант' };

    this.answers[playerId] = idx;
    const elapsed = this.answerTime - this.timeLeft;
    this.emit('answer:submitted', {
      submitted: Object.keys(this.answers).length,
      total: this._survivors().length,
    });

    if (Object.keys(this.answers).length >= this._survivors().length) {
      this._clearTimer();
      this._resolveAnswers();
    }
    return { success: true, elapsed };
  }

  _resolveAnswers() {
    if (this._aborted) return;
    const q = this.questions[this.round - 1];
    const correct = [];
    const wrong = [];

    for (const p of this._survivors()) {
      const ans = this.answers[p.id];
      if (ans === q.answer) {
        correct.push(p);
        const elapsed = this.answerTime - this.timeLeft;
        const speedBonus = Math.max(0, Math.floor((this.answerTime - elapsed) / this.answerTime * 50));
        p.score += 100 + speedBonus;
      } else {
        wrong.push(p);
      }
    }

    this.emit('round:ended', {
      round: this.round,
      question: q.q,
      options: q.options.map((text, i) => ({ id: `o${i}`, text, isCorrect: i === q.answer })),
      correct: correct.map((p) => ({ id: p.id, name: p.name })),
      wrong: wrong.map((p) => ({ id: p.id, name: p.name })),
      scoreboard: this._scoreboard(),
    });

    if (wrong.length === 0) {
      this._delay = setTimeout(() => {
        this._delay = null;
        if (!this._aborted) this._startRound();
      }, 4000);
      return;
    }

    this._clearTimer();
    this.phase = 'kill-screen';
    this.killTargets = wrong;
    this.killAnswers = {};

    const killOptions = shuffle([
      { id: 'k0', text: '🟢' },
      { id: 'k1', text: '💀' },
      { id: 'k2', text: '🟢' },
      { id: 'k3', text: '🟢' },
    ]);
    this.killCorrectId = killOptions.find((o) => o.text === '💀').id;

    this.emit('kill:started', {
      targets: wrong.map((p) => ({ id: p.id, name: p.name })),
      options: killOptions,
      killScreenTime: this.killScreenTime,
    });

    this._clearTimer();
    this.timeLeft = this.killScreenTime;
    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this._clearTimer();
        if (!this._aborted) this._resolveKillScreen();
      }
    }, 1000);
  }

  submitKillChoice(playerId, optionId) {
    if (this._aborted || this.phase !== 'kill-screen') return { success: false, error: 'Сейчас нельзя' };
    if (!this.killTargets?.some((p) => p.id === playerId)) return { success: false, error: 'Вы не в зоне риска' };
    if (playerId in this.killAnswers) return { success: false, error: 'Вы уже выбрали' };

    this.killAnswers[playerId] = optionId;
    this.emit('kill:choice-submitted', {
      submitted: Object.keys(this.killAnswers).length,
      total: this.killTargets.length,
    });

    if (Object.keys(this.killAnswers).length >= this.killTargets.length) {
      this._clearTimer();
      this._resolveKillScreen();
    }
    return { success: true };
  }

  _resolveKillScreen() {
    if (this._aborted) return;
    const killed = [];
    const survived = [];

    for (const p of this.killTargets) {
      const choice = this.killAnswers[p.id];
      if (choice === this.killCorrectId) {
        survived.push(p);
      } else {
        p.alive = false;
        killed.push(p);
        const killer = this._survivors()[Math.floor(Math.random() * this._survivors().length)];
        if (killer) killer.score += 50;
      }
    }

    this.emit('kill:resolved', {
      killed: killed.map((p) => ({ id: p.id, name: p.name })),
      survived: survived.map((p) => ({ id: p.id, name: p.name })),
      correctOptionId: this.killCorrectId,
      scoreboard: this._scoreboard(),
    });

    this.killTargets = null;
    this.killAnswers = {};

    this._delay = setTimeout(() => {
      this._delay = null;
      if (!this._aborted) this._startRound();
    }, 4000);
  }

  _survivors() {
    return this.players.filter((p) => p.alive);
  }

  _scoreboard() {
    return [...this.players]
      .map((p) => ({ id: p.id, name: p.name, score: p.score, alive: p.alive }))
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
      total: this.questions.length,
      timeLeft: this.timeLeft,
    };
  }
}
