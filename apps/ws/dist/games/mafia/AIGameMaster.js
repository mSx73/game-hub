function isBotPlayerId(id) {
  return typeof id === 'string' && id.startsWith('bot_');
}

export class AIGameMaster {
  constructor(engine) {
    this.engine = engine;
    this.speechQueue = [];
    this.isSpeaking = false;
    this.dayNumber = 0;
    this.nightNumber = 0;
    this.totalKilled = 0;
    this.gameEnded = false;
    this.setupListeners();
  }

  setupListeners() {
    this.engine.on('game:phase-changed', (phase, timer, opts) => {
      this.onPhaseChanged(phase, timer, opts);
    });
    this.engine.on('game:night-resolved', (results) => {
      this.onNightResolved(results);
    });
    this.engine.on('game:lynched', (playerId, votes) => {
      this.onLynched(playerId, votes);
    });
    this.engine.on('game:poison-death', (playerId) => {
      this.onPoisonDeath(playerId);
    });
    this.engine.on('game:vote-tie', (candidates) => {
      this.onVoteTie(candidates);
    });
    this.engine.on('game:ended', (winner) => {
      this.onGameEnded(winner);
    });
    this.engine.on('game:player-killed', (playerId, cause) => {
      if (cause === 'disconnected') {
        const p = this.getPlayer(playerId);
        this.speak(`${p.name} покинул город. Место за столом пустует...`);
      }
    });
  }

  onPhaseChanged(phase, timer, opts = {}) {
    const state = this.engine.getState();
    const alive = state.players.filter((p) => p.status === 'alive');
    const aliveCount = alive.length;
    const isActive = opts?.isActive ?? true;

    switch (phase) {
      case 'role-reveal':
        this.speak('🎭 Добро пожаловать в игру «Мафия»!');
        this.queueDelayed('Каждый из вас получил тайную роль. Посмотрите её — и никому не показывайте.', 2500);
        this.queueDelayed(`В городе ${aliveCount} жителей. Среди них затаились опасные люди...`, 4500);
        break;

      case 'night-start':
        this.nightNumber++;
        if (this.nightNumber === 1) {
          this.speak('🌙 Город погружается в первую ночь. Закройте глаза, жители...');
          this.queueDelayed('Тишина опускается на улицы. Но не все спят...', 2500);
        } else {
          const nightLines = [
            `🌙 Ночь ${this.nightNumber}. Город засыпает тревожным сном...`,
            `🌙 Наступает ${this.nightNumber}-я ночь. Тени скользят по переулкам...`,
            `🌙 Ночь ${this.nightNumber}. В темноте слышны шаги...`,
            `🌙 ${this.nightNumber}-я ночь опускается на город. Фонари гаснут один за другим...`,
          ];
          this.speak(this.pick(nightLines));
          if (this.totalKilled >= 3) {
            this.queueDelayed('Страх нарастает. Город теряет жителей...', 2000);
          }
        }
        break;

      case 'night-waiting':
        break;

      case 'night-mafia':
        if (isActive) this.speakToRole('mafia', this.pick([
          '🔪 Мафия открывает глаза. Ваш ход — выберите жертву.',
          '🔪 Мафия просыпается. Кто не доживёт до рассвета?',
          '🔪 Семья собирается. Пора решить, кто лишний в этом городе.',
        ]));
        break;

      case 'night-don':
        if (isActive) this.speakToRole('don', this.pick([
          '🎩 Дон мафии, ваша очередь. Проверьте — кто из них Шериф?',
          '🎩 Крёстный отец, проверьте подозрительного жителя.',
        ]));
        break;

      case 'night-doctor':
        if (isActive) this.speakToRole('doctor', this.pick([
          '💉 Доктор, просыпайтесь! Кого будете спасать?',
          '💉 Доктор, ночная смена. Выберите пациента.',
          '💉 Врач просыпается. Чью жизнь вы спасёте сегодня?',
        ]));
        break;

      case 'night-sheriff':
        if (isActive) this.speakToRole('sheriff', this.pick([
          '⭐ Шериф просыпается! Кого проверяем?',
          '⭐ Шериф, ваш ход. Укажите на подозрительного.',
          '⭐ Закон не спит! Шериф, кого проверить?',
        ]));
        break;

      case 'night-bodyguard':
        if (isActive) this.speakToRole('bodyguard', this.pick([
          '🛡️ Телохранитель, встаньте на защиту. Кого прикроете от ножа?',
          '🛡️ Телохранитель, выберите жителя, чью жизнь вы готовы отдать за него.',
        ]));
        break;

      case 'night-journalist':
        if (isActive) this.speakToRole('journalist', this.pick([
          '📰 Журналист, ваша статья — проверка. Кто из них в мафии?',
          '📰 Расследование ночью: журналист, укажите подозреваемого.',
        ]));
        break;

      case 'night-maniac':
        if (isActive) this.speakToRole('maniac', this.pick([
          '🔪 Маньяк бродит по улицам. Выберите жертву.',
          '🔪 Безумец открывает глаза. Кто станет следующим?',
        ]));
        break;

      case 'night-poisoner':
        if (isActive) this.speakToRole('poisoner', this.pick([
          '☠️ Отравитель готовит зелье. Кому подсыпать яд?',
          '☠️ Ядовитые руки тянутся к чьему-то стакану...',
        ]));
        break;

      case 'night-putana':
        if (isActive) this.speakToRole('putana', this.pick([
          '💋 Путана выбирает компанию на ночь.',
          '💋 Обольстительница решает, кого отвлечь этой ночью.',
        ]));
        break;

      case 'night-end':
        this.speak('Ночь подходит к концу. Подводим итоги...');
        break;

      case 'morning': {
        const dayNum = this.nightNumber;
        if (this.totalKilled === 0) {
          this.speak(`☀️ Утро ${dayNum}-го дня! Город просыпается. Все живы!`);
        } else {
          this.speak(this.pick([
            `☀️ Утро ${dayNum}-го дня. Город просыпается в тревоге...`,
            `☀️ Рассвет ${dayNum}-го дня. Не все дожили до утра...`,
            `☀️ ${dayNum}-е утро. Жители с опаской выходят на улицы...`,
          ]));
        }
        break;
      }

      case 'discussion': {
        const discussionLines = [
          '💬 Время обсуждения! Кто подозрителен? Высказывайтесь!',
          '💬 Слово жителям! Обсудите, кто может быть мафией.',
          '💬 Начинается дискуссия. Аргументируйте, обвиняйте, защищайтесь!',
        ];
        this.speak(this.pick(discussionLines));
        if (timer > 30) {
          this.queueDelayed(`Общий таймер фазы — ${timer} секунд.`, 2000);
        }
        if (aliveCount <= 5) {
          this.queueDelayed('Каждый голос на счету — нас осталось мало.', 4000);
        }
        const humans = alive.filter((p) => !isBotPlayerId(p.id));
        const slotMs = 61000;
        humans.forEach((p, i) => {
          this.queueDelayed(
            `🎤 ${p.name}, у вас до минуты на высказывание. Говорим строго по очереди.`,
            4500 + i * slotMs
          );
        });
        break;
      }

      case 'voting':
        this.speak(this.pick([
          '🗳️ Голосование! Выбирайте, кого изгнать из города.',
          '🗳️ Пора голосовать! Кто покинет город сегодня?',
          '🗳️ Начинается голосование. Сделайте свой выбор.',
        ]));
        break;

      case 'vote-result':
        this.speak('Подсчитываем голоса...');
        break;

      case 'gameOver':
        break;
    }
  }

  onNightResolved(results) {
    const killed = results.killed || [];

    if (killed.length === 0) {
      this.speak(this.pick([
        '✨ Удивительно — ночь прошла без жертв!',
        '✨ Все живы! Спокойная ночь.',
      ]));
    } else {
      this.totalKilled += killed.length;
      if (killed.length === 1) {
        this.speak(this.pick([
          '💀 Этой ночью город потерял одного жителя...',
          '💀 Страшная находка на рассвете...',
          '💀 Утром обнаружено тело...',
        ]));
      } else {
        this.speak(`💀 Кровавая ночь! Город потерял ${killed.length} жителей...`);
      }
      killed.forEach((name, i) => {
        this.queueDelayed(
          this.pick([
            `${name} был(а) найден(а) мёртвым(ой).`,
            `${name} не пережил(а) эту ночь.`,
            `${name} — ещё одна жертва тьмы.`,
          ]),
          2000 + i * 2500
        );
      });
    }
  }

  onLynched(playerId, votes) {
    const p = this.getPlayer(playerId);
    this.totalKilled++;
    const lines = [
      `⚖️ Жители решили: ${p.name} покидает город. ${votes} голосов.`,
      `⚖️ Большинством в ${votes} голосов ${p.name} изгнан(а)!`,
      `⚖️ Народный суд вынес вердикт: ${p.name} виновен(на). ${votes} голосов.`,
    ];
    this.speak(this.pick(lines));
    this.queueDelayed(`Роль ${p.name}: ${this.roleToRussian(p.role)}.`, 3000);
  }

  onPoisonDeath(playerId) {
    const p = this.getPlayer(playerId);
    this.totalKilled++;
    this.speak(this.pick([
      `☠️ ${p.name} умирает от загадочного отравления...`,
      `☠️ Яд сделал своё дело. ${p.name} больше нет.`,
    ]));
  }

  onVoteTie(candidates) {
    const names = candidates.map((id) => this.getPlayer(id).name).join(' и ');
    this.speak(`⚖️ Ничья! ${names} набрали поровну голосов. Никто не изгнан.`);
  }

  resetState() {
    this.speechQueue = [];
    this.isSpeaking = false;
    this.dayNumber = 0;
    this.nightNumber = 0;
    this.totalKilled = 0;
    this.gameEnded = true;
  }

  onGameEnded(winner) {
    const state = this.engine.getState();

    switch (winner) {
      case 'mafia':
        this.speak('🏴 Мафия захватила город! Тьма поглотила последних мирных жителей.', true);
        this.queueDelayed('Преступники торжествуют. Город пал.', 3000, true);
        break;
      case 'civilian':
        this.speak('🏆 Мирные жители победили! Вся мафия раскрыта и изгнана!', true);
        this.queueDelayed('Справедливость восторжествовала. Город спасён!', 3000, true);
        break;
      case 'maniac':
        this.speak('🔪 Маньяк уничтожил всех! Безумие победило разум.', true);
        this.queueDelayed('Ни мафия, ни мирные не смогли его остановить...', 3000, true);
        break;
      default:
        this.speak('🎬 Игра завершена!', true);
    }

    this.queueDelayed('Раскрываем все карты:', 5000, true);
    state.players.forEach((p, i) => {
      const status = p.status === 'alive' ? '✅ жив(а)' : `💀 ${p.deathCause || 'мёртв(а)'}`;
      this.queueDelayed(`${p.name} — ${this.roleToRussian(p.role)} [${status}]`, 6000 + i * 1200, true);
    });

    const totalDelay = 6000 + state.players.length * 1200 + 2000;
    this.queueDelayed(`Игра длилась ${state.round} раундов. Всего погибло ${this.totalKilled} человек.`, totalDelay, true);

    setTimeout(() => this.resetState(), totalDelay + 3000);
  }

  roleToRussian(role) {
    const map = {
      civilian: 'Мирный житель',
      citizen: 'Мирный житель',
      mafia: 'Мафия',
      don: 'Дон мафии',
      sheriff: 'Шериф',
      doctor: 'Доктор',
      maniac: 'Маньяк',
      poisoner: 'Отравитель',
      putana: 'Путана',
      bodyguard: 'Телохранитель',
      journalist: 'Журналист',
      mayor: 'Мэр',
    };
    return map[role] || role;
  }

  speak(text, force) {
    if (this.gameEnded && !force) return;
    this.speechQueue.push(text);
    if (!this.isSpeaking) this.processQueue();
  }

  speakToRole(role, text) {
    if (this.gameEnded) return;
    const state = this.engine.getState();
    const targets = state.players.filter((p) => p.role === role && p.status === 'alive').map((p) => p.id);
    if (targets.length > 0) {
      this.engine.emit('ai:whisper', { playerIds: targets, text });
    }
  }

  queueDelayed(text, delayMs, force) {
    setTimeout(() => this.speak(text, force), delayMs);
  }

  async processQueue() {
    this.isSpeaking = true;
    while (this.speechQueue.length > 0) {
      const text = this.speechQueue.shift();
      this.engine.emit('ai:speak', text);
      const pauseMs = Math.min(4000, Math.max(1500, text.length * 40));
      await this.delay(pauseMs);
    }
    this.isSpeaking = false;
  }

  getPlayer(id) {
    const state = this.engine.getState();
    return state.players.find((p) => p.id === id) || { id, name: 'Неизвестный', role: 'civilian', status: 'dead' };
  }

  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
