import { EventEmitter } from 'events';

export class ChameleonEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.playerIds = new Set(this.players.map(p => p.id));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 0;
    this.maxRounds = this.settings.maxRounds ?? 6;
    this.clueTime = this.settings.clueTime ?? 30;
    this.votingTime = this.settings.votingTime ?? 30;
    this.discussionTime = this.settings.discussionTime ?? 60;
    this.chameleonId = null;
    this.secretWord = null;
    this.currentGrid = null;
    this.clues = new Map();
    this.clueOrder = [];
    this.clueIndex = 0;
    this.votes = new Map();
    this.usedGrids = new Set();
    this.lastChameleonId = null;
    this._aborted = false;
    this._roundDelayTimeout = null;

    this.grids = [
      { title: 'Еда', words: ['Пицца', 'Суши', 'Борщ', 'Паста', 'Плов', 'Шашлык', 'Салат', 'Стейк', 'Рамен', 'Тако', 'Фалафель', 'Вареники', 'Окрошка', 'Хинкали', 'Круассан', 'Пельмени'] },
      { title: 'Животные', words: ['Кошка', 'Собака', 'Слон', 'Дельфин', 'Орёл', 'Медведь', 'Тигр', 'Пингвин', 'Жираф', 'Кенгуру', 'Осьминог', 'Хамелеон', 'Панда', 'Лиса', 'Волк', 'Черепаха'] },
      { title: 'Страны', words: ['Россия', 'Япония', 'Бразилия', 'Египет', 'Канада', 'Италия', 'Мексика', 'Австралия', 'Индия', 'Франция', 'Германия', 'Турция', 'Китай', 'Испания', 'Греция', 'Норвегия'] },
      { title: 'Спорт', words: ['Футбол', 'Хоккей', 'Теннис', 'Бокс', 'Плавание', 'Гольф', 'Бег', 'Шахматы', 'Волейбол', 'Лыжи', 'Сёрфинг', 'Дзюдо', 'Фехтование', 'Гимнастика', 'Бадминтон', 'Регби'] },
      { title: 'Профессии', words: ['Врач', 'Учитель', 'Повар', 'Пилот', 'Художник', 'Юрист', 'Инженер', 'Актёр', 'Пожарный', 'Фермер', 'Дизайнер', 'Хирург', 'Журналист', 'Строитель', 'Программист', 'Космонавт'] },
      { title: 'Транспорт', words: ['Автобус', 'Самолёт', 'Поезд', 'Велосипед', 'Мотоцикл', 'Трамвай', 'Лодка', 'Вертолёт', 'Такси', 'Метро', 'Каноэ', 'Яхта', 'Ракета', 'Дирижабль', 'Санки', 'Скутер'] },
      { title: 'Музыка', words: ['Гитара', 'Пианино', 'Барабан', 'Скрипка', 'Флейта', 'Саксофон', 'Арфа', 'Виолончель', 'Бас', 'Труба', 'Укулеле', 'Банджо', 'Аккордеон', 'Орган', 'Балалайка', 'Ксилофон'] },
      { title: 'Фильмы', words: ['Комедия', 'Триллер', 'Драма', 'Мюзикл', 'Хоррор', 'Боевик', 'Мелодрама', 'Детектив', 'Фантастика', 'Вестерн', 'Аниме', 'Документальный', 'Нуар', 'Пародия', 'Сказка', 'Байопик'] },
      { title: 'Одежда', words: ['Джинсы', 'Футболка', 'Платье', 'Куртка', 'Шорты', 'Пальто', 'Свитер', 'Юбка', 'Шарф', 'Кроссовки', 'Шляпа', 'Перчатки', 'Костюм', 'Сарафан', 'Жилетка', 'Носки'] },
      { title: 'Праздники', words: ['Новый год', 'Пасха', 'Хэллоуин', 'Рождество', 'Масленица', 'День рождения', 'Свадьба', 'Выпускной', 'Юбилей', 'Карнавал', 'Крещение', 'Ивана Купала', 'Первое мая', 'Восьмое марта', 'День Победы', 'Сабантуй'] },
      { title: 'Природа', words: ['Гора', 'Озеро', 'Лес', 'Пустыня', 'Океан', 'Река', 'Водопад', 'Вулкан', 'Ледник', 'Остров', 'Пещера', 'Каньон', 'Болото', 'Тундра', 'Степь', 'Коралловый риф'] },
      { title: 'Школа', words: ['Математика', 'Физика', 'Химия', 'Биология', 'История', 'Литература', 'География', 'Музыка', 'Физкультура', 'Английский', 'Рисование', 'Информатика', 'Обществознание', 'Астрономия', 'Экономика', 'Труд'] },
      { title: 'Мебель', words: ['Стол', 'Стул', 'Диван', 'Кровать', 'Шкаф', 'Комод', 'Полка', 'Тумбочка', 'Кресло', 'Табурет', 'Буфет', 'Вешалка', 'Гамак', 'Скамейка', 'Пуфик', 'Сервант'] },
      { title: 'Напитки', words: ['Вода', 'Чай', 'Кофе', 'Сок', 'Молоко', 'Квас', 'Компот', 'Какао', 'Лимонад', 'Кефир', 'Смузи', 'Морс', 'Кисель', 'Ряженка', 'Матча', 'Тархун'] },
      { title: 'Космос', words: ['Земля', 'Луна', 'Солнце', 'Марс', 'Юпитер', 'Венера', 'Сатурн', 'Комета', 'Астероид', 'Звезда', 'Галактика', 'Туманность', 'Спутник', 'Метеорит', 'Чёрная дыра', 'Квазар'] },
    ];
  }

  start() {
    if (this._aborted) return;
    this.phase = 'playing';
    this.round = 0;
    this.nextRound();
  }

  nextRound() {
    if (this._aborted) return;
    this.stopTimer();
    this.round++;
    if (this.round > this.maxRounds) { this.endGame(); return; }

    this.clues.clear();
    this.votes.clear();
    this.clueIndex = 0;

    let eligibleChameleons = this.players.filter(p => p.id !== this.lastChameleonId);
    if (eligibleChameleons.length === 0) eligibleChameleons = this.players;
    const chameleonIdx = Math.floor(Math.random() * eligibleChameleons.length);
    this.chameleonId = eligibleChameleons[chameleonIdx].id;
    this.lastChameleonId = this.chameleonId;

    let availableIndices = this.grids.map((_, i) => i).filter((i) => !this.usedGrids.has(i));
    if (availableIndices.length === 0) {
      this.usedGrids.clear();
      availableIndices = this.grids.map((_, i) => i);
    }
    const gIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedGrids.add(gIdx);
    this.currentGrid = this.grids[gIdx];

    this.secretWord = this.currentGrid.words[Math.floor(Math.random() * this.currentGrid.words.length)];
    this.clueOrder = [...this.players].sort(() => Math.random() - 0.5);

    this.emit('game:started', {
      round: this.round, maxRounds: this.maxRounds,
      grid: this.currentGrid.words, gridTitle: this.currentGrid.title,
      players: this.players.map(p => ({
        id: p.id, name: p.name,
        role: p.id === this.chameleonId ? 'chameleon' : 'citizen',
        secretWord: p.id === this.chameleonId ? null : this.secretWord,
      })),
    });

    this.phase = 'cluing';
    this.promptNextClue();
  }

  promptNextClue() {
    if (this._aborted) return;
    if (this.clueIndex >= this.clueOrder.length) { this.startVoting(); return; }
    const current = this.clueOrder[this.clueIndex];
    this.timeLeft = this.clueTime;

    this.emit('clue:prompt', {
      playerId: current.id, playerName: current.name,
      clueNumber: this.clueIndex + 1, totalClues: this.clueOrder.length,
      timeLeft: this.timeLeft,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (this._aborted) return;
        this.clues.set(current.id, '—');
        this.emit('clue:submitted', { playerId: current.id, playerName: current.name, clue: '—' });
        this.clueIndex++;
        this.promptNextClue();
      }
    }, 1000);
  }

  submitClue(playerId, clue) {
    if (this._aborted) return false;
    if (this.phase !== 'cluing') return false;
    const current = this.clueOrder[this.clueIndex];
    if (!current || playerId !== current.id) return false;
    if (this.clues.has(playerId)) return false;

    this.stopTimer();
    const cleanClue = clue.trim().slice(0, 50) || '—';
    this.clues.set(playerId, cleanClue);
    this.emit('clue:submitted', { playerId, playerName: current.name, clue: cleanClue });
    this.clueIndex++;
    this.promptNextClue();
    return true;
  }

  startVoting() {
    if (this._aborted) return;
    this.stopTimer();
    this.phase = 'voting';
    this.votes.clear();

    const allClues = this.clueOrder.map(p => ({
      id: p.id, name: p.name, clue: this.clues.get(p.id) ?? '—',
    }));

    this.emit('voting:started', {
      clues: allClues,
      players: this.players.map(p => ({ id: p.id, name: p.name })),
      timeLeft: this.votingTime,
    });

    this.timeLeft = this.votingTime;
    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.resolveVotes();
      }
    }, 1000);
  }

  vote(voterId, targetId) {
    if (this._aborted) return false;
    if (this.phase !== 'voting') return false;
    if (voterId === targetId) return false;
    if (!this.playerIds.has(voterId)) return false;
    if (!this.playerIds.has(targetId)) return false;
    if (this.votes.has(voterId)) return false;

    this.votes.set(voterId, targetId);
    this.emit('vote:cast', { voterId, total: this.votes.size, required: this.players.length });
    if (this.votes.size >= this.players.length) { this.stopTimer(); this.resolveVotes(); }
    return true;
  }

  resolveVotes() {
    if (this._aborted) return;
    if (this.phase === 'chameleon_guess' || this.phase === 'finished') return;

    const tally = new Map();
    for (const targetId of this.votes.values()) {
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    }
    let maxVotes = 0;
    const tied = [];
    for (const [id, count] of tally) {
      if (count > maxVotes) {
        maxVotes = count;
        tied.length = 0;
        tied.push(id);
      } else if (count === maxVotes) {
        tied.push(id);
      }
    }
    const accused = tied.length > 0 ? tied[Math.floor(Math.random() * tied.length)] : null;

    const caught = accused === this.chameleonId;
    this.emit('voting:ended', {
      accused, accusedName: this.players.find(p => p.id === accused)?.name ?? '—',
      votes: maxVotes, caught,
      chameleonId: this.chameleonId,
      chameleonName: this.players.find(p => p.id === this.chameleonId)?.name ?? '—',
    });

    if (caught) {
      this.phase = 'chameleon_guess';
      this.emit('chameleon:guess', { chameleonId: this.chameleonId, grid: this.currentGrid.words, timeLeft: 15 });
      this.timeLeft = 15;
      this.timer = setInterval(() => {
        if (this._aborted) return;
        this.timeLeft--;
        this.emit('timer:tick', this.timeLeft);
        if (this.timeLeft <= 0) {
          this.stopTimer();
          if (!this._aborted) this.scoreRound(true, false);
        }
      }, 1000);
    } else {
      this.scoreRound(false, false);
    }
  }

  submitGuess(playerId, guess) {
    if (this._aborted) return false;
    if (this.phase !== 'chameleon_guess') return false;
    if (playerId !== this.chameleonId) return false;
    const guessNorm = guess.trim().toLowerCase();
    const validGuess = this.currentGrid?.words?.some((w) => w.toLowerCase() === guessNorm);
    if (!validGuess) return false;
    this.stopTimer();
    const correct = guessNorm === this.secretWord.toLowerCase();
    this.emit('chameleon:guess', {
      chameleonId: this.chameleonId, guess, correct, actualWord: this.secretWord,
    });
    this.scoreRound(true, correct);
    return true;
  }

  scoreRound(wasCaught, guessedCorrectly) {
    if (this._aborted) return;
    if (this.phase === 'results') return;
    this.phase = 'results';
    const pointsForWin = this.settings.pointsForWin ?? 2;
    const chameleonGuessBonus = this.settings.chameleonGuessBonus ?? 3;
    if (wasCaught && !guessedCorrectly) {
      for (const p of this.players) { if (p.id !== this.chameleonId) p.score += pointsForWin; }
    } else {
      const cham = this.players.find(p => p.id === this.chameleonId);
      if (cham) cham.score += guessedCorrectly ? chameleonGuessBonus : pointsForWin;
    }
    this.emit('score:updated', {
      players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
    });
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    if (this.round >= this.maxRounds) {
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
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
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
      phase: this.phase, players: this.players,
      round: this.round, maxRounds: this.maxRounds,
      timeLeft: this.timeLeft,
      chameleonId: this.phase === 'finished' ? this.chameleonId : null,
      gridTitle: this.currentGrid?.title ?? null,
      cluesCount: this.clues.size, votesCount: this.votes.size,
    };
  }
}
