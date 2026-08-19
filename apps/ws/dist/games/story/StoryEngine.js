import { EventEmitter } from 'events';

const OPENING_LINES = [
  'Однажды в тёмном лесу раздался странный звук...',
  'Когда робот открыл глаза, он понял, что находится на кухне...',
  'Президент вышел к трибуне и сказал: «У меня две новости...»',
  'Кот сел за руль и завёл мотор...',
  'На дне океана нашли дверь с табличкой «Добро пожаловать»...',
  'В холодильнике обнаружился портал в другое измерение...',
  'Пират посмотрел на карту и понял, что она нарисована карандашом...',
  'Бабушка достала из сумки лазерный меч...',
  'Утром вместо солнца взошёл гигантский пончик...',
  'Детектив открыл конверт и нашёл внутри рецепт борща...',
  'Космонавт вернулся на Землю и обнаружил, что все говорят задом наперёд...',
  'В зоопарке все животные вдруг начали петь хором...',
  'Профессор изобрёл машину, которая превращает скуку в конфеты...',
  'На собеседовании спросили: «Какой ваш любимый динозавр?»...',
  'Дракон пришёл в поликлинику с жалобой на горло...',
  'В школе отменили все уроки и ввели один предмет — мемология...',
  'Курьер доставил посылку из 2087 года...',
];

export class StoryEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator);
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.turnTime = this.settings.turnTime ?? 30;
    this.noTimeLimit = this.settings.noTimeLimit === true;
    this.sentencesPerTurn = Math.min(3, Math.max(2, this.settings.sentencesPerTurn ?? 2));
    this.genres = this.settings.genres ?? ['фантастика', 'комедия', 'детектив', 'ужасы', 'мелодрама'];
    this.storyRound = 0;
    this.maxStories = this.settings.maxStories ?? 3;
    this.currentTurnIndex = 0;
    this.currentStory = [];
    this.contributions = new Map();
    this.stories = [];
    this.usedOpenings = new Set();
    this._aborted = false;
    this._delayStartTurn = null;
    this._delayEndGame = null;
    this._delayNewStory = null;
  }

  start() {
    if (this._aborted) return;
    if (this.players.length < 2) {
      this.emit('error', { message: 'Нужно минимум 2 игрока' });
      return;
    }
    this.phase = 'playing';
    this.usedOpenings.clear();
    this.startNewStory();
  }

  startNewStory() {
    if (this._aborted) return;
    this.storyRound++;
    if (this.storyRound > this.maxStories) {
      this.endGame();
      return;
    }

    this.currentTurnIndex = 0;
    this.currentStory = [];
    this.contributions.clear();

    const opening = this.pickOpening();
    const genre = this.genres[Math.floor(Math.random() * this.genres.length)];
    this.currentGenre = genre;
    this.currentStory.push({ text: opening, author: null });

    this.emit('story:started', {
      storyRound: this.storyRound,
      maxStories: this.maxStories,
      openingLine: opening,
      genre,
      sentencesPerTurn: this.sentencesPerTurn,
      noTimeLimit: this.noTimeLimit,
    });

    if (this._delayStartTurn) clearTimeout(this._delayStartTurn);
    this._delayStartTurn = setTimeout(() => {
      this._delayStartTurn = null;
      if (!this._aborted) this.startTurn();
    }, 2000);
  }

  pickOpening() {
    let availableIndices = OPENING_LINES.map((_, i) => i).filter((i) => !this.usedOpenings.has(i));
    if (availableIndices.length === 0) {
      this.usedOpenings.clear();
      availableIndices = OPENING_LINES.map((_, i) => i);
    }
    const idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedOpenings.add(idx);
    return OPENING_LINES[idx];
  }

  startTurn() {
    if (this._aborted) return;
    while (this.currentTurnIndex < this.players.length) {
      const candidate = this.players[this.currentTurnIndex];
      const rp = this.room?.players?.find((p) => p.id === candidate.id);
      if (rp && rp.isOnline !== false) break;
      this.currentTurnIndex++;
    }
    if (this.currentTurnIndex >= this.players.length) {
      this.completeStory();
      return;
    }

    const player = this.players[this.currentTurnIndex];
    const previousText = this.currentStory.length > 0 ? (this.currentStory[this.currentStory.length - 1]?.text ?? '') : '';

    this.phase = 'turn';
    this.emit('turn:started', {
      player: { id: player.id, name: player.name },
      previousText,
      turnIndex: this.currentTurnIndex + 1,
      totalTurns: this.players.length,
      timeLeft: this.noTimeLimit ? null : this.turnTime,
      noTimeLimit: this.noTimeLimit,
    });

    if (this.noTimeLimit) {
      // Без времени — ждём submitSentence, таймер не запускаем
      return;
    }

    this.startTimer(this.turnTime, () => {
      if (this._aborted) return;
      this.currentStory.push({ text: '...', author: player.id, authorName: player.name });
      this.emit('sentence:submitted', {
        playerId: player.id,
        playerName: player.name,
        sentence: '...',
        skipped: true,
      });
      this.currentTurnIndex++;
      this.startTurn();
    });
  }

  submitSentence(playerId, sentence) {
    if (this._aborted) return false;
    if (this.phase !== 'turn') return false;
    const currentPlayer = this.players[this.currentTurnIndex];
    if (!currentPlayer || playerId !== currentPlayer.id) return false;

    const text = String(sentence || '').trim();
    if (text.length < 2 || text.length > 300) return false;

    this.stopTimer();
    this.emit('timer:tick', 0);
    this.currentStory.push({ text, author: playerId, authorName: currentPlayer.name });

    this.emit('sentence:submitted', {
      playerId,
      playerName: currentPlayer.name,
      sentence: text,
      skipped: false,
    });

    this.currentTurnIndex++;
    if (this.currentTurnIndex >= this.players.length) {
      this.completeStory();
    } else {
      this.startTurn();
    }
    return true;
  }

  completeStory() {
    if (this._aborted) return;
    this.stopTimer();
    const fullStory = this.currentStory.map(s => s.text).join(' ');
    const playerContributions = this.currentStory
      .filter(s => s.author !== null)
      .map(s => ({ playerId: s.author, playerName: s.authorName, text: s.text }));

    this.stories.push({
      storyRound: this.storyRound,
      fullStory,
      contributions: playerContributions,
    });

    this.emit('story:completed', {
      storyRound: this.storyRound,
      fullStory,
      contributions: playerContributions,
    });

    if (this.storyRound >= this.maxStories) {
      if (this._delayEndGame) clearTimeout(this._delayEndGame);
      this._delayEndGame = setTimeout(() => {
        this._delayEndGame = null;
        if (!this._aborted) this.endGame();
      }, 3000);
    } else {
      if (this._delayNewStory) clearTimeout(this._delayNewStory);
      this._delayNewStory = setTimeout(() => {
        this._delayNewStory = null;
        if (!this._aborted) this.startNewStory();
      }, 4000);
    }
  }

  startTimer(seconds, onEnd) {
    this.stopTimer();
    this.timeLeft = seconds;
    this.timer = setInterval(() => {
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

  handlePlayerDisconnect(playerId) {
    if (this._aborted || this.phase !== 'turn') return;
    const current = this.players[this.currentTurnIndex];
    if (!current || current.id !== playerId) return;
    this.skipCurrentTurn(current);
  }

  skipCurrentTurn(player) {
    this.stopTimer();
    this.currentStory.push({ text: '...', author: player.id, authorName: player.name });
    this.emit('sentence:submitted', {
      playerId: player.id,
      playerName: player.name,
      sentence: '...',
      skipped: true,
    });
    this.currentTurnIndex++;
    this.startTurn();
  }

  cleanup() {
    this._aborted = true;
    this.stopTimer();
    if (this._delayStartTurn) {
      clearTimeout(this._delayStartTurn);
      this._delayStartTurn = null;
    }
    if (this._delayEndGame) {
      clearTimeout(this._delayEndGame);
      this._delayEndGame = null;
    }
    if (this._delayNewStory) {
      clearTimeout(this._delayNewStory);
      this._delayNewStory = null;
    }
    if (typeof this.removeAllListeners === 'function') this.removeAllListeners();
  }

  endGame() {
    if (this._aborted) return;
    this.stopTimer();
    this.phase = 'finished';
    const fullText = this.stories.map(s => s.fullStory).join(' ');
    this.emit('game:ended', {
      winner: null,
      players: this.players,
      stories: this.stories,
      fullStory: fullText,
    });
  }

  getState() {
    return {
      phase: this.phase,
      players: this.players,
      storyRound: this.storyRound,
      maxStories: this.maxStories,
      currentTurnIndex: this.currentTurnIndex,
      currentStory: this.currentStory,
      timeLeft: this.timeLeft,
    };
  }
}
