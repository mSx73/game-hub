import { sanitizeNonMafiaSettingsForClients } from './quizPackParser.js';

export function sanitizeRoom(room, viewerSocketId = null) {
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
      timers: room.settings?.timers,
      options: { aiGameMaster: room.settings?.options?.aiGameMaster },
    } : sanitizeNonMafiaSettingsForClients(room.settings || {}),
    players: (room.players || []).map((p) => ({
      id: p.id,
      name: p.name,
      isOnline: p.isOnline,
      isHost: p.isHost,
      isSpectator: p.isSpectator,
      isBot: !!p.isBot,
      // Роли мафии только из персонального game:state-update, не из комнаты
      role: room.gameType === 'mafia' ? undefined : isHost ? p.role : undefined,
    })),
    spectators: (room.spectators || []).map((s) => ({
      id: s.id, name: s.name, isOnline: s.isOnline,
    })),
  };
}

export function sanitizeText(text, maxLength = 500) {
  return String(text || '').slice(0, maxLength)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const rateLimitMap = new Map();

export function checkRateLimit(socketId, action = 'default', maxPerSec = 5) {
  const key = `${socketId}:${action}`;
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];
  const recent = timestamps.filter((t) => now - t < 1000);
  if (recent.length >= maxPerSec) return false;
  recent.push(now);
  rateLimitMap.set(key, recent);
  if (rateLimitMap.size > 10000) {
    for (const [k, v] of rateLimitMap) {
      if (v.every((t) => now - t > 5000)) rateLimitMap.delete(k);
    }
  }
  return true;
}
