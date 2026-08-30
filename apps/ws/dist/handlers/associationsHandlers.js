import { AssociationsEngine } from '../games/associations/AssociationsEngine.js';
import { sanitizeRoom } from '../utils/sanitize.js';
export function registerAssociationsHandlers(io, socket, roomManager, gameManager = null) {
  socket.on('game:start', (arg0, arg1) => {
    const callback = typeof arg0 === 'function' ? arg0 : typeof arg1 === 'function' ? arg1 : undefined;
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || room.hostId !== socket.id || room.gameType !== 'associations') return;
    if (room.players.length < 3) {
      io.to(room.code).emit('room:error', 'Минимум 3 игрока для Ассоциаций');
      callback?.({ success: false, error: 'Минимум 3 игрока для Ассоциаций' });
      return;
    }
    const players = room.players.filter((p) => !p.isSpectator).map((p) => ({ id: p.id, name: p.name }));
    const settings = room.settings ?? {};
    const engine = new AssociationsEngine(players, settings);
    roomManager.setGameEngine(room.code, engine);
    engine.on('words:collected', (total) => {
      io.to(room.code).emit('associations:words-collected', { total });
    });
    engine.on('chain:started', (data) => {
      io.to(room.code).emit('associations:chain-started', data);
    });
    engine.on('turn:started', (data) => {
      io.to(room.code).emit('associations:turn-started', data);
    });
    engine.on('word:rejected', (data) => {
      io.to(socket.id).emit('room:error', data.reason);
    });
    engine.on('link:added', (link) => {
      io.to(room.code).emit('associations:link-added', link);
    });
    engine.on('voting:started', (data) => {
      io.to(room.code).emit('associations:voting-started', data);
    });
    engine.on('voting:ended', (data) => {
      io.to(room.code).emit('associations:voting-ended', data);
    });
    engine.on('bonus:awarded', (data) => {
      io.to(room.code).emit('associations:bonus', data);
    });
    engine.on('chain:broken', (data) => {
      io.to(room.code).emit('associations:chain-broken', data);
    });
    engine.on('game:ended', (data) => {
      io.to(room.code).emit('game:ended', { ...data, gameType: 'associations' });
      room.status = 'waiting';
      room.updatedAt = new Date();
      roomManager.clearGameEngine(room.code);
      io.to(room.code).emit('room:updated', sanitizeRoom(room));
    });
    io.to(room.code).emit('game:started', { phase: 'adding-words', gameType: 'associations' });
    room.status = 'playing';
    room.updatedAt = new Date();
    io.to(room.code).emit('room:updated', sanitizeRoom(room));
    callback?.({ success: true });
  });
  socket.on('game:action', (action) => {
    if (gameManager?.handleAction?.(socket, action)) return;
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || room.gameType !== 'associations') return;
    const engine = roomManager.getGameEngine(room.code);
    if (!engine || !(engine instanceof AssociationsEngine)) return;
    if (action.type === 'add-words' && Array.isArray(action.words)) {
      engine.addWords(socket.id, action.words);
      return;
    }
    if (action.type === 'submit-association' && typeof action.word === 'string') {
      engine.submitAssociation(socket.id, action.word);
      return;
    }
    if (action.type === 'vote' && typeof action.vote === 'boolean') {
      engine.vote(socket.id, action.vote);
      return;
    }
  });
}
