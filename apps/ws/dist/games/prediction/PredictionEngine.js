import { EventEmitter } from 'events';

const PREDICTION_QUESTIONS = [
  'Кто из игроков скорее всего опоздает на встречу?',
  'Кто скорее всего выиграет в лотерею?',
  'Кто будет жить в другой стране?',
  'Кто скорее всего станет знаменитым?',
  'Кто скорее всего заснёт на работе?',
  'Кто скорее всего заведёт экзотическое животное?',
  'Кто скорее всего напишет книгу?',
  'Кто скорее всего прыгнет с парашютом?',
  'Кто из игроков мог бы выжить на необитаемом острове?',
  'Кто скорее всего станет миллионером?',
  'Кто скорее всего забудет день рождения друга?',
  'Кто скорее всего будет танцевать на столе?',
  'Кто скорее всего станет президентом?',
  'Кто скорее всего пробежит марафон?',
  'Кто из игроков самый хитрый?',
  'Кто скорее всего будет говорить во сне?',
  'Кто скорее всего заведёт собаку?',
  'Кто скорее всего переедет в деревню?',
  'Кто из игроков лучший повар?',
  'Кто скорее всего забудет зонт в дождь?',
  'Кто скорее всего полетит в космос?',
  'Кто скорее всего откроет свой бизнес?',
  'Кто из игроков самый романтичный?',
  'Кто скорее всего выучит пять языков?',
  'Кто скорее всего потеряет телефон?',
  'Кто из игроков выглядит моложе всех?',
  'Кто скорее всего будет вести YouTube-канал?',
  'Кто скорее всего устроит сюрприз другу?',
  'Кто скорее всего бросит всё и уедет путешествовать?',
  'Кто из игроков самый упрямый?',
  'Кто скорее всего споёт караоке перед незнакомцами?',
  'Кто скорее всего съест что-то очень острое?',
];

export class PredictionEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 1;
    this.maxRounds = this.settings.maxRounds ?? 10;
    this.currentQuestion = null;
    this.votes = new Map();
    this.usedQuestions = new Set();
    this.voteTime = this.settings.votingTime ?? this.settings.voteTime ?? 20;
    this.pointsForMajority = this.settings.pointsForMajority ?? 2;
    this.pointsForTie = this.settings.pointsForTie ?? 1;
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

    this.votes.clear();

    let availableIndices = PREDICTION_QUESTIONS.map((_, i) => i).filter((i) => !this.usedQuestions.has(i));
    if (availableIndices.length === 0) {
      this.usedQuestions.clear();
      availableIndices = PREDICTION_QUESTIONS.map((_, i) => i);
    }
    const qIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedQuestions.add(qIdx);
    this.currentQuestion = PREDICTION_QUESTIONS[qIdx];

    this.phase = 'voting';
    this.timeLeft = this.voteTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      question: this.currentQuestion,
      candidates: this.players.map(p => ({ id: p.id, name: p.name })),
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

  submitVote(playerId, votedForId) {
    if (this._aborted) return false;
    if (this.phase !== 'voting') return false;
    if (this.votes.has(playerId)) return false;
    if (!this.players.find(p => p.id === playerId)) return false;
    if (!this.players.find(p => p.id === votedForId)) return false;

    this.votes.set(playerId, votedForId);
    this.emit('vote:submitted', { playerId, total: this.votes.size, required: this.players.length });

    if (this.votes.size >= this.players.length) {
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

    const tally = new Map();
    for (const votedForId of this.votes.values()) {
      tally.set(votedForId, (tally.get(votedForId) ?? 0) + 1);
    }

    const counts = [...tally.values()];
    const maxVotes = counts.length > 0 ? Math.max(...counts) : 0;
    const winners = maxVotes > 0 ? [...tally.entries()].filter(([, c]) => c === maxVotes).map(([pid]) => pid) : [];
    const allVoted = this.votes.size === this.players.length;
    const isEqualDistribution = allVoted && counts.length > 0 && new Set(counts).size === 1;

    if (isEqualDistribution) {
      for (const voterId of this.votes.keys()) {
        const p = this.players.find((pl) => pl.id === voterId);
        if (p) p.score += this.pointsForTie;
      }
    } else if (winners.length > 0) {
      for (const [voterId, votedForId] of this.votes) {
        if (winners.includes(votedForId)) {
          const p = this.players.find(pl => pl.id === voterId);
          if (p) p.score += this.pointsForMajority;
        }
      }
    }

    const winner = winners.length > 0 ? this.players.find(p => p.id === winners[0]) : null;

    const results = this.players.map(p => ({
      id: p.id,
      name: p.name,
      votesReceived: tally.get(p.id) ?? 0,
      votedFor: this.votes.get(p.id) ?? null,
    }));

    this.emit('round:ended', {
      round: this.round,
      question: this.currentQuestion,
      winner: winner ? { id: winner.id, name: winner.name, votes: maxVotes } : null,
      winners: winners,
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
      }, 3000);
    } else {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.nextRound();
      }, 3000);
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
      votesCount: this.votes.size,
    };
  }
}
