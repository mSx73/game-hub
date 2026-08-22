import { createGameEngine } from '../GameFactory.js';
import { HatEngine } from '../games/hat/HatEngine.js';
import { sanitizeText, checkRateLimit } from '../utils/sanitize.js';
import { parseQuizTxt, sanitizeNonMafiaSettingsForClients } from '../utils/quizPackParser.js';

function toPublicRoom(room, viewerSocketId = null) {
  const isHost = viewerSocketId && room.hostId === viewerSocketId;
  return {
    code: room.code,
    gameType: room.gameType,
    title: room.title,
    status: room.status,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    hasPassword: !!room.password,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    settings: room.gameType === 'mafia' ? {
      targetPlayerCount: room.settings?.targetPlayerCount,
      timers: room.settings?.timers,
      options: {
        aiGameMaster: room.settings?.options?.aiGameMaster,
        isAlone: room.settings?.options?.isAlone,
        classicMode: room.settings?.options?.classicMode,
      },
    } : sanitizeNonMafiaSettingsForClients(room.settings || {}),
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isOnline: p.isOnline,
      isHost: p.isHost,
      isSpectator: p.isSpectator,
      isBot: !!p.isBot,
      role: isHost ? p.role : undefined,
    })),
    spectators: (room.spectators || []).map((s) => ({
      id: s.id, name: s.name, isOnline: s.isOnline,
    })),
  };
}

export function registerRoomHandlers(io, socket, roomManager) {
  const ensurePoisonedSpeakerTimer = (room) => {
    if (!room || room.gameType !== 'mafia' || !room.speakingNow) return;
    const engine = roomManager.getGameEngine(room.code);
    const state = engine?.getState?.();
    const speaker = state?.players?.find((p) => p.id === room.speakingNow);
    if (!speaker || speaker.status !== 'poisoned') return;

    if (room.poisonSpeakerTimeout) clearTimeout(room.poisonSpeakerTimeout);
    room.poisonSpeakerTimeout = setTimeout(() => {
      const liveState = engine?.getState?.();
      const liveSpeaker = liveState?.players?.find((p) => p.id === room.speakingNow);
      if (!liveSpeaker || liveSpeaker.status !== 'poisoned') return;
      liveSpeaker.status = 'dead';
      liveSpeaker.deathCause = 'poison';
      room.speakingQueue = room.speakingQueue.filter((id) => id !== liveSpeaker.id);
      room.raisedHands = room.raisedHands.filter((id) => id !== liveSpeaker.id);
      if (room.speakingNow === liveSpeaker.id) room.speakingNow = null;
      if (!room.mutedPlayers.includes(liveSpeaker.id)) room.mutedPlayers.push(liveSpeaker.id);
      io.to(room.code).emit('game:player-killed', liveSpeaker.id, 'poison', {
        player: { name: liveSpeaker.name, role: liveSpeaker.role },
      });
    }, 5000);
  };

  socket.on('game:start', (arg0, arg1) => {
    const callback = typeof arg0 === 'function' ? arg0 : typeof arg1 === 'function' ? arg1 : undefined;
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || room.hostId !== socket.id) {
        return callback?.({ success: false, error: 'Только хост может начать игру' });
      }
      const delegated = ['mafia', 'associations', 'crocodile', 'crocodile-verbs', 'crocodile-nouns', 'sketch', 'alias', 'spy', 'quiz', 'meme', 'wordbomb', 'debate', 'truths', 'story', 'emoji', 'whoami', 'fakeartist', 'lastword', 'auction', 'wavelength', 'ranking', 'chameleon', 'timeline', 'categories', 'rhyme', 'priceisright', 'wouldyourather', 'bluff', 'escalation', 'memory', 'hotpotato', 'fibbing', 'prediction', 'connect', 'crossword', 'anagrams', 'wordchain', 'facts', 'sequence', 'bombparty', 'psych', 'judge', 'trust', 'impostor', 'caption', 'emojiart', 'flags', 'logos', 'maps', 'quotes', 'collage'];
      if (delegated.includes(room.gameType)) return;

      const engine = createGameEngine(room, io, roomManager);
      if (!engine) return;
      if (engine.start) engine.start();
      
      room.status = 'playing';
      io.to(room.code).emit('game:started', { gameType: room.gameType });
      io.to(room.code).emit('room:updated', toPublicRoom(room));
      callback?.({ success: true });
    } catch (err) {
      console.error('[GameStart Error]', err);
      callback?.({ success: false, error: err.message });
    }
  });

    socket.on('room:create', (data, callback) => {
        try {
      const settings = data.settings ?? {};
      const room = roomManager.createRoom(socket.id, data.playerName, data.gameType, settings, {
        title: data.title,
        password: data.password,
      });
            socket.join(room.code);
            socket.data.roomCode = room.code;
            socket.data.playerName = data.playerName;
      
      // NEW: Handle "I'm alone" mode - auto-fill with bots
      // Backward/forward compatibility:
      // - old payload: settings.isAlone
      // - current payload from web lobby: settings.options.isAlone
      const isAloneMode = !!(settings.isAlone ?? settings.options?.isAlone);
      if (isAloneMode && room.gameType === 'mafia') {
        const targetCount = settings.targetPlayerCount || 6;
        const target = Math.min(room.maxPlayers, Math.max(4, parseInt(targetCount, 10) || 6));
        roomManager.setBots(room.code, target);
      }
      
      if (room.gameType === 'mafia' && settings.targetPlayerCount && !settings.isAlone) {
        const target = Math.min(room.maxPlayers, Math.max(4, parseInt(settings.targetPlayerCount, 10) || 4));
        roomManager.setBots(room.code, target);
      }
      callback({ success: true, room: toPublicRoom(room, socket.id) });
      io.to(room.code).emit('room:updated', toPublicRoom(room));
    } catch (err) {
            callback({ success: false, error: err.message });
        }
    });
  socket.on('room:list', (callback) => {
    callback?.({ success: true, rooms: roomManager.listPublicRooms() });
  });
    socket.on('room:join', (data, callback) => {
        try {
      const result = roomManager.joinRoom(
        socket.id,
        data.playerName,
        data.code,
        data.asSpectator ?? false,
        data.password ?? ''
      );
            if (!result.success) {
                callback({ success: false, error: result.error });
                return;
            }
            socket.join(result.room.code);
            socket.data.roomCode = result.room.code;
            socket.data.playerName = data.playerName;
      callback({ success: true, room: toPublicRoom(result.room, socket.id) });
      io.to(result.room.code).emit('room:updated', toPublicRoom(result.room));
      const joinedPlayer = [...result.room.players, ...result.room.spectators].find((p) => p.id === socket.id);
      if (joinedPlayer) io.to(result.room.code).emit('room:player-joined', joinedPlayer);
    } catch (err) {
            callback({ success: false, error: err.message });
        }
    });
    socket.on('room:leave', () => {
        const code = socket.data.roomCode;
    if (!code) return;
        const room = roomManager.leaveRoom(socket.id);
        socket.leave(code);
        socket.data.roomCode = undefined;
        if (room) {
      io.to(code).emit('room:updated', toPublicRoom(room));
            io.to(code).emit('room:player-left', socket.id);
        }
    });
    socket.on('room:kick-player', (playerId) => {
        const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || room.hostId !== socket.id) return;
        const room2 = roomManager.leaveRoom(playerId);
        if (room2) {
      io.to(room.code).emit('room:updated', toPublicRoom(room2));
            io.to(room.code).emit('room:player-left', playerId);
            io.to(playerId).emit('room:error', 'Вас исключили из комнаты');
            io.sockets.sockets.get(playerId)?.leave(room.code);
        }
    });
    socket.on('room:update-settings', (settings) => {
        const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || room.hostId !== socket.id) return;
    const prevOptions = room.settings?.options || {};
    const incoming = { ...(settings || {}) };
    delete incoming.quizCustomQuestions;
    delete incoming.quizCustomQuestionCount;
    room.settings = { ...room.settings, ...incoming };
    if (room.gameType === 'mafia' && settings.options) {
      room.settings.options = { ...prevOptions, ...settings.options };
    }
    if (room.gameType === 'mafia' && settings.targetPlayerCount != null) {
      const target = Math.min(room.maxPlayers, Math.max(4, parseInt(settings.targetPlayerCount, 10) || 4));
      roomManager.setBots(room.code, target);
    }
    room.updatedAt = new Date();
    io.to(room.code).emit('room:updated', toPublicRoom(room));
  });

  const QUIZ_TXT_MAX_BYTES = 10 * 1024 * 1024;
  const QUIZ_MAX_QUESTIONS = 2000;

  socket.on('room:quiz-upload', (payload, callback) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || room.hostId !== socket.id) {
        return callback?.({ success: false, error: 'Только хост может загрузить вопросы' });
      }
      if (room.gameType !== 'quiz') {
        return callback?.({ success: false, error: 'Доступно только в режиме «Квиз»' });
      }
      if (room.status !== 'waiting') {
        return callback?.({ success: false, error: 'Загрузка только до начала игры' });
      }
      const text = typeof payload?.text === 'string' ? payload.text : '';
      if (Buffer.byteLength(text, 'utf8') > QUIZ_TXT_MAX_BYTES) {
        return callback?.({ success: false, error: 'Текст больше 10 МБ' });
      }
      const parsed = parseQuizTxt(text);
      if (parsed.length === 0) {
        return callback?.({
          success: false,
          error: 'Нет валидных вопросов. Формат: блоки через ---, 6 строк — вопрос, 4 варианта, correct:0..3',
        });
      }
      if (parsed.length > QUIZ_MAX_QUESTIONS) {
        return callback?.({ success: false, error: `Слишком много вопросов (максимум ${QUIZ_MAX_QUESTIONS})` });
      }
      room.settings = { ...(room.settings || {}), quizCustomQuestions: parsed };
      room.updatedAt = new Date();
      io.to(room.code).emit('room:updated', toPublicRoom(room));
      callback?.({ success: true, count: parsed.length });
    } catch (e) {
      callback?.({ success: false, error: e?.message || 'Ошибка разбора файла' });
    }
  });

  socket.on('room:quiz-clear-custom', (_payload, callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || room.hostId !== socket.id) {
      return callback?.({ success: false, error: 'Только хост' });
    }
    if (room.gameType !== 'quiz') return callback?.({ success: false, error: 'Только квиз' });
    if (room.status !== 'waiting') return callback?.({ success: false, error: 'Только до старта игры' });
    room.settings = { ...(room.settings || {}) };
    delete room.settings.quizCustomQuestions;
    room.updatedAt = new Date();
    io.to(room.code).emit('room:updated', toPublicRoom(room));
    callback?.({ success: true });
  });

  socket.on('room:change-nickname', (newName, callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room) return callback?.({ success: false, error: 'Вы не в комнате' });
    const name = String(newName || '').slice(0, 20);
    if (name.length < 2) return callback?.({ success: false, error: 'Ник должен быть 2-20 символов' });
    const player = [...room.players, ...room.spectators].find((p) => p.id === socket.id);
    if (!player) return callback?.({ success: false, error: 'Игрок не найден' });
    player.name = name;
    socket.data.playerName = name;
        room.updatedAt = new Date();
    io.to(room.code).emit('room:updated', toPublicRoom(room));
    callback?.({ success: true, name });
  });
  /** Досрочное завершение игры хостом (все типы кроме мафии — у мафии своя панель). */
  socket.on('host:end-game', (callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || room.hostId !== socket.id) {
      return callback?.({ success: false, error: 'Только хост может завершить игру' });
    }
    if (room.gameType === 'mafia') {
      return callback?.({ success: false, error: 'Для мафии используйте панель ведущего' });
    }
    if (room.status !== 'playing') {
      return callback?.({ success: false, error: 'Сейчас нет активной игры' });
    }
    roomManager.clearGameEngine(room.code);
    room.status = 'waiting';
    room.updatedAt = new Date();
    io.to(room.code).emit('game:ended', { abortedByHost: true });
    io.to(room.code).emit('room:updated', toPublicRoom(room));
    callback?.({ success: true });
  });

  socket.on('game:action', (action, callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || room.status !== 'playing') return;

    const engine = roomManager.getGameEngine(room.code);
    if (!engine) return;

    // Dedicated handlers process mafia/associations. Here we handle Hat actions.
    if (room.gameType === 'hat' && engine instanceof HatEngine) {
      if (action?.type === 'add-words' && Array.isArray(action.words)) {
        const result = engine.addWords(socket.id, action.words);
        const ok = result && typeof result === 'object' && result.ok === true;
        callback?.({
          success: ok,
          error: ok ? undefined : (typeof result === 'object' && result?.error) || 'Не удалось добавить слова',
        });
        return;
      }
      if (action?.type === 'skip-word') {
        const isExplainer = engine.getState()?.currentExplainer === socket.id;
        if (!isExplainer) return callback?.({ success: false, error: 'Слово может пропустить только объясняющий' });
        engine.skipWord();
        callback?.({ success: true });
        return;
      }
      if (action?.type === 'hat:confirm-guess' && typeof action.guesserId === 'string') {
        const res = engine.confirmManualGuess(socket.id, action.guesserId);
        callback?.({ success: !!res.ok, error: res.ok ? undefined : res.error });
        return;
      }
    }
  });

  socket.on('room:set-bots', (data, callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || room.hostId !== socket.id || room.gameType !== 'mafia')
      return callback?.({ success: false, error: 'Недоступно' });
    const targetTotal = Math.min(room.maxPlayers, Math.max(4, parseInt(data?.targetTotal, 10) || 4));
    const ok = roomManager.setBots(room.code, targetTotal);
    if (ok) {
      io.to(room.code).emit('room:updated', toPublicRoom(room));
      callback?.({ success: true, room: toPublicRoom(room, socket.id) });
    } else {
      callback?.({ success: false, error: 'Не удалось изменить ботов' });
    }
    });
    socket.on('room:toggle-spectator', () => {
        const room = roomManager.getRoomByPlayer(socket.id);
    if (!room) return;
        const player = [...room.players, ...room.spectators].find((p) => p.id === socket.id);
    if (!player) return;
        if (player.isSpectator) {
      if (room.players.length >= room.maxPlayers) return;
            room.spectators = room.spectators.filter((p) => p.id !== socket.id);
            room.players.push(player);
            player.isSpectator = false;
    } else {
            room.players = room.players.filter((p) => p.id !== socket.id);
            room.spectators.push(player);
            player.isSpectator = true;
        }
        room.updatedAt = new Date();
    io.to(room.code).emit('room:updated', toPublicRoom(room));
    });
}
