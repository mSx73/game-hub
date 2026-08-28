import { EventEmitter } from 'events';

const TOPICS = [
  'Кошки лучше собак',
  'Пицца — лучшее изобретение человечества',
  'Лучше быть невидимым, чем уметь летать',
  'Ананас на пицце — это нормально',
  'Понедельник — лучший день недели',
  'Жить без интернета легко',
  'Зима лучше лета',
  'Инопланетяне уже среди нас',
  'Супергерои приносят больше вреда, чем пользы',
  'Без домашних заданий образование было бы лучше',
  'Роботы заменят всех людей через 50 лет',
  'Жизнь в деревне лучше, чем в городе',
  'Путешествия во времени — плохая идея',
  'Быть ребёнком лучше, чем взрослым',
  'Завтрак — самый бесполезный приём пищи',
  'Книги лучше фильмов',
  'Носки с сандалиями — это стильно',
  'Спать днём — признак гениальности',
  'Лучше уметь читать мысли, чем телепортироваться',
  'Динозавры были бы отличными домашними животными',
  'Чай лучше кофе',
  'Лучше жить в прошлом, чем в будущем',
  'Единороги реальнее, чем драконы',
  'Математика — самый бесполезный предмет',
  'Лучше никогда не спать, чем никогда не есть',
  'Пришельцы боятся людей',
  'Выходные должны быть три дня',
  'Лучше быть самым умным, чем самым сильным',
  'Кетчуп подходит ко всему',
  'Мир был бы лучше без социальных сетей',
  'Зомби-апокалипсис — это весело',
  'Пингвины — самые крутые животные',
];

const MAX_TOPIC_LENGTH = 100;

export class DebateEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.round = 0;
    this.maxRounds = Math.min(this.settings.maxRounds ?? 6, Math.floor(this.players.length / 2) * 3 || 6);
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.turnTime = this.settings.turnTime ?? 60;
    this.prepTime = this.settings.prepTime ?? 30;
    this.usedTopics = new Set();
    this.lastDebaterIds = new Set();
    this.debaterSideCount = new Map();
    this.currentDebaters = null;
    this.currentTopic = null;
    this.votes = new Map();
    this._aborted = false;
    this._roundDelayTimeout = null;
  }

  start() {
    if (this._aborted) return;
    if (this.players.length < 3) {
      this.emit('error', { message: 'Нужно минимум 3 игрока' });
      return;
    }
    this.phase = 'playing';
    this.nextRound();
  }

  nextRound() {
    if (this._aborted) return;
    this.round++;
    this.maxRounds = Math.min(this.settings.maxRounds ?? 6, Math.floor(this.players.length / 2) * 3 || 6);
    if (this.round > this.maxRounds) {
      this.endGame();
      return;
    }

    this.votes.clear();

    const [p1, p2] = this.pickDebaters();
    this.currentDebaters = { player1: p1, player2: p2 };
    this.currentTopic = this.pickTopic();

    const sides = this.assignSides(p1, p2);

    this.lastDebaterIds = new Set([p1.id, p2.id]);

    this.phase = 'prep';
    const topicDisplay = this.currentTopic.length > MAX_TOPIC_LENGTH
      ? this.currentTopic.slice(0, MAX_TOPIC_LENGTH) + '…'
      : this.currentTopic;
    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      topic: topicDisplay,
      player1: { id: p1.id, name: p1.name },
      player2: { id: p2.id, name: p2.name },
      side1: sides.side1,
      side2: sides.side2,
      timeLeft: this.prepTime,
      phase: 'prep',
    });

    this.startTimer(this.prepTime, () => {
      if (this._aborted) return;
      this.phase = 'debating';
      this.emit('phase:changed', { phase: 'debating', timeLeft: this.turnTime * 2 });
      this.startTimer(this.turnTime * 2, () => {
        if (!this._aborted) this.startVoting();
      });
    });
  }

  pickDebaters() {
    let eligible = this.players.filter((p) => !this.lastDebaterIds.has(p.id));
    if (eligible.length < 2) eligible = [...this.players];
    const shuffled = eligible.sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1]];
  }

  assignSides(p1, p2) {
    const c1 = this.debaterSideCount.get(p1.id) ?? { za: 0, proti: 0 };
    const c2 = this.debaterSideCount.get(p2.id) ?? { za: 0, proti: 0 };
    const p1PrefersZa = c1.za <= c1.proti;
    const p2PrefersZa = c2.za <= c2.proti;
    if (p1PrefersZa && !p2PrefersZa) {
      this.debaterSideCount.set(p1.id, { za: c1.za + 1, proti: c1.proti });
      this.debaterSideCount.set(p2.id, { za: c2.za, proti: c2.proti + 1 });
      return { side1: 'ЗА', side2: 'ПРОТИВ' };
    }
    if (!p1PrefersZa && p2PrefersZa) {
      this.debaterSideCount.set(p1.id, { za: c1.za, proti: c1.proti + 1 });
      this.debaterSideCount.set(p2.id, { za: c2.za + 1, proti: c2.proti });
      return { side1: 'ПРОТИВ', side2: 'ЗА' };
    }
    const side1Za = Math.random() < 0.5;
    if (side1Za) {
      this.debaterSideCount.set(p1.id, { za: c1.za + 1, proti: c1.proti });
      this.debaterSideCount.set(p2.id, { za: c2.za, proti: c2.proti + 1 });
      return { side1: 'ЗА', side2: 'ПРОТИВ' };
    }
    this.debaterSideCount.set(p1.id, { za: c1.za, proti: c1.proti + 1 });
    this.debaterSideCount.set(p2.id, { za: c2.za + 1, proti: c2.proti });
    return { side1: 'ПРОТИВ', side2: 'ЗА' };
  }

  pickTopic() {
    let available = TOPICS.filter(t => !this.usedTopics.has(t));
    if (available.length === 0) {
      this.usedTopics.clear();
      available = [...TOPICS];
    }
    const topic = available[Math.floor(Math.random() * available.length)];
    this.usedTopics.add(topic);
    return topic;
  }

  startVoting() {
    if (this._aborted) return;
    this.stopTimer();
    this.phase = 'voting';
    this.votes.clear();

    this.emit('voting:started', {
      round: this.round,
      topic: this.currentTopic,
      player1: { id: this.currentDebaters.player1.id, name: this.currentDebaters.player1.name },
      player2: { id: this.currentDebaters.player2.id, name: this.currentDebaters.player2.name },
      timeLeft: 15,
    });

    this.startTimer(15, () => {
      if (!this._aborted) this.resolveVoting();
    });
  }

  castVote(voterId, votedForId) {
    if (this._aborted) return false;
    if (this.phase !== 'voting') return false;
    if (!this.currentDebaters) return false;
    const { player1, player2 } = this.currentDebaters;
    if (voterId === player1.id || voterId === player2.id) return false;
    if (votedForId !== player1.id && votedForId !== player2.id) return false;
    if (this.votes.has(voterId)) return false;

    this.votes.set(voterId, votedForId);
    this.emit('vote:cast', { voterId, total: this.votes.size });

    const eligibleVoters = this.players.filter(
      p => p.id !== player1.id && p.id !== player2.id && p.active !== false
    );
    const minVotes = eligibleVoters.length > 0 ? Math.floor(eligibleVoters.length / 2) + 1 : 1;
    if (eligibleVoters.length > 0 && (this.votes.size >= eligibleVoters.length || this.votes.size >= minVotes)) {
      this.resolveVoting();
    }
    return true;
  }

  resolveVoting() {
    if (this._aborted) return;
    this.stopTimer();
    if (this.phase !== 'voting') return;
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.phase = 'results';

    const { player1, player2 } = this.currentDebaters;
    const playerById = new Map(this.players.map((p) => [p.id, p]));
    let p1Votes = 0;
    let p2Votes = 0;
    for (const votedFor of this.votes.values()) {
      if (votedFor === player1.id) p1Votes++;
      else if (votedFor === player2.id) p2Votes++;
    }

    const awardPoints = (winner, loser, winnerVotes) => {
      winner.score += 3;
      loser.score += 1;
      for (const [vid, voted] of this.votes.entries()) {
        if (voted === winner.id) {
          const v = playerById.get(vid);
          if (v) v.score += 1;
        }
      }
    };

    let winner = null;
    if (p1Votes > p2Votes) {
      winner = player1;
      awardPoints(player1, player2, p1Votes);
    } else if (p2Votes > p1Votes) {
      winner = player2;
      awardPoints(player2, player1, p2Votes);
    } else {
      player1.score += 2;
      player2.score += 2;
      for (const vid of this.votes.keys()) {
        const v = playerById.get(vid);
        if (v) v.score += 1;
      }
    }

    this.emit('round:ended', {
      round: this.round,
      topic: this.currentTopic,
      winner: winner ? { id: winner.id, name: winner.name } : null,
      p1Votes,
      p2Votes,
      scores: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
    });

    if (this.round >= this.maxRounds) {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.endGame();
      }, 3000);
    } else {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.nextRound();
      }, 5000);
    }
  }

  startTimer(seconds, onEnd) {
    this.stopTimer();
    this.timeLeft = seconds;
    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) onEnd();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  endGame() {
    if (this._aborted) return;
    this.stopTimer();
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.phase = 'finished';
    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    this.emit('game:ended', {
      winner: sorted[0] ?? null,
      players: sorted,
    });
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
      round: this.round,
      maxRounds: this.maxRounds,
      players: this.players,
      currentTopic: this.currentTopic,
      currentDebaters: this.currentDebaters,
      timeLeft: this.timeLeft,
    };
  }
}
