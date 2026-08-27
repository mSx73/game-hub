import { MafiaGameEngine } from './games/mafia/MafiaGameEngine.js';
import { HatEngine } from './games/hat/HatEngine.js';
import { AssociationsEngine } from './games/associations/AssociationsEngine.js';
import { CrocodileEngine } from './games/crocodile/CrocodileEngine.js';
import { sanitizeRoom } from './utils/sanitize.js';
import { AIGameMaster } from './games/mafia/AIGameMaster.js';
import { GameEventLogger } from './games/mafia/GameEventLogger.js';

// Игры из этого списка создаются через newGamesHandler/ENGINE_MAP, не здесь.
const DELEGATED_GAME_TYPES = new Set([
  'mafia', 'associations', 'crocodile', 'crocodile-verbs', 'crocodile-nouns', 'alias', 'spy', 'quiz', 'meme', 'wordbomb',
  'debate', 'truths', 'story', 'emoji', 'whoami', 'fakeartist', 'lastword', 'auction',
  'wavelength', 'ranking', 'chameleon', 'timeline', 'categories', 'rhyme',
  'priceisright', 'wouldyourather', 'bluff', 'escalation', 'memory', 'hotpotato',
  'fibbing', 'prediction',   'connect', 'crossword', 'anagrams', 'wordchain', 'facts', 'sequence', 'bombparty',
  'psych', 'judge', 'trust', 'impostor', 'caption', 'emojiart', 'flags', 'logos', 'maps', 'quotes', 'collage',
]);

export function createGameEngine(room, io, roomManager) {
  const { gameType, code } = room;
  if (DELEGATED_GAME_TYPES.has(gameType)) {
    return null;
  }
  let engine;
  try {
    switch (gameType) {
      case 'mafia':
        engine = new MafiaGameEngine(room);
        new GameEventLogger(engine);
        if (room.settings?.options?.aiGameMaster) {
          new AIGameMaster(engine);
        }
        setupMafiaListeners(engine, io, code);
        break;
      case 'hat':
        engine = new HatEngine(room);
        setupHatListeners(engine, io, code, roomManager);
        break;
      case 'associations':
        const players = room.players.filter(p => !p.isSpectator).map(p => ({ id: p.id, name: p.name }));
        engine = new AssociationsEngine(players, room.settings ?? {});
        setupAssociationsListeners(engine, io, code);
        break;
      case 'crocodile':
        engine = new CrocodileEngine(room);
        setupCrocodileListeners(engine, io, code);
        break;
      default:
        throw new Error(`Unknown game type: ${gameType}`);
    }
  } catch (err) {
    if (io) io.to(code).emit('room:error', err.message ?? 'Ошибка создания игры');
    throw err;
  }

  roomManager.setGameEngine(code, engine);
  return engine;
}

function setupMafiaListeners(engine, io, code) {
  engine.on('game:started', (state) => io.to(code).emit('game:started', state));
  engine.on('game:phase-changed', (phase, timer) => io.to(code).emit('game:phase-changed', phase, timer));
  engine.on('game:action-result', (data) => {
    if (data.playerId) io.to(data.playerId).emit('game:action-result', data);
    else io.to(code).emit('game:action-result', data);
  });
  engine.on('game:ended', (winner, stats) => io.to(code).emit('game:ended', { winner, stats }));
  engine.on('ai:speak', (text) => io.to(code).emit('ai:speak', text));
}

function setupHatListeners(engine, io, code, roomManager) {
  engine.on('phase:changed', (data) => io.to(code).emit('hat:phaseChanged', data));
  engine.on('words:added', (data) => io.to(code).emit('hat:wordsAdded', data));
  engine.on('words:complete', (total) => io.to(code).emit('hat:wordsComplete', { total }));
  engine.on('round:started', (data) => {
    const explainerSocketId = data?.explainer;
    const { word: _secretWord, ...publicRound } = data;
    io.to(code).emit('hat:roundStarted', publicRound);
    if (explainerSocketId) {
      io.to(explainerSocketId).emit('hat:roundStarted', data);
    }
  });
  engine.on('word:new', (data) => {
    const explainerSocketId = data?.explainer;
    const payloadExplainer = {
      word: data.word,
      isExplainer: true,
      explainerName: data.explainerName,
      explainer: data.explainer,
      guessCandidates: data.guessCandidates,
    };
    const payloadGuessers = {
      word: null,
      isExplainer: false,
      explainerName: data.explainerName,
      explainer: data.explainer,
      guessCandidates: data.guessCandidates,
    };
    if (explainerSocketId) {
      io.to(explainerSocketId).emit('hat:newWord', payloadExplainer);
      // Не слать «угадывающий» пакет объясняющему — иначе второй эвент затирает isExplainer/word в UI
      io.to(code).except(explainerSocketId).emit('hat:newWord', payloadGuessers);
    } else {
      io.to(code).emit('hat:newWord', payloadGuessers);
    }
  });
  engine.on('word:guessed', (data) => io.to(code).emit('hat:wordGuessed', data));
  engine.on('word:skipped', (word) => io.to(code).emit('hat:wordSkipped', { word }));
  engine.on('timer:tick', (timeLeft) => io.to(code).emit('hat:timerUpdate', timeLeft));
  engine.on('round:ended', (data) => io.to(code).emit('hat:roundEnded', data));
  engine.on('game:ended', (data) => {
    io.to(code).emit('game:ended', data);
    const room = roomManager.getRoom(code);
    if (room && room.status === 'playing') {
      room.status = 'waiting';
      room.updatedAt = new Date();
      roomManager.clearGameEngine(code);
      io.to(code).emit('room:updated', sanitizeRoom(room));
    }
  });
  engine.on('score:updated', (data) => io.to(code).emit('hat:scoreUpdated', data));
  engine.on('scores:update', (data) => io.to(code).emit('hat:scoreboard', data));
  engine.on('player:disconnected', (data) => io.to(code).emit('hat:playerDisconnected', data));
}

function setupAssociationsListeners(engine, io, code) {
  engine.on('turn:started', (data) => io.to(code).emit('associations:turn-started', data));
  engine.on('link:added', (link) => io.to(code).emit('associations:link-added', link));
  engine.on('voting:started', (data) => io.to(code).emit('associations:voting-started', data));
  engine.on('voting:ended', (data) => io.to(code).emit('associations:voting-ended', data));
  engine.on('game:ended', (data) => io.to(code).emit('game:ended', data));
}

function setupCrocodileListeners(engine, io, code) {
  engine.on('turn:started', (data) => io.to(code).emit('crocodile:turn-started', data));
  engine.on('word:pick', (data) => io.to(data.playerId).emit('crocodile:your-word', { word: data.word }));
  engine.on('timer:tick', (timeLeft) => io.to(code).emit('crocodile:timer', timeLeft));
  engine.on('word:guessed', (data) => io.to(code).emit('crocodile:word-guessed', data));
}
