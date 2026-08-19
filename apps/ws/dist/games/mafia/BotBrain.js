const PROFILES = [
  { name: 'Агрессор', voteStyle: 'loud', suspicionBias: 0.7, chatFrequency: 0.6, accuseChance: 0.5 },
  { name: 'Тихоня', voteStyle: 'follower', suspicionBias: 0.3, chatFrequency: 0.2, accuseChance: 0.1 },
  { name: 'Аналитик', voteStyle: 'smart', suspicionBias: 0.5, chatFrequency: 0.4, accuseChance: 0.3 },
  { name: 'Параноик', voteStyle: 'random', suspicionBias: 0.9, chatFrequency: 0.5, accuseChance: 0.7 },
  { name: 'Дипломат', voteStyle: 'consensus', suspicionBias: 0.4, chatFrequency: 0.3, accuseChance: 0.15 },
  { name: 'Хаотик', voteStyle: 'chaotic', suspicionBias: 0.5, chatFrequency: 0.7, accuseChance: 0.4 },
];

const CHAT_LINES = {
  discussion: {
    civilian: {
      suspicious: [
        'Мне кажется, {target} ведёт себя подозрительно...',
        '{target} как-то слишком тих(а). Это настораживает.',
        'Кто-нибудь обратил внимание на {target}?',
        'У меня плохое предчувствие насчёт {target}.',
        '{target}, объясни свою позицию!',
        'Не нравится мне взгляд {target}...',
      ],
      defend: [
        'Я мирный, поверьте мне!',
        'Подождите, давайте разберёмся без паники.',
        'Нет причин меня подозревать.',
        'Я за логику, а не за эмоции.',
        'Может, стоит подумать ещё?',
      ],
      neutral: [
        'Кто-нибудь что-то заметил?',
        'Давайте обсудим спокойно.',
        'Пока сложно сказать...',
        'Нужно больше информации.',
        'Первый день — все под подозрением.',
        'Интересно...',
        'Хм, надо подумать.',
      ],
    },
    mafia: {
      deflect: [
        'Не понимаю, почему на меня смотрят.',
        'Я точно мирный, клянусь!',
        'Давайте лучше проверим {target}.',
        '{target} ведёт себя очень странно, не находите?',
        'Я за то, чтобы разобраться, а не обвинять.',
        'Мне кажется, настоящая мафия молчит. А я вот говорю.',
      ],
      frame: [
        '{target} подозрительно молчит. Мафия?',
        'Обратите внимание на {target}!',
        'Мне кажется, {target} прячется за спинами.',
        'А что если {target} — мафия? Подумайте.',
      ],
    },
    sheriff: [
      'У меня есть кое-какая информация...',
      'Я проверил кое-кого. Потерпите.',
      'Доверьтесь мне — я знаю, кто виноват.',
    ],
    doctor: [
      'Я позабочусь о городе.',
      'Не волнуйтесь, я делаю что могу.',
    ],
  },
  voting: {
    decided: [
      'Голосую за {target}!',
      '{target}, извини, но ты подозрителен(на).',
      'Мой голос — {target}.',
    ],
    uncertain: [
      'Сложный выбор...',
      'Не уверен(а), но рискну.',
    ],
  },
};

export class BotBrain {
  constructor(botId, role, team, engine) {
    this.botId = botId;
    this.role = role;
    this.team = team;
    this.engine = engine;
    this.profile = PROFILES[Math.floor(Math.random() * PROFILES.length)];
    this.memory = {
      suspectedPlayers: new Map(),
      confirmedMafia: new Set(),
      confirmedClean: new Set(),
      playerClaims: new Map(),
      discussionLog: [],
      roundNotes: [],
      roundSummaries: [],
      internalPlan: '',
      currentDay: 1,
      lastVotedFor: null,
      chatCooldown: 0,
      lastReactiveAt: 0,
    };
  }

  decideNightAction(phase, alivePlayers) {
    const validTargets = phase === 'night-doctor'
      ? alivePlayers
      : alivePlayers.filter((p) => p.id !== this.botId);

    if (validTargets.length === 0) return null;

    switch (this.role) {
      case 'mafia':
      case 'don':
        return this.decideMafiaKill(validTargets);
      case 'doctor':
        return this.decideDoctorHeal(validTargets, alivePlayers);
      case 'sheriff':
        return this.decideSheriffCheck(validTargets);
      case 'maniac':
        return this.decideManiacKill(validTargets);
      case 'poisoner':
        return this.decidePoisonerTarget(validTargets);
      case 'putana':
        return this.decidePutanaBlock(validTargets);
      case 'bodyguard':
        return this.decideBodyguardProtect(validTargets, alivePlayers);
      case 'journalist':
        return this.decideJournalistCheck(validTargets);
      default:
        return null;
    }
  }

  decideMafiaKill(targets) {
    const nonMafia = targets.filter((p) => p.team !== 'mafia');
    if (nonMafia.length === 0) return targets[0];
    const dangerous = nonMafia.filter((p) =>
      ['sheriff', 'doctor', 'journalist', 'bodyguard'].includes(p.role) ||
      this.memory.suspectedPlayers.get(p.id) === 'sheriff'
    );
    if (dangerous.length > 0 && Math.random() < 0.6) {
      return this.pickRandom(dangerous);
    }
    return this.pickRandom(nonMafia);
  }

  decideDoctorHeal(targets, allAlive) {
    if (Math.random() < 0.3) {
      const self = targets.find((p) => p.id === this.botId);
      if (self) return self;
    }
    const valuable = allAlive.filter((p) =>
      p.id !== this.botId && this.memory.confirmedClean.has(p.id)
    );
    if (valuable.length > 0) return this.pickRandom(valuable);
    return this.pickRandom(targets.filter((p) => p.id !== this.botId) || targets);
  }

  decideSheriffCheck(targets) {
    const unchecked = targets.filter((p) =>
      !this.memory.confirmedMafia.has(p.id) && !this.memory.confirmedClean.has(p.id)
    );
    const suspected = unchecked.filter((p) =>
      (this.memory.suspectedPlayers.get(p.id) || 0) > 0.5
    );
    if (suspected.length > 0) return this.pickRandom(suspected);
    if (unchecked.length > 0) return this.pickRandom(unchecked);
    return this.pickRandom(targets);
  }

  decideManiacKill(targets) {
    const knownMafia = targets.filter(
      (p) => this.memory.confirmedMafia.has(p.id) && p.team === 'mafia'
    );
    if (knownMafia.length > 0) return this.pickRandom(knownMafia);

    const suspicious = targets.filter(
      (p) => (this.memory.suspectedPlayers.get(p.id) || 0) > 0.6
    );
    if (suspicious.length > 0 && Math.random() < 0.7) {
      return this.pickRandom(suspicious);
    }

    return this.pickRandom(targets);
  }

  decidePoisonerTarget(targets) {
    const nonMafia = targets.filter((p) => p.team !== 'mafia');
    return this.pickRandom(nonMafia.length > 0 ? nonMafia : targets);
  }

  decidePutanaBlock(targets) {
    const suspected = targets.filter((p) =>
      this.memory.suspectedPlayers.get(p.id) === 'sheriff' ||
      this.memory.suspectedPlayers.get(p.id) === 'doctor'
    );
    if (suspected.length > 0 && Math.random() < 0.5) return this.pickRandom(suspected);
    return this.pickRandom(targets);
  }

  decideBodyguardProtect(targets, allAlive) {
    const townish = targets.filter((p) => p.team !== 'mafia');
    const valuable = townish.filter(
      (p) =>
        p.id !== this.botId &&
        (['sheriff', 'doctor', 'journalist', 'mayor'].includes(p.role) ||
          this.memory.confirmedClean.has(p.id))
    );
    if (valuable.length > 0 && Math.random() < 0.65) return this.pickRandom(valuable);
    const others = targets.filter((p) => p.id !== this.botId);
    return this.pickRandom(others.length > 0 ? others : targets);
  }

  decideJournalistCheck(targets) {
    return this.decideSheriffCheck(targets);
  }

  decideVote(alivePlayers) {
    const others = alivePlayers.filter((p) => p.id !== this.botId);
    if (others.length === 0) return null;

    if (this.team === 'mafia') {
      const civilians = others.filter((p) => p.team !== 'mafia');
      if (civilians.length > 0) {
        const dangerous = civilians.filter((p) =>
          ['sheriff', 'doctor', 'journalist', 'bodyguard', 'mayor'].includes(p.role)
        );
        if (dangerous.length > 0 && Math.random() < 0.5) return this.pickRandom(dangerous);
        return this.pickRandom(civilians);
      }
    }

    const confirmed = others.filter((p) =>
      this.memory.confirmedMafia.has(p.id) && p.status === 'alive'
    );
    if (confirmed.length > 0) return this.pickRandom(confirmed);

    const highSuspicion = others.filter((p) =>
      (this.memory.suspectedPlayers.get(p.id) || 0) > 0.6
    );
    if (highSuspicion.length > 0 && Math.random() < this.profile.suspicionBias) {
      return this.pickRandom(highSuspicion);
    }

    return this.pickRandom(others);
  }

  generateChatMessage(phase, alivePlayers) {
    if (Math.random() > this.profile.chatFrequency) return null;
    if (this.memory.chatCooldown > 0) {
      this.memory.chatCooldown--;
      return null;
    }
    this.memory.chatCooldown = Math.floor(Math.random() * 3) + 1;

    const others = alivePlayers.filter((p) => p.id !== this.botId);
    const randomTarget = others.length > 0 ? this.pickRandom(others) : null;
    const targetName = randomTarget?.name || 'кто-то';

    if (phase === 'discussion') {
      if (this.memory.internalPlan && Math.random() < 0.2) {
        return this.team === 'mafia'
          ? 'Слишком много хаоса. Давайте спокойнее и по фактам.'
          : `Мой план на день: ${this.memory.internalPlan}`;
      }
      const thought = this.generateThoughtFromMemory(alivePlayers);
      if (thought) return thought;
      if (this.team === 'mafia') {
        const pool = Math.random() < 0.5
          ? CHAT_LINES.discussion.mafia.deflect
          : CHAT_LINES.discussion.mafia.frame;
        return this.fillTemplate(this.pickRandom(pool), targetName);
      }
      if (Math.random() < this.profile.accuseChance && randomTarget) {
        return this.fillTemplate(this.pickRandom(CHAT_LINES.discussion.civilian.suspicious), targetName);
      }
      if (this.role === 'sheriff' && Math.random() < 0.3) {
        return this.pickRandom(CHAT_LINES.discussion.sheriff);
      }
      if (this.role === 'doctor' && Math.random() < 0.2) {
        return this.pickRandom(CHAT_LINES.discussion.doctor);
      }
      return this.pickRandom(CHAT_LINES.discussion.civilian.neutral);
    }

    if (phase === 'voting') {
      if (randomTarget && Math.random() < 0.5) {
        return this.fillTemplate(this.pickRandom(CHAT_LINES.voting.decided), targetName);
      }
      return this.pickRandom(CHAT_LINES.voting.uncertain);
    }

    return null;
  }

  onCheckResult(targetId, isMafia) {
    if (isMafia) {
      this.memory.confirmedMafia.add(targetId);
    } else {
      this.memory.confirmedClean.add(targetId);
    }
  }

  onPlayerKilled(playerId) {
    this.memory.suspectedPlayers.delete(playerId);
    this.memory.confirmedMafia.delete(playerId);
    this.memory.confirmedClean.delete(playerId);
    this.memory.playerClaims.delete(playerId);
  }

  updateSuspicion(playerId, delta) {
    const current = this.memory.suspectedPlayers.get(playerId) || 0.5;
    this.memory.suspectedPlayers.set(playerId, Math.max(0, Math.min(1, current + delta)));
  }

  observeHumanSpeech({ speakerId, speakerName, text, players = [], phase = 'discussion' }) {
    const safeText = String(text || '').trim();
    if (!safeText) return;
    const lower = safeText.toLowerCase();
    this.memory.discussionLog.push({
      speakerId,
      speakerName,
      text: safeText,
      phase,
      ts: Date.now(),
    });
    this.memory.roundNotes.push(`${speakerName}: ${safeText}`);
    if (this.memory.discussionLog.length > 80) this.memory.discussionLog = this.memory.discussionLog.slice(-80);
    if (this.memory.roundNotes.length > 60) this.memory.roundNotes = this.memory.roundNotes.slice(-60);

    const mafiaKeywords = ['маф', 'убийц', 'убийца', 'подозр', 'красн'];
    const sheriffKeywords = ['шериф', 'проверил'];
    const doctorKeywords = ['доктор', 'лечил', 'спас'];

    if (sheriffKeywords.some((k) => lower.includes(k))) {
      this.memory.playerClaims.set(speakerId, 'sheriff');
    } else if (doctorKeywords.some((k) => lower.includes(k))) {
      this.memory.playerClaims.set(speakerId, 'doctor');
    }

    for (const p of players) {
      if (!p?.id || p.id === speakerId || p.id === this.botId) continue;
      const name = String(p.name || '').trim().toLowerCase();
      if (!name) continue;
      if (!lower.includes(name) && !lower.includes(`@${name}`)) continue;
      if (mafiaKeywords.some((k) => lower.includes(k))) {
        this.updateSuspicion(p.id, 0.18);
      } else if (lower.includes('мирн') || lower.includes('чист')) {
        this.updateSuspicion(p.id, -0.12);
      } else {
        this.updateSuspicion(p.id, 0.05);
      }
    }

    if (this.team === 'mafia' && !isNaN(Date.now())) {
      const me = players.find((p) => p.id === this.botId);
      const myName = String(me?.name || '').toLowerCase();
      if ((myName && lower.includes(myName)) || lower.includes('мафия')) {
        this.memory.lastReactiveAt = Math.max(this.memory.lastReactiveAt, Date.now() - 2000);
      }
    }
  }

  generateReactiveThought({ speakerName, text, phase = 'discussion', alivePlayers = [] }) {
    const now = Date.now();
    if (phase !== 'discussion' && phase !== 'voting' && phase !== 'votingRevote') return null;
    if (now - (this.memory.lastReactiveAt || 0) < 8000) return null;
    this.memory.lastReactiveAt = now;
    const lower = String(text || '').toLowerCase();

    if (this.team === 'mafia') {
      const nonMafia = alivePlayers.filter((p) => p.id !== this.botId && p.team !== 'mafia');
      const target = nonMafia.length ? this.pickRandom(nonMafia) : null;
      if (lower.includes('маф') || lower.includes('подозр')) {
        const t = target?.name || 'другого игрока';
        return this.pickRandom([
          `${speakerName}, спорно. Я бы проверил ${t}.`,
          `Не спешим. У меня вопросы к ${t}.`,
          `${speakerName}, пока не убежден. ${t} подозрительнее.`,
        ]);
      }
      return null;
    }

    if (lower.includes('я шериф') || lower.includes('я доктор')) {
      return `${speakerName}, принято. Но нужны конкретные факты и проверки.`;
    }

    const topSuspicion = [...this.memory.suspectedPlayers.entries()]
      .filter(([, score]) => score >= 0.65)
      .sort((a, b) => b[1] - a[1])[0];
    if (topSuspicion) {
      const suspect = alivePlayers.find((p) => p.id === topSuspicion[0]);
      if (suspect) return `Запоминаю обсуждение. Сейчас наиболее подозрителен ${suspect.name}.`;
    }
    return null;
  }

  generateThoughtFromMemory(alivePlayers = []) {
    const topSuspicion = [...this.memory.suspectedPlayers.entries()]
      .filter(([, score]) => score >= 0.68)
      .sort((a, b) => b[1] - a[1])[0];
    if (!topSuspicion) return null;
    const suspect = alivePlayers.find((p) => p.id === topSuspicion[0]);
    if (!suspect) return null;
    if (this.team === 'mafia') return null;
    return this.pickRandom([
      `Я держу в голове стол: пока больше всего вопросов к ${suspect.name}.`,
      `По совокупности сказанного подозреваю ${suspect.name}.`,
    ]);
  }

  generateIntroductionStory(day = 1) {
    const civilStories = [
      'Я местный механик, живу здесь давно и хочу вычислить мафию по фактам.',
      'Я работаю в ночной смене и привык слушать людей внимательно.',
      'Я обычный житель, пришел играть аккуратно и без суеты.',
      'Я предприниматель, в городе давно — голосую только по аргументам.',
    ];
    const mafiaStories = [
      'Я обычный мирный житель, хочу найти мафию как можно быстрее.',
      'Я за город и за честную игру, давайте смотреть на факты.',
      'Я просто гражданин, но слишком тихие игроки вызывают вопросы.',
    ];
    const roleHint = this.team === 'mafia' ? this.pickRandom(mafiaStories) : this.pickRandom(civilStories);
    return `День ${day}. Представлюсь: ${roleHint}`;
  }

  generateTurnSpeech({ phase = 'discussion', day = 1, alivePlayers = [] }) {
    if (phase === 'intro') {
      const intro = this.generateIntroductionStory(day);
      if (this.team === 'mafia') {
        return `${intro} Я за спокойный стол и аккуратные выводы, без поспешных казней.`;
      }
      return `${intro} Буду слушать аргументы и голосовать только по логике.`;
    }
    if (phase === 'discussion') {
      const intro = this.generateIntroductionStory(day);
      const thought = this.generateThoughtFromMemory(alivePlayers);
      if (thought) return `${intro} ${thought}`;
      if (this.team === 'mafia') {
        const nonMafia = alivePlayers.filter((p) => p.id !== this.botId && p.team !== 'mafia');
        const target = nonMafia.length > 0 ? this.pickRandom(nonMafia).name : 'одного из игроков';
        return `${intro} Пока вижу подозрительное поведение у ${target}, предлагаю проверить его.`;
      }
      return `${intro} Пока мало данных, но подозрительны резкие обвинения без логики.`;
    }
    if (phase === 'voting' || phase === 'votingRevote') {
      const suspect = [...this.memory.suspectedPlayers.entries()].sort((a, b) => b[1] - a[1])[0];
      if (suspect) {
        const p = alivePlayers.find((x) => x.id === suspect[0]);
        if (p) return `Голосую по столу: у меня больше всего вопросов к ${p.name}.`;
      }
      return this.team === 'mafia'
        ? 'Голосую по поведению за самого подозрительного на мой взгляд.'
        : 'Голосую по аргументам обсуждения, без эмоций.';
    }
    return null;
  }

  onPhaseChanged({ phase, state }) {
    if (!phase || !state) return;
    this.memory.currentDay = state.day || this.memory.currentDay || 1;
    if (phase === 'morning' || phase === 'discussion') {
      this.memory.internalPlan = this.buildInternalPlan(state);
    }
    if (phase === 'night-start') {
      this.finalizeRoundSummary(state);
      this.memory.roundNotes = [];
    }
  }

  buildInternalPlan(state) {
    const alive = (state.players || []).filter((p) => p.status === 'alive' || p.status === 'poisoned');
    const topSuspicion = [...this.memory.suspectedPlayers.entries()]
      .sort((a, b) => b[1] - a[1])[0];
    const suspectName = topSuspicion
      ? (alive.find((p) => p.id === topSuspicion[0])?.name || 'неопределенного игрока')
      : 'наименее активного игрока';

    if (this.team === 'mafia') {
      return `давить на ${suspectName}, выглядеть мирным и не палить связки`;
    }
    if (this.role === 'sheriff') {
      return `собрать голоса против ${suspectName} и аккуратно раскрывать проверки`;
    }
    if (this.role === 'doctor') {
      return `не светить роль, искать цель для лечения по давлению стола`;
    }
    return `слушать стол, давить аргументами на ${suspectName}`;
  }

  finalizeRoundSummary(state) {
    const notes = this.memory.roundNotes || [];
    if (notes.length === 0) return;
    const topSuspicion = [...this.memory.suspectedPlayers.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id, score]) => {
        const p = state.players.find((x) => x.id === id);
        return p ? `${p.name}:${score.toFixed(2)}` : null;
      })
      .filter(Boolean);
    const summary = {
      day: this.memory.currentDay,
      keyPoints: notes.slice(-4),
      topSuspicion,
      plan: this.memory.internalPlan,
      ts: Date.now(),
    };
    this.memory.roundSummaries.push(summary);
    if (this.memory.roundSummaries.length > 12) this.memory.roundSummaries = this.memory.roundSummaries.slice(-12);
  }

  getLatestRoundSummaryText() {
    const last = this.memory.roundSummaries[this.memory.roundSummaries.length - 1];
    if (!last) return null;
    const suspects = Array.isArray(last.topSuspicion) && last.topSuspicion.length > 0
      ? last.topSuspicion.join(', ')
      : 'нет явных лидеров';
    return `Итог дня ${last.day}: ключевые подозрения — ${suspects}. План: ${last.plan || 'собираем больше инфы'}.`;
  }

  fillTemplate(text, targetName) {
    return text.replace(/\{target\}/g, targetName);
  }

  pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  getHumanDelay() {
    const base = 2000 + Math.random() * 3000;
    const jitter = Math.random() * 2000;
    return Math.round(base + jitter);
  }

  getChatDelay() {
    return Math.round(3000 + Math.random() * 8000);
  }
}
