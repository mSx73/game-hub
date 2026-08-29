import { EventEmitter } from 'events';
import { isPlayerOnline, pruneOfflineFromMap } from '../../core/playerOnline.js';

const SECRET_WORDS = [
  { word: 'КОСМОС', category: 'Наука' },
  { word: 'БАНАН', category: 'Еда' },
  { word: 'ПИАНИНО', category: 'Музыка' },
  { word: 'ПОДВОДНАЯ ЛОДКА', category: 'Транспорт' },
  { word: 'ЗАКАТ', category: 'Природа' },
  { word: 'БИБЛИОТЕКА', category: 'Места' },
  { word: 'ВУЛКАН', category: 'Природа' },
  { word: 'ГИРОСКОП', category: 'Наука' },
  { word: 'ДИНОЗАВР', category: 'Животные' },
  { word: 'ЖАБА', category: 'Животные' },
  { word: 'ЗОНТИК', category: 'Предметы' },
  { word: 'КАЛЬСОНЫ', category: 'Одежда' },
  { word: 'КАРАВАЙ', category: 'Еда' },
  { word: 'КАРТИНА', category: 'Искусство' },
  { word: 'КОМПАС', category: 'Предметы' },
  { word: 'КРОКОДИЛ', category: 'Животные' },
  { word: 'ЛАСТОЧКА', category: 'Животные' },
  { word: 'МАГНИТ', category: 'Наука' },
  { word: 'НАСТРОЙКА', category: 'Музыка' },
  { word: 'ОЛИМПИАДА', category: 'Спорт' },
  { word: 'ПАРАШЮТ', category: 'Спорт' },
  { word: 'ПЕЧЕНЬЕ', category: 'Еда' },
  { word: 'ПОДУШКА', category: 'Предметы' },
  { word: 'РАКЕТА', category: 'Транспорт' },
  { word: 'САЛФЕТКА', category: 'Предметы' },
  { word: 'СНЕГОВИК', category: 'Зима' },
  { word: 'СПИДОМЕТР', category: 'Транспорт' },
  { word: 'ТАРАКАН', category: 'Животные' },
  { word: 'ФОНАРИК', category: 'Предметы' },
  { word: 'ХОЛОДИЛЬНИК', category: 'Предметы' },
  { word: 'ШОКОЛАД', category: 'Еда' },
  { word: 'ЭКСКАВАТОР', category: 'Транспорт' },
  { word: 'БИНокль', category: 'Предметы' },
  { word: 'ГАНТЕЛЬ', category: 'Спорт' },
  { word: 'ДИРИЖАБЛЬ', category: 'Транспорт' },
  { word: 'ЖУРАВЛЬ', category: 'Животные' },
  { word: 'ЗЕРКАЛО', category: 'Предметы' },
  { word: 'ИНСТРУМЕНТ', category: 'Предметы' },
  { word: 'КАПУСТА', category: 'Еда' },
  { word: 'ЛОПАТА', category: 'Предметы' },
  { word: 'МОЛОТ', category: 'Предметы' },
  { word: 'НОСОК', category: 'Одежда' },
  { word: 'ОБЛАКО', category: 'Природа' },
  { word: 'ПОДВАЛ', category: 'Места' },
  { word: 'РОБОТ', category: 'Наука' },
  { word: 'САМОВАР', category: 'Предметы' },
  { word: 'ТЕЛЕСКОП', category: 'Наука' },
  { word: 'УДАВ', category: 'Животные' },
  { word: 'ФЕРМА', category: 'Места' },
  { word: 'ХЛЕБ', category: 'Еда' },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class PasswordEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.players = new Map();
    this.state = 'waiting';
    this.round = 0;
    this.maxRounds = 5;
    this.clueGiverId = null;
    this.secretWord = null;
    this.clue = null;
    this.guesses = new Map();
    this.wordPool = [];
    this.roundTimer = null;
    this._aborted = false;
    this._timerInterval = null;
    this._roundTimeout = null;
    this.gameId = 'password_' + Date.now();
  }

  start() {
    if (this._aborted) return;
    const roomPlayers = (this.room?.players ?? []).filter(p => !p.isSpectator && isPlayerOnline(p, this.room));
    for (const p of roomPlayers) {
      if (!this.players.has(p.id)) {
        this.players.set(p.id, { id: p.id, name: p.name, score: 0 });
      }
    }
    this.wordPool = shuffle(SECRET_WORDS);
    this.state = 'waiting';
    this.round = 0;
  }

  addPlayer(player) {
    this.players.set(player.id, { id: player.id, name: player.name, score: 0 });
    this.emit('player:joined', { playerId: player.id, playerName: player.name });
  }

  removePlayer(playerId) {
    if (this.players.has(playerId)) {
      const p = this.players.get(playerId);
      this.players.delete(playerId);
      this.emit('player:left', { playerId, playerName: p.name });
    }
  }

  nextClueGiver() {
    pruneOfflineFromMap(this.players, this.room);
    const ids = Array.from(this.players.keys()).filter((id) => {
      const rp = this.room?.players?.find((p) => p.id === id);
      return !rp || rp.isOnline !== false;
    });
    if (ids.length === 0) return null;
    if (!this.clueGiverId || !ids.includes(this.clueGiverId)) return ids[0];
    const idx = ids.indexOf(this.clueGiverId);
    return ids[(idx + 1) % ids.length];
  }

  startRound() {
    if (this._aborted) return;
    if (this.players.size < 2) {
      this.emit('error', { message: 'Нужно минимум 2 игрока' });
      return;
    }

    this.round++;
    if (this.round > this.maxRounds) {
      this.endGame();
      return;
    }

    this.clueGiverId = this.nextClueGiver();
    const wordEntry = this.wordPool[(this.round - 1) % this.wordPool.length];
    this.secretWord = wordEntry.word;
    this.clue = null;
    this.guesses.clear();

    this.state = 'clue';
    this.roundTimer = 20;

    this.emit('round:started', {
      round: this.round,
      maxRounds: this.maxRounds,
      clueGiverId: this.clueGiverId,
      clueGiverName: this.players.get(this.clueGiverId)?.name,
      category: wordEntry.category,
      scores: this.getScoreboard(),
    });
    // Ведущему раунда нигде не сообщалось само секретное слово — ни один
    // emit тут его не содержал, а фронт даже не пытался его отрисовать в
    // фазе подсказки. Ведущий физически не мог знать, к какому слову
    // придумывать подсказку. word:pick — уже существующий generic-канал
    // (newGamesHandler.js форвардит его конкретному playerId как `${gameType}:your-word`).
    this.emit('word:pick', { playerId: this.clueGiverId, word: this.secretWord });

    this.emit('clue:prompt', {
      clueGiverId: this.clueGiverId,
      category: wordEntry.category,
    });

    if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
    this._timerInterval = setInterval(() => {
      if (this._aborted) { clearInterval(this._timerInterval); this._timerInterval = null; return; }
      this.roundTimer--;
      this.emit('timer:tick', this.roundTimer);
      if (this.roundTimer <= 0) {
        clearInterval(this._timerInterval);
        this._timerInterval = null;
        if (this.state === 'clue') {
          this.clue = '—';
          this.startGuessing();
        } else if (this.state === 'guessing') {
          this.resolveRound();
        }
      }
    }, 1000);
  }

  submitClue(playerId, clue) {
    if (this.state !== 'clue' || playerId !== this.clueGiverId) return false;
    const trimmed = String(clue || '').trim().toUpperCase();
    if (!trimmed) return false;

    this.clue = trimmed;
    this.emit('clue:submitted', {
      clueGiverId: playerId,
      clue: trimmed,
    });
    this.startGuessing();
    return true;
  }

  startGuessing() {
    this.state = 'guessing';
    this.roundTimer = 20;
    this.guesses.clear();

    this.emit('phase:changed', { phase: 'guessing', clue: this.clue });
    this.emit('timer:tick', this.roundTimer);
  }

  submitGuess(playerId, guess) {
    if (this.state !== 'guessing') return false;
    if (playerId === this.clueGiverId) return false;
    if (this.guesses.has(playerId)) return false;

    const trimmed = String(guess || '').trim().toUpperCase();
    if (!trimmed) return false;

    this.guesses.set(playerId, trimmed);

    const isCorrect = trimmed === this.secretWord;
    this.emit('guess:submitted', {
      playerId,
      playerName: this.players.get(playerId)?.name,
      correct: isCorrect,
    });

    if (isCorrect) {
      const guesser = this.players.get(playerId);
      const clueGiver = this.players.get(this.clueGiverId);
      if (guesser) guesser.score += 100;
      if (clueGiver) clueGiver.score += 50;

      this.emit('guess:result', {
        playerId,
        playerName: guesser?.name,
        correct: true,
        clueGiverId: this.clueGiverId,
        clueGiverName: clueGiver?.name,
        secretWord: this.secretWord,
      });

      if (this._roundTimeout) { clearTimeout(this._roundTimeout); this._roundTimeout = null; }
      this._roundTimeout = setTimeout(() => {
        this._roundTimeout = null;
        if (!this._aborted) this.resolveRound();
      }, 3000);
      return true;
    }

    const remainingGuessers = Array.from(this.players.keys()).filter(
      id => id !== this.clueGiverId && !this.guesses.has(id)
    );
    if (remainingGuessers.length === 0) {
      if (this._roundTimeout) { clearTimeout(this._roundTimeout); this._roundTimeout = null; }
      this._roundTimeout = setTimeout(() => {
        this._roundTimeout = null;
        if (!this._aborted) this.resolveRound();
      }, 2000);
    }

    return true;
  }

  resolveRound() {
    if (this.state === 'ended' || this.state === 'round-result') return;
    this.state = 'round-result';
    if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }

    const someoneGuessed = Array.from(this.guesses.values()).some(g => g === this.secretWord);

    this.emit('round:ended', {
      round: this.round,
      maxRounds: this.maxRounds,
      secretWord: this.secretWord,
      clue: this.clue,
      clueGiverId: this.clueGiverId,
      clueGiverName: this.players.get(this.clueGiverId)?.name,
      guessed: someoneGuessed,
      scores: this.getScoreboard(),
    });

    if (this.round < this.maxRounds) {
      setTimeout(() => {
        if (!this._aborted) this.startRound();
      }, 4000);
    } else {
      setTimeout(() => {
        if (!this._aborted) this.endGame();
      }, 4000);
    }
  }

  endGame() {
    if (this.state === 'ended') return;
    this.state = 'ended';
    if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
    if (this._roundTimeout) { clearTimeout(this._roundTimeout); this._roundTimeout = null; }

    const scores = this.getScoreboard();
    const winner = scores[0];

    this.emit('game:ended', {
      winnerId: winner?.id,
      winnerName: winner?.name,
      scores,
    }, { scores });
  }

  getScoreboard() {
    return Array.from(this.players.values())
      .map(p => ({ id: p.id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }

  cleanup() {
    this._aborted = true;
    if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
    if (this._roundTimeout) { clearTimeout(this._roundTimeout); this._roundTimeout = null; }
    this.removeAllListeners();
  }

  getState() {
    return {
      state: this.state,
      round: this.round,
      maxRounds: this.maxRounds,
      clueGiverId: this.clueGiverId,
      clue: this.clue,
      players: this.getScoreboard(),
    };
  }
}
