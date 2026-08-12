import { EventEmitter } from 'events';

const COLORS = [
  { name: 'Красный', value: '#ff4757', hex: 'ff4757' },
  { name: 'Синий', value: '#3742fa', hex: '3742fa' },
  { name: 'Зеленый', value: '#2ed573', hex: '2ed573' },
  { name: 'Желтый', value: '#ffa502', hex: 'ffa502' },
  { name: 'Фиолетовый', value: '#9b59b6', hex: '9b59b6' },
  { name: 'Оранжевый', value: '#ff7f50', hex: 'ff7f50' },
  { name: 'Розовый', value: '#ff6b81', hex: 'ff6b81' },
  { name: 'Бирюзовый', value: '#1dd1a1', hex: '1dd1a1' },
];

const COLOR_NAMES = COLORS.map(c => c.name);

export class ColorsEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.players = new Map(); // id -> { id, name, score, lives }
    this.state = 'waiting'; // waiting, showing, guessing, finished
    this.round = 0;
    this.maxRounds = 5;
    this.currentColor = null;
    this.currentColorName = null;
    this.correctAnswer = null;
    this.options = [];
    this.timer = null;
    this.timeLeft = 10;
    this.answered = new Set();
    this._aborted = false;
    this._nextRoundTimeout = null;
  }

  start() {
    if (this._aborted) return;
    // Заполняем игроков из комнаты. Раньше this.players оставался пустым (addPlayer никто
    // не вызывал), а generic-handler звал engine.start(), которого не было → игра падала на старте.
    const roomPlayers = (this.room?.players ?? []).filter((p) => !p.isSpectator);
    for (const p of roomPlayers) {
      if (!this.players.has(p.id)) {
        this.players.set(p.id, { id: p.id, name: p.name, score: 0, lives: 3, ready: false });
      }
    }
    this.state = 'waiting';
  }

  addPlayer(player) {
    this.players.set(player.id, {
      id: player.id,
      name: player.name,
      score: 0,
      lives: 3,
      ready: false
    });
    this.emit('player:joined', { playerId: player.id, playerName: player.name });
  }

  removePlayer(playerId) {
    if (this.players.has(playerId)) {
      const player = this.players.get(playerId);
      this.players.delete(playerId);
      this.emit('player:left', { playerId, playerName: player.name });
    }
  }

  setReady(playerId, ready) {
    const player = this.players.get(playerId);
    if (player) {
      player.ready = ready;
      this.emit('player:ready', { playerId, ready });
      
      // Если все готовы и минимум 2 игрока
      const allReady = Array.from(this.players.values()).every(p => p.ready);
      if (allReady && this.players.size >= 2 && this.state === 'waiting') {
        this.startRound();
      }
    }
  }

  startRound() {
    if (this._aborted) return;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.round >= this.maxRounds) {
      this.finishGame();
      return;
    }
    
    this.round++;
    this.state = 'showing';
    this.timeLeft = 3;
    
    // Выбрать случайный цвет
    const colorIndex = Math.floor(Math.random() * COLORS.length);
    this.currentColor = COLORS[colorIndex];
    this.currentColorName = this.currentColor.name;
    
    // Создать варианты ответов (правильный + 3 случайных)
    this.options = [this.currentColorName];
    while (this.options.length < 4) {
      const randomColor = COLOR_NAMES[Math.floor(Math.random() * COLOR_NAMES.length)];
      if (!this.options.includes(randomColor)) {
        this.options.push(randomColor);
      }
    }
    
    // Перемешать варианты
    this.options = this.options.sort(() => Math.random() - 0.5);
    this.correctAnswer = this.options.indexOf(this.currentColorName);
    
    this.emit('game:round-started', {
      round: this.round,
      maxRounds: this.maxRounds,
      color: this.currentColor,
      colorName: this.currentColorName,
      options: this.options,
      timeLeft: this.timeLeft
    });
    
    // Таймер показа цвета (3 секунды)
    this.timer = setInterval(() => {
      this.timeLeft--;
      this.emit('game:timer', { timeLeft: this.timeLeft });
      
      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        this.startGuessing();
      }
    }, 1000);
  }

  startGuessing() {
    if (this._aborted) return;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.state = 'guessing';
    this.answered = new Set();
    this.timeLeft = 10;
    
    this.emit('game:guessing-started', {
      options: this.options,
      timeLeft: this.timeLeft
    });
    
    // Таймер для угадывания
    this.timer = setInterval(() => {
      this.timeLeft--;
      this.emit('game:timer', { timeLeft: this.timeLeft });
      
      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        this.finishRound();
      }
    }, 1000);
  }

  handleGuess(playerId, guessIndex) {
    if (this.state !== 'guessing') return false;
    
    const player = this.players.get(playerId);
    if (!player) return false;
    if (player.lives <= 0) return false;
    if (this.answered.has(playerId)) return false;
    this.answered.add(playerId);

    const isCorrect = guessIndex === this.correctAnswer;
    const points = isCorrect ? 10 : 0;
    
    if (isCorrect) {
      player.score += points;
      this.emit('player:correct', {
        playerId,
        playerName: player.name,
        guess: this.options[guessIndex],
        points,
        score: player.score
      });
    } else {
      player.lives--;
      this.emit('player:wrong', {
        playerId,
        playerName: player.name,
        guess: this.options[guessIndex],
        correctAnswer: this.currentColorName,
        lives: player.lives
      });
      
      if (player.lives <= 0) {
        this.emit('player:eliminated', { playerId, playerName: player.name });
      }
    }
    
    // Завершаем раунд досрочно, когда все ещё живые игроки ответили (или все выбыли).
    const stillPlaying = Array.from(this.players.values()).filter(p => p.lives > 0);
    if (stillPlaying.length === 0 || stillPlaying.every(p => this.answered.has(p.id))) {
      clearInterval(this.timer);
      this.finishRound();
    }

    return true;
  }

  finishRound() {
    if (this._aborted) return;
    clearInterval(this.timer);
    this.timer = null;
    this.state = 'waiting';
    
    const scores = Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      lives: p.lives
    }));
    
    this.emit('game:round-ended', {
      round: this.round,
      scores,
      correctAnswer: this.currentColorName,
      color: this.currentColor
    });
    
    // Сбросить готовность для следующего раунда
    for (const player of this.players.values()) {
      player.ready = false;
    }
    
    // Автоматически начать следующий раунд через 5 секунд
    if (this._nextRoundTimeout) { clearTimeout(this._nextRoundTimeout); this._nextRoundTimeout = null; }
    if (this.round < this.maxRounds) {
      this._nextRoundTimeout = setTimeout(() => {
        this._nextRoundTimeout = null;
        if (!this._aborted && this.state === 'waiting') {
          this.startRound();
        }
      }, 5000);
    } else {
      this._nextRoundTimeout = setTimeout(() => {
        this._nextRoundTimeout = null;
        if (!this._aborted) this.finishGame();
      }, 3000);
    }
  }

  finishGame() {
    if (this._aborted) return;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.state = 'finished';
    
    const scores = Array.from(this.players.values())
      .map(p => ({ id: p.id, name: p.name, score: p.score, lives: p.lives }))
      .sort((a, b) => b.score - a.score);
    
    const winner = scores.length > 0 ? scores[0] : null;
    
    this.emit('game:ended', {
      winner,
      scores,
      totalRounds: this.maxRounds
    });
  }

  cleanup() {
    this._aborted = true;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this._nextRoundTimeout) { clearTimeout(this._nextRoundTimeout); this._nextRoundTimeout = null; }
    this.removeAllListeners();
  }

  getState() {
    return {
      state: this.state,
      round: this.round,
      maxRounds: this.maxRounds,
      currentColor: this.currentColor,
      currentColorName: this.currentColorName,
      options: this.options,
      correctAnswer: this.correctAnswer,
      timeLeft: this.timeLeft,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        lives: p.lives,
        ready: p.ready
      }))
    };
  }
}