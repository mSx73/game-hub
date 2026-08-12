/**
 * Resync game state to a reconnecting player (Sprint N).
 */
import { MAFIA_SOCKET_EVENTS } from '@playforfun/shared-types';

const DRAW_GAMES = ['crocodile', 'crocodile-verbs', 'crocodile-nouns', 'sketch'];

export function resyncGameState(io, roomManager, room, socketId) {
  if (!room || room.status !== 'playing') return;
  const engine = roomManager.getGameEngine(room.code);
  if (!engine) return;

  if (room.gameType === 'mafia' && typeof engine.getPlayerState === 'function') {
    const aiGameMaster = room.settings?.options?.aiGameMaster ?? false;
    const personalState = engine.getPlayerState(socketId, room.hostId, aiGameMaster);
    if (personalState) {
      io.to(socketId).emit(MAFIA_SOCKET_EVENTS.SNAPSHOT, personalState);
      io.to(socketId).emit(MAFIA_SOCKET_EVENTS.STATE_UPDATE, personalState);
    }
    return;
  }

  if (room.gameType === 'mafia2' && typeof engine.getPlayerState === 'function') {
    const state = engine.getPlayerState(socketId);
    if (state) io.to(socketId).emit('mafia:state', state);
    return;
  }

  if (room.gameType === 'bunker' && typeof engine.getPlayerState === 'function') {
    const state = engine.getPlayerState(socketId);
    if (state) io.to(socketId).emit('bunker:state', state);
    return;
  }

  if (room.gameType === 'melody' && typeof engine.getPlayerState === 'function') {
    const state = engine.getPlayerState(socketId);
    if (state) io.to(socketId).emit('melody:state', state);
    return;
  }

  if (DRAW_GAMES.includes(room.gameType) && typeof engine.getState === 'function') {
    const state = engine.getState();
    const evPrefix = room.gameType === 'sketch' ? 'sketch' : 'crocodile';
    const explainer = state.players?.[state.currentPlayerIndex];
    const currentWord = typeof engine.currentWord === 'string' ? engine.currentWord : '';
    const wordLength = currentWord.replace(/ /g, '').length;
    const wordPattern = currentWord ? currentWord.replace(/[^ ]/g, '_') : '';
    io.to(socketId).emit(`${evPrefix}:sync-state`, {
      phase: state.phase,
      turn: explainer
        ? {
            explainerId: explainer.id,
            explainerName: explainer.name,
            timeLeft: state.timeLeft ?? engine.timeLeft ?? 0,
            round: state.round ?? engine.round,
            maxRounds: state.maxRounds ?? engine.maxRounds,
            // Подсказка угадывающим (без самого слова)
            wordLength,
            wordPattern,
            // Само слово только рисующему — остальные видят маску
            ...(explainer.id === socketId && currentWord ? { word: currentWord } : currentWord ? { word: wordPattern } : {}),
          }
        : null,
      scores: (state.players || []).map((p) => ({ id: p.id, name: p.name, score: p.score ?? 0 })),
      timeLeft: state.timeLeft ?? engine.timeLeft ?? 0,
    });
    if (explainer?.id === socketId && engine.currentWord) {
      io.to(socketId).emit(`${evPrefix}:your-word`, { word: engine.currentWord });
    }
    if (explainer?.id === socketId && Array.isArray(engine.wordChoices) && engine.wordChoices.length > 0 && !engine.currentWord) {
      io.to(socketId).emit(`${evPrefix}:word-choices`, {
        choices: engine.wordChoices,
        timeLeft: engine.selectionTimeoutSec ?? 15,
        selectionTimeoutSec: engine.selectionTimeoutSec ?? 15,
      });
    }
    io.to(socketId).emit(`${evPrefix}:timer`, state.timeLeft ?? engine.timeLeft ?? 0);
    if (typeof engine.getState === 'function') {
      const scores = (state.players || []).map((p) => ({ id: p.id, name: p.name, score: p.score ?? 0 }));
      io.to(socketId).emit(`${evPrefix}:score`, { players: scores });
    }
    return;
  }

  if (typeof engine.getState === 'function') {
    io.to(socketId).emit('game:state-sync', engine.getState());
  }
}
