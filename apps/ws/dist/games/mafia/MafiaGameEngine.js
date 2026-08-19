import { EventEmitter } from 'events';
export class MafiaGameEngine extends EventEmitter {
  constructor(room) {
    super();
    this.nightActions = new Map();
    this.dayActions = new Map();
    this.donElectionVotes = new Map();
    this.phaseTimer = null;
    this.currentPhaseStartTime = new Date();
    this.room = room;
    this.settings = room.settings;
    this.stateVersion = 0;
    this.phaseEndsAt = 0;
    this.state = this.initializeState();
    this.pendingRevoteCandidates = null;
    this.votingTieResolved = false;
    this.voteResolutionMode = 'normal';
  }
  initializeState() {
    return {
      phase: 'role-reveal',
      day: 0,
      round: 1,
      players: this.distributeRoles(),
      nightKills: [],
      nightHeals: [],
      nightPoisoned: [],
      nightBlocked: [],
      gameLog: [],
      pendingActions: new Set(),
      completedActions: new Set(),
      version: this.stateVersion,
    };
  }
  distributeRoles() {
    const humanGm = !this.room.settings?.options?.aiGameMaster;
    const hostId = this.room.hostId;
    const players = [
      ...this.room.players.filter(
        (p) => !p.isSpectator && !(humanGm && hostId && p.id === hostId)
      ),
    ];
    const roles = [];
    const { roles: roleConfig } = this.settings;
    if (roleConfig.mafia > 0) roles.push('don');
    for (let i = 1; i < roleConfig.mafia; i++) roles.push('mafia');
    for (let i = 0; i < roleConfig.sheriffs; i++) roles.push('sheriff');
    for (let i = 0; i < roleConfig.doctors; i++) roles.push('doctor');
    for (let i = 0; i < roleConfig.maniacs; i++) roles.push('maniac');
    for (let i = 0; i < roleConfig.poisoners; i++) roles.push('poisoner');
    for (let i = 0; i < roleConfig.putanas; i++) roles.push('putana');
    for (let i = 0; i < (roleConfig.bodyguards || 0); i++) roles.push('bodyguard');
    for (let i = 0; i < (roleConfig.journalists || 0); i++) roles.push('journalist');
    for (let i = 0; i < (roleConfig.mayors || 0); i++) roles.push('mayor');
    while (roles.length < players.length) {
      roles.push('civilian');
    }
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    const roleTeams = {
      civilian: 'civilian',
      citizen: 'civilian',
      sheriff: 'civilian',
      doctor: 'civilian',
      putana: 'civilian',
      bodyguard: 'civilian',
      journalist: 'civilian',
      mayor: 'civilian',
      mafia: 'mafia',
      don: 'mafia',
      poisoner: 'mafia',
      maniac: 'maniac',
    };
    return players.map((player, index) => ({
      ...player,
      role: roles[index],
      team: roleTeams[roles[index]] ?? 'civilian',
      status: 'alive',
      votesReceived: 0,
      hasVoted: false,
      voteTarget: undefined,
      cannotVoteNextDay: false,
      isBlockedTonight: false,
    }));
  }
  start() {
    this.emit('game:started', this.state);
    this.startPhase('role-reveal');
  }
  startPhase(phase) {
    this.clearPhaseTimer();
    this.state.phase = phase;
    this.currentPhaseStartTime = new Date();
    if (phase === 'night-start') {
      this.state.players.forEach((p) => {
        p.isBlockedTonight = false;
        if (p.cannotVoteNextDay) p.cannotVoteNextDay = false;
      });
    }
    const duration = this.getPhaseDuration(phase);
    this.phaseEndsAt = duration > 0 ? (Date.now() + duration * 1000) : 0;
    this.touchState();
    this.emit('game:phase-changed', phase, duration);
    if (duration > 0) {
      this.phaseTimer = setTimeout(() => {
        this.handlePhaseEnd(phase);
      }, duration * 1000);
    }
    this.updatePendingActions(phase);
  }
  getPhaseTimer() {
    if (!this.phaseTimer) return 0;
    const elapsed = (Date.now() - this.currentPhaseStartTime.getTime()) / 1000;
    const duration = this.getPhaseDuration(this.state.phase);
    return Math.max(0, Math.ceil(duration - elapsed));
  }

  getPlayerState(playerId, hostId, aiGameMaster) {
    const player = this.state.players.find((p) => p.id === playerId);
    const hostInRoster = this.state.players.some((p) => p.id === hostId);

    const baseState = {
      phase: this.state.phase,
      day: this.state.day,
      round: this.state.round,
      phaseTimer: this.getPhaseTimer(),
      phaseEndsAt: this.phaseEndsAt || null,
      serverTime: Date.now(),
      version: this.stateVersion,
    };

    const voteProgress =
      this.state.phase === 'voting' || this.state.phase === 'votingRevote' || this.state.phase === 'vote-result'
        ? Object.fromEntries([...this.dayActions.entries()].map(([voterId, a]) => [voterId, a.target]))
        : undefined;
    const voteTally =
      this.state.phase === 'voting' || this.state.phase === 'votingRevote' || this.state.phase === 'vote-result'
        ? (() => {
            const tallies = {};
            for (const [voterId, a] of this.dayActions.entries()) {
              const voter = this.state.players.find((p) => p.id === voterId);
              const w = voter?.role === 'mayor' ? 2 : 1;
              tallies[a.target] = (tallies[a.target] ?? 0) + w;
            }
            return tallies;
          })()
        : undefined;

    if (!player) {
      const isHumanModerator = playerId === hostId && !aiGameMaster && !hostInRoster;
      if (!isHumanModerator) return null;
      return {
        ...baseState,
        gameType: 'mafia',
        isModerator: true,
        myRole: null,
        myTeam: null,
        fullVisibility: true,
        dayVotes: voteProgress,
        voteTally,
        players: this.state.players.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          team: p.team,
          status: p.status,
          isOnline: p.isOnline,
          cannotVoteNextDay: !!p.cannotVoteNextDay,
        })),
        hostNightActions: this.getHostNightActions(),
      };
    }

    const isDead = player.status === 'dead';
    const isHost = hostId === playerId;
    const isHostPlaying = hostInRoster;
    const hostSeesAll = isHost && !isHostPlaying && !aiGameMaster;

    if (isDead || hostSeesAll) {
      return {
        ...baseState,
        gameType: 'mafia',
        dayVotes: voteProgress,
        voteTally,
        players: this.state.players.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          team: p.team,
          status: p.status,
          isOnline: p.isOnline,
          cannotVoteNextDay: !!p.cannotVoteNextDay,
        })),
        myRole: player.role,
        myTeam: player.team,
        fullVisibility: true,
        hostNightActions: hostSeesAll ? this.getHostNightActions() : undefined,
      };
    }

    const mafiaTeam = this.state.players.filter((p) => p.team === 'mafia' && p.id !== playerId);

    return {
      ...baseState,
      gameType: 'mafia',
      dayVotes: voteProgress,
      voteTally,
      players: this.state.players.map((p) => {
        const isSelf = p.id === playerId;
        // Только мёртвые раскрывают карту; отравленные ещё в игре — роль скрыта от чужих
        const otherDead = p.status === 'dead';
        const isMafiaMate = player.team === 'mafia' && p.team === 'mafia' && !isSelf;

        return {
          id: p.id,
          name: p.name,
          role: isSelf || otherDead ? p.role : null,
          team: isSelf || otherDead ? p.team : null,
          status: p.status,
          isOnline: p.isOnline,
          cannotVoteNextDay: !!p.cannotVoteNextDay,
          isMafiaTeammate: isMafiaMate || undefined,
        };
      }),
      myRole: player.role,
      myTeam: player.team,
      mafiaMates: player.team === 'mafia' ? mafiaTeam.map((p) => ({ id: p.id, name: p.name, role: p.role })) : undefined,
    };
  }

  getHostNightActions() {
    const activeNight = this.state.phase.startsWith('night-') && this.state.phase !== 'night-start' && this.state.phase !== 'night-end';
    if (!activeNight && this.nightActions.size === 0) return [];
    const roleLabel = {
      don: 'Дон',
      mafia: 'Мафия',
      doctor: 'Доктор',
      sheriff: 'Шериф',
      bodyguard: 'Телохранитель',
      journalist: 'Журналист',
      maniac: 'Маньяк',
      poisoner: 'Отравитель',
      putana: 'Путана',
      civilian: 'Мирный',
      mayor: 'Мэр',
    };
    const actionLabel = {
      kill: 'убийство',
      heal: 'лечение',
      block: 'блок',
      poison: 'отравление',
      guard: 'защита',
      'check-sheriff': 'проверка (дон)',
      'check-don': 'проверка (шериф)',
      'check-journalist': 'проверка (журналист)',
    };
    return Array.from(this.nightActions.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map((a) => {
        const actor = this.state.players.find((p) => p.id === a.actor);
        const target = this.state.players.find((p) => p.id === a.target);
        return {
          phase: a.phase,
          type: a.type,
          typeLabel: actionLabel[a.type] || a.type,
          actorId: a.actor,
          actorName: actor?.name || a.actor,
          actorRole: a.actorRole,
          actorRoleLabel: roleLabel[a.actorRole] || a.actorRole,
          targetId: a.target,
          targetName: target?.name || a.target,
          timestamp: a.timestamp,
        };
      });
  }

  getPhaseRoles(phase) {
    const map = {
      'night-mafia': ['mafia', 'don'],
      'night-don': ['don'],
      'night-doctor': ['doctor'],
      'night-sheriff': ['sheriff'],
      'night-bodyguard': ['bodyguard'],
      'night-journalist': ['journalist'],
      'night-maniac': ['maniac'],
      'night-poisoner': ['poisoner'],
      'night-putana': ['putana'],
    };
    return map[phase] || [];
  }

  maskPhase(realPhase, playerRole) {
    if (!realPhase.startsWith('night-') || realPhase === 'night-start' || realPhase === 'night-end') return realPhase;
    const phaseRoles = this.getPhaseRoles(realPhase);
    if (phaseRoles.includes(playerRole)) return realPhase;
    return 'night-waiting';
  }

  getPhaseDuration(phase) {
    const timers = this.settings?.timers ?? {};
    // Ручной режим ведущего (без ИИ): длительность фаз не ограничена таймером.
    if (!this.settings?.options?.aiGameMaster) return 0;
    switch (phase) {
      case 'role-reveal':
        return timers.roleReveal ?? 12;
      case 'don-election':
        return timers.donElection ?? 25;
      case 'intro':
        return timers.intro ?? 45;
      case 'night-start':
        return 5;
      case 'night-mafia':
      case 'night-don':
      case 'night-doctor':
      case 'night-sheriff':
      case 'night-bodyguard':
      case 'night-journalist':
      case 'night-maniac':
      case 'night-poisoner':
      case 'night-putana':
        return timers.night ?? 45;
      case 'night-end':
        return 5;
      case 'morning':
        return 10;
      case 'discussion':
        return timers.discussion ?? 120;
      case 'voting':
        return timers.voting ?? 45;
      case 'votingTieDiscussion':
        return 30;
      case 'votingRevote':
        return timers.voting ?? 45;
      case 'vote-result':
        return 10;
      case 'gameOver':
        return 0;
      default:
        return 30;
    }
  }
  /** Живые + отравленные (ещё участвуют в городском обсуждении и голосовании). */
  townActivePlayers() {
    return this.state.players.filter((p) => p.status === 'alive' || p.status === 'poisoned');
  }

  updatePendingActions(phase) {
    this.state.pendingActions.clear();
    const alivePlayers = this.state.players.filter((p) => p.status === 'alive');
    const townActive = this.townActivePlayers();
    switch (phase) {
      case 'don-election': {
        const mafia = townActive.filter((p) => p.team === 'mafia');
        mafia.forEach((p) => this.state.pendingActions.add(p.id));
        break;
      }
      case 'night-mafia': {
        const mafia = alivePlayers.filter((p) => p.team === 'mafia');
        mafia.forEach((p) => this.state.pendingActions.add(p.id));
        break;
      }
      case 'night-don': {
        alivePlayers.filter((p) => p.role === 'don').forEach((p) => this.state.pendingActions.add(p.id));
        break;
      }
      case 'night-doctor': {
        alivePlayers.filter((p) => p.role === 'doctor').forEach((p) => this.state.pendingActions.add(p.id));
        break;
      }
      case 'night-sheriff': {
        alivePlayers.filter((p) => p.role === 'sheriff').forEach((p) => this.state.pendingActions.add(p.id));
        break;
      }
      case 'night-bodyguard': {
        alivePlayers.filter((p) => p.role === 'bodyguard').forEach((p) => this.state.pendingActions.add(p.id));
        break;
      }
      case 'night-journalist': {
        alivePlayers.filter((p) => p.role === 'journalist').forEach((p) => this.state.pendingActions.add(p.id));
        break;
      }
      case 'night-maniac': {
        alivePlayers.filter((p) => p.role === 'maniac').forEach((p) => this.state.pendingActions.add(p.id));
        break;
      }
      case 'night-poisoner': {
        alivePlayers.filter((p) => p.role === 'poisoner').forEach((p) => this.state.pendingActions.add(p.id));
        break;
      }
      case 'night-putana': {
        alivePlayers.filter((p) => p.role === 'putana').forEach((p) => this.state.pendingActions.add(p.id));
        break;
      }
      case 'voting':
      case 'votingRevote':
        // Поочерёдное голосование для всех режимов:
        // action-required получает только текущий голосующий.
        const ordered = townActive
          .filter((p) => !p.cannotVoteNextDay)
          .map((p) => p.id);
        const alreadyVoted = new Set([...this.dayActions.keys()]);
        const nextVoter = ordered.find((id) => !alreadyVoted.has(id));
        if (nextVoter) this.state.pendingActions.add(nextVoter);
        break;
    }
    this.emit('game:pending-actions-updated', Array.from(this.state.pendingActions));
  }
  handleAction(playerId, action) {
    if (!this.isValidAction(playerId, action)) return false;
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return false;
    const actionType = this.getNightActionType(player.role, action.type);
    if (this.state.phase.startsWith('night') && actionType) {
      this.nightActions.set(playerId, {
        type: actionType,
        actor: playerId,
        actorRole: player.role,
        target: action.targetId,
        phase: this.state.phase,
        timestamp: new Date(),
      });
    } else if (this.state.phase === 'don-election') {
      this.donElectionVotes.set(playerId, {
        type: 'elect-don',
        actor: playerId,
        actorRole: player.role,
        target: action.targetId,
        phase: this.state.phase,
        timestamp: new Date(),
      });
    } else if (this.state.phase === 'voting' || this.state.phase === 'votingRevote') {
      this.dayActions.set(playerId, {
        type: 'vote',
        actor: playerId,
        target: action.targetId,
        timestamp: new Date(),
      });
      const target = this.state.players.find((p) => p.id === action.targetId);
      if (target) target.votesReceived += player.role === 'mayor' ? 2 : 1;
      player.hasVoted = true;
      player.voteTarget = action.targetId;
    }
    this.state.completedActions.add(playerId);
    this.state.pendingActions.delete(playerId);
    this.touchState();
    if (this.state.pendingActions.size === 0) {
      // Голосование идёт по очереди и закрывается после последнего голоса.
      if (this.state.phase === 'voting' || this.state.phase === 'votingRevote') {
        this.updatePendingActions(this.state.phase);
        if (this.state.pendingActions.size === 0) {
          this.emit('game:all-votes-collected');
        }
      } else {
        this.clearPhaseTimer();
        this.handlePhaseEnd(this.state.phase);
      }
    }
    this.emit('game:action-completed', playerId, action);
    return true;
  }
  getNightActionType(role, type) {
    const map = {
      kill: 'kill',
      heal: 'heal',
      block: 'block',
      poison: 'poison',
      guard: 'guard',
      'check-sheriff': 'check-sheriff',
      'check-don': 'check-don',
      'check-journalist': 'check-journalist',
    };
    return map[type] ?? null;
  }
  isValidAction(playerId, action) {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return false;
    const phase = this.state.phase;
    const townOk = player.status === 'alive' || player.status === 'poisoned';
    const nightOk = player.status === 'alive';
    if (phase === 'voting' || phase === 'votingRevote' || phase === 'don-election') {
      if (!townOk) return false;
    } else if (phase.startsWith('night')) {
      if (!nightOk) return false;
    } else if (player.status !== 'alive') return false;

    if (!this.state.pendingActions.has(playerId)) return false;
    const phaseRoleMap = {
      'night-mafia': ['mafia', 'don'],
      'night-don': ['don'],
      'night-doctor': ['doctor'],
      'night-sheriff': ['sheriff'],
      'night-bodyguard': ['bodyguard'],
      'night-journalist': ['journalist'],
      'night-maniac': ['maniac'],
      'night-poisoner': ['poisoner'],
      'night-putana': ['putana'],
    };
    if (this.state.phase.startsWith('night')) {
      const allowedRoles = phaseRoleMap[this.state.phase] ?? [];
      if (!allowedRoles.includes(player.role)) return false;
    }
    if (action.targetId) {
      const target = this.state.players.find((p) => p.id === action.targetId);
      const targetOkDay = target && (target.status === 'alive' || target.status === 'poisoned');
      const targetOkNight = target && target.status === 'alive';
      if (phase === 'voting' || phase === 'votingRevote' || phase === 'don-election') {
        if (!targetOkDay) return false;
        if (phase === 'votingRevote' && Array.isArray(this.pendingRevoteCandidates) && this.pendingRevoteCandidates.length > 0) {
          if (!this.pendingRevoteCandidates.includes(action.targetId)) return false;
        }
      } else if (phase.startsWith('night')) {
        if (!targetOkNight) return false;
      } else if (!target || target.status !== 'alive') return false;
      if (action.targetId === playerId) {
        if (action.type === 'elect-don') return true;
        if (player.role === 'doctor' && this.settings?.options?.selfHealDoctor) return true;
        return false;
      }
    }
    return true;
  }
  hasLivingRole(role) {
    if (role === 'mafia') {
      return this.state.players.some(
        (p) => p.team === 'mafia' && (p.status === 'alive' || p.status === 'poisoned')
      );
    }
    return this.state.players.some(
      (p) => p.role === role && (p.status === 'alive' || p.status === 'poisoned')
    );
  }

  getNextNightPhase(skipFromPhase) {
    const chain = [
      'night-putana',
      'night-doctor',
      'night-mafia',
      'night-maniac',
      'night-poisoner',
      'night-sheriff',
      'night-don',
      'night-bodyguard',
      'night-journalist',
      'night-end',
    ];
    const roleForPhase = {
      'night-mafia': 'mafia',
      'night-don': 'don',
      'night-doctor': 'doctor',
      'night-sheriff': 'sheriff',
      'night-bodyguard': 'bodyguard',
      'night-journalist': 'journalist',
      'night-maniac': 'maniac',
      'night-poisoner': 'poisoner',
      'night-putana': 'putana',
    };
    const idx = chain.indexOf(skipFromPhase);
    if (idx < 0) return skipFromPhase;
    // Стартуем со следующего, чтобы реально пропустить переданную фазу
    for (let i = idx + 1; i < chain.length; i++) {
      const phase = chain[i];
      if (phase === 'night-end') return phase;
      const role = roleForPhase[phase];
      if (role && this.hasLivingRole(role)) return phase;
    }
    return 'night-end';
  }

  handlePhaseEnd(phase) {
    this.clearPhaseTimer();
    const transitions = {
      'role-reveal': this.settings?.options?.chooseDonByVote ? 'don-election' : 'intro',
      'don-election': 'intro',
      intro: 'night-start',
      'night-start': 'night-putana',
      'night-putana': 'night-doctor',
      'night-doctor': 'night-mafia',
      'night-mafia': 'night-maniac',
      'night-maniac': 'night-poisoner',
      'night-poisoner': 'night-sheriff',
      'night-sheriff': 'night-don',
      'night-don': 'night-bodyguard',
      'night-bodyguard': 'night-journalist',
      'night-journalist': 'night-end',
      'night-end': 'morning',
      morning: 'discussion',
      discussion: 'voting',
      voting: 'vote-result',
      votingTieDiscussion: 'votingRevote',
      votingRevote: 'vote-result',
      'vote-result': 'night-start',
      gameOver: 'gameOver',
    };
    if (phase === 'don-election') {
      this.resolveDonElection();
      this.donElectionVotes.clear();
    }
    if (phase === 'night-end') {
      this.resolveNightActions();
    } else if (phase === 'vote-result') {
      this.resolveVoting();
      this.voteResolutionMode = 'normal';
    }
    // resolveVoting может сам переключить фазу (tie discussion/revote).
    // В таком случае не продолжаем стандартный transition для старой фазы.
    if (this.state.phase !== phase) return;
    const winner = this.checkWinCondition();
    if (winner) {
      this.startPhase('gameOver');
      this.emit('game:ended', winner, this.generateStats());
      return;
    }
    let nextPhase = transitions[phase];
    if (phase === 'voting') this.voteResolutionMode = 'normal';
    if (phase === 'votingRevote') this.voteResolutionMode = 'revote';
    const townActiveCount = this.townActivePlayers().length;
    if (phase === 'vote-result' && nextPhase === 'night-start' && townActiveCount <= 3) {
      // Клатч 3 игроков: не уходим в ночь, даём городу ещё один цикл обсуждения/голосования.
      nextPhase = 'discussion';
    }
    const firstNightSkip = ['night-mafia', 'night-maniac', 'night-poisoner'];
    if (this.state.day === 1 && this.settings?.options?.firstNightNoKill && firstNightSkip.includes(nextPhase)) {
      nextPhase = this.getNextNightPhase(nextPhase);
      // Если следующая фаза тоже из «убийственных» в первую ночь — пропускаем дальше
      while (firstNightSkip.includes(nextPhase)) {
        nextPhase = this.getNextNightPhase(nextPhase);
      }
    } else if (nextPhase && nextPhase.startsWith('night-') && nextPhase !== 'night-start' && nextPhase !== 'night-end') {
      const roleForPhase = {
        'night-mafia': 'mafia',
        'night-don': 'don',
        'night-doctor': 'doctor',
        'night-sheriff': 'sheriff',
        'night-bodyguard': 'bodyguard',
        'night-journalist': 'journalist',
        'night-maniac': 'maniac',
        'night-poisoner': 'poisoner',
        'night-putana': 'putana',
      };
      const role = roleForPhase[nextPhase];
      if (role && !this.hasLivingRole(role)) {
        nextPhase = this.getNextNightPhase(nextPhase);
      }
    } else if (nextPhase === 'night-start') {
      this.state.day++;
      this.state.round++;
    }
    this.startPhase(nextPhase);
  }
  resolveDonElection() {
    const alive = this.state.players.filter((p) => p.status === 'alive');
    const mafia = alive.filter((p) => p.team === 'mafia');
    if (mafia.length === 0) return;
    const votes = Array.from(this.donElectionVotes.values());
    const voted = this.getMostVoted(votes);
    const targetId = voted?.target;
    const candidate = targetId ? mafia.find((p) => p.id === targetId) : null;
    const currentDon = alive.find((p) => p.role === 'don' && p.team === 'mafia');
    if (candidate && candidate.id !== currentDon?.id) {
      if (currentDon) currentDon.role = 'mafia';
      candidate.role = 'don';
      candidate.team = 'mafia';
      this.emit('game:role-changed', candidate.id, 'don');
      if (currentDon) this.emit('game:role-changed', currentDon.id, 'mafia');
    }
  }
  resolveNightActions() {
    const actions = Array.from(this.nightActions.values());
    // Путана блокирует голос на следующем голосовании для каждой своей цели (поддержка нескольких путан)
    const visitedByPutana = new Set();
    const putanaActions = actions.filter((a) => a.type === 'block');
    for (const a of putanaActions) {
      if (!a?.target) continue;
      const target = this.state.players.find((p) => p.id === a.target);
      if (target) {
        target.cannotVoteNextDay = true;
        visitedByPutana.add(a.target);
      }
    }
    const effectiveActions = actions;

    const results = {
      kills: new Set(),
      heals: new Set(),
      poisons: new Set(),
      blocks: visitedByPutana,
      checks: [],
    };

    // Все доктора: объединение целей лечения
    for (const a of effectiveActions.filter((x) => x.type === 'heal')) {
      if (a?.target) results.heals.add(a.target);
    }

    const mafiaActions = effectiveActions.filter((a) => a.type === 'kill' && (a.actorRole === 'mafia' || a.actorRole === 'don'));
    if (mafiaActions.length > 0) {
      const mafiaTarget = this.getMostVoted(mafiaActions);
      if (mafiaTarget?.target) results.kills.add(mafiaTarget.target);
    }
    // Все маньяки убивают свою цель независимо
    for (const a of effectiveActions.filter((x) => x.type === 'kill' && x.actorRole === 'maniac')) {
      if (a?.target) results.kills.add(a.target);
    }

    const bodyguardDeaths = new Set();
    const guardActions = effectiveActions.filter((a) => a.type === 'guard');
    const protectedToGuard = new Map();
    for (const ga of guardActions) {
      if (ga?.target && ga.actor) protectedToGuard.set(ga.target, ga.actor);
    }
    for (const targetId of [...results.kills]) {
      const guardianId = protectedToGuard.get(targetId);
      if (!guardianId) continue;
      const g = this.state.players.find((p) => p.id === guardianId);
      if (g && g.status === 'alive') {
        results.kills.delete(targetId);
        results.kills.add(guardianId);
        bodyguardDeaths.add(guardianId);
      }
    }
    results.bodyguardDeaths = bodyguardDeaths;

    // Все отравители: объединение целей
    for (const a of effectiveActions.filter((x) => x.type === 'poison')) {
      if (a?.target) results.poisons.add(a.target);
    }

    // Каждый шериф получает свою проверку
    for (const sheriffAction of effectiveActions.filter((a) => a.type === 'check-sheriff')) {
      if (!sheriffAction?.target) continue;
      const target = this.state.players.find((p) => p.id === sheriffAction.target);
      const isMafia = target?.team === 'mafia' && target.role !== 'don';
      results.checks.push({
        sheriff: sheriffAction.actor,
        target: sheriffAction.target,
        result: !!isMafia,
      });
    }
    // Каждый дон-проверяющий получает свою проверку
    for (const donAction of effectiveActions.filter((a) => a.type === 'check-don')) {
      if (!donAction?.target) continue;
      const target = this.state.players.find((p) => p.id === donAction.target);
      const isSheriff = target?.role === 'sheriff';
      results.checks.push({
        don: donAction.actor,
        target: donAction.target,
        result: !!isSheriff,
      });
    }
    // Каждый журналист получает свою проверку
    for (const journalistAction of effectiveActions.filter((a) => a.type === 'check-journalist')) {
      if (!journalistAction?.target) continue;
      const target = this.state.players.find((p) => p.id === journalistAction.target);
      const isMafiaSide = target?.team === 'mafia';
      results.checks.push({
        journalist: journalistAction.actor,
        target: journalistAction.target,
        result: !!isMafiaSide,
      });
    }
    this.applyNightResults(results);
    this.nightActions.clear();
    this.emit('game:night-resolved', {
      killed: Array.from(results.kills).map((id) => this.getPlayerName(id)),
      healed: Array.from(results.heals).map((id) => this.getPlayerName(id)),
      poisoned: Array.from(results.poisons).map((id) => this.getPlayerName(id)),
      checks: results.checks,
    });
  }
  applyNightResults(results) {
    const killedTonight = [];
    const healedTonight = [];
    const poisonedTonight = [];
    for (const player of this.state.players) {
      if (player.status !== 'alive' && player.status !== 'poisoned') continue;

      const isKilled = results.kills.has(player.id);
      const isHealed = results.heals.has(player.id);
      const isPoisoned = results.poisons.has(player.id);

      if (isKilled && !isHealed) {
        player.status = 'dead';
        if (results.bodyguardDeaths?.has(player.id)) {
          player.deathCause = 'bodyguard';
        } else if (isPoisoned) {
          player.deathCause = 'poison-and-kill';
        } else {
          player.deathCause = 'mafia';
        }
        killedTonight.push(player.id);
      } else if (isPoisoned && !isHealed && !isKilled) {
        player.status = 'poisoned';
        poisonedTonight.push(player.id);
      } else if (isHealed) {
        if (player.status === 'poisoned' || isPoisoned) healedTonight.push(player.id);
        player.status = 'alive';
      }
    }
    this.state.nightKills = killedTonight;
    this.state.nightHeals = healedTonight;
    this.state.nightPoisoned = poisonedTonight;
    this.touchState();
    this.logEvent('night-resolved', {
      kills: killedTonight,
      heals: healedTonight,
      poisons: poisonedTonight,
      blocks: Array.from(results.blocks),
    });
  }
  resolveVoting() {
    const votes = Array.from(this.dayActions.values());
    const voteCounts = new Map();
    for (const vote of votes) {
      const voter = this.state.players.find((p) => p.id === vote.actor);
      const w = voter?.role === 'mayor' ? 2 : 1;
      const current = voteCounts.get(vote.target) ?? 0;
      voteCounts.set(vote.target, current + w);
    }
    let maxVotes = 0;
    const candidates = [];
    for (const [playerId, count] of voteCounts) {
      if (count > maxVotes) {
        maxVotes = count;
        candidates.length = 0;
        candidates.push(playerId);
      } else if (count === maxVotes) {
        candidates.push(playerId);
      }
    }
    let lynched = null;
    const isRevote = this.voteResolutionMode === 'revote';
    if (candidates.length === 1) {
      lynched = candidates[0];
    } else if (candidates.length > 1) {
      if (!isRevote) {
        this.pendingRevoteCandidates = [...candidates];
        this.votingTieResolved = false;
        this.emit('game:vote-tie', candidates);
        this.dayActions.clear();
        this.startPhase('votingTieDiscussion');
        return;
      }
      if (this.settings.options?.equalVotesRandomLynch) {
        lynched = candidates[Math.floor(Math.random() * candidates.length)];
        this.emit('game:random-lynch-selected', lynched, candidates);
      } else if (this.settings.options?.equalVotesNoKill) {
        this.emit('game:vote-tie', candidates);
        this.emit('game:city-sleeps-no-execution', candidates);
      } else {
        // Вариант по умолчанию: массовая казнь — при равных голосах умирают ВСЕ кандидаты
        for (const id of candidates) {
          const player = this.state.players.find((p) => p.id === id);
          if (player) {
            player.status = 'dead';
            player.deathCause = 'lynched';
          }
        }
        this.emit('game:mass-execution', candidates);
        this.emit('game:multiple-lynched', candidates);
      }
    }
    if (lynched) {
      const player = this.state.players.find((p) => p.id === lynched);
      if (player) {
        player.status = 'dead';
        player.deathCause = 'lynched';
      }
      this.emit('game:lynched', lynched, maxVotes);
    }
    for (const player of this.state.players) {
      player.votesReceived = 0;
      player.hasVoted = false;
      player.voteTarget = undefined;
    }
    this.dayActions.clear();
    this.pendingRevoteCandidates = null;
    this.votingTieResolved = true;
    this.processPoisonedPlayers();
  }
  processPoisonedPlayers() {
    for (const player of this.state.players) {
      if (player.status === 'poisoned') {
        player.status = 'dead';
        player.deathCause = 'poison';
        this.emit('game:poison-death', player.id);
      }
    }
  }
  checkWinCondition() {
    const aliveNow = this.state.players.filter((p) => p.status === 'alive');
    const willDieTonight = this.state.players.filter(
      (p) => p.status === 'poisoned' || this.state.nightKills?.includes(p.id)
    );
    // FIXED: Include poisoned players as effectively dead for win condition check
    const effectivelyAlive = aliveNow.filter(
      (p) => !willDieTonight.some((d) => d.id === p.id) && p.status !== 'poisoned'
    );

    const aliveManiac = effectivelyAlive.find((p) => p.role === 'maniac');
    const aliveMafia = effectivelyAlive.filter((p) => p.team === 'mafia');
    const aliveCivilians = effectivelyAlive.filter((p) => p.team === 'civilian');

    // Маньяк побеждает в клатче: 1v1 или когда остался один.
    if (
      aliveManiac &&
      (effectivelyAlive.length === 1 ||
        (effectivelyAlive.length === 2 && effectivelyAlive.some((p) => p.role === 'maniac')))
    ) return 'maniac';
    // FIXED: Mafia wins when they equal or outnumber civilians (and no maniac threat)
    if (aliveMafia.length >= aliveCivilians.length && !aliveManiac) return 'mafia';
    // FIXED: Civilians win when all mafia and maniac are dead
    if (aliveMafia.length === 0 && !aliveManiac) return 'civilian';
    return null;
  }
  getMostVoted(actions) {
    if (actions.length === 0) return null;
    const votes = new Map();
    for (const action of actions) {
      votes.set(action.target, (votes.get(action.target) ?? 0) + 1);
    }
    let max = 0;
    let target = null;
    for (const [t, count] of votes) {
      if (count > max) {
        max = count;
        target = t;
      }
    }
    return target ? actions.find((a) => a.target === target) : null;
  }
  getPlayerName(id) {
    return this.state.players.find((p) => p.id === id)?.name ?? 'Unknown';
  }
  logEvent(type, data) {
    this.state.gameLog.push({
      timestamp: new Date(),
      day: this.state.day,
      phase: this.state.phase,
      type,
      data,
    });
  }
  clearPhaseTimer() {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  /** Остановка таймера фазы и снятие слушателей (сброс партии / закрытие движка). */
  cleanup() {
    this.clearPhaseTimer();
    this.removeAllListeners();
  }
  generateStats() {
    const winner = this.checkWinCondition();
    return {
      winner,
      totalRounds: this.state.round,
      gameDuration: Date.now() - this.currentPhaseStartTime.getTime(),
      players: this.state.players.map((p) => ({
        name: p.name,
        role: p.role,
        team: p.team,
        survived: p.status === 'alive',
        deathCause: p.deathCause,
      })),
    };
  }
  forceNextPhase() {
    this.handlePhaseEnd(this.state.phase);
  }
  setPhase(phase) {
    this.clearPhaseTimer();
    this.startPhase(phase);
  }
  killPlayer(playerId) {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || player.status === 'dead') return;
    player.status = 'dead';
    player.deathCause = 'host-kill';
    this.touchState();
    this.emit('game:player-killed', playerId, 'moderator');
  }
  revivePlayer(playerId) {
    const player = this.state.players.find((p) => p.id === playerId);
    if (player) {
      player.status = 'alive';
      player.deathCause = undefined;
      this.touchState();
      this.emit('game:player-revived', playerId);
    }
  }
  changeRole(playerId, newRole) {
    const player = this.state.players.find((p) => p.id === playerId);
    if (player) {
      player.role = newRole;
      player.team = this.getTeamForRole(newRole);
      this.touchState();
      this.emit('game:role-changed', playerId, newRole);
    }
  }
  getTeamForRole(role) {
    const map = {
      civilian: 'civilian',
      citizen: 'civilian',
      sheriff: 'civilian',
      doctor: 'civilian',
      putana: 'civilian',
      bodyguard: 'civilian',
      journalist: 'civilian',
      mayor: 'civilian',
      mafia: 'mafia',
      don: 'mafia',
      poisoner: 'mafia',
      maniac: 'maniac',
    };
    return map[role] ?? 'civilian';
  }

  onConnectionChange(playerId, isOnline) {
    const player = this.state.players.find((p) => p.id === playerId);
    if (player) player.isOnline = isOnline;
    if (isOnline) {
      this.emit('game:player-reconnected', playerId);
    } else {
      this.emit('game:player-disconnected', playerId);
      // Если фаза голосования и ушёл текущий голосующий — двигаемся к следующему,
      // иначе таймер фазы крутится впустую. Ночные фазы остаются по таймеру.
      const phase = this.state.phase;
      if ((phase === 'voting' || phase === 'votingRevote') && this.state.pendingActions.has(playerId)) {
        this.state.pendingActions.delete(playerId);
        this.updatePendingActions(phase);
        if (this.state.pendingActions.size === 0) {
          this.clearPhaseTimer();
          this.handlePhaseEnd(phase);
        }
      }
    }
  }

  /**
   * После переподключения room.players получает новый socket.id, а состояние движка — нет.
   * Без этого ломаются game:state-update, голосование и мафиозный чат.
   */
  remapPlayerId(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return false;
    const pl = this.state.players.find((p) => p.id === oldId);
    if (!pl) return false;
    pl.id = newId;

    const patchAction = (v) => {
      if (!v || typeof v !== 'object') return v;
      const next = { ...v };
      if (next.actor === oldId) next.actor = newId;
      if (next.target === oldId) next.target = newId;
      return next;
    };

    const rekeyMap = (m) => {
      if (!(m instanceof Map)) return;
      const next = new Map();
      for (const [k, v] of m) {
        const nk = k === oldId ? newId : k;
        next.set(nk, patchAction(v));
      }
      m.clear();
      for (const [k, v] of next) m.set(k, v);
    };

    rekeyMap(this.nightActions);
    rekeyMap(this.dayActions);
    rekeyMap(this.donElectionVotes);

    if (this.state.pendingActions?.delete(oldId)) this.state.pendingActions.add(newId);
    if (this.state.completedActions?.delete(oldId)) this.state.completedActions.add(newId);

    for (const p of this.state.players) {
      if (p.voteTarget === oldId) p.voteTarget = newId;
    }

    const repl = (arr) => {
      if (!Array.isArray(arr)) return;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === oldId) arr[i] = newId;
      }
    };
    repl(this.state.nightKills);
    repl(this.state.nightHeals);
    repl(this.state.nightPoisoned);
    repl(this.state.nightBlocked);

    this.emit('game:player-id-remapped', oldId, newId);
    this.touchState();
    return true;
  }

  touchState() {
    this.stateVersion += 1;
    this.state.version = this.stateVersion;
  }

  onPlayerTimeout(playerId) {
    const player = this.state.players.find((p) => p.id === playerId);
    if (player && (player.status === 'alive' || player.status === 'poisoned') && !player.isOnline) {
      player.status = 'dead';
      player.deathCause = 'disconnected';
      this.emit('game:player-killed', playerId, 'disconnected');

      const winner = this.checkWinCondition();
      if (winner) {
        this.startPhase('gameOver');
        this.emit('game:ended', winner, this.generateStats());
      }
    }
  }
  getState() {
    return { ...this.state };
  }
}
