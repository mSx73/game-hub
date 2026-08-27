import { BaseGame } from '../../core/BaseGame.js';

/* ============================================================================
 * MafiaGame — кастомная Мафия (rewrite). extends BaseGame.
 *
 * Голос — внешний (Discord), поэтому «активный спикер» = серверная очередь
 * речи, а не аудио. Чата в приложении нет.
 *
 * Ночь резолвится одной фазой по СТРОГОЙ матрице приоритетов:
 *   1) Путана   — блок действия цели + иммунитет от убийств + лишение голоса
 *   2) Доктор   — лечение от мгновенного убийства
 *   3) Убийцы   — Мафия (командный выстрел; Дон в блоке → стреляет рядовой)
 *                 Маньяк (сам за себя; может бить мафию — ошибки не выдаём)
 *   4) Вампир   — укус: цель не умирает, но станет вампиром на след. ночь;
 *                 укус Мафии не срабатывает
 *   5) Отравитель — статус poisoned (НЕ убивает ночью; см. mid-speech death)
 *   6) Шериф    — проверка статуса (Мафия/Не мафия; Дон маскируется)
 * ==========================================================================*/

const ROLE_TEAM = {
  civilian: 'town', sheriff: 'town', doctor: 'town', putana: 'town',
  bodyguard: 'town', mayor: 'town', journalist: 'town',
  mafia: 'mafia', don: 'mafia', poisoner: 'mafia',
  maniac: 'maniac',
  vampire: 'vampire',
};

// Какое ночное действие умеет роль (для валидации сабмита).
const ROLE_ACTION = {
  putana: 'block', doctor: 'heal', don: 'kill', mafia: 'kill',
  maniac: 'kill', vampire: 'bite', poisoner: 'poison', sheriff: 'check',
};

const DEFAULTS = {
  durations: { roleReveal: 7, intro: 18, night: 30, day: 20, discussion: 45, voting: 30, tieDiscussion: 30, revote: 25, reveal: 6 },
  midSpeechPoisonMs: 5000,
  maxDaysWithoutExecution: 2,
  donDisguise: true, // Дон выглядит для Шерифа как «Не мафия»
  mayorVoteWeight: 2,
};

export class MafiaGame extends BaseGame {
  /**
   * @param {object} room  — { code, players:[{id,name,...}], gameType }
   * @param {object} io     — socket.io (через BaseGame.broadcast); может быть null в тестах
   * @param {object} options — { roles, durations, hostId, humanGm, ... }
   */
  constructor(room = null, io = null, options = {}) {
    super(room, io);
    this.options = { ...DEFAULTS, ...options, durations: { ...DEFAULTS.durations, ...(options.durations || {}) } };
    this.hostId = options.hostId ?? room?.hostId ?? null;
    this.humanGm = !!options.humanGm;            // ведущий-человек не получает роли
    const count = (room?.players || []).filter((p) => !p.isSpectator).length;
    this.roleConfig = options.roles || room?.settings?.roles || MafiaGame.defaultRoles(count);

    this.phase = 'lobby';
    this.day = 0;

    this._nightActions = new Map();   // actorId -> { type, target }
    this._votes = new Map();          // voterId -> targetId
    this._checkResults = [];          // [{ sheriffId, targetId, isMafia }]
    this._tieCandidates = null;       // [ids] во время tieDiscussion/revote
    this._revote = false;
    this.daysWithoutExecution = 0;
    this.activeSpeaker = null;
    this._speakOrder = [];
    this._speakIdx = -1;
    this.winner = null;
    this.stateVersion = 0;

    // ── Бот-«мозг» (эвристика) ──
    this._heat = new Map();          // playerId -> «подозрительность» (накопленные обвинения/голоса)
    this._sheriffChecks = new Map(); // sheriffId -> Map(targetId -> isMafia)
  }

  /* ───────────────────────── helpers ───────────────────────── */

  static defaultRoles(n) {
    return {
      mafia: Math.max(1, Math.floor(n / 4)),
      sheriffs: 1,
      doctors: n >= 7 ? 1 : 0,
      maniacs: n >= 8 ? 1 : 0,
      poisoners: n >= 9 ? 1 : 0,
      putanas: n >= 10 ? 1 : 0,
      vampires: n >= 11 ? 1 : 0,
    };
  }

  getPlayer(id) { return this.players.find((p) => p.id === id) || null; }
  getPlayerName(id) { return this.getPlayer(id)?.name ?? '???'; }
  touch() { this.stateVersion++; }
  alivePlayers() { return this.players.filter((p) => p.alive); }
  livingByTeam(team) { return this.players.filter((p) => p.alive && p.team === team); }
  hasLivingRole(role) { return this.players.some((p) => p.alive && p.role === role); }
  isModerator(id) { return this.humanGm && id && id === this.hostId; }

  /* ───────────────────────── lifecycle ───────────────────────── */

  start() {
    this.assignRoles();
    this.phase = 'roleReveal';
    this.day = 0;
    this.touch();
    this.emit('game:started', this.publicState());
    this.emit('game:phase-changed', this.phase, this.options.durations.roleReveal);
    this.setPhaseTimer('roleReveal', () => this.startIntro());
    return this;
  }

  /** Фаза знакомства: каждый по кругу представляется (речь), затем — первая ночь. */
  startIntro() {
    this.phase = 'intro';
    this._afterSpeaking = () => this.startNight();
    this.touch();
    this.broadcast('mafia:curtain', { closing: false });
    this.emit('game:phase-changed', this.phase, this.options.durations.intro);
    this.emit('intro:begin', {});
    this._speakOrder = this.alivePlayers().map((p) => p.id);
    this._speakIdx = -1;
    this.nextSpeaker();
  }

  assignRoles() {
    const pool = (this.room?.players || this.players || []).filter(
      (p) => !p.isSpectator && !this.isModerator(p.id)
    );
    const roles = [];
    const c = this.roleConfig;
    if ((c.mafia || 0) > 0) { roles.push('don'); for (let i = 1; i < c.mafia; i++) roles.push('mafia'); }
    for (let i = 0; i < (c.poisoners || 0); i++) roles.push('poisoner');
    for (let i = 0; i < (c.sheriffs || 0); i++) roles.push('sheriff');
    for (let i = 0; i < (c.doctors || 0); i++) roles.push('doctor');
    for (let i = 0; i < (c.putanas || 0); i++) roles.push('putana');
    for (let i = 0; i < (c.maniacs || 0); i++) roles.push('maniac');
    for (let i = 0; i < (c.vampires || 0); i++) roles.push('vampire');
    while (roles.length < pool.length) roles.push('civilian');
    // Фишер–Йейтс
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    this.players = pool.map((p, i) => ({
      id: p.id, name: p.name, bot: !!p.isBot || !!p.bot,
      role: roles[i] || 'civilian',
      team: ROLE_TEAM[roles[i] || 'civilian'],
      alive: true,
      poisoned: false,
      blockedTonight: false,
      immuneTonight: false,
      cannotVoteToday: false,
      pendingVampire: false,
      deathCause: null,
    }));
    this.touch();
  }

  setPhaseTimer(name, fn) {
    const secs = this.options.durations[name] ?? 0;
    if (secs > 0) {
      this._phaseTimer = this.registerTimeout(() => fn(), secs * 1000);
    }
  }

  /* ───────────────────────── NIGHT ───────────────────────── */

  startNight() {
    this.day += 1;
    this.phase = 'night';
    this._nightActions.clear();
    this._checkResults = [];

    // сброс однонощных меток + конверсия укушенных вампиром (на ход позже)
    for (const p of this.players) {
      p.blockedTonight = false;
      p.immuneTonight = false;
      if (p.pendingVampire && p.alive && p.team !== 'mafia') {
        p.pendingVampire = false;
        p.role = 'vampire';
        p.team = 'vampire';
        this.emit('player:turned-vampire', { playerId: p.id });
      } else if (p.pendingVampire) {
        p.pendingVampire = false;
      }
    }
    this.touch();
    this.emit('game:phase-changed', this.phase, this.options.durations.night);
    this.emit('night:begin', { day: this.day });
    this.broadcast('mafia:curtain', { closing: true }); // занавес «город засыпает»
    this.setPhaseTimer('night', () => this.resolveNight());
  }

  /** Сабмит ночного действия. Возвращает {ok} или {ok:false,error}. */
  submitNightAction(actorId, action = {}) {
    if (this.phase !== 'night') return { ok: false, error: 'Сейчас не ночь' };
    const actor = this.getPlayer(actorId);
    if (!actor || !actor.alive) return { ok: false, error: 'Недоступно' };
    const expected = ROLE_ACTION[actor.role];
    if (!expected) return { ok: false, error: 'У вашей роли нет ночного действия' };
    const target = action.target ?? action.targetId;
    const tgt = this.getPlayer(target);
    if (!tgt || !tgt.alive) return { ok: false, error: 'Цель недоступна' };
    // МАНЬЯК может навестись на мафию — НЕ выдаём ошибку (иначе раскроем роль).
    this._nightActions.set(actorId, { type: expected, target, actorRole: actor.role });
    this.emit('night:action-submitted', { actorId });
    // авто-резолв, когда все «активные» роли сходили
    if (this.allNightActionsIn()) {
      this.clearManagedTimeout(this._phaseTimer);
      this.resolveNight();
    }
    return { ok: true };
  }

  allNightActionsIn() {
    const actors = this.players.filter((p) => p.alive && ROLE_ACTION[p.role]);
    return actors.every((p) => this._nightActions.has(p.id));
  }

  /**
   * Резолв ночи по матрице приоритетов. Вынесен «чисто», чтобы покрывать тестами.
   * @returns {object} результат { kills, healed, poisoned, blocked, bitten, checks }
   */
  resolveNight() {
    if (this.phase !== 'night') return null;
    const A = (role) => [...this._nightActions.entries()]
      .filter(([id]) => { const p = this.getPlayer(id); return p && p.alive && p.role === role; })
      .map(([id, a]) => ({ actor: id, target: a.target }));

    const blocked = new Set();
    const immune = new Set();
    const cannotVote = new Set();
    const heals = new Set();
    const kills = new Set();
    const bitten = new Set();
    const poisoned = new Set();
    const checks = [];

    // 1) ПУТАНА — блок + иммунитет + лишение голоса
    for (const act of A('putana')) {
      if (!act.target || blocked.has(act.actor)) continue;
      blocked.add(act.target);
      immune.add(act.target);
      cannotVote.add(act.target);
    }
    const active = (actorId) => !blocked.has(actorId);

    // 2) ДОКТОР — лечение
    for (const act of A('doctor')) {
      if (active(act.actor) && act.target) heals.add(act.target);
    }

    // 3a) МАФИЯ — командный выстрел. Стреляет Дон; если Дон в блоке/мёртв — рядовой.
    const mafiaTarget = this.resolveMafiaShot(blocked);
    if (mafiaTarget) kills.add(mafiaTarget);
    // 3b) МАНЬЯК — каждый сам за себя (может бить мафию)
    for (const act of A('maniac')) {
      if (active(act.actor) && act.target) kills.add(act.target);
    }

    // 4) ВАМПИР — укус (не по мафии). Не убивает; помечает на конверсию.
    for (const act of A('vampire')) {
      if (!active(act.actor) || !act.target) continue;
      const tgt = this.getPlayer(act.target);
      if (!tgt || tgt.team === 'mafia') continue; // укус мафии не срабатывает
      bitten.add(act.target);
    }

    // 5) ОТРАВИТЕЛЬ — статус (срабатывает позже, mid-speech)
    for (const act of A('poisoner')) {
      if (active(act.actor) && act.target) poisoned.add(act.target);
    }

    // 6) ШЕРИФ — проверка (Дон маскируется)
    for (const act of A('sheriff')) {
      if (!active(act.actor) || !act.target) continue;
      const tgt = this.getPlayer(act.target);
      const isMafia = !!tgt && tgt.team === 'mafia'
        && !(this.options.donDisguise && tgt.role === 'don');
      checks.push({ sheriffId: act.actor, targetId: act.target, isMafia });
    }

    // ── применяем смерти: убит, если НЕ иммунен и НЕ вылечен ──
    const deaths = [];
    for (const targetId of kills) {
      if (immune.has(targetId) || heals.has(targetId)) continue;
      const p = this.getPlayer(targetId);
      if (p && p.alive) { p.alive = false; p.deathCause = 'night'; deaths.push(targetId); }
    }
    // укус действует только на выживших
    for (const targetId of bitten) {
      const p = this.getPlayer(targetId);
      if (p && p.alive) p.pendingVampire = true;
    }
    // отравление — на выживших (статус, не смерть)
    for (const targetId of poisoned) {
      const p = this.getPlayer(targetId);
      if (p && p.alive) p.poisoned = true;
    }
    // лишение голоса на следующий день
    for (const id of cannotVote) {
      const p = this.getPlayer(id);
      if (p) p.cannotVoteToday = true;
    }

    this._checkResults = checks;
    const result = {
      kills: deaths,
      healed: [...heals],
      poisoned: [...poisoned],
      blocked: [...blocked],
      bitten: [...bitten],
      checks,
    };

    this.touch();
    this.emit('night:resolved', result);
    // приватно — каждому шерифу его проверка (+ запоминаем для бота-шерифа)
    for (const ch of checks) {
      if (!this._sheriffChecks.has(ch.sheriffId)) this._sheriffChecks.set(ch.sheriffId, new Map());
      this._sheriffChecks.get(ch.sheriffId).set(ch.targetId, ch.isMafia);
      this.emit('check:result', { sheriffId: ch.sheriffId, targetId: ch.targetId, isMafia: ch.isMafia });
    }
    for (const id of deaths) this.emit('player:died', { playerId: id, cause: 'night' });

    if (this.checkWin()) return result;
    this.startDay();
    return result;
  }

  /** Командный выстрел мафии: Дон, иначе рядовой; учёт блока. */
  resolveMafiaShot(blocked) {
    const mafiaActs = [...this._nightActions.entries()]
      .filter(([id]) => { const p = this.getPlayer(id); return p && p.alive && (p.role === 'don' || p.role === 'mafia'); })
      .map(([id, a]) => ({ actor: id, target: a.target, role: this.getPlayer(id).role }));
    if (mafiaActs.length === 0) return null;
    const don = mafiaActs.find((m) => m.role === 'don' && !blocked.has(m.actor));
    if (don && don.target) return don.target;
    // Дон мёртв/в блоке → берём выстрел любого незаблокированного рядового
    const shooter = mafiaActs.find((m) => !blocked.has(m.actor) && m.target);
    return shooter ? shooter.target : null;
  }

  /* ───────────────────────── DAY / речь / mid-speech яд ───────────────────────── */

  startDay() {
    this.phase = 'day';
    this._afterSpeaking = () => this.startVoting();
    // «остывание» подозрений к новому дню
    for (const [id, v] of this._heat) this._heat.set(id, v * 0.55);
    // сброс «однодневных» меток голоса делаем В НАЧАЛЕ голосования, не сейчас
    this.touch();
    this.broadcast('mafia:curtain', { closing: false }); // занавес поднимается
    this.emit('game:phase-changed', this.phase, this.options.durations.day);
    this.emit('day:begin', { day: this.day });
    // очередь речи: все живые по кругу
    this._speakOrder = this.alivePlayers().map((p) => p.id);
    this._speakIdx = -1;
    this.nextSpeaker();
  }

  /** Передать слово следующему живому игроку; вооружить mid-speech-яд при необходимости. */
  nextSpeaker() {
    this.clearManagedTimeout(this._speakTimer);
    this.clearManagedTimeout(this._poisonTimer);
    this._speakIdx += 1;
    // пропускаем мёртвых и оффлайн
    while (this._speakIdx < this._speakOrder.length) {
      const p = this.getPlayer(this._speakOrder[this._speakIdx]);
      const online = this.room?.players?.find((rp) => rp.id === p?.id)?.isOnline !== false;
      if (p?.alive && online) break;
      this._speakIdx += 1;
    }
    if (this._speakIdx >= this._speakOrder.length) {
      this.activeSpeaker = null;
      this.emit('speaking:turn', { playerId: null });
      (this._afterSpeaking || (() => this.startVoting()))();
      return;
    }
    const id = this._speakOrder[this._speakIdx];
    this.activeSpeaker = id;
    this.touch();
    this.emit('speaking:turn', { playerId: id });
    this.beginSpeakingTurn(id);
  }

  /** Запускает таймер хода речи и (скрыто) 5-сек яд, если спикер отравлен. */
  beginSpeakingTurn(playerId) {
    const player = this.getPlayer(playerId);
    if (!player || !player.alive) { this.nextSpeaker(); return; }

    // обычный лимит речи
    const speakSecs = this.options.durations.day || 20;
    this._speakTimer = this.registerTimeout(() => this.nextSpeaker(), speakSecs * 1000);

    // mid-speech death: яд срабатывает через 5с после получения слова
    if (player.poisoned) {
      this._poisonTimer = this.registerTimeout(() => {
        const p = this.getPlayer(playerId);
        if (!p || !p.alive) return;
        p.alive = false;
        p.deathCause = 'poison';
        p.poisoned = false;
        this.touch();
        this.emit('playerDiedMidSpeech', { playerId, name: p.name });
        this.emit('player:died', { playerId, cause: 'poison' });
        this.clearManagedTimeout(this._speakTimer);
        if (this.checkWin()) return;
        this.nextSpeaker();
      }, this.options.midSpeechPoisonMs);
    }
  }

  /** Игрок сам завершил речь раньше времени. */
  finishSpeaking(playerId) {
    if (playerId !== this.activeSpeaker) return { ok: false, error: 'Сейчас не ваш ход' };
    this.nextSpeaker();
    return { ok: true };
  }

  /* ───────────────────────── VOTING / ничьи ───────────────────────── */

  startVoting(candidates = null) {
    this.phase = candidates ? 'votingRevote' : 'voting';
    this._revote = !!candidates;
    this._votes.clear();
    this._tieCandidates = candidates;
    this.touch();
    this.emit('game:phase-changed', this.phase, this.options.durations[candidates ? 'revote' : 'voting']);
    this.emit('voting:begin', { candidates: candidates || this.alivePlayers().map((p) => p.id), revote: this._revote });
    this.setPhaseTimer(candidates ? 'revote' : 'voting', () => this.resolveVoting());
  }

  submitVote(voterId, targetId) {
    if (this.phase !== 'voting' && this.phase !== 'votingRevote') return { ok: false, error: 'Сейчас не голосование' };
    const voter = this.getPlayer(voterId);
    if (!voter || !voter.alive) return { ok: false, error: 'Недоступно' };
    if (voter.cannotVoteToday) return { ok: false, error: 'Путана лишила вас голоса' };
    if (this._tieCandidates && !this._tieCandidates.includes(targetId)) return { ok: false, error: 'Можно голосовать только против кандидатов' };
    const tgt = this.getPlayer(targetId);
    if (!tgt || !tgt.alive) return { ok: false, error: 'Цель недоступна' };
    this._votes.set(voterId, targetId);
    this._bumpHeat(targetId, 1);
    this.emit('vote:cast', { voterId, targetId });
    if (this.allVotesIn()) { this.clearManagedTimeout(this._phaseTimer); this.resolveVoting(); }
    return { ok: true };
  }

  allVotesIn() {
    const voters = this.alivePlayers().filter((p) => !p.cannotVoteToday);
    return voters.length > 0 && voters.every((p) => this._votes.has(p.id));
  }

  tally() {
    const counts = new Map();
    for (const [voterId, targetId] of this._votes) {
      const voter = this.getPlayer(voterId);
      const w = voter?.role === 'mayor' ? this.options.mayorVoteWeight : 1;
      counts.set(targetId, (counts.get(targetId) || 0) + w);
    }
    let max = 0; const leaders = [];
    for (const [id, n] of counts) {
      if (n > max) { max = n; leaders.length = 0; leaders.push(id); }
      else if (n === max) leaders.push(id);
    }
    return { counts, max, leaders };
  }

  resolveVoting() {
    if (this.phase !== 'voting' && this.phase !== 'votingRevote') return;
    const { leaders, max } = this.tally();

    if (max === 0 || leaders.length === 0) return this.noExecution('no-votes');

    if (leaders.length === 1) return this.execute(leaders[0]);

    // НИЧЬЯ
    if (!this._revote) {
      this._tieCandidates = [...leaders];
      this.phase = 'votingTieDiscussion';
      this.touch();
      this.emit('voting:tie', { candidates: leaders });
      this.emit('game:phase-changed', this.phase, this.options.durations.tieDiscussion);
      // по 30с речи каждому кандидату → затем переголосование
      this.setPhaseTimer('tieDiscussion', () => this.startVoting(this._tieCandidates));
      return;
    }
    // ничья и на переголосовании → город спит, без казни
    return this.noExecution('tie-revote');
  }

  execute(targetId) {
    const p = this.getPlayer(targetId);
    if (p && p.alive) { p.alive = false; p.deathCause = 'lynch'; }
    this.daysWithoutExecution = 0;
    this.touch();
    this.emit('player:lynched', { playerId: targetId });
    this.emit('player:died', { playerId: targetId, cause: 'lynch' });
    this.afterDay();
  }

  noExecution(reason) {
    this.daysWithoutExecution += 1;
    this.touch();
    this.emit('voting:no-execution', { reason, daysWithoutExecution: this.daysWithoutExecution });
    // 2 дня подряд без казни → побеждает Мафия
    if (this.daysWithoutExecution >= this.options.maxDaysWithoutExecution) {
      return this.endGame('mafia', 'Город слишком долго не казнил никого');
    }
    this.afterDay();
  }

  afterDay() {
    // снимаем дневные метки голоса
    for (const p of this.players) p.cannotVoteToday = false;
    if (this.checkWin()) return;
    this.startNight();
  }

  /* ───────────────────────── WIN ───────────────────────── */

  checkWin() {
    if (this.winner) return true;
    const alive = this.alivePlayers();
    const mafia = alive.filter((p) => p.team === 'mafia');
    const maniac = alive.filter((p) => p.team === 'maniac');
    const vampire = alive.filter((p) => p.team === 'vampire');
    const town = alive.filter((p) => p.team === 'town');
    const threats = mafia.length + maniac.length + vampire.length;

    // Маньяк/вампир в клатче (1 на 1 или последний)
    if (maniac.length && alive.length <= 2) return this.endGame('maniac', 'Маньяк остался хозяином города');
    if (vampire.length && threats === vampire.length && vampire.length >= town.length) {
      return this.endGame('vampire', 'Вампиры захватили город');
    }
    // Город: не осталось угроз
    if (threats === 0) return this.endGame('town', 'Город очищен');
    // Мафия: паритет и нет маньяка/вампира
    if (mafia.length > 0 && maniac.length === 0 && vampire.length === 0 && mafia.length >= town.length) {
      return this.endGame('mafia', 'Мафия сравнялась с городом');
    }
    return false;
  }

  endGame(winner, reason) {
    this.winner = winner;
    this.phase = 'gameOver';
    this.clearAllTimersSafe();
    this.touch();
    this.emit('game:phase-changed', this.phase, 0);
    this.emit('game:ended', { winner, reason, players: this.stats() });
    return true;
  }

  clearAllTimersSafe() {
    // снимаем «текущие» рабочие таймеры (полная зачистка — в cleanup())
    this.clearManagedTimeout(this._phaseTimer);
    this.clearManagedTimeout(this._speakTimer);
    this.clearManagedTimeout(this._poisonTimer);
  }

  stats() {
    return this.players.map((p) => ({
      id: p.id, name: p.name, role: p.role, team: p.team, survived: p.alive, deathCause: p.deathCause,
    }));
  }

  /* ───────────────────────── БОТ-МОЗГ (эвристика) ───────────────────────── */

  _bumpHeat(id, n) { if (id) this._heat.set(id, (this._heat.get(id) || 0) + n); }

  _pickFromPool(pool) {
    let best = null, bs = -Infinity;
    for (const p of pool) {
      const s = (this._heat.get(p.id) || 0) + Math.random() * 1.2;
      if (s > bs) { bs = s; best = p; }
    }
    return best ? best.id : null;
  }

  /** Подозреваемый: топ по heat (+шум) среди живых; team:'town' — валить чужих (для мафии). */
  _pickSuspect(bot, { team = null, exclude = [] } = {}) {
    const ex = new Set([bot.id, ...exclude]);
    let pool = this.alivePlayers().filter((p) => !ex.has(p.id));
    if (team === 'town') { const t = pool.filter((p) => p.team !== bot.team); if (t.length) pool = t; }
    return this._pickFromPool(pool);
  }

  /** Известная боту-шерифу живая мафия. */
  _knownMafia(bot) {
    const checks = this._sheriffChecks.get(bot.id);
    if (!checks) return null;
    for (const [tid, isMafia] of checks) {
      const t = this.getPlayer(tid);
      if (isMafia && t && t.alive) return tid;
    }
    return null;
  }

  botNightTarget(botId) {
    const bot = this.getPlayer(botId);
    if (!bot || !bot.alive) return null;
    switch (bot.role) {
      case 'don':
      case 'mafia':
      case 'vampire':
      case 'poisoner':
        return this._pickSuspect(bot, { team: 'town' });
      case 'maniac':
      case 'putana':
        return this._pickSuspect(bot, {});
      case 'sheriff': {
        const checked = this._sheriffChecks.get(bot.id) || new Map();
        const unchecked = this.alivePlayers().filter((p) => p.id !== bot.id && !checked.has(p.id));
        return this._pickFromPool(unchecked.length ? unchecked : this.alivePlayers().filter((p) => p.id !== bot.id));
      }
      case 'doctor':
        return Math.random() < 0.3 ? bot.id : (this._pickSuspect(bot, { team: 'town' }) || bot.id);
      default:
        return null;
    }
  }

  botVoteTarget(botId) {
    const bot = this.getPlayer(botId);
    if (!bot || !bot.alive) return null;
    const cands = this._tieCandidates;
    const ok = (id) => id && (!cands || cands.includes(id));
    if (bot.role === 'sheriff') { const m = this._knownMafia(bot); if (ok(m)) return m; }
    if (bot.team === 'mafia') { const s = this._pickSuspect(bot, { team: 'town' }); if (ok(s)) return s; }
    let pool = this.alivePlayers().filter((p) => p.id !== botId && ok(p.id));
    if (bot.team === 'mafia') pool = pool.filter((p) => p.team !== 'mafia');
    return this._pickFromPool(pool);
  }

  /** Короткая реплика бота в свой ход (обвинение/оправдание/намёк шерифа). */
  botSpeak(botId) {
    const bot = this.getPlayer(botId);
    if (!bot || !bot.alive) return;
    const myHeat = this._heat.get(botId) || 0;
    const maxHeat = Math.max(0, ...this.alivePlayers().map((p) => this._heat.get(p.id) || 0));
    // если на тебя давят — иногда оправдывайся
    if (myHeat > 0.6 && myHeat >= maxHeat && Math.random() < 0.6) {
      const def = ['Я мирный, честно!', 'Зря на меня — я за город.', 'Проверьте лучше других!', 'Это не я, поверьте.'];
      this.emit('bot:speech', { playerId: botId, text: def[Math.floor(Math.random() * def.length)] });
      return;
    }
    // шериф с проверенной мафией — раскрывается
    if (bot.role === 'sheriff') {
      const m = this._knownMafia(bot);
      if (m) { this._bumpHeat(m, 2); this.emit('bot:speech', { playerId: botId, text: `Я шериф. ${this.getPlayerName(m)} — мафия, голосуем!` }); return; }
    }
    const targetId = bot.team === 'mafia' ? this._pickSuspect(bot, { team: 'town' }) : this._pickSuspect(bot, {});
    const tn = targetId ? this.getPlayerName(targetId) : null;
    const lines = tn
      ? [`${tn} ведёт себя странно.`, `${tn} — мой главный подозреваемый.`, `Голос против: ${tn}.`, `Приглядитесь к «${tn}».`, `${tn}, оправдывайся.`]
      : ['Пока непонятно, кто мафия…', 'Слушаю всех внимательно.', 'Дождёмся ночи.'];
    if (targetId) this._bumpHeat(targetId, 1.2);
    this.emit('bot:speech', { playerId: botId, text: lines[Math.floor(Math.random() * lines.length)] });
  }

  /* ───────────────────────── socket-friendly интерфейс ───────────────────────── */

  handleAction(playerId, action = {}) {
    switch (action.type) {
      case 'block': case 'heal': case 'kill': case 'bite': case 'poison': case 'check':
        return this.submitNightAction(playerId, action);
      case 'vote':
        return this.submitVote(playerId, action.target ?? action.targetId);
      case 'finish-speaking':
        return this.finishSpeaking(playerId);
      default:
        return { ok: false, error: `Неизвестное действие: ${action.type}` };
    }
  }

  /** RoomManager зовёт при дисконнекте: если ушёл текущий спикер — передаём слово. */
  handlePlayerDisconnect(playerId) {
    if (this.phase === 'discussion' && this.activeSpeaker === playerId) {
      this.nextSpeaker();
    }
  }

  publicState() {
    return {
      phase: this.phase,
      day: this.day,
      activeSpeaker: this.activeSpeaker,
      daysWithoutExecution: this.daysWithoutExecution,
      version: this.stateVersion,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, alive: p.alive,
        // роли наружу скрыты, кроме gameOver
        role: this.phase === 'gameOver' ? p.role : undefined,
        deathCause: p.deathCause,
      })),
    };
  }

  getState() { return this.publicState(); }

  /** Персональное состояние: игрок видит свою роль и (для мафии) сокомандников. */
  getPlayerState(playerId) {
    const me = this.getPlayer(playerId);
    const base = this.publicState();
    if (!me) return base; // зритель/ведущий
    base.you = { id: me.id, role: me.role, team: me.team, alive: me.alive, poisoned: me.poisoned };
    if (me.team === 'mafia') {
      base.allies = this.players.filter((p) => p.team === 'mafia' && p.id !== me.id).map((p) => ({ id: p.id, name: p.name, role: p.role }));
    }
    if (me.team === 'vampire') {
      base.allies = this.players.filter((p) => p.team === 'vampire' && p.id !== me.id).map((p) => ({ id: p.id, name: p.name }));
    }
    return base;
  }
}
