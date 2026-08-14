import { EventEmitter } from 'events';
import { FIBBAGE_FACTS } from './fibbageFacts.js';

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const num = (v, def) => (Number(v) > 0 ? Number(v) : def);
const normalize = (s) => String(s ?? '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');

/**
 * Предательский квиз (Fibbage). Факт с пропуском и одним верным ответом.
 * Игроки придумывают правдоподобную ложь → затем все ищут правду среди вариантов.
 * Очки: за найденную правду (+500) и за каждого, кто купился на твою ложь (+100).
 * Фазы: lies → choosing → reveal.
 */
export class FibbageEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter((p) => !p.isSpectator).map((p) => ({ id: p.id, name: p.name, score: 0 }));
    this.lieTime = num(this.settings.lieTime, 45);
    this.chooseTime = num(this.settings.chooseTime, 25);
    this.phase = 'waiting';
    this.round = 0;
    this.rounds = num(this.settings.rounds, Math.min(5, FIBBAGE_FACTS.length));
    this.questionOrder = shuffle(FIBBAGE_FACTS.map((_, i) => i)).slice(0, this.rounds);
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
    this.phase = 'lies';
    this._startRound();
  }

  _startRound() {
    if (this._aborted) return;
    if (this.round >= this.questionOrder.length) { this.endGame(); return; }
    const fact = FIBBAGE_FACTS[this.questionOrder[this.round]];
    this.round++;
    this.current = { fact, lies: {}, options: null, picks: {} };
    this.phase = 'lies';

    this.emit('round:started', {
      round: this.round,
      total: this.questionOrder.length,
      question: fact.q,
      lieTime: this.lieTime,
    });

    this._clearTimer();
    this.timeLeft = this.lieTime;
    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) { this._clearTimer(); if (!this._aborted) this._beginChoosing(); }
    }, 1000);
  }

  submitLie(playerId, text) {
    if (this._aborted || this.phase !== 'lies' || !this.current) return { success: false, error: 'Сейчас нельзя' };
    if (!this.players.find((p) => p.id === playerId)) return { success: false, error: 'Вы не в игре' };
    const raw = String(text ?? '').trim().slice(0, 60);
    const norm = normalize(raw);
    if (!norm) return { success: false, error: 'Введите вариант ответа' };
    if (norm === normalize(this.current.fact.answer)) {
      return { success: false, error: 'Это правильный ответ! Придумайте правдоподобную ложь' };
    }
    if (Object.values(this.current.lies).some((l) => normalize(l) === norm)) {
      return { success: false, error: 'Такой вариант уже придумали — попробуйте другой' };
    }
    if (playerId in this.current.lies) return { success: false, error: 'Вы уже отправили ложь' };
    this.current.lies[playerId] = raw;
    this.emit('answer:submitted', { submitted: Object.keys(this.current.lies).length, total: this.players.length });
    if (Object.keys(this.current.lies).length >= this.players.length) {
      this._clearTimer();
      this._beginChoosing();
    }
    return { success: true };
  }

  _beginChoosing() {
    if (this._aborted || !this.current) return;
    this.phase = 'choosing';
    const entries = Object.entries(this.current.lies).map(([authorId, text]) => ({ authorId, text }));
    entries.push({ authorId: null, text: this.current.fact.answer }); // правда
    const shuffled = shuffle(entries);
    this.current.options = shuffled.map((e, i) => ({ id: `o${i}`, text: e.text, authorId: e.authorId }));

    this.emit('voting:started', {
      question: this.current.fact.q,
      options: this.current.options.map((o) => ({ id: o.id, text: o.text })),
      chooseTime: this.chooseTime,
    });

    this._clearTimer();
    this.timeLeft = this.chooseTime;
    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) { this._clearTimer(); if (!this._aborted) this._resolve(); }
    }, 1000);
  }

  choose(playerId, optionId) {
    if (this._aborted || this.phase !== 'choosing' || !this.current?.options) return false;
    const opt = this.current.options.find((o) => o.id === optionId);
    if (!opt) return false;
    if (opt.authorId === playerId) return false;        // нельзя выбрать свою ложь
    if (playerId in this.current.picks) return false;
    this.current.picks[playerId] = optionId;
    this.emit('vote:cast', { picked: Object.keys(this.current.picks).length, total: this.players.length });
    if (Object.keys(this.current.picks).length >= this.players.length) {
      this._clearTimer();
      this._resolve();
    }
    return true;
  }

  _resolve() {
    if (this._aborted || !this.current?.options) return;
    const { options, picks, fact } = this.current;
    const truthOpt = options.find((o) => o.authorId === null);
    const nameOf = (id) => this.players.find((p) => p.id === id)?.name ?? '—';

    // Очки: +500 нашедшим правду; +100 автору лжи за каждого, кто на неё купился.
    for (const [pid, oid] of Object.entries(picks)) {
      if (oid === truthOpt.id) {
        const p = this.players.find((x) => x.id === pid);
        if (p) p.score += 500;
      }
    }
    for (const o of options) {
      if (o.authorId == null) continue;
      const fooled = Object.values(picks).filter((oid) => oid === o.id).length;
      if (fooled > 0) {
        const author = this.players.find((p) => p.id === o.authorId);
        if (author) author.score += 100 * fooled;
      }
    }

    const reveal = options.map((o) => ({
      text: o.text,
      isTruth: o.authorId === null,
      authorName: o.authorId === null ? null : nameOf(o.authorId),
      pickedBy: Object.entries(picks).filter(([, oid]) => oid === o.id).map(([pid]) => nameOf(pid)),
    }));

    this.emit('round:ended', {
      question: fact.q,
      truth: fact.answer,
      options: reveal,
      scoreboard: this._scoreboard(),
    });

    if (this._delay) clearTimeout(this._delay);
    this._delay = setTimeout(() => {
      this._delay = null;
      if (!this._aborted) this._startRound();
    }, 6500);
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
    return { phase: this.phase, players: this._scoreboard(), round: this.round, total: this.questionOrder.length, timeLeft: this.timeLeft };
  }
}
