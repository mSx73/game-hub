import { EventEmitter } from 'events';
import { QUIPLASH_PROMPTS } from './quiplashPrompts.js';

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
 * Острослов (Quiplash-стиль).
 * N игроков → N промптов, каждый промпт отвечают РОВНО двое (кольцевая пара).
 * Затем дуэли: все, кроме авторов, голосуют за смешной ответ. Очки = доля голосов
 * (+ бонус за «чистую победу»). Фазы: answering → voting (по дуэли) → finished.
 */
export class QuiplashEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter((p) => !p.isSpectator).map((p) => ({ id: p.id, name: p.name, score: 0 }));
    this.phase = 'waiting';
    this.answerTime = num(this.settings.answerTime, 70);
    this.voteTime = num(this.settings.voteTime, 18);
    this.prompts = [];          // [{ promptId, text, authorIds:[a,b], answers:{ [pid]: text } }]
    this.order = [];            // порядок промптов на голосование
    this.currentIndex = -1;
    this.activeVote = null;     // { promptId, slots:{a,b}, tally:{a,b}, voters:Set, allowed:Set }
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
    this._assignPrompts();
    this.phase = 'answering';
    this.emit('game:started', {
      quiplash: true,
      assignments: this._assignmentsByPlayer(),
      answerTime: this.answerTime,
      totalPrompts: this.prompts.length,
    });
    this._startAnswerTimer();
  }

  _assignPrompts() {
    const N = this.players.length;
    const texts = shuffle(QUIPLASH_PROMPTS).slice(0, N);
    this.prompts = texts.map((text, i) => ({
      promptId: `p${i}`,
      text,
      authorIds: [this.players[i].id, this.players[(i + 1) % N].id],
      answers: {},
    }));
    this.order = shuffle(this.prompts.map((p) => p.promptId));
  }

  _assignmentsByPlayer() {
    const map = {};
    for (const p of this.players) map[p.id] = [];
    for (const prompt of this.prompts) {
      for (const aid of prompt.authorIds) {
        if (map[aid]) map[aid].push({ promptId: prompt.promptId, text: prompt.text });
      }
    }
    return map;
  }

  _startAnswerTimer() {
    this._clearTimer();
    this.timeLeft = this.answerTime;
    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this._clearTimer();
        if (!this._aborted) this._startVoting();
      }
    }, 1000);
  }

  submitAnswer(playerId, promptId, text) {
    if (this._aborted || this.phase !== 'answering') return false;
    const prompt = this.prompts.find((p) => p.promptId === promptId);
    if (!prompt || !prompt.authorIds.includes(playerId)) return false;
    const clean = String(text ?? '').trim().slice(0, 140);
    if (!clean) return false;
    prompt.answers[playerId] = clean;
    this.emit('answer:submitted', { playerId });
    // Все слоты заполнены — переходим к голосованию досрочно.
    const totalSlots = this.prompts.length * 2;
    const filled = this.prompts.reduce((s, p) => s + Object.keys(p.answers).length, 0);
    if (filled >= totalSlots) {
      this._clearTimer();
      this._startVoting();
    }
    return true;
  }

  _startVoting() {
    if (this._aborted) return;
    this.phase = 'voting';
    this.currentIndex = -1;
    this._nextMatchup();
  }

  _nextMatchup() {
    if (this._aborted) return;
    this.currentIndex++;
    if (this.currentIndex >= this.order.length) {
      this.endGame();
      return;
    }
    const prompt = this.prompts.find((p) => p.promptId === this.order[this.currentIndex]);
    const [authorA, authorB] = prompt.authorIds;
    // Случайно раскидываем по слотам a/b, чтобы порядок не выдавал автора.
    const slotsArr = shuffle([authorA, authorB]);
    const slots = { a: slotsArr[0], b: slotsArr[1] };
    const placeholder = '(промолчал)';
    const present = new Set(this.players.map((p) => p.id));
    const allowed = new Set(
      this.players.map((p) => p.id).filter((id) => id !== authorA && id !== authorB && present.has(id)),
    );
    this.activeVote = { promptId: prompt.promptId, slots, tally: { a: 0, b: 0 }, voters: new Set(), allowed };

    this.emit('quiplash:matchup', {
      index: this.currentIndex,
      total: this.order.length,
      promptId: prompt.promptId,
      prompt: prompt.text,
      answers: [
        { answerId: 'a', text: prompt.answers[slots.a] || placeholder },
        { answerId: 'b', text: prompt.answers[slots.b] || placeholder },
      ],
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
        if (!this._aborted) this._resolveMatchup();
      }
    }, 1000);
  }

  vote(playerId, answerId) {
    if (this._aborted || this.phase !== 'voting' || !this.activeVote) return false;
    if (answerId !== 'a' && answerId !== 'b') return false;
    const v = this.activeVote;
    if (!v.allowed.has(playerId) || v.voters.has(playerId)) return false;
    v.voters.add(playerId);
    v.tally[answerId] += 1;
    this.emit('quiplash:vote-cast', { voted: v.voters.size, total: v.allowed.size });
    if (v.voters.size >= v.allowed.size) {
      this._clearTimer();
      this._resolveMatchup();
    }
    return true;
  }

  _resolveMatchup() {
    if (this._aborted || !this.activeVote) return;
    const v = this.activeVote;
    const prompt = this.prompts.find((p) => p.promptId === v.promptId);
    const totalVotes = v.tally.a + v.tally.b;
    const authorName = (id) => this.players.find((p) => p.id === id)?.name ?? '—';
    const placeholder = '(промолчал)';

    const award = (slot) => {
      const authorId = v.slots[slot];
      const votes = v.tally[slot];
      const player = this.players.find((p) => p.id === authorId);
      let pts = votes * 100;
      const other = slot === 'a' ? v.tally.b : v.tally.a;
      const sweep = totalVotes > 0 && votes === totalVotes && other === 0 && votes >= 1;
      if (sweep) pts += 100; // бонус «Острослов!» за чистую победу
      if (player) player.score += pts;
      return { authorId, authorName: authorName(authorId), votes, points: pts, sweep, text: prompt.answers[authorId] || placeholder };
    };

    const results = [award('a'), award('b')].sort((x, y) => y.votes - x.votes);
    this.activeVote = null;

    this.emit('quiplash:matchup-result', {
      index: this.currentIndex,
      prompt: prompt.text,
      results,
      scoreboard: this._scoreboard(),
    });

    if (this._delay) clearTimeout(this._delay);
    this._delay = setTimeout(() => {
      this._delay = null;
      if (!this._aborted) this._nextMatchup();
    }, 4500);
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
      currentIndex: this.currentIndex,
      total: this.order.length,
      timeLeft: this.timeLeft,
    };
  }
}
