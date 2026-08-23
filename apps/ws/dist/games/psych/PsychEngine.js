import { EventEmitter } from 'events';

const QUESTIONS = [
  'Какой твой любимый фильм?',
  'Какое блюдо ты готовишь лучше всего?',
  'Какая у тебя самая странная привычка?',
  'Что последнее тебя рассмешило до слёз?',
  'Какой самый странный подарок ты получал(а)?',
  'Какая песня может застрять у тебя в голове?',
  'Какой предмет в школе ты ненавидел(а)?',
  'Что бы ты сделал(а) с миллионом долларов?',
  'Какая самая глупая вещь, в которую ты верил(а) в детстве?',
  'Какой твой самый бесполезный талант?',
  'Какой фильм ты можешь пересматривать бесконечно?',
  'Какая самая смешная история из твоего детства?',
  'Каким животным ты был(а) бы?',
  'Какой суперспособностью ты бы хотел(а) обладать?',
  'Какое самое необычное место, где ты засыпал(а)?',
  'Какой самый странный поступок ты совершал(а)?',
  'Какая книга тебе запомнилась больше всего?',
  'Какой твой тайный страх?',
  'Какой самый неудачный подарок ты дарил(а)?',
  'Что тебя раздражает больше всего?',
];

export class PsychEngine extends EventEmitter {
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
    this.psychId = null;
    this.currentQuestion = null;
    this.answers = new Map();
    this.guesses = new Map();
    this.usedQuestions = new Set();
    this.answerTime = this.settings.answerTime ?? 30;
    this.guessTime = this.settings.guessTime ?? 45;
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

    this.answers.clear();
    this.guesses.clear();
    this.psychId = this.players[Math.floor(Math.random() * this.players.length)].id;

    let available = QUESTIONS.map((_, i) => i).filter(i => !this.usedQuestions.has(i));
    if (available.length === 0) {
      this.usedQuestions.clear();
      available = QUESTIONS.map((_, i) => i);
    }
    const qIdx = available[Math.floor(Math.random() * available.length)];
    this.usedQuestions.add(qIdx);
    this.currentQuestion = QUESTIONS[qIdx];

    this.phase = 'answering';
    this.timeLeft = this.answerTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      question: this.currentQuestion,
      psychId: this.psychId,
      timeLeft: this.timeLeft,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.startGuessing();
      }
    }, 1000);
  }

  handleChat(playerId, message) {
    if (this._aborted) return false;
    if (this.phase === 'answering' && playerId !== this.psychId) {
      return this.submitAnswer(playerId, message);
    }
    return false;
  }

  submitAnswer(playerId, text) {
    if (this._aborted) return false;
    if (this.phase !== 'answering') return false;
    if (playerId === this.psychId) return false;
    if (this.answers.has(playerId)) return false;

    const trimmed = String(text ?? '').trim().slice(0, 200);
    if (!trimmed) return false;

    this.answers.set(playerId, trimmed);
    this.emit('answer:submitted', { playerId, total: this.answers.size, required: this.players.length - 1 });

    if (this.answers.size >= this.players.length - 1) {
      this.stopTimer();
      if (!this._aborted) this.startGuessing();
    }
    return true;
  }

  startGuessing() {
    if (this._aborted) return;
    this.phase = 'guessing';
    const entries = [...this.answers.entries()].sort(() => Math.random() - 0.5);
    const shuffled = entries.map(([id, ans], i) => ({ index: i + 1, playerId: id, answer: ans }));
    this._shuffledEntries = shuffled;

    this.timeLeft = this.guessTime;
    this.emit('guessing:started', {
      answers: shuffled.map(s => ({ index: s.index, answer: s.answer })),
      candidates: shuffled.map(s => ({ id: s.playerId, name: this.players.find(p => p.id === s.playerId)?.name })),
      psychId: this.psychId,
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

  submitGuess(psychId, guess) {
    if (this._aborted) return false;
    if (this.phase !== 'guessing' || psychId !== this.psychId) return false;

    if (Array.isArray(guess)) {
      for (const g of guess) {
        const idx = g.index ?? g.answerIndex;
        const pid = g.playerId ?? g.targetId;
        if (idx != null && pid) this.guesses.set(idx, pid);
      }
      if (this.guesses.size >= this.answers.size) {
        this.stopTimer();
        if (!this._aborted) this.resolveRound();
      }
      return true;
    }

    const parsed = typeof guess === 'object' ? guess : {};
    const idx = parsed.index ?? parsed.answerIndex;
    const guessPlayerId = parsed.playerId ?? parsed.targetId;
    if (idx != null && guessPlayerId) {
      this.guesses.set(idx, guessPlayerId);
      if (this.guesses.size >= this.answers.size) {
        this.stopTimer();
        if (!this._aborted) this.resolveRound();
      }
    }
    return true;
  }

  castVote(psychId, guess) {
    return this.submitGuess(psychId, guess);
  }

  resolveRound() {
    if (this._aborted) return;
    if (this.phase === 'results') return;
    this.phase = 'results';
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    const shuffled = this._shuffledEntries || [...this.answers.entries()].map(([id, ans], i) => ({ index: i + 1, playerId: id, answer: ans }));

    let correct = 0;
    for (const s of shuffled) {
      const guessed = this.guesses.get(s.index);
      if (guessed === s.playerId) {
        correct++;
        const p = this.players.find(x => x.id === this.psychId);
        if (p) p.score = (p.score || 0) + 2;
      }
    }

    this.emit('round:ended', {
      round: this.round,
      question: this.currentQuestion,
      results: shuffled.map(s => ({
        index: s.index,
        answer: s.answer,
        playerId: s.playerId,
        playerName: this.players.find(p => p.id === s.playerId)?.name,
        guessed: this.guesses.get(s.index) === s.playerId,
      })),
      correct,
      total: shuffled.length,
      psychId: this.psychId,
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
