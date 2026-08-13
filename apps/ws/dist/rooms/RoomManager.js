import { randomBytes } from 'crypto';
import { remapPlayerIdDeep } from '../core/remapPlayerId.js';

export class RoomManager {
  constructor(redis) {
    this.redis = redis;
    this.rooms = new Map();
    this.playerToRoom = new Map();
    this.gameEngines = new Map();
  }
  generateCode() {
    return randomBytes(3).toString('hex').toUpperCase();
  }
  createRoom(hostSocketId, hostName, gameType, settings, options = {}) {
    hostName = String(hostName ?? 'Игрок');
    const maxForGame = this.getMaxPlayers(gameType);
    const requestedMax = settings?.maxPlayers != null ? parseInt(settings.maxPlayers, 10) : null;
    if (requestedMax != null && !isNaN(requestedMax) && requestedMax > maxForGame) {
      throw new Error(`maxPlayers не может превышать ${maxForGame} для игры ${gameType}`);
    }
    const code = this.generateCode();
    const host = {
      id: hostSocketId,
      name: hostName.slice(0, 20),
      isOnline: true,
      joinedAt: new Date(),
      lastActivity: new Date(),
      connectionStatus: 'online',
      status: 'alive',
      isHost: true,
      isSpectator: false,
      votesReceived: 0,
      hasVoted: false,
    };
    const room = {
      code,
      gameType,
      title: String(options.title || '').slice(0, 64) || `Комната ${code}`,
      password: options.password ? String(options.password).slice(0, 64) : null,
      status: 'waiting',
      createdAt: new Date(),
      updatedAt: new Date(),
      hostId: hostSocketId,
      players: [host],
      spectators: [],
      maxPlayers: requestedMax != null && !isNaN(requestedMax) ? Math.min(maxForGame, Math.max(2, requestedMax)) : maxForGame,
      settings,
      chatHistory: [],
      speakingQueue: [],
      speakingNow: null,
      raisedHands: [],
      mutedPlayers: [],
    };
    this.rooms.set(code, room);
    this.playerToRoom.set(hostSocketId, code);
    this.persistRoomInternal(code);
    return room;
  }
  joinRoom(socketId, playerName, code, asSpectator = false, password = '') {
    if (!code || typeof code !== 'string') return { success: false, error: 'Код комнаты не указан' };
    const roomCode = code.toUpperCase();
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: 'Комната не найдена' };
    if (room.status === 'finished') return { success: false, error: 'Игра завершена' };
    if (room.password && room.password !== String(password || '')) {
      return { success: false, error: 'Неверный пароль комнаты' };
    }

    const safeName = String(playerName || '').slice(0, 20);

    // Повторный room:join тем же сокетом не должен дублировать игрока.
    const existingById = [...room.players, ...room.spectators].find((p) => p.id === socketId);
    if (existingById) {
      existingById.isOnline = true;
      existingById.connectionStatus = 'online';
      existingById.lastActivity = new Date();
      existingById.isSpectator = !!asSpectator;
      if (asSpectator) {
        room.players = room.players.filter((p) => p.id !== socketId);
        if (!room.spectators.find((p) => p.id === socketId)) room.spectators.push(existingById);
      } else {
        room.spectators = room.spectators.filter((p) => p.id !== socketId);
        if (!room.players.find((p) => p.id === socketId)) room.players.push(existingById);
      }
      this.playerToRoom.set(socketId, roomCode);
      room.updatedAt = new Date();
      this.persistRoomInternal(roomCode);
      return { success: true, room };
    }

    // Переподключение по имени — до проверки «игра уже началась», иначе рефреш блокирует rejoin.
    const reconnectByName = [...room.players, ...room.spectators]
      .filter((p) => p.name === safeName && !p.isOnline)
      .sort((a, b) => (b.lastActivity?.getTime() ?? 0) - (a.lastActivity?.getTime() ?? 0))[0];
    if (reconnectByName) {
      const oldId = reconnectByName.id;
      reconnectByName.id = socketId;
      reconnectByName.isOnline = true;
      reconnectByName.lastActivity = new Date();
      reconnectByName.connectionStatus = 'online';
      if (room.hostId === oldId) {
        room.hostId = socketId;
        reconnectByName.isHost = true;
      }
      if (asSpectator !== reconnectByName.isSpectator) {
        if (asSpectator) {
          room.players = room.players.filter((p) => p.id !== socketId);
          room.spectators.push(reconnectByName);
        } else {
          room.spectators = room.spectators.filter((p) => p.id !== socketId);
          room.players.push(reconnectByName);
        }
        reconnectByName.isSpectator = asSpectator;
      }
      this.playerToRoom.delete(oldId);
      this.playerToRoom.set(socketId, roomCode);
      if (Array.isArray(room.mutedPlayers)) {
        room.mutedPlayers = room.mutedPlayers.map((id) => (id === oldId ? socketId : id));
      }
      room.updatedAt = new Date();
      this.persistRoomInternal(roomCode);
      const gameEngine = this.getGameEngine(roomCode);
      if (gameEngine && oldId !== socketId) {
        if (typeof gameEngine.remapPlayerId === 'function') {
          gameEngine.remapPlayerId(oldId, socketId);
        } else {
          remapPlayerIdDeep(gameEngine, oldId, socketId);
        }
      }
      return { success: true, room, reconnected: true, oldPlayerId: oldId };
    }

    if (room.status !== 'waiting' && !asSpectator) return { success: false, error: 'Игра уже началась' };

    if (!asSpectator && room.players.length >= room.maxPlayers) {
      return { success: false, error: 'Комната заполнена' };
    }

    const player = {
      id: socketId,
      name: safeName,
      isOnline: true,
      joinedAt: new Date(),
      lastActivity: new Date(),
      connectionStatus: 'online',
      status: 'alive',
      isHost: false,
      isSpectator: asSpectator,
      votesReceived: 0,
      hasVoted: false,
    };
    if (asSpectator) room.spectators.push(player);
    else room.players.push(player);

    this.playerToRoom.set(socketId, roomCode);
    room.updatedAt = new Date();
    this.persistRoomInternal(roomCode);
    return { success: true, room };
  }
  leaveRoom(socketId) {
    const code = this.playerToRoom.get(socketId);
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room) return null;
    room.players = room.players.filter((p) => p.id !== socketId);
    room.spectators = room.spectators.filter((p) => p.id !== socketId);
    // Если остались только боты — закрываем комнату
    const humansLeft = [...room.players, ...room.spectators].filter((p) => !p.isBot).length;
    if (humansLeft === 0) {
      this.closeRoom(code);
      return null;
    }
    if (room.hostId === socketId) {
      const newHost = room.players.find((p) => !p.isSpectator && !p.isBot) ?? room.spectators.find((p) => !p.isBot) ?? room.players.find((p) => !p.isSpectator) ?? room.spectators[0];
      if (newHost) {
        room.hostId = newHost.id;
        newHost.isHost = true;
      } else {
        this.closeRoom(code);
        return null;
      }
    }
    this.playerToRoom.delete(socketId);
    room.updatedAt = new Date();
    this.persistRoomInternal(code);
    return room;
  }
  handleDisconnect(socketId) {
    const code = this.playerToRoom.get(socketId);
    if (!code) return;
    const room = this.rooms.get(code);
    if (!room) return;
    const player = [...room.players, ...room.spectators].find((p) => p.id === socketId);
    if (player) {
      player.isOnline = false;
      player.connectionStatus = 'offline';
      if (room.status !== 'playing') player.status = 'disconnected';

      const gameEngine = this.getGameEngine(code);
      if (gameEngine) {
        if (typeof gameEngine.onConnectionChange === 'function') {
          gameEngine.onConnectionChange(socketId, false);
        } else if (typeof gameEngine.handlePlayerDisconnect === 'function') {
          gameEngine.handlePlayerDisconnect(socketId);
        }
      }

      // Если остались только боты — сразу закрываем комнату
      const humansOnline = [...room.players, ...room.spectators].filter((p) => !p.isBot && p.isOnline).length;
      if (humansOnline === 0) {
        this.closeRoom(code);
        return;
      }

      if (player.disconnectTimeout) clearTimeout(player.disconnectTimeout);
      player.disconnectTimeout = setTimeout(() => {
        player.disconnectTimeout = null;
        const currentRoom = this.rooms.get(code);
        if (!currentRoom) return;
        const stillDisconnected = [...currentRoom.players, ...currentRoom.spectators].find(
          (p) => p.id === socketId && !p.isOnline
        );
        if (stillDisconnected) {
          if (currentRoom.status === 'waiting') {
            this.leaveRoom(socketId);
          } else {
            const currentEngine = this.getGameEngine(code);
            if (currentEngine) {
              if (typeof currentEngine.onPlayerTimeout === 'function') {
                stillDisconnected.gameStatus = 'dead';
                currentEngine.onPlayerTimeout(socketId);
              } else if (typeof currentEngine.handlePlayerTimeout === 'function') {
                currentEngine.handlePlayerTimeout(socketId);
              }
            }
          }
        }
      }, 120000);
    }
  }
  closeRoom(code) {
    const upper = String(code || '').toUpperCase();
    const room = this.rooms.get(upper);
    if (!room) return;
    for (const p of [...room.players, ...room.spectators]) {
      if (p.disconnectTimeout) {
        clearTimeout(p.disconnectTimeout);
        p.disconnectTimeout = null;
      }
    }
    this.clearGameEngine(upper);
    this.rooms.delete(upper);
    for (const [pid, rcode] of this.playerToRoom.entries()) {
      if (String(rcode || '').toUpperCase() === upper) this.playerToRoom.delete(pid);
    }
    this.redis?.del(`room:${upper}`);
  }

  handleReconnect(socketId) {
    const code = this.playerToRoom.get(socketId);
    if (!code) return;
    const room = this.rooms.get(code);
    if (!room) return;

    const player = [...room.players, ...room.spectators].find((p) => p.id === socketId);
    if (player) {
      player.isOnline = true;
      player.connectionStatus = 'online';
      if (player.disconnectTimeout) {
        clearTimeout(player.disconnectTimeout);
        player.disconnectTimeout = null;
      }

      const gameEngine = this.getGameEngine(code);
      if (gameEngine) {
        if (typeof gameEngine.onConnectionChange === 'function') {
          gameEngine.onConnectionChange(socketId, true);
        } else if (typeof gameEngine.handlePlayerReconnect === 'function') {
          gameEngine.handlePlayerReconnect(socketId);
        }
      }
    }
  }
  getRoom(code) {
    return this.rooms.get(code.toUpperCase());
  }
  getRoomByPlayer(socketId) {
    const code = this.playerToRoom.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }
  getRoomBySocketId(socketId) {
    return this.getRoomByPlayer(socketId);
  }
  listPublicRooms() {
    return [...this.rooms.values()]
      .filter((room) => room.status === 'waiting')
      .map((room) => ({
        code: room.code,
        title: room.title,
        gameType: room.gameType,
        hasPassword: !!room.password,
        players: room.players.length,
        maxPlayers: room.maxPlayers,
        createdAt: room.createdAt,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 100);
  }
  setGameEngine(code, engine) {
    this.gameEngines.set(code, engine);
  }
  getGameEngine(code) {
    return this.gameEngines.get(code);
  }
  persistRoom(code) {
    return this.persistRoomInternal(code);
  }
  getMaxPlayers(gameType) {
    const limits = {
      mafia: 20,
      crocodile: 16,
      'crocodile-verbs': 16,
      'crocodile-nouns': 16,
      hat: 20,
      associations: 16,
      monopoly: 8,
      kowall: 8,
      'truth-or-dare': 20,
      alias: 12, spy: 12, quiz: 20, meme: 16, wordbomb: 12,
      debate: 16, truths: 12, story: 10, emoji: 16, whoami: 10,
      fakeartist: 10, lastword: 12, auction: 16, wavelength: 12,
      ranking: 12, chameleon: 10, timeline: 16, categories: 12,
      rhyme: 12, priceisright: 16, wouldyourather: 20, bluff: 10,
      escalation: 10, memory: 12, hotpotato: 10, fibbing: 10,
      prediction: 16, connect: 12, crossword: 6, anagrams: 8,
      wordchain: 12, facts: 12, sequence: 8, bombparty: 12,
      psych: 12, judge: 10, trust: 8, impostor: 12,
      caption: 12, emojiart: 10, flags: 20, logos: 12, maps: 8, quotes: 10,
    };
    return limits[gameType] ?? 20;
  }
  setBots(roomCode, targetTotal) {
    const room = this.rooms.get(roomCode?.toUpperCase());
    if (!room || room.gameType !== 'mafia' || room.status !== 'waiting') return false;
    const realPlayers = room.players.filter((p) => !p.isBot);
    const targetBots = Math.max(0, Math.min(room.maxPlayers - realPlayers.length, targetTotal - realPlayers.length));
    const currentBots = room.players.filter((p) => p.isBot);
    const BOT_NAMES = ['Алиса', 'Боб', 'Вика', 'Гриша', 'Дина', 'Егор', 'Женя', 'Зоя', 'Игорь', 'Катя', 'Лёша', 'Маша'];
    const getUniqueBotName = () => {
      const used = new Set(room.players.map((p) => p.name));
      for (let n = 0; n < 1000; n++) {
        const idx = n % BOT_NAMES.length;
        const suffix = n >= BOT_NAMES.length ? ` ${Math.floor(n / BOT_NAMES.length) + 1}` : '';
        const name = BOT_NAMES[idx] + suffix;
        if (!used.has(name)) return name;
      }
      return `Бот_${Date.now()}`;
    };
    while (room.players.filter((p) => p.isBot).length < targetBots) {
      room.players.push({
        id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: getUniqueBotName(),
        isBot: true,
        isOnline: true,
        joinedAt: new Date(),
        lastActivity: new Date(),
        connectionStatus: 'online',
        status: 'alive',
        isHost: false,
        isSpectator: false,
        votesReceived: 0,
        hasVoted: false,
      });
    }
    while (room.players.filter((p) => p.isBot).length > targetBots) {
      const botIdx = room.players.findIndex((p) => p.isBot);
      if (botIdx >= 0) room.players.splice(botIdx, 1);
    }
    room.updatedAt = new Date();
    this.persistRoomInternal(roomCode);
    return true;
  }
  /** Останавливает таймеры движка и снимает слушатели (досрочное завершение игры хостом). */
  clearGameEngine(code) {
    const upper = String(code || '').toUpperCase();
    const engine = this.gameEngines.get(upper);
    if (!engine) {
      this.gameEngines.delete(upper);
      return;
    }
    if (typeof engine.cleanup === 'function') {
      if (typeof engine.stopTimer === 'function') engine.stopTimer();
      engine.cleanup();
    } else {
      if (typeof engine.stopTimer === 'function') engine.stopTimer();
      if (typeof engine.removeAllListeners === 'function') engine.removeAllListeners();
    }
    this.gameEngines.delete(upper);
  }
  async persistRoomInternal(code) {
    const room = this.rooms.get(code);
    if (room && this.redis) {
      const serialized = JSON.stringify({
        ...room,
        createdAt: room.createdAt.toISOString(),
        updatedAt: room.updatedAt.toISOString(),
      });
      await this.redis.setex(`room:${code}`, 3600, serialized);
    }
  }
}
