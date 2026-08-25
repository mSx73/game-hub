import { EventEmitter } from 'events';

const CHARACTERS = [
  'Путин', 'Илон Маск', 'Гарри Поттер', 'Баба Яга', 'Наполеон',
  'Дарт Вейдер', 'Шрек', 'Клеопатра', 'Эйнштейн', 'Чебурашка',
  'Снегурочка', 'Дед Мороз', 'Винни-Пух', 'Джеймс Бонд', 'Рапунцель',
  'Пушкин', 'Гагарин', 'Бэтмен', 'Золушка', 'Шерлок Холмс',
  'Моцарт', 'Мона Лиза', 'Человек-паук', 'Алиса (из страны чудес)', 'Кощей Бессмертный',
  'Волан-де-Морт', 'Элвис Пресли', 'Мадонна', 'Тор', 'Железный человек',
  'Джокер', 'Леонардо да Винчи', 'Пикачу', 'Микки Маус', 'Супермарио',
  'Дракула', 'Робин Гуд', 'Фрида Кало', 'Чарли Чаплин', 'Мэрилин Монро',
  'Иван Грозный', 'Пётр Первый', 'Екатерина Великая', 'Масяня', 'Кот Матроскин',
  'Незнайка', 'Буратино', 'Карлсон', 'Леопольд', 'Колобок',
  'Гендальф', 'Йода', 'Росомаха', 'Халк', 'Капитан Джек Воробей',
];

export class WhoAmIEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({
      ...p,
      character: null,
      guessed: false,
      questionsAsked: 0,
    }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.currentPlayerIndex = 0;
    this.turnTime = this.settings.turnTime ?? 30;
    this.maxQuestionsPerTurn = 1;
    this.maxQuestionsPerPlayer = this.settings.maxQuestionsPerPlayer ?? 20;
    this.activeQuestion = null;
    this.yesNoVotes = new Map();
    this.finishOrder = [];
    this._aborted = false;
    this._roundDelayTimeout = null;
  }

  start() {
    if (this._aborted) return;
    if (this.players.length < 3) {
      this.emit('error', { message: 'Нужно минимум 3 игрока' });
      return;
    }
    this.finishOrder = [];
    this.assignCharacters();
    this.phase = 'playing';

    const assignments = {};
    for (const player of this.players) {
      assignments[player.id] = {};
      for (const other of this.players) {
        if (other.id !== player.id) {
          assignments[player.id][other.id] = {
            name: other.name,
            character: other.character,
          };
        }
      }
    }

    this.emit('game:started', { assignments });
    this.startTurn();
  }

  assignCharacters() {
    const shuffled = [...CHARACTERS].sort(() => Math.random() - 0.5);
    this.players.forEach((p, i) => {
      p.character = shuffled[i % shuffled.length];
    });
  }

  startTurn() {
    if (this._aborted) return;
    const activePlayers = this.players.filter(p => !p.guessed);
    if (activePlayers.length <= 1) {
      this.endGame();
      return;
    }

    let attempts = 0;
    while (this.players[this.currentPlayerIndex].guessed && attempts < this.players.length) {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
      attempts++;
    }
    if (attempts >= this.players.length) {
      this.endGame();
      return;
    }

    const current = this.players[this.currentPlayerIndex];
    this.activeQuestion = null;
    this.yesNoVotes.clear();

    this.emit('turn:started', {
      player: { id: current.id, name: current.name },
      questionsAsked: current.questionsAsked,
      maxQuestionsPerPlayer: this.maxQuestionsPerPlayer,
      timeLeft: this.turnTime,
      remainingPlayers: activePlayers.length,
    });

    this.startTimer(this.turnTime, () => {
      if (this._aborted) return;
      this.emit('turn:timeout', { playerId: current.id });
      this.advanceTurn();
    });
  }

  askQuestion(playerId, question) {
    if (this._aborted) return false;
    if (this.phase !== 'playing') return false;
    const current = this.players[this.currentPlayerIndex];
    if (playerId !== current.id) return false;
    if (this.activeQuestion) return false;
    if (current.questionsAsked >= this.maxQuestionsPerPlayer) return false;

    const text = String(question || '').trim();
    if (text.length < 3 || text.length > 200) return false;

    this.stopTimer();
    this.activeQuestion = text;
    this.yesNoVotes.clear();
    current.questionsAsked++;

    this.emit('question:asked', {
      playerId,
      playerName: current.name,
      question: text,
      timeLeft: 15,
    });

    this.startTimer(15, () => {
      if (!this._aborted) this.resolveVoting();
    });
    return true;
  }

  voteYesNo(voterId, vote) {
    if (this._aborted) return false;
    if (this.phase !== 'playing' || !this.activeQuestion) return false;
    const current = this.players[this.currentPlayerIndex];
    if (voterId === current.id) return false;
    if (this.yesNoVotes.has(voterId)) return false;
    if (typeof vote !== 'boolean') return false;

    this.yesNoVotes.set(voterId, vote);
    this.emit('vote:yes-no', {
      voterId,
      total: this.yesNoVotes.size,
    });

    const eligibleVoters = this.players.filter(p => p.id !== current.id && !p.guessed);
    if (this.yesNoVotes.size >= eligibleVoters.length) {
      this.stopTimer();
      if (!this._aborted) this.resolveVoting();
    }
    return true;
  }

  resolveVoting() {
    if (this._aborted) return;
    this.stopTimer();
    if (!this.activeQuestion) return;
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }

    let yesCount = 0;
    let noCount = 0;
    for (const v of this.yesNoVotes.values()) {
      if (v) yesCount++;
      else noCount++;
    }

    const answer = yesCount >= noCount ? 'да' : 'нет';
    this.emit('answer:revealed', {
      question: this.activeQuestion,
      answer,
      yesCount,
      noCount,
    });

    this.activeQuestion = null;
    this.yesNoVotes.clear();

    this._roundDelayTimeout = setTimeout(() => {
      this._roundDelayTimeout = null;
      if (this._aborted) return;
      this.emit('turn:guess-or-pass', {
        playerId: this.players[this.currentPlayerIndex].id,
        timeLeft: 15,
      });
      this.startTimer(15, () => {
        if (!this._aborted) this.advanceTurn();
      });
    }, 2000);
  }

  submitGuess(playerId, guess) {
    if (this._aborted) return false;
    if (this.phase !== 'playing') return false;
    const current = this.players[this.currentPlayerIndex];
    if (playerId !== current.id) return false;

    const normalized = String(guess || '').trim().toLowerCase();
    const correctAnswer = current.character.toLowerCase();
    const isCorrect = normalized === correctAnswer || this.fuzzyMatch(normalized, correctAnswer);

    this.stopTimer();
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }

    if (isCorrect) {
      current.guessed = true;
      this.finishOrder.push({
        id: current.id,
        name: current.name,
        character: current.character,
        questionsAsked: current.questionsAsked,
        place: this.finishOrder.length + 1,
      });

      this.emit('guess:result', {
        playerId: current.id,
        playerName: current.name,
        guess: guess.trim(),
        correct: true,
        character: current.character,
        place: this.finishOrder.length,
      });

      const activePlayers = this.players.filter(p => !p.guessed);
      if (activePlayers.length <= 1) {
        if (activePlayers.length === 1) {
          const last = activePlayers[0];
          this.finishOrder.push({
            id: last.id,
            name: last.name,
            character: last.character,
            questionsAsked: last.questionsAsked,
            place: this.finishOrder.length + 1,
          });
        }
        this._roundDelayTimeout = setTimeout(() => {
          this._roundDelayTimeout = null;
          if (!this._aborted) this.endGame();
        }, 3000);
        return true;
      }
    } else {
      this.emit('guess:result', {
        playerId: current.id,
        playerName: current.name,
        guess: guess.trim(),
        correct: false,
      });
    }

    this._roundDelayTimeout = setTimeout(() => {
      this._roundDelayTimeout = null;
      if (!this._aborted) this.advanceTurn();
    }, 2000);
    return true;
  }

  passTurn(playerId) {
    if (this._aborted) return false;
    if (this.phase !== 'playing') return false;
    const current = this.players[this.currentPlayerIndex];
    if (playerId !== current.id) return false;
    this.stopTimer();
    this.advanceTurn();
    return true;
  }

  advanceTurn() {
    if (this._aborted) return;
    this.stopTimer();
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.activeQuestion = null;
    this.yesNoVotes.clear();
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this._roundDelayTimeout = setTimeout(() => {
      this._roundDelayTimeout = null;
      if (!this._aborted) this.startTurn();
    }, 1500);
  }

  fuzzyMatch(guess, answer) {
    const clean = s => s.replace(/[ёЁ]/g, 'е').replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').replace(/[^а-яa-z0-9 ]/gi, '');
    return clean(guess) === clean(answer);
  }

  handleChat(playerId, message) {
    if (this._aborted) return false;
    const current = this.players[this.currentPlayerIndex];
    if (!current || this.phase !== 'playing') return false;

    if (playerId === current.id && !this.activeQuestion) {
      const text = message.trim();
      if (text.endsWith('?')) {
        return this.askQuestion(playerId, text);
      }
    }
    return false;
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

    const scores = this.finishOrder.map((p, i) => ({
      ...p,
      score: (this.players.length - i) * 10 - p.questionsAsked,
    }));

    this.emit('game:ended', {
      winner: scores[0] ?? null,
      results: scores,
      allCharacters: this.players.map(p => ({ id: p.id, name: p.name, character: p.character })),
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
      players: this.players.map(p => ({ id: p.id, name: p.name, guessed: p.guessed, questionsAsked: p.questionsAsked })),
      currentPlayerIndex: this.currentPlayerIndex,
      activeQuestion: this.activeQuestion,
      timeLeft: this.timeLeft,
      finishOrder: this.finishOrder,
    };
  }
}
