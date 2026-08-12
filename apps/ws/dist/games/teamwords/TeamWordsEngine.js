import { EventEmitter } from 'events';

const WORD_SETS = {
  animals: ['Кошка', 'Собака', 'Лев', 'Слон', 'Тигр', 'Медведь', 'Обезьяна', 'Зебра', 'Жираф', 'Панда'],
  food: ['Яблоко', 'Банан', 'Пицца', 'Суп', 'Салат', 'Шоколад', 'Мороженое', 'Бургер', 'Суши', 'Кофе'],
  cities: ['Москва', 'Париж', 'Лондон', 'Токио', 'Нью-Йорк', 'Берлин', 'Рим', 'Пекин', 'Дубай', 'Сидней'],
  professions: ['Врач', 'Учитель', 'Программист', 'Повар', 'Полицейский', 'Пожарный', 'Архитектор', 'Дизайнер', 'Актер', 'Спортсмен'],
  movies: ['Матрица', 'Титаник', 'Гарри Поттер', 'Властелин колец', 'Звездные войны', 'Аватар', 'Пираты Карибского моря', 'Форсаж', 'Мстители', 'Джокер']
};

export class TeamWordsEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.players = new Map(); // id -> { id, name, team, score, isExplainer }
    this.teams = {
      red: { name: 'Красные', score: 0, players: [] },
      blue: { name: 'Синие', score: 0, players: [] }
    };
    this.state = 'waiting'; // waiting, explaining, guessing, roundEnd, gameEnd
    this.round = 0;
    this.maxRounds = 3;
    this.currentWord = '';
    this.currentCategory = '';
    this.currentTeam = 'red';
    this.currentExplainer = null;
    this.timeLeft = 60;
    this.timer = null;
    this.guessedWords = [];
    this.skippedWords = [];
    this.wordSet = [];
    this._aborted = false;
    this._roundEndTimeout = null;
  }

  start() {
    if (this._aborted) return;
    const roomPlayers = (this.room?.players ?? []).filter((p) => !p.isSpectator);
    for (const p of roomPlayers) {
      if (!this.players.has(p.id)) {
        this.addPlayer(p);
      }
    }
    this.state = 'waiting';
  }

  addPlayer(player) {
    // Распределить по командам
    const team = this.getSmallestTeam();
    this.players.set(player.id, {
      id: player.id,
      name: player.name,
      team,
      score: 0,
      isExplainer: false,
      ready: false
    });
    
    this.teams[team].players.push(player.id);
    
    this.emit('player:joined', { 
      playerId: player.id, 
      playerName: player.name,
      team
    });
    
    this.emit('teams:updated', this.getTeamsState());
  }

  removePlayer(playerId) {
    if (this.players.has(playerId)) {
      const player = this.players.get(playerId);
      const team = player.team;
      
      // Удалить из команды
      this.teams[team].players = this.teams[team].players.filter(id => id !== playerId);
      this.players.delete(playerId);
      
      this.emit('player:left', { playerId, playerName: player.name, team });
      this.emit('teams:updated', this.getTeamsState());
    }
  }

  getSmallestTeam() {
    const redCount = this.teams.red.players.length;
    const blueCount = this.teams.blue.players.length;
    return redCount <= blueCount ? 'red' : 'blue';
  }

  setReady(playerId, ready) {
    const player = this.players.get(playerId);
    if (player) {
      player.ready = ready;
      this.emit('player:ready', { playerId, ready });
      
      // Если все готовы и минимум 4 игрока (по 2 в команде)
      const allReady = Array.from(this.players.values()).every(p => p.ready);
      if (allReady && this.players.size >= 4 && this.state === 'waiting') {
        this.startGame();
      }
    }
  }

  startGame() {
    this.state = 'explaining';
    this.round = 1;
    this.currentTeam = 'red';
    this.selectExplainer();
    this.generateWordSet();
    this.pickNextWord();
    
    this.emit('game:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      teams: this.getTeamsState(),
      explainer: this.currentExplainer
    });
    
    this.startTimer(60);
  }

  selectExplainer() {
    const teamPlayers = this.teams[this.currentTeam].players;
    if (teamPlayers.length === 0) return;
    
    // Выбрать случайного объясняющего из текущей команды
    const randomIndex = Math.floor(Math.random() * teamPlayers.length);
    this.currentExplainer = teamPlayers[randomIndex];
    
    // Обновить статус игроков
    for (const player of this.players.values()) {
      player.isExplainer = player.id === this.currentExplainer;
    }
  }

  generateWordSet() {
    const categories = Object.keys(WORD_SETS);
    this.currentCategory = categories[Math.floor(Math.random() * categories.length)];
    this.wordSet = [...WORD_SETS[this.currentCategory]];
    this.guessedWords = [];
    this.skippedWords = [];
    
    // Перемешать слова
    this.wordSet = this.wordSet.sort(() => Math.random() - 0.5);
  }

  pickNextWord() {
    if (this.wordSet.length === 0) {
      this.endRound();
      return;
    }
    
    this.currentWord = this.wordSet.pop();
    this.emit('game:word-changed', {
      word: this.currentWord,
      category: this.currentCategory,
      remaining: this.wordSet.length,
      guessed: this.guessedWords.length,
      skipped: this.skippedWords.length
    });
    
    // Отправить слово только объясняющему
    if (this.currentExplainer) {
      this.emit('explainer:word', {
        playerId: this.currentExplainer,
        word: this.currentWord,
        category: this.currentCategory
      });
    }
  }

  startTimer(seconds) {
    this.timeLeft = seconds;
    clearInterval(this.timer);
    
    this.timer = setInterval(() => {
      this.timeLeft--;
      this.emit('game:timer', { timeLeft: this.timeLeft });
      
      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        this.endRound();
      }
    }, 1000);
  }

  handleGuess(playerId, guess) {
    if (this.state !== 'explaining') return false;
    
    const player = this.players.get(playerId);
    if (!player || player.team !== this.currentTeam || player.id === this.currentExplainer) {
      return false;
    }
    
    const normalizedGuess = guess.toLowerCase().trim();
    const normalizedWord = this.currentWord.toLowerCase().trim();
    
    if (normalizedGuess === normalizedWord) {
      // Правильное угадывание
      this.guessedWords.push(this.currentWord);
      this.teams[this.currentTeam].score += 10;
      player.score += 10;
      
      this.emit('word:guessed', {
        playerId,
        playerName: player.name,
        word: this.currentWord,
        teamScore: this.teams[this.currentTeam].score,
        remaining: this.wordSet.length
      });
      
      this.pickNextWord();
      return true;
    }
    
    return false;
  }

  handleSkip() {
    if (this.state !== 'explaining' || this.wordSet.length === 0) return false;
    
    this.skippedWords.push(this.currentWord);
    this.emit('word:skipped', {
      word: this.currentWord,
      skippedCount: this.skippedWords.length
    });
    
    this.pickNextWord();
    return true;
  }

  endRound() {
    clearInterval(this.timer);
    this.state = 'roundEnd';
    
    this.emit('game:round-ended', {
      round: this.round,
      team: this.currentTeam,
      guessedWords: this.guessedWords,
      skippedWords: this.skippedWords,
      score: this.teams[this.currentTeam].score,
      teams: this.getTeamsState()
    });
    
    // Переключить команду
    this.currentTeam = this.currentTeam === 'red' ? 'blue' : 'red';
    
    // Перейти к следующему раунду или завершить игру
    if (this._roundEndTimeout) { clearTimeout(this._roundEndTimeout); this._roundEndTimeout = null; }
    if (this.round < this.maxRounds) {
      this._roundEndTimeout = setTimeout(() => {
        this._roundEndTimeout = null;
        if (this._aborted) return;
        this.round++;
        this.state = 'explaining';
        this.generateWordSet();
        this.selectExplainer();
        this.pickNextWord();
        this.startTimer(60);

        this.emit('game:round-started', {
          round: this.round,
          maxRounds: this.maxRounds,
          team: this.currentTeam,
          explainer: this.currentExplainer,
          teams: this.getTeamsState()
        });
      }, 5000);
    } else {
      this._roundEndTimeout = setTimeout(() => {
        this._roundEndTimeout = null;
        if (!this._aborted) this.endGame();
      }, 3000);
    }
  }

  endGame() {
    if (this._aborted) return;
    this.state = 'gameEnd';
    
    const winner = this.teams.red.score > this.teams.blue.score ? 'red' : 
                  this.teams.blue.score > this.teams.red.score ? 'blue' : 'tie';
    
    this.emit('game:ended', {
      winner,
      teams: this.getTeamsState(),
      finalScores: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        team: p.team,
        score: p.score
      }))
    });
  }

  getTeamsState() {
    return {
      red: {
        name: this.teams.red.name,
        score: this.teams.red.score,
        players: this.teams.red.players.map(id => {
          const p = this.players.get(id);
          return p ? { id: p.id, name: p.name, score: p.score } : null;
        }).filter(Boolean)
      },
      blue: {
        name: this.teams.blue.name,
        score: this.teams.blue.score,
        players: this.teams.blue.players.map(id => {
          const p = this.players.get(id);
          return p ? { id: p.id, name: p.name, score: p.score } : null;
        }).filter(Boolean)
      }
    };
  }

  cleanup() {
    this._aborted = true;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this._roundEndTimeout) { clearTimeout(this._roundEndTimeout); this._roundEndTimeout = null; }
    this.removeAllListeners();
  }

  getState() {
    return {
      state: this.state,
      round: this.round,
      maxRounds: this.maxRounds,
      currentTeam: this.currentTeam,
      currentWord: this.currentWord,
      currentCategory: this.currentCategory,
      currentExplainer: this.currentExplainer,
      timeLeft: this.timeLeft,
      wordSet: this.wordSet,
      guessedWords: this.guessedWords,
      skippedWords: this.skippedWords,
      teams: this.getTeamsState(),
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        team: p.team,
        score: p.score,
        isExplainer: p.isExplainer,
        ready: p.ready
      }))
    };
  }
}