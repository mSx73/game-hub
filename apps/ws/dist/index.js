import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { logger } from './utils/monitoring.js';
import { RoomManager } from './rooms/RoomManager.js';
import { registerRoomHandlers } from './handlers/roomHandlers.js';
import { registerMafiaHandlers } from './handlers/mafiaHandlers.js';
import { registerAssociationsHandlers } from './handlers/associationsHandlers.js';
import { registerCrocodileHandlers } from './handlers/crocodileHandlers.js';
import { registerNewGamesHandler, NEW_GAME_TYPES } from './handlers/newGamesHandler.js';
import { GameManager } from './core/GameManager.js';
const setBotsRateLimit = new Map();
const corsOrigin = (() => {
  if (process.env.CORS_ORIGIN) return process.env.CORS_ORIGIN;
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) return '*';
  try {
    return new URL(frontendUrl).origin;
  } catch {
    return '*';
  }
})();
const httpServer = createServer(async (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'ws' }));
    return;
  }
  const setBotsMatch = req.url?.match(/^\/api\/set-bots\/([A-Za-z0-9]+)(?:\?|$)/);
  if (setBotsMatch && (req.method === 'GET' || req.method === 'POST')) {
    const [, code] = setBotsMatch;
    const key = `set-bots:${code}`;
    const now = Date.now();
    const last = setBotsRateLimit.get(key) ?? 0;
    if (now - last < 2000) {
      const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin };
      if (corsOrigin !== '*') headers.Vary = 'Origin';
      res.writeHead(429, headers);
      res.end(JSON.stringify({ success: false, error: 'Too many requests' }));
      return;
    }
    setBotsRateLimit.set(key, now);
    const adminToken = process.env.ADMIN_TOKEN;
    const providedToken = Array.isArray(req.headers['x-admin-token'])
      ? req.headers['x-admin-token'][0]
      : req.headers['x-admin-token'] || '';
    if (adminToken && providedToken !== adminToken) {
      const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin };
      if (corsOrigin !== '*') headers.Vary = 'Origin';
      res.writeHead(401, headers);
      res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
      return;
    }
    const q = req.url?.split('?')[1] || '';
    const total = new URLSearchParams(q).get('total') || '4';
    const target = Math.min(20, Math.max(4, parseInt(total, 10) || 4));
    const ok = roomManager.setBots(code.toUpperCase(), target);
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin };
    if (corsOrigin !== '*') headers.Vary = 'Origin';
    res.writeHead(200, headers);
    res.end(JSON.stringify({ success: ok }));
    return;
  }
});
const io = new Server(httpServer, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});
let redis = null;
if (process.env.REDIS_URL) {
  try {
    const pubClient = new Redis(process.env.REDIS_URL);
    const subClient = pubClient.duplicate();
    pubClient.on('error', (err) => logger.error('[Redis] pub error', err));
    subClient.on('error', (err) => logger.error('[Redis] sub error', err));
    const adapter = createAdapter(pubClient, subClient);
    adapter.on?.('error', (err) => logger.error('[Socket.io Adapter]', err));
    io.adapter(adapter);
    redis = pubClient;
    logger.info('[WS] Redis adapter connected');
  } catch (err) {
    logger.warn('[WS] Redis not available, using memory adapter', err);
  }
}
const roomManager = new RoomManager(redis);
const gameManager = new GameManager({
  io,
  roomManager,
  newGameTypes: new Set([...NEW_GAME_TYPES, 'mafia', 'associations']),
});

// Hat теперь работает через HatEngine (GameFactory + game:action) — устаревший HatGame удалён.

io.on('connection', (socket) => {
  logger.info('[WS] Client connected', { socketId: socket.id });
  roomManager.handleReconnect(socket.id);

  registerRoomHandlers(io, socket, roomManager);
  registerMafiaHandlers(io, socket, roomManager, null, gameManager);
  registerAssociationsHandlers(io, socket, roomManager, gameManager);
  registerCrocodileHandlers(io, socket, roomManager);
  registerNewGamesHandler(io, socket, roomManager, gameManager);

  socket.on('disconnect', () => {
    logger.info('[WS] Client disconnected', { socketId: socket.id });
    roomManager.handleDisconnect(socket.id);
  });
});
const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  logger.info('[WS] Listening on port', { port: PORT });
});
