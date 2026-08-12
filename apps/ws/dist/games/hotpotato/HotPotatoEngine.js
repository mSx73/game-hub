import { EventEmitter } from 'events';

const CATEGORIES = [
  'Город на букву К',
  'Животное на букву С',
  'Фрукт или овощ',
  'Страна Европы',
  'Профессия на букву В',
  'Марка автомобиля',
  'Фильм ужасов',
  'Цвет на букву К',
  'Блюдо русской кухни',
  'Река России',
  'Музыкальный инструмент',
  'Вид спорта',
  'Птица',
  'Цветок',
  'Столица мира',
  'Сладость',
  'Мультфильм',
  'Планета или звезда',
  'Предмет в школе',
  'Одежда на букву К',
  'Имя на букву А',
  'Морское животное',
  'Ягода',
  'Дерево',
  'Порода собак',
  'Композитор или музыкант',
  'Овощ',
  'Город России',
  'Напиток',
  'Инструмент (ручной)',
  'Праздник',
  'Насекомое',
  'Танец',
  'Книга или автор',
  'Специя или приправа',
  'Игра (настольная или видео)',
  'Предмет мебели',
  'Вид транспорта',
  'Элемент таблицы Менделеева',
  'Озеро или море',
  'Актёр или актриса',
  'Бытовая техника',
];

export class HotPotatoEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0, lives: 3 }));
    this.phase = 'waiting';
    this.timer = null;
    this.potatoTimer = null;
    this.currentPlayerIndex = 0;
    this.currentCategory = null;
    this.usedCategories = new Set();
    this.usedAnswers = new Set();
    this.alivePlayers = [];
    this.potatoExplodeMs = 0;
    this.potatoStartedAt = 0;
    this._aborted = false;
    this._roundDelayTimeout = null;
  }

  start() {
    if (this._aborted) return;
    this.phase = 'playing';
    this.alivePlayers = this.players.map(p => p.id);
    this.currentPlayerIndex = 0;
    this.nextPotato();
  }

  nextPotato() {
    if (this._aborted) return;
    this.stopTimer();

    if (this.alivePlayers.length <= 1) {
      this.endGame();
      return;
    }

    this.usedAnswers.clear();

    let available = CATEGORIES.filter(c => !this.usedCategories.has(c));
    if (available.length === 0) {
      this.usedCategories.clear();
      available = [...CATEGORIES];
    }
    this.currentCategory = available[Math.floor(Math.random() * available.length)];
    this.usedCategories.add(this.currentCategory);

    const minRaw = this.settings.minTimer ?? 3;
    const maxRaw = this.settings.maxTimer ?? 15;
    this.minTimer = Math.min(minRaw, maxRaw);
    this.maxTimer = Math.max(minRaw, maxRaw);
    this.questionTime = this.settings.questionTime ?? 5;
    this.potatoExplodeMs = (Math.floor(Math.random() * (this.maxTimer - this.minTimer + 1)) + this.minTimer) * 1000;
    this.potatoStartedAt = Date.now();

    this.currentPlayerIndex = this.currentPlayerIndex % this.alivePlayers.length;
    const currentId = this.alivePlayers[this.currentPlayerIndex];
    const player = this.players.find(p => p.id === currentId);

    this.phase = 'passing';

    this.emit('potato:passed', {
      currentPlayerId: currentId,
      currentPlayerName: player?.name ?? '?',
      question: this.currentCategory,
      alivePlayers: this.alivePlayers.map(id => {
        const pl = this.players.find(p => p.id === id);
        return { id, name: pl?.name ?? '?', lives: pl?.lives ?? 0 };
      }),
    });

    this.potatoTimer = setTimeout(() => {
      if (!this._aborted) this.explode();
    }, this.potatoExplodeMs);
  }

  submitAnswer(playerId, text) { return this.handleChat(playerId, text); }
  handleChat(playerId, message) {
    if (this._aborted) return false;
    if (this.phase === 'question') {
      return this.handleQuestionAnswer(playerId, message);
    }
    if (this.phase !== 'passing') return false;

    const currentId = this.alivePlayers[this.currentPlayerIndex];
    if (playerId !== currentId) return false;

    const answer = (message ?? '').trim();
    if (answer.length === 0) return false;

    const answerLower = answer.toLowerCase();
    if (this.usedAnswers.has(answerLower)) return false;

    this.usedAnswers.add(answerLower);

    this.emit('answer:accepted', {
      playerId,
      playerName: this.players.find(p => p.id === playerId)?.name ?? '?',
      answer,
    });

    this.passPotato();
    return true;
  }

  passPotato() {
    if (this.currentPlayerIndex >= this.alivePlayers.length) this.currentPlayerIndex = 0;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.alivePlayers.length;
    const currentId = this.alivePlayers[this.currentPlayerIndex];
    const player = this.players.find(p => p.id === currentId);

    this.emit('potato:passed', {
      currentPlayerId: currentId,
      currentPlayerName: player?.name ?? '?',
      question: this.currentCategory,
      alivePlayers: this.alivePlayers.map(id => {
        const pl = this.players.find(p => p.id === id);
        return { id, name: pl?.name ?? '?', lives: pl?.lives ?? 0 };
      }),
    });
  }

  explode() {
    if (this._aborted) return;
    this.stopTimer();

    const currentId = this.alivePlayers[this.currentPlayerIndex];
    const player = this.players.find(p => p.id === currentId);

    this.phase = 'question';
    this.explodedPlayerId = currentId;
    this.questionAnswered = false;

    this.emit('potato:exploded', {
      playerId: currentId,
      playerName: player?.name ?? '?',
      question: this.currentCategory,
      timeLeft: this.questionTime,
    });

    this.timeLeft = this.questionTime;
    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.resolveQuestion(false);
      }
    }, 1000);
  }

  handleQuestionAnswer(playerId, answer) {
    if (this._aborted) return false;
    if (this.phase !== 'question' || this.questionAnswered) return false;
    if (playerId !== this.explodedPlayerId) return false;
    const text = (answer ?? '').trim();
    if (text.length === 0) return false;

    this.stopTimer();
    this.questionAnswered = true;
    this.resolveQuestion(true);
    return true;
  }

  resolveQuestion(correct) {
    if (this._aborted) return;
    if (this.phase !== 'question') return;
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.phase = 'passing';

    const currentId = this.explodedPlayerId;
    const player = this.players.find(p => p.id === currentId);

    if (player && !correct) {
      player.lives--;

      this.emit('potato:result', {
        playerId: currentId,
        playerName: player.name,
        correct: false,
        livesLeft: player.lives,
      });

      if (player.lives <= 0) {
        this.alivePlayers = this.alivePlayers.filter(id => id !== currentId);
        this.emit('player:eliminated', {
          playerId: currentId,
          playerName: player.name,
          remaining: this.alivePlayers.length,
        });

        if (this.currentPlayerIndex >= this.alivePlayers.length) {
          this.currentPlayerIndex = 0;
        }
      } else {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.alivePlayers.length;
      }
    } else if (player && correct) {
      this.emit('potato:result', {
        playerId: currentId,
        playerName: player.name,
        correct: true,
        livesLeft: player.lives,
      });
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.alivePlayers.length;
    }

    if (this.alivePlayers.length <= 1) {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.endGame();
      }, 2000);
    } else {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.nextPotato();
      }, 2000);
    }
  }

  endGame() {
    if (this._aborted) return;
    this.phase = 'finished';
    this.stopTimer();

    if (this.alivePlayers.length === 1) {
      const winnerId = this.alivePlayers[0];
      const winner = this.players.find(p => p.id === winnerId);
      if (winner) winner.score += 20;
    }

    const sorted = [...this.players].sort((a, b) => b.lives - a.lives || b.score - a.score);
    this.emit('game:ended', { winner: sorted[0] ?? null, players: sorted });
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.potatoTimer) {
      clearTimeout(this.potatoTimer);
      this.potatoTimer = null;
    }
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
  }

  cleanup() {
    this._aborted = true;
    this.stopTimer();
    this.removeAllListeners();
  }

  getState() {
    return {
      phase: this.phase,
      players: this.players,
      alivePlayers: this.alivePlayers,
      currentPlayerIndex: this.currentPlayerIndex,
      currentCategory: this.currentCategory,
    };
  }
}
