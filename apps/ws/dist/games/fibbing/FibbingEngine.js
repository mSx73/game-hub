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
  'Какую еду ты бы ел(а) каждый день?',
  'Какой праздник твой любимый и почему?',
  'Какой твой самый неловкий момент?',
  'Какой язык ты бы хотел(а) выучить?',
  'Какое место ты мечтаешь посетить?',
];

export class FibbingEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 1;
    this.maxRounds = this.settings.maxRounds ?? 8;
    this.currentQuestion = null;
    this.truthTellerId = null;
    this.answers = new Map();
    this.votes = new Map();
    this.usedQuestions = new Set();
    this.answerTime = this.settings.questionTime ?? this.settings.answerTime ?? 30;
    this.voteTime = this.settings.guessingTime ?? this.settings.voteTime ?? 20;
    this.pointsForFindingTruth = this.settings.pointsForFindingTruth ?? 2;
    this.pointsForFooling = this.settings.pointsForFooling ?? 3;
    this._answerIndex = [];
    this._aborted = false;
    this._roundDelayTimeout = null;
  }

  start() {
    if (this._aborted) return;
    this.phase = 'playing';
    this.round = 1;
    this.nextRound();
  }

  nextRound() {
    if (this._aborted) return;
    this.stopTimer();
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }

    if (this.round > this.maxRounds) {
      this.endGame();
      return;
    }

    this.answers.clear();
    this.votes.clear();
    this._answerIndex = [];

    let availableIndices = QUESTIONS.map((_, i) => i).filter((i) => !this.usedQuestions.has(i));
    if (availableIndices.length === 0) {
      this.usedQuestions.clear();
      availableIndices = QUESTIONS.map((_, i) => i);
    }
    const qIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedQuestions.add(qIdx);
    this.currentQuestion = QUESTIONS[qIdx];

    this.truthTellerId = this.players[Math.floor(Math.random() * this.players.length)].id;

    this.phase = 'answering';
    this.timeLeft = this.answerTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      question: this.currentQuestion,
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

  submitAnswer(playerId, text) {
    if (this._aborted) return false;
    if (this.phase !== 'answering') return false;
    if (this.answers.has(playerId)) return false;
    if (!this.players.find(p => p.id === playerId)) return false;

    const trimmed = (text ?? '').trim().slice(0, 200);
    if (trimmed.length === 0) return false;

    this.answers.set(playerId, trimmed);
    this.emit('answer:submitted', { playerId, total: this.answers.size, required: this.players.length });

    if (this.answers.size >= this.players.length) {
      this.stopTimer();
      if (!this._aborted) this.startVoting();
    }
    return true;
  }

  startVoting() {
    if (this._aborted) return;
    if (this.phase === 'voting') return;
    this.phase = 'voting';
    this.votes.clear();

    this._answerIndex = [];
    let idx = 0;
    for (const [playerId, text] of this.answers) {
      this._answerIndex.push({ idx, text, authorId: playerId });
      idx++;
    }
    this._answerIndex.sort(() => Math.random() - 0.5);
    this._answerIndex.forEach((a, i) => { a.idx = i; });

    this.timeLeft = this.voteTime;

    this.emit('voting:started', {
      question: this.currentQuestion,
      answers: this._answerIndex.map(a => ({ idx: a.idx, text: a.text })),
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

  castVote(voterId, answerIdx) {
    if (this._aborted) return false;
    if (this.phase !== 'voting') return false;
    if (this.votes.has(voterId)) return false;
    if (!this.players.find(p => p.id === voterId)) return false;
    if (voterId === this.truthTellerId) return false;

    const target = this._answerIndex.find(a => a.idx === answerIdx);
    if (!target) return false;
    if (target.authorId === voterId) return false;

    this.votes.set(voterId, answerIdx);
    this.emit('vote:cast', { voterId, total: this.votes.size });

    const eligible = this.players.filter(p => p.id !== this.truthTellerId).length;
    if (this.votes.size >= eligible) {
      this.stopTimer();
      if (!this._aborted) this.resolveRound();
    }
    return true;
  }

  resolveRound() {
    if (this._aborted) return;
    if (this.phase === 'results') return;
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.phase = 'results';

    const truthEntry = this._answerIndex.find(a => a.authorId === this.truthTellerId);
    const truthIdx = truthEntry ? truthEntry.idx : -1;

    const fooledBy = new Map();
    const correctVoters = [];

    for (const [voterId, ansIdx] of this.votes) {
      if (ansIdx === truthIdx) {
        const p = this.players.find(pl => pl.id === voterId);
        if (p) {
          p.score += this.pointsForFindingTruth;
          correctVoters.push(voterId);
        }
      } else {
        const fakeAuthor = this._answerIndex.find(a => a.idx === ansIdx);
        if (fakeAuthor) {
          fooledBy.set(fakeAuthor.authorId, (fooledBy.get(fakeAuthor.authorId) ?? 0) + 1);
        }
      }
    }

    for (const [authorId, count] of fooledBy) {
      const p = this.players.find(pl => pl.id === authorId);
      if (p) p.score += count * this.pointsForFooling;
    }

    if (correctVoters.length === this.players.length - 1 && this.players.some(p => p.id === this.truthTellerId)) {
      const truthPlayer = this.players.find(p => p.id === this.truthTellerId);
      if (truthPlayer) truthPlayer.score += this.settings.allGuessedBonus ?? 1;
    }

    const results = this.players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      wasTruthTeller: p.id === this.truthTellerId,
      votedCorrectly: correctVoters.includes(p.id),
      fooledCount: fooledBy.get(p.id) ?? 0,
    }));

    this.emit('round:ended', {
      round: this.round,
      question: this.currentQuestion,
      truthTellerId: this.truthTellerId,
      truthAnswer: truthEntry?.text ?? null,
      truthIdx,
      results,
    });
    this.emit('score:updated', {
      players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
    });

    this.round++;
    if (this.round > this.maxRounds) {
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

  endGame() {
    if (this._aborted) return;
    this.phase = 'finished';
    this.stopTimer();
    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    this.emit('game:ended', { winner: sorted[0] ?? null, players: sorted });
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
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

  getState() {
    return {
      phase: this.phase,
      players: this.players,
      round: this.round,
      maxRounds: this.maxRounds,
      timeLeft: this.timeLeft,
      currentQuestion: this.currentQuestion,
      truthTellerId: this.truthTellerId,
      answersCount: this.answers.size,
      votesCount: this.votes.size,
    };
  }
}
