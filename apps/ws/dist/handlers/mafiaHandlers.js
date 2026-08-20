import { MafiaGameEngine } from '../games/mafia/MafiaGameEngine.js';
import { AIGameMaster } from '../games/mafia/AIGameMaster.js';
import { GameEventLogger } from '../games/mafia/GameEventLogger.js';
import { BotBrain } from '../games/mafia/BotBrain.js';
import { AutopilotController } from '../games/mafia/AutopilotController.js';
import { MafiaOrchestrator } from '../games/mafia/MafiaOrchestrator.js';
import { createNarrationProvider } from '../games/mafia/providers/NarrationProvider.js';
import { createBotDecisionProvider } from '../games/mafia/providers/BotDecisionProvider.js';
import { sanitizeRoom, sanitizeText } from '../utils/sanitize.js';
import { MAFIA_SOCKET_EVENTS, MAFIA_ACTION_TYPES, isMafiaNightPhase } from '@playforfun/shared-types';

function isBotId(id) {
  return typeof id === 'string' && id.startsWith('bot_');
}

const botBrains = new Map();
const autopilotControllers = new Map();
const discussionTurnControllers = new Map();
const ALLOWED_MAFIA_ACTIONS = new Set(Object.values(MAFIA_ACTION_TYPES));

function isValidMafiaActionPayload(action) {
  if (!action || typeof action !== 'object') return false;
  if (!ALLOWED_MAFIA_ACTIONS.has(action.type)) return false;
  if (action.targetId != null && typeof action.targetId !== 'string') return false;
  return true;
}

function getNightRolePublicLine(phase) {
  const lines = {
    'night-putana': '🌙 ИИ ведущий: ночной ход Путаны.',
    'night-doctor': '🌙 ИИ ведущий: ночной ход Доктора.',
    'night-mafia': '🌙 ИИ ведущий: ночной ход Мафии.',
    'night-maniac': '🌙 ИИ ведущий: ночной ход Маньяка.',
    'night-poisoner': '🌙 ИИ ведущий: ночной ход Отравителя.',
    'night-sheriff': '🌙 ИИ ведущий: ночной ход Шерифа.',
    'night-don': '🌙 ИИ ведущий: ночной ход Дона.',
    'night-bodyguard': '🌙 ИИ ведущий: ночной ход Телохранителя.',
    'night-journalist': '🌙 ИИ ведущий: ночной ход Журналиста.',
    'night-end': '🌙 ИИ ведущий: ночь завершается, подводим итоги.',
  };
  return lines[phase] || null;
}

function getBotBrain(botId, engine) {
  if (botBrains.has(botId)) return botBrains.get(botId);
  const state = engine.getState();
  const player = state.players.find((p) => p.id === botId);
  if (!player) return null;
  const brain = new BotBrain(botId, player.role, player.team, engine);
  botBrains.set(botId, brain);
  return brain;
}

function performBotAction(engine, botId, phase, roomCode, io, roomManager, botDecisionProvider = null) {
  const state = engine.getState();
  const player = state.players.find((p) => p.id === botId);
  if (!player) return;
  const isTownPhase = phase === 'voting' || phase === 'votingRevote' || phase === 'don-election';
  if (!isTownPhase && player.status !== 'alive') return;
  if (isTownPhase && player.status !== 'alive' && player.status !== 'poisoned') return;

  const brain = getBotBrain(botId, engine);
  if (!brain) return;

  const alive = state.players.filter((p) => p.status === 'alive');
  const townActive = state.players.filter((p) => p.status === 'alive' || p.status === 'poisoned');
  const tryAction = (type, candidates = []) => {
    const tried = new Set();
    for (const candidate of candidates) {
      if (!candidate?.id || candidate.id === botId || tried.has(candidate.id)) continue;
      tried.add(candidate.id);
      const ok = engine.handleAction(botId, { type, targetId: candidate.id });
      if (ok) return true;
    }
    return false;
  };

  if (phase === 'don-election') {
    const mafia = townActive.filter((p) => p.team === 'mafia');
    const selectedId = botDecisionProvider?.chooseTarget?.(mafia.map((m) => m.id)) || null;
    const selected = selectedId ? mafia.find((m) => m.id === selectedId) : null;
    const fallback = mafia.filter((m) => m.id !== selected?.id);
    const candidates = selected ? [selected, ...fallback] : mafia;
    tryAction('elect-don', candidates);
  } else if (phase === 'voting' || phase === 'votingRevote') {
    const room = roomManager.getRoom(roomCode);
    const mentionWindowMs = 4 * 60 * 1000;
    const providerTargetId = botDecisionProvider?.chooseTarget?.(
      townActive.filter((c) => c.id !== botId).map((c) => c.id),
      {}
    );
    const target = providerTargetId
      ? townActive.find((c) => c.id === providerTargetId)
      : brain.decideVote(townActive);
    const fallback = townActive.filter((c) => c.id !== botId && c.id !== target?.id);
    const candidates = target ? [target, ...fallback] : fallback;
    tryAction('vote', candidates);
  } else if (phase.startsWith('night-')) {
    const target = brain.decideNightAction(phase, alive);
    const typeMap = {
      'night-mafia': 'kill', 'night-don': 'check-don', 'night-doctor': 'heal',
      'night-sheriff': 'check-sheriff', 'night-bodyguard': 'guard',
      'night-journalist': 'check-journalist', 'night-maniac': 'kill',
      'night-poisoner': 'poison', 'night-putana': 'block',
    };
    const actionType = typeMap[phase] || 'kill';
    const fallback = alive.filter((p) => p.id !== botId && p.id !== target?.id);
    const candidates = target ? [target, ...fallback] : fallback;
    tryAction(actionType, candidates);
  }
}



function clearDiscussionTurns(roomCode) {
  const ctrl = discussionTurnControllers.get(roomCode);
  if (!ctrl) return;
  if (ctrl.announceTimer) clearTimeout(ctrl.announceTimer);
  if (ctrl.nextTurnTimer) clearTimeout(ctrl.nextTurnTimer);
  discussionTurnControllers.delete(roomCode);
}

function finishCurrentDiscussionTurn(roomCode, delayMs = 180) {
  const ctrl = discussionTurnControllers.get(roomCode);
  if (!ctrl) return false;
  if (ctrl.announceTimer) {
    clearTimeout(ctrl.announceTimer);
    ctrl.announceTimer = null;
  }
  if (ctrl.nextTurnTimer) {
    clearTimeout(ctrl.nextTurnTimer);
    ctrl.nextTurnTimer = null;
  }
  ctrl.index += 1;
  ctrl.currentSpeakerId = null;
  if (ctrl.index >= ctrl.queue.length) return true;
  ctrl.announceTimer = setTimeout(() => {
    const active = discussionTurnControllers.get(roomCode);
    if (!active || typeof active.announceTurn !== 'function') return;
    active.announceTurn();
  }, Math.max(0, delayMs));
  return true;
}

function startDiscussionTurns(engine, room, io, roomManager) {
  const roomCode = room.code;
  clearDiscussionTurns(roomCode);
  const state = engine.getState();
  const phase = state.phase;
  if (phase !== 'discussion' && phase !== 'intro') return;
  const queue = state.players.filter((p) => p.status === 'alive' || p.status === 'poisoned').map((p) => p.id);
  if (queue.length === 0) return;
  const totalPhaseSec = phase === 'intro'
    ? Math.max(40, Number(room?.settings?.timers?.intro || 90))
    : Math.max(30, Number(room?.settings?.timers?.discussion || 120));
  const perTurnSec = Math.max(10, Math.floor(totalPhaseSec / Math.max(1, queue.length)));
  const ctrl = {
    queue,
    index: 0,
    perTurnSec,
    announceTimer: null,
    nextTurnTimer: null,
    day: state.day || 1,
    phase,
    currentSpeakerId: null,
    announceTurn: null,
  };
  discussionTurnControllers.set(roomCode, ctrl);

  const announceTurn = () => {
    const currentCtrl = discussionTurnControllers.get(roomCode);
    const currentRoom = roomManager.getRoom(roomCode);
    const currentEngine = roomManager.getGameEngine(roomCode);
    if (!currentCtrl || !currentRoom || !currentEngine || currentEngine !== engine) return;
    if (currentEngine.getState().phase !== currentCtrl.phase) return;

    const playerId = currentCtrl.queue[currentCtrl.index];
    if (!playerId) return;
    const player = currentEngine.getState().players.find((p) => p.id === playerId);
    if (!player || (player.status !== 'alive' && player.status !== 'poisoned')) {
      currentCtrl.index += 1;
      if (currentCtrl.index < currentCtrl.queue.length) {
        currentCtrl.announceTimer = setTimeout(announceTurn, 100);
      }
      return;
    }

    const isIntro = currentCtrl.phase === 'intro';
    currentCtrl.currentSpeakerId = playerId;
    io.to(roomCode).emit('room:chat-message', {
      system: true,
      message: isIntro
        ? `🎙️ Представление: слово у ${player.name}. Время — ${currentCtrl.perTurnSec} сек.`
        : `🎤 Слово: ${player.name}. Время на выступление — ${currentCtrl.perTurnSec} сек.`,
      timestamp: new Date(),
    });
    io.to(roomCode).emit('game:speaking-turn', {
      phase: currentCtrl.phase,
      playerId,
      playerName: player.name,
      index: currentCtrl.index + 1,
      total: currentCtrl.queue.length,
      durationSec: currentCtrl.perTurnSec,
      day: currentCtrl.day,
    });

    currentCtrl.nextTurnTimer = setTimeout(() => {
      finishCurrentDiscussionTurn(roomCode, 250);
    }, currentCtrl.perTurnSec * 1000);
  };

  ctrl.announceTurn = announceTurn;
  ctrl.announceTimer = setTimeout(announceTurn, 700);
}

function getWaitingMessage(phase, role) {
  if (phase !== 'night-waiting') return undefined;
  const messages = {
    mafia: 'Мафия договаривается...',
    don: 'Мафия договаривается...',
    doctor: 'Город спит...',
    sheriff: 'Тихая ночь...',
    civilian: 'Ночь, все спят...',
    citizen: 'Ночь, все спят...',
    putana: 'Город спит...',
    poisoner: 'Мафия договаривается...',
    maniac: 'Тихая ночь...',
    bodyguard: 'Тихая ночь...',
    journalist: 'Тихая ночь...',
    mayor: 'Ночь, все спят...',
  };
  return messages[role] || 'Ночь, все спят...';
}

function normalizeMafiaSettings(room) {
  const envAutopilot = process.env.MAFIA_AUTOPILOT_ENABLED === '1';
  const envAiNarration = process.env.MAFIA_AI_NARRATION_ENABLED === '1';
  const envAiBots = process.env.MAFIA_AI_BOTS_ENABLED === '1';
  const mergedOpts = { aiGameMaster: false, ...(room.settings?.options || {}) };
  const classicMode = mergedOpts.classicMode !== false;
  const humanGm = !mergedOpts.aiGameMaster;
  const hostId = room.hostId;
  const playersCount = room.players.filter(
    (p) => !p.isSpectator && !(humanGm && hostId && p.id === hostId)
  ).length;
  const mafiaCount = playersCount >= 11 ? 3 : playersCount >= 7 ? 2 : 1;
  const introSec = Math.max(60, Math.min(180, playersCount * 12));
  const discussionSec = Math.max(120, Math.min(300, playersCount * 25));
  const votingSec = Math.max(45, Math.min(120, playersCount * 8));
  const defaults = {
    roles: {
      mafia: mafiaCount,
      sheriffs: playersCount >= 4 ? 1 : 0,
      doctors: playersCount >= 6 ? 1 : 0,
      maniacs: 0,
      poisoners: 0,
      putanas: 0,
      bodyguards: 0,
      journalists: 0,
      mayors: 0,
    },
    timers: {
      roleReveal: 12,
      donElection: 0,
      intro: introSec,
      night: 45,
      discussion: discussionSec,
      voting: votingSec,
    },
    options: {
      firstNightNoKill: false,
      equalVotesNoKill: true,
      equalVotesRandomLynch: false,
      selfHealDoctor: false,
      aiGameMaster: false,
      autopilot: envAutopilot,
      aiNarration: envAiNarration,
      aiBots: envAiBots,
      chooseDonByVote: false,
      classicMode: true,
    },
  };
  room.settings = {
    ...defaults,
    ...(room.settings || {}),
    roles: { ...defaults.roles, ...(room.settings?.roles || {}) },
    timers: { ...defaults.timers, ...(room.settings?.timers || {}) },
    options: { ...defaults.options, ...(room.settings?.options || {}) },
  };
  if (classicMode) {
    room.settings.roles = {
      ...room.settings.roles,
      maniacs: 0,
      poisoners: 0,
      putanas: 0,
      bodyguards: 0,
      journalists: 0,
      mayors: 0,
    };
    room.settings.options = {
      ...room.settings.options,
      chooseDonByVote: false,
      equalVotesNoKill: true,
      equalVotesRandomLynch: false,
      firstNightNoKill: false,
      selfHealDoctor: false,
      classicMode: true,
    };
    room.settings.timers = {
      ...room.settings.timers,
      roleReveal: 12,
      donElection: 0,
      intro: introSec,
      night: 45,
      discussion: discussionSec,
      voting: votingSec,
    };
  }
}

export function registerMafiaHandlers(io, socket, roomManager, livekitService, gameManager = null) {
  socket.on('game:start', (arg0, arg1) => {
    const callback = typeof arg0 === 'function' ? arg0 : typeof arg1 === 'function' ? arg1 : undefined;
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      // Не мафия — молча выходим: другие обработчики (крокодил, шляпа, …) обработают game:start.
      if (!room || room.gameType !== 'mafia') {
        return;
      }
      if (room.hostId !== socket.id) {
        callback?.({ success: false, error: 'Только хост может начать мафию' });
        return;
      }
      if (room.status === 'playing') {
        callback?.({ success: false, error: 'Игра уже запущена' });
        return;
      }
      normalizeMafiaSettings(room);
      const humanGm = !room.settings?.options?.aiGameMaster;
      const eligiblePlayers = room.players.filter(
        (p) => !p.isSpectator && (!humanGm || p.id !== room.hostId)
      );
      if (eligiblePlayers.length < 4) {
        const msg = humanGm
          ? 'Минимум 4 игрока за столом (ведущий без ИИ в роли не получает карту и не считается в состав)'
          : 'Минимум 4 игрока для начала';
        io.to(room.code).emit('room:error', msg);
        callback?.({ success: false, error: msg });
        return;
      }
      const engine = new MafiaGameEngine(room);
      roomManager.setGameEngine(room.code, engine);
      new GameEventLogger(engine);
      const settings = room.settings;
      const aiGameMaster = room.settings?.options?.aiGameMaster ?? false;
      const autopilotEnabled = room.settings?.options?.autopilot ?? aiGameMaster;
      const aiNarrationEnabled = room.settings?.options?.aiNarration ?? aiGameMaster;
      const aiBotsEnabled = room.settings?.options?.aiBots ?? false;
      const narrationProvider = createNarrationProvider({
        mode: aiNarrationEnabled ? (process.env.MAFIA_NARRATION_MODE || 'llm') : 'template',
      });
      const botDecisionProvider = createBotDecisionProvider(aiBotsEnabled ? (process.env.MAFIA_AI_BOTS_MODE || 'mentions') : 'deterministic');
      const orchestrator = new MafiaOrchestrator({
        io,
        room,
        engine,
        aiGameMaster,
        hostId: room.hostId,
        narrationProvider,
      });
      const emitStateUpdate = () => {
        orchestrator.emitPlayerSnapshots();
      };
      if (settings?.options?.aiGameMaster) {
        new AIGameMaster(engine);
      }
    engine.on('ai:speak', (text) => {
      orchestrator.emitNarration(text, { roomCode: room.code, phase: engine.getState().phase });
    });
    engine.on('ai:whisper', ({ playerIds, text }) => {
      (playerIds || []).forEach((pid) => io.to(pid).emit(MAFIA_SOCKET_EVENTS.AI_SPEAK, text));
    });
      if (!room.mafiaMetrics || typeof room.mafiaMetrics !== 'object') room.mafiaMetrics = {};
      const autopilot = new AutopilotController(engine, {
        enabled: autopilotEnabled,
        onMetric: (metricName) => {
          room.mafiaMetrics[metricName] = (room.mafiaMetrics[metricName] || 0) + 1;
        },
      });
    autopilot.attach();
    autopilotControllers.set(room.code, autopilot);

    engine.on('game:started', (state) => {
      state.players.forEach((p) => {
        const personalState = engine.getPlayerState(p.id, room.hostId, aiGameMaster);
        if (personalState) {
          io.to(p.id).emit(MAFIA_SOCKET_EVENTS.STARTED, personalState);
          io.to(p.id).emit(MAFIA_SOCKET_EVENTS.SNAPSHOT, personalState);
        }
      });
      if (!aiGameMaster && room.hostId && !state.players.some((p) => p.id === room.hostId)) {
        const modState = engine.getPlayerState(room.hostId, room.hostId, aiGameMaster);
        if (modState) {
          io.to(room.hostId).emit(MAFIA_SOCKET_EVENTS.STARTED, modState);
          io.to(room.hostId).emit(MAFIA_SOCKET_EVENTS.SNAPSHOT, modState);
        }
      }
    });
    engine.on('game:phase-changed', (phase, timer) => {
      const state = engine.getState();
      for (const p of state.players) {
        if (!isBotId(p.id)) continue;
        const brain = getBotBrain(p.id, engine);
        if (brain?.onPhaseChanged) brain.onPhaseChanged({ phase, state });
      }
      if (phase === 'discussion' || phase === 'intro') {
        startDiscussionTurns(engine, room, io, roomManager);
      }
      else clearDiscussionTurns(room.code);
      const phaseRoles = engine.getPhaseRoles?.(phase) ?? [];
      const isNightPhase = isMafiaNightPhase(phase);

      if (isNightPhase && phaseRoles.length > 0) {
        state.players.forEach((p) => {
          const visiblePhase = engine.maskPhase?.(phase, p.role) ?? phase;
          const isActive = phaseRoles.includes(p.role);
          io.to(p.id).emit(MAFIA_SOCKET_EVENTS.PHASE_CHANGED, visiblePhase, timer, {
            isActive,
            isSpectator: p.status !== 'alive',
            waitingMessage: !isActive ? getWaitingMessage(visiblePhase, p.role) : undefined,
          });
        });
      } else {
        io.to(room.code).emit(MAFIA_SOCKET_EVENTS.PHASE_CHANGED, phase, timer);
      }
      if (aiGameMaster && isNightPhase) {
        const nightLine = getNightRolePublicLine(phase);
        if (nightLine) {
          orchestrator.emitNarration(nightLine, { roomCode: room.code, phase });
        }
      }
      // После любой смены фазы отдаём актуальных игроков (статусы после ночи, линча и т.д.)
      emitStateUpdate();
    });
    engine.on('game:pending-actions-updated', (playerIds) => {
      const state = engine.getState();
      if ((state.phase === 'voting' || state.phase === 'votingRevote') && Array.isArray(playerIds) && playerIds.length > 0) {
        const currentVoterId = playerIds[0];
        const currentVoter = state.players.find((p) => p.id === currentVoterId);
        if (currentVoter) {
          io.to(room.code).emit('room:chat-message', {
            system: true,
            message: `🗳️ Голосует: ${currentVoter.name}.`,
            timestamp: new Date(),
          });
          io.to(room.code).emit('game:speaking-turn', {
            phase: state.phase,
            playerId: currentVoter.id,
            playerName: currentVoter.name,
            durationSec: Math.max(10, Number(room?.settings?.timers?.voting || 45)),
          });
        }
      }
      const settings = room.settings;
      const phaseDuration = state.phase === 'don-election'
        ? (settings?.timers?.donElection ?? 25)
        : state.phase.startsWith('night')
          ? (settings?.timers?.night ?? 60)
          : (settings?.timers?.voting ?? 60);
      const actionDescs = {
        'don-election': 'Выберите Дона (видно только мафии)',
        'night-mafia': 'Выберите жертву',
        'night-don': 'Проверьте игрока на Шерифа',
        'night-doctor': 'Кого лечить?',
        'night-sheriff': 'Кого проверить?',
        'night-maniac': 'Выберите жертву',
        'night-poisoner': 'Кого отравить?',
        'night-putana': 'Кого заблокировать?',
        'night-bodyguard': 'Кого прикрыть от убийства?',
        'night-journalist': 'Кого проверить на мафию?',
        voting: 'Голосуйте за изгнание',
        votingRevote: 'Переголосование среди кандидатов',
      };
      const aliveOnly = state.players.filter((p) => p.status === 'alive').map((p) => p.id);
      const townIds = state.players
        .filter((p) => p.status === 'alive' || p.status === 'poisoned')
        .map((p) => p.id);
      const mafiaIds = state.players
        .filter((p) => (p.status === 'alive' || p.status === 'poisoned') && p.team === 'mafia')
        .map((p) => p.id);
      const includeSelf =
        (state.phase === 'night-doctor' && room.settings?.options?.selfHealDoctor === true)
        || state.phase === 'don-election';
      const revoteCandidates = Array.isArray(engine.pendingRevoteCandidates)
        ? engine.pendingRevoteCandidates.filter((id) => townIds.includes(id))
        : [];
      const humanIds = playerIds.filter((pid) => !isBotId(pid));
      const botIds = playerIds.filter((pid) => isBotId(pid));
      humanIds.forEach((pid) => {
        const validTargets =
          state.phase === 'votingRevote' && revoteCandidates.length > 0
            ? revoteCandidates.filter((id) => id !== pid)
            : state.phase === 'voting' || state.phase === 'votingRevote'
              ? townIds.filter((id) => id !== pid)
              : state.phase === 'don-election'
                ? mafiaIds
                : includeSelf
                  ? aliveOnly
                  : aliveOnly.filter((id) => id !== pid);
        io.to(pid).emit(MAFIA_SOCKET_EVENTS.ACTION_REQUIRED, {
          type: state.phase === 'voting' || state.phase === 'votingRevote' ? 'vote' : 'select-target',
          description: actionDescs[state.phase] ?? 'Выберите цель',
          validTargets,
          timeout: phaseDuration,
        });
      });
      botIds.forEach((botId, i) => {
        const baseDelay = 2000 + Math.floor(Math.random() * 5001); // 2-7s
        const delay = baseDelay + i * 300;
        setTimeout(() => {
          const r = roomManager.getRoom(room.code);
          const eng = roomManager.getGameEngine(room.code);
          if (r && eng && eng instanceof MafiaGameEngine)
            performBotAction(eng, botId, state.phase, room.code, io, roomManager, botDecisionProvider);
        }, delay);
      });

    });
    engine.on('game:night-resolved', (results) => {
      io.to(room.code).emit(MAFIA_SOCKET_EVENTS.NIGHT_RESOLVED, results);
      results.checks?.forEach((check) => {
        const targetName = engine.getPlayerName(check.target);
        if (check.sheriff) {
          io.to(check.sheriff).emit(MAFIA_SOCKET_EVENTS.ACTION_RESULT, {
            success: true,
            kind: 'investigation',
            role: 'sheriff',
            targetId: check.target,
            targetName,
            message: check.result
              ? `Шериф: «${targetName}» — мафия (рядовой).`
              : `Шериф: «${targetName}» — не рядовая мафия (чист по мафии).`,
          });
          if (isBotId(check.sheriff)) {
            const brain = getBotBrain(check.sheriff, engine);
            if (brain) brain.onCheckResult(check.target, check.result);
          }
        }
        if (check.don) {
          io.to(check.don).emit(MAFIA_SOCKET_EVENTS.ACTION_RESULT, {
            success: true,
            kind: 'investigation',
            role: 'don',
            targetId: check.target,
            targetName,
            message: check.result
              ? `Дон: «${targetName}» — шериф.`
              : `Дон: «${targetName}» — не шериф.`,
          });
          if (isBotId(check.don)) {
            const brain = getBotBrain(check.don, engine);
            if (brain && check.result) brain.memory.suspectedPlayers.set(check.target, 'sheriff');
          }
        }
        if (check.journalist) {
          io.to(check.journalist).emit(MAFIA_SOCKET_EVENTS.ACTION_RESULT, {
            success: true,
            kind: 'investigation',
            role: 'journalist',
            targetId: check.target,
            targetName,
            message: check.result
              ? `Журналист: «${targetName}» — мафия (включая дона).`
              : `Журналист: «${targetName}» — не мафия.`,
          });
          if (isBotId(check.journalist)) {
            const brain = getBotBrain(check.journalist, engine);
            if (brain) brain.onCheckResult(check.target, check.result);
          }
        }
      });
      // Ночные смерти без отдельного game:player-killed — иначе клиент остаётся со старыми статусами
      emitStateUpdate();
    });
    engine.on('game:lynched', (playerId, votes) => {
      const state = engine.getState();
      const killedPlayer = state.players.find((p) => p.id === playerId);
      io.to(room.code).emit('game:player-killed', playerId, 'lynched', {
        player: killedPlayer ? { name: killedPlayer.name, role: killedPlayer.role } : undefined,
      });
      io.to(room.code).emit('room:chat-message', { system: true, message: `${killedPlayer?.name ?? 'Игрок'} был линчеван (${votes} голосов)`, timestamp: new Date() });
      if (!room.mutedPlayers.includes(playerId)) room.mutedPlayers.push(playerId);
      emitStateUpdate();
    });
    engine.on('game:poison-death', (playerId) => {
      const state = engine.getState();
      const killedPlayer = state.players.find((p) => p.id === playerId);
      io.to(room.code).emit('game:player-killed', playerId, 'poison', {
        player: killedPlayer ? { name: killedPlayer.name, role: killedPlayer.role } : undefined,
      });
      if (!room.mutedPlayers.includes(playerId)) room.mutedPlayers.push(playerId);
      emitStateUpdate();
    });
    engine.on('game:ended', (winner, stats) => {
      io.to(room.code).emit(MAFIA_SOCKET_EVENTS.ENDED, winner, stats);
      autopilot.cleanup();
      autopilotControllers.delete(room.code);
      clearDiscussionTurns(room.code);
      room.status = 'finished';
      room.updatedAt = new Date();
      roomManager.persistRoom(room.code);
    });
    engine.on('game:vote-tie', (candidates) => {
      io.to(room.code).emit('game:vote-tie', candidates);
    });
    engine.on('game:city-sleeps-no-execution', (candidates) => {
      io.to(room.code).emit('game:city-sleeps-no-execution', candidates);
    });
    engine.on('game:multiple-lynched', (candidates) => {
      io.to(room.code).emit('game:multiple-lynched', candidates);
    });
    engine.on('game:player-id-remapped', () => {
      emitStateUpdate();
    });

    engine.on('game:action-completed', () => {
      emitStateUpdate();
    });

    engine.on('game:player-killed', (playerId, cause) => {
      const state = engine.getState();
      const killedPlayer = state.players.find((p) => p.id === playerId);
      io.to(room.code).emit('game:player-killed', playerId, cause, {
        player: killedPlayer ? { name: killedPlayer.name, role: killedPlayer.role } : undefined,
      });
      emitStateUpdate();
      if (!room.mutedPlayers.includes(playerId)) room.mutedPlayers.push(playerId);
      for (const [botId, brain] of botBrains.entries()) {
        if (state.players.some((p) => p.id === botId)) brain.onPlayerKilled(playerId);
      }
      room.speakingQueue = room.speakingQueue.filter((id) => id !== playerId);
      room.raisedHands = room.raisedHands.filter((id) => id !== playerId);
      if (room.speakingNow === playerId) room.speakingNow = null;
    });
    engine.on('game:player-revived', (playerId) => {
      io.to(room.code).emit('game:player-revived', playerId);
      emitStateUpdate();
    });
    engine.on('game:role-changed', (playerId) => {
      if (isBotId(playerId)) {
        const brain = botBrains.get(playerId);
        const updated = engine.getState().players.find((p) => p.id === playerId);
        if (brain && updated) {
          brain.role = updated.role;
          brain.team = updated.team;
        }
      }
      // Не шлём роли всей комнате — только персональные снимки (иначе мафия «светится» у всех)
      emitStateUpdate();
    });
    engine.start();
    room.status = 'playing';
    room.updatedAt = new Date();
    room.speakingNow = null;
    room.speakingQueue = [];
    room.raisedHands = [];
    room.mutedPlayers = [];
    io.to(room.code).emit('room:updated', sanitizeRoom(room));
    callback?.({ success: true });
    } catch (err) {
      console.error('[MafiaStart Error]', err);
      callback?.({ success: false, error: 'Ошибка запуска мафии' });
    }
  });
  socket.on('game:action', (action) => {
    if (gameManager?.handleAction?.(socket, action)) return;
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || room.gameType !== 'mafia') return;
    if (!isValidMafiaActionPayload(action)) {
      socket.emit(MAFIA_SOCKET_EVENTS.ACTION_REJECTED, {
        reason: 'invalid_payload',
        message: 'Некорректный формат действия.',
      });
      return;
    }
    const engine = roomManager.getGameEngine(room.code);
    if (!engine || !(engine instanceof MafiaGameEngine)) return;
    const success = engine.handleAction(socket.id, action);
    if (!success) {
      socket.emit(MAFIA_SOCKET_EVENTS.ACTION_REJECTED, {
        reason: 'not_allowed',
        message: 'Сейчас это действие недоступно (не ваша фаза, уже проголосовали или вы выбыли).',
      });
    }
  });
  socket.on('game:finish-speaking-turn', (callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || room.gameType !== 'mafia' || room.status !== 'playing') {
      return callback?.({ success: false, error: 'Недоступно' });
    }
    const engine = roomManager.getGameEngine(room.code);
    if (!engine || !(engine instanceof MafiaGameEngine)) {
      return callback?.({ success: false, error: 'Игра не запущена' });
    }
    const state = engine.getState();
    if (state.phase !== 'discussion' && state.phase !== 'intro') {
      return callback?.({ success: false, error: 'Завершение речи доступно только на обсуждении' });
    }
    const ctrl = discussionTurnControllers.get(room.code);
    if (!ctrl || !ctrl.currentSpeakerId) {
      return callback?.({ success: false, error: 'Сейчас нет активного выступления' });
    }
    if (ctrl.currentSpeakerId !== socket.id) {
      return callback?.({ success: false, error: 'Только текущий выступающий может завершить речь' });
    }
    finishCurrentDiscussionTurn(room.code, 150);
    io.to(room.code).emit('room:chat-message', {
      system: true,
      message: '⏭️ Выступление завершено досрочно. Передаём слово следующему.',
      timestamp: new Date(),
    });
    callback?.({ success: true });
  });
  socket.on('host:reset-mafia-party', (callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || room.gameType !== 'mafia') {
      return callback?.({ success: false, error: 'Только для комнаты мафии' });
    }
    if (room.hostId !== socket.id) {
      return callback?.({ success: false, error: 'Только хост может сбросить партию' });
    }
    if (room.status !== 'playing' && room.status !== 'finished') {
      return callback?.({ success: false, error: 'Нет партии для сброса' });
    }
    const autopilot = autopilotControllers.get(room.code);
    if (autopilot) {
      autopilot.cleanup();
      autopilotControllers.delete(room.code);
    }
    clearDiscussionTurns(room.code);
    roomManager.clearGameEngine(room.code);

    for (const p of room.players) {
      if (isBotId(p.id)) botBrains.delete(p.id);
      delete p.role;
      p.status = 'alive';
      p.votesReceived = 0;
      p.hasVoted = false;
      delete p.deathCause;
    }
    for (const p of room.spectators || []) {
      delete p.role;
      if (p.status === 'dead' || p.status === 'poisoned') p.status = 'alive';
      delete p.deathCause;
    }
    room.mutedPlayers = [];

    room.status = 'waiting';
    room.updatedAt = new Date();
    io.to(room.code).emit('game:ended', { mafiaPartyReset: true });
    io.to(room.code).emit('room:updated', sanitizeRoom(room));
    roomManager.persistRoom(room.code);
    callback?.({ success: true });
  });

  socket.on('host:get-mafia-metrics', (callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || room.gameType !== 'mafia') {
      callback?.({ success: false, error: 'Только для комнаты мафии' });
      return;
    }
    if (room.hostId !== socket.id) {
      callback?.({ success: false, error: 'Недостаточно прав' });
      return;
    }
    callback?.({
      success: true,
      metrics: room.mafiaMetrics || {},
      featureFlags: {
        autopilot: !!room.settings?.options?.autopilot,
        aiNarration: !!room.settings?.options?.aiNarration,
        aiBots: !!room.settings?.options?.aiBots,
      },
    });
  });

  socket.on('host:next-phase', (callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room) return callback?.({ success: false, error: 'Комната не найдена' });
    if (room.hostId !== socket.id) return callback?.({ success: false, error: 'Недостаточно прав' });
    const engine = roomManager.getGameEngine(room.code);
    if (engine && engine instanceof MafiaGameEngine) {
      engine.forceNextPhase();
      callback?.({ success: true });
      return;
    }
    callback?.({ success: false, error: 'Игра не запущена' });
  });
  socket.on('host:set-phase', (phase, callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room) return callback?.({ success: false, error: 'Комната не найдена' });
    if (room.hostId !== socket.id) return callback?.({ success: false, error: 'Недостаточно прав' });
    const engine = roomManager.getGameEngine(room.code);
    if (engine && engine instanceof MafiaGameEngine) {
      engine.setPhase(phase);
      callback?.({ success: true });
      return;
    }
    callback?.({ success: false, error: 'Игра не запущена' });
  });
  socket.on('host:kill-player', (playerId, callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room) return callback?.({ success: false, error: 'Комната не найдена' });
    if (room.hostId !== socket.id) return callback?.({ success: false, error: 'Недостаточно прав' });
    const engine = roomManager.getGameEngine(room.code);
    if (engine && engine instanceof MafiaGameEngine) {
      engine.killPlayer(playerId);
      callback?.({ success: true });
      return;
    }
    callback?.({ success: false, error: 'Игра не запущена' });
  });
  socket.on('host:revive-player', (playerId, callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room) return callback?.({ success: false, error: 'Комната не найдена' });
    if (room.hostId !== socket.id) return callback?.({ success: false, error: 'Недостаточно прав' });
    const engine = roomManager.getGameEngine(room.code);
    if (engine && engine instanceof MafiaGameEngine) {
      engine.revivePlayer(playerId);
      callback?.({ success: true });
      return;
    }
    callback?.({ success: false, error: 'Игра не запущена' });
  });
  socket.on('host:change-role', (playerId, newRole, callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room) return callback?.({ success: false, error: 'Комната не найдена' });
    if (room.hostId !== socket.id) return callback?.({ success: false, error: 'Недостаточно прав' });
    const engine = roomManager.getGameEngine(room.code);
    if (engine && engine instanceof MafiaGameEngine) {
      engine.changeRole(playerId, newRole);
      callback?.({ success: true });
      return;
    }
    callback?.({ success: false, error: 'Игра не запущена' });
  });
  socket.on('host:act-as', ({ playerId, action }, callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room) return callback?.({ success: false, error: 'Комната не найдена' });
    if (room.hostId !== socket.id) return callback?.({ success: false, error: 'Недостаточно прав' });
    const engine = roomManager.getGameEngine(room.code);
    if (!engine || !(engine instanceof MafiaGameEngine)) {
      return callback?.({ success: false, error: 'Игра не запущена' });
    }
    const targetPlayer = engine.getState().players.find((p) => p.id === playerId);
    if (!targetPlayer) return callback?.({ success: false, error: 'Игрок не найден' });

    const success = engine.handleAction(playerId, action);
    if (success) {
      callback?.({ success: true });
      io.to(room.code).emit('room:chat-message', {
        message: `[Ведущий] сделал ход за ${targetPlayer.name}`,
        system: true,
        timestamp: new Date(),
      });
    } else {
      callback?.({ success: false, error: 'Действие отклонено движком' });
    }
  });

}
