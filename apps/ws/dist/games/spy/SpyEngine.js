import { EventEmitter } from 'events';

export class SpyEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.spyId = null;
    this.location = '';
    this.votes = new Map();
    this.timer = null;
    this.timeLeft = 0;
    this.discussionTime = this.settings.discussionTime ?? 120;

    this.locationRoles = {
      'Больница': ['Врач', 'Пациент', 'Медсестра', 'Санитар'],
      'Школа': ['Учитель', 'Ученик', 'Директор', 'Охранник'],
      'Ресторан': ['Повар', 'Официант', 'Посетитель', 'Бармен'],
      'Полицейский участок': ['Детектив', 'Заключённый', 'Дежурный', 'Следователь'],
      'Пляж': ['Отдыхающий', 'Спасатель', 'Продавец мороженого', 'Серфер'],
      'Цирк': ['Клоун', 'Дрессировщик', 'Акробат', 'Кассир'],
      'Космическая станция': ['Космонавт', 'Учёный', 'Пилот', 'Инженер'],
      'Подводная лодка': ['Капитан', 'Матрос', 'Штурман', 'Механик'],
      'Казино': ['Крупье', 'Игрок', 'Охранник', 'Бармен'],
      'Аэропорт': ['Пилот', 'Пассажир', 'Стюардесса', 'Таможенник'],
      'Киностудия': ['Режиссёр', 'Актёр', 'Оператор', 'Гримёр'],
      'Библиотека': ['Библиотекарь', 'Читатель', 'Студент', 'Охранник'],
      'Банк': ['Кассир', 'Клиент', 'Охранник', 'Менеджер'],
      'Музей': ['Экскурсовод', 'Посетитель', 'Смотритель', 'Реставратор'],
      'Театр': ['Актёр', 'Зритель', 'Режиссёр', 'Билетёр'],
      'Стадион': ['Спортсмен', 'Болельщик', 'Тренер', 'Судья'],
      'Зоопарк': ['Смотритель', 'Посетитель', 'Ветеринар', 'Экскурсовод'],
      'Супермаркет': ['Кассир', 'Покупатель', 'Грузчик', 'Охранник'],
      'Тюрьма': ['Заключённый', 'Надзиратель', 'Врач', 'Охранник'],
      'Университет': ['Студент', 'Профессор', 'Декан', 'Лаборант'],
      'Церковь': ['Священник', 'Прихожанин', 'Певчий', 'Сторож'],
      'Ферма': ['Фермер', 'Тракторист', 'Доярка', 'Сторож'],
      'Замок': ['Король', 'Рыцарь', 'Прислуга', 'Стражник'],
      'Пиратский корабль': ['Капитан', 'Матрос', 'Кок', 'Штурман'],
      'Военная база': ['Солдат', 'Офицер', 'Разведчик', 'Механик'],
      'Спа-салон': ['Массажист', 'Клиент', 'Администратор', 'Косметолог'],
      'Горнолыжный курорт': ['Инструктор', 'Лыжник', 'Спасатель', 'Бармен'],
      'Пожарная станция': ['Пожарный', 'Водитель', 'Диспетчер', 'Механик'],
      'Автосервис': ['Механик', 'Владелец авто', 'Приёмщик', 'Электрик'],
      'Парикмахерская': ['Парикмахер', 'Клиент', 'Мастер маникюра', 'Администратор'],
      'Свадьба': ['Жених', 'Невеста', 'Тамада', 'Гость'],
      'Дискотека': ['Диджей', 'Танцор', 'Бармен', 'Охранник'],
      'Яхта': ['Капитан', 'Матрос', 'Гость', 'Повар'],
      'Планетарий': ['Экскурсовод', 'Посетитель', 'Астроном', 'Оператор'],
      'Ботанический сад': ['Садовник', 'Посетитель', 'Биолог', 'Экскурсовод'],
      'Вокзал': ['Проводник', 'Пассажир', 'Кассир', 'Носильщик'],
      'Бассейн': ['Пловец', 'Тренер', 'Спасатель', 'Посетитель'],
      'Караоке-бар': ['Певец', 'Зритель', 'Бармен', 'Ведущий'],
      'Детский сад': ['Воспитатель', 'Ребёнок', 'Няня', 'Повар'],
      'Стройка': ['Прораб', 'Рабочий', 'Крановщик', 'Инженер'],
    };
    this._aborted = false;
    this.locations = [
      'Больница', 'Школа', 'Ресторан', 'Полицейский участок', 'Пляж',
      'Цирк', 'Космическая станция', 'Подводная лодка', 'Казино', 'Аэропорт',
      'Киностудия', 'Библиотека', 'Банк', 'Музей', 'Посольство',
      'Театр', 'Стадион', 'Поезд', 'Корабль', 'Зоопарк',
      'Супермаркет', 'Кладбище', 'Тюрьма', 'Университет', 'Церковь',
      'Ферма', 'Замок', 'Пиратский корабль', 'Военная база', 'Спа-салон',
      'Горнолыжный курорт', 'Пожарная станция', 'Автосервис', 'Парикмахерская', 'Свадьба',
      'Дискотека', 'Яхта', 'Планетарий', 'Ботанический сад', 'Вокзал',
      'Бассейн', 'Караоке-бар', 'Детский сад', 'Стройка',
    ];
  }

  start() {
    if (this._aborted) return;
    this.phase = 'discussion';
    const spyIndex = Math.floor(Math.random() * this.players.length);
    this.spyId = this.players[spyIndex].id;
    this.location = this.locations[Math.floor(Math.random() * this.locations.length)];

    const roles = this.locationRoles[this.location];
    const citizenPlayers = this.players.filter(p => p.id !== this.spyId);
    const roleAssignments = roles && roles.length >= citizenPlayers.length
      ? [...roles].sort(() => Math.random() - 0.5).slice(0, citizenPlayers.length)
      : null;
    this.emit('game:started', {
      players: this.players.map((p, i) => {
        const isSpy = p.id === this.spyId;
        const citizenIdx = citizenPlayers.findIndex(c => c.id === p.id);
        const role = isSpy ? 'spy' : (roleAssignments ? roleAssignments[citizenIdx] : 'житель');
        return {
          id: p.id,
          name: p.name,
          role,
          location: isSpy ? null : this.location,
        };
      }),
    });

    this.timeLeft = this.discussionTime;
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

  startVoting() {
    if (this._aborted) return;
    if (this.phase === 'voting') return;
    this.stopTimer();
    this.phase = 'voting';
    this.votes.clear();

    this.emit('voting:started', {
      players: this.players.map(p => ({ id: p.id, name: p.name })),
      timeLeft: 30,
    });

    this.timeLeft = 30;
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
    if (!this.players.find(p => p.id === voterId)) return false;
    if (!this.players.find(p => p.id === targetId)) return false;
    if (this.votes.has(voterId)) return false;

    this.votes.set(voterId, targetId);
    this.emit('vote:cast', { voterId, total: this.votes.size, required: this.players.length });

    if (this.votes.size >= this.players.length) {
      this.stopTimer();
      this.resolveVotes();
    }
    return true;
  }

  resolveVotes() {
    if (this._aborted) return;
    if (this.phase === 'finished') return;

    const tally = new Map();
    for (const targetId of this.votes.values()) {
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    }

    let maxVotes = 0;
    let accused = null;
    for (const [id, count] of tally) {
      if (count > maxVotes) {
        maxVotes = count;
        accused = id;
      }
    }

    const spyCaught = accused === this.spyId;
    const spy = this.players.find(p => p.id === this.spyId);

    if (spyCaught) {
      for (const p of this.players) {
        if (p.id !== this.spyId) p.score += 10;
      }
    } else {
      if (spy) spy.score += 15;
    }

    this.emit('voting:ended', {
      accused,
      accusedName: this.players.find(p => p.id === accused)?.name ?? '—',
      votes: maxVotes,
      spyCaught,
      spyId: this.spyId,
      spyName: spy?.name ?? '—',
      location: this.location,
    });

    if (!spyCaught) {
      this.phase = 'spy_guess';
      this.emit('spy:canGuess', { spyId: this.spyId, timeLeft: 20, locations: [...this.locations].sort((a, b) => a.localeCompare(b, 'ru')) });
      this.timeLeft = 20;
      this.timer = setInterval(() => {
        if (this._aborted) return;
        this.timeLeft--;
        this.emit('timer:tick', this.timeLeft);
        if (this.timeLeft <= 0) {
          this.stopTimer();
          if (!this._aborted) this.endGame(false);
        }
      }, 1000);
    } else {
      this.endGame(true);
    }
  }

  spyGuess(playerId, guessedLocation) {
    if (this._aborted) return false;
    if (this.phase !== 'spy_guess') return false;
    if (playerId !== this.spyId) return false;

    this.stopTimer();
    const correct = guessedLocation.trim().toLowerCase() === this.location.toLowerCase();

    if (correct) {
      const spy = this.players.find(p => p.id === this.spyId);
      if (spy) spy.score += 20;
    }

    this.emit('spy:guess', {
      guessedLocation,
      correct,
      actualLocation: this.location,
    });

    this.endGame(!correct);
    return true;
  }

  endGame(citizensWin) {
    if (this._aborted) return;
    this.phase = 'finished';
    this.stopTimer();
    this.emit('game:ended', {
      citizensWin,
      spyId: this.spyId,
      spyName: this.players.find(p => p.id === this.spyId)?.name ?? '—',
      location: this.location,
      players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
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
    this.removeAllListeners();
  }

  getState() {
    return {
      phase: this.phase,
      players: this.players,
      spyId: this.phase === 'finished' ? this.spyId : null,
      location: this.phase === 'finished' ? this.location : null,
      timeLeft: this.timeLeft,
      votesCount: this.votes.size,
    };
  }
}
