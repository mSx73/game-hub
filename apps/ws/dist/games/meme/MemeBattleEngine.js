import { EventEmitter } from 'events';

export class MemeBattleEngine extends EventEmitter {
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
    this.pointsToWin = this.settings.pointsToWin ?? null;
    this.pointsPerWin = this.settings.pointsPerWin ?? 10;
    this.judgeIndex = 0;
    this.currentPrompt = '';
    this.submissions = new Map();
    this.votes = new Map();
    this.usedPrompts = new Set();
    this.answerTime = this.settings.answerTime ?? 30;
    this.voteTime = this.settings.voteTime ?? 20;
    this._aborted = false;
    this._resolveDelayTimeout = null;

    this.prompts = [
      'Что бы сказал кот, если бы умел говорить?',
      'Худшее название для нового ресторана',
      'Что нельзя говорить на первом свидании',
      'Самая странная причина опоздать на работу',
      'Что написать на своей визитке, чтобы никто не позвонил',
      'Тост, после которого все замолчат',
      'Что бы сказал президент, если бы был котом',
      'Самый бесполезный суперспособность',
      'Что кричат в метро в 8 утра?',
      'Лучший способ испортить день рождения',
      'Новый закон, который бы все ненавидели',
      'Что написать на футболке, чтобы все отошли',
      'Совет от бабушки, которому не стоит следовать',
      'Идеальный ответ, когда спрашивают «Чем занимаешься?»',
      'Худшее послание в бутылке',
      'Что бы написал искусственный интеллект в резюме',
      'Название для самого скучного фильма',
      'Причина, по которой вас выгнали из зоопарка',
      'Что на самом деле думает ваш стоматолог',
      'Рекламный слоган для кирпичей',
      'Фраза, которую точно не стоит говорить пилоту',
      'Секретный ингредиент бабушкиного пирога',
      'Что хотят услышать рыбы от рыбаков',
      'Объявление на доске в подъезде из ада',
      'Что на самом деле означают гудки в телефоне',
      'Почему кошки смотрят в пустой угол',
      'Что сказал бы ваш будильник, если бы мог говорить',
      'Самая неуместная фраза для надгробия',
      'Совет по выживанию в зомби-апокалипсисе от бухгалтера',
      'Первое правило клуба домохозяек',
      'Что кричит навигатор, когда вы проехали поворот',
      'Инструкция по сборке мебели из одного слова',
    ];
  }

  start() {
    if (this._aborted) return;
    this.phase = 'playing';
    this.round = 1;
    this.nextRound();
  }

  nextRound() {
    if (this._aborted) return;
    if (this.timer) clearInterval(this.timer);

    if (this.round > this.maxRounds) {
      this.endGame();
      return;
    }

    this.submissions.clear();
    this.votes.clear();
    const judge = this.players[this.judgeIndex % this.players.length];
    this.currentJudgeId = judge?.id ?? null;

    let availableIndices = this.prompts.map((_, i) => i).filter((i) => !this.usedPrompts.has(i));
    if (availableIndices.length === 0) {
      this.usedPrompts.clear();
      availableIndices = this.prompts.map((_, i) => i);
    }
    const promptIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedPrompts.add(promptIdx);
    this.currentPrompt = this.prompts[promptIdx];

    this.phase = 'answering';
    this.timeLeft = this.answerTime;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      prompt: this.currentPrompt,
      timeLeft: this.timeLeft,
      judgeId: this.currentJudgeId,
      judgeName: judge?.name ?? '—',
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
    if (playerId === this.currentJudgeId) return false;
    if (this.submissions.has(playerId)) return false;
    if (!this.players.find(p => p.id === playerId)) return false;

    const trimmed = (text ?? '').trim().slice(0, 200);
    if (trimmed.length === 0) return false;

    this.submissions.set(playerId, trimmed);
    this.emit('answer:submitted', { playerId, total: this.submissions.size, required: this.players.length });

    const eligibleCount = this.players.filter(p => p.id !== this.currentJudgeId).length;
    if (this.submissions.size >= eligibleCount) {
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

    const anonymousAnswers = [];
    let idx = 0;
    for (const [playerId, text] of this.submissions) {
      anonymousAnswers.push({ idx, text, authorId: playerId });
      idx++;
    }
    this._answerIndex = anonymousAnswers;

    this.emit('voting:started', {
      prompt: this.currentPrompt,
      answers: anonymousAnswers.map(a => ({ idx: a.idx, text: a.text })),
      timeLeft: this.voteTime,
    });

    this.timeLeft = this.voteTime;
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

  vote(voterId, answerIdx) {
    if (this._aborted) return false;
    if (this.phase !== 'voting') return false;
    if (this.votes.has(voterId)) return false;

    const target = this._answerIndex?.[answerIdx];
    if (!target) return false;
    if (target.authorId === voterId) return false;

    const isJudge = voterId === this.currentJudgeId;
    const weight = isJudge ? 2 : 1;
    this.votes.set(voterId, { answerIdx, weight });

    // Ждём всех — судья тоже должен проголосовать (его голос считается вдвойне)
    const eligibleVoters = this.players;
    const allEligibleVoted = eligibleVoters.every((p) => this.votes.has(p.id));
    if (allEligibleVoted) {
      this.stopTimer();
      if (!this._aborted) this.resolveRound();
    }
    this.emit('vote:cast', { voterId, total: this.votes.size });
    return true;
  }

  resolveRound() {
    if (this._aborted) return;
    if (!this._answerIndex) return;
    if (this.phase === 'results') return;
    this.phase = 'results';
    if (this._resolveDelayTimeout) {
      clearTimeout(this._resolveDelayTimeout);
      this._resolveDelayTimeout = null;
    }

    const tally = new Map();
    for (const { answerIdx, weight } of this.votes.values()) {
      tally.set(answerIdx, (tally.get(answerIdx) ?? 0) + weight);
    }

    let maxVotes = 0;
    let winnerIdx = null;
    for (const [idx, count] of tally) {
      if (count > maxVotes) {
        maxVotes = count;
        winnerIdx = idx;
      }
    }

    const winnerEntry = winnerIdx !== null ? this._answerIndex[winnerIdx] : null;
    if (winnerEntry) {
      const player = this.players.find(p => p.id === winnerEntry.authorId);
      if (player) {
        player.score += this.pointsPerWin;
        if (this.pointsToWin != null && player.score >= this.pointsToWin) {
          this._resolveDelayTimeout = setTimeout(() => {
            this._resolveDelayTimeout = null;
            if (!this._aborted) this.endGame();
          }, 2000);
          this.emit('round:ended', {
            round: this.round,
            prompt: this.currentPrompt,
            winner: { authorId: winnerEntry.authorId, authorName: this.players.find(p => p.id === winnerEntry.authorId)?.name ?? '—', text: winnerEntry.text, votes: maxVotes },
            scores: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
          });
          this.round++;
          return;
        }
      }
    }
    this.judgeIndex = (this.judgeIndex + 1) % this.players.length;

    this.emit('round:ended', {
      round: this.round,
      prompt: this.currentPrompt,
      winner: winnerEntry ? {
        authorId: winnerEntry.authorId,
        authorName: this.players.find(p => p.id === winnerEntry.authorId)?.name ?? '—',
        text: winnerEntry.text,
        votes: maxVotes,
      } : null,
      scores: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
    });

    this.round++;
    if (this.round > this.maxRounds || (this.pointsToWin != null && (this.players.some(p => p.score >= this.pointsToWin)))) {
      this._resolveDelayTimeout = setTimeout(() => {
        this._resolveDelayTimeout = null;
        if (!this._aborted) this.endGame();
      }, 3000);
    } else {
      this._resolveDelayTimeout = setTimeout(() => {
        this._resolveDelayTimeout = null;
        if (!this._aborted) this.nextRound();
      }, 3000);
    }
  }

  endGame() {
    if (this._aborted) return;
    this.phase = 'finished';
    this.stopTimer();
    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    this.emit('game:ended', {
      winner: sorted[0] ?? null,
      players: sorted,
    });
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
    if (this._resolveDelayTimeout) {
      clearTimeout(this._resolveDelayTimeout);
      this._resolveDelayTimeout = null;
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
      currentPrompt: this.currentPrompt,
      submissionsCount: this.submissions.size,
      votesCount: this.votes.size,
    };
  }
}
