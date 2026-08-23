import { CrocodileEngine } from '../games/crocodile/CrocodileEngine.js';
import { SketchEngine } from '../games/sketch/SketchEngine.js';
import { sanitizeRoom } from '../utils/sanitize.js';

const CROCODILE_FAMILY = ['crocodile', 'crocodile-verbs', 'crocodile-nouns', 'sketch'];
const DRAW_GAMES = CROCODILE_FAMILY;

export function registerCrocodileHandlers(io, socket, roomManager) {
  socket.on('crocodile:draw', (data) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || !DRAW_GAMES.includes(room.gameType) || room.status !== 'playing') return;
    const engine = roomManager.getGameEngine(room.code);
    if (engine && typeof engine.recordDraw === 'function') engine.recordDraw();
    const ev = room.gameType === 'sketch' ? 'sketch:draw' : 'crocodile:draw';
    socket.to(room.code).emit(ev, { senderId: socket.id, ...data });
  });

  socket.on('crocodile:clear', () => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || !DRAW_GAMES.includes(room.gameType) || room.status !== 'playing') return;
    const ev = room.gameType === 'sketch' ? 'sketch:clear' : 'crocodile:clear';
    io.to(room.code).emit(ev);
  });

  socket.on('crocodile:undo', () => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || !DRAW_GAMES.includes(room.gameType) || room.status !== 'playing') return;
    const ev = room.gameType === 'sketch' ? 'sketch:undo' : 'crocodile:undo';
    socket.to(room.code).emit(ev);
  });

  // NEW: Word selection from 3 choices
  socket.on('crocodile:select-word', (wordIndex, callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || !DRAW_GAMES.includes(room.gameType) || room.status !== 'playing') {
      callback?.({ success: false, error: 'Недоступно' });
      return;
    }
    const engine = roomManager.getGameEngine(room.code);
    if (!engine || (!(engine instanceof CrocodileEngine) && !(engine instanceof SketchEngine))) {
      callback?.({ success: false, error: 'Игра не запущена' });
      return;
    }
    const result = engine.selectWord(socket.id, wordIndex);
    const ok = result && result.ok === true;
    const errMsg =
      result?.code === 'not_explainer'
        ? 'Слово выбирает только текущий художник'
        : result?.code === 'bad_index'
          ? 'Некорректный вариант'
          : result?.code === 'already_chosen'
            ? 'Слово уже выбрано'
            : 'Не удалось выбрать слово';
    callback?.({ success: ok, error: ok ? undefined : errMsg });
  });

  socket.on('crocodile:manual-confirm', ({ guesserId } = {}, callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || !DRAW_GAMES.includes(room.gameType) || room.status !== 'playing') {
      return callback?.({ success: false, error: 'Игра не активна' });
    }
    const engine = roomManager.getGameEngine(room.code);
    if (!engine || typeof engine.manualConfirmGuess !== 'function') {
      return callback?.({ success: false, error: 'Движок не поддерживает ручное подтверждение' });
    }
    const result = engine.manualConfirmGuess(socket.id, guesserId);
    if (result?.ok) return callback?.({ success: true });
    const msg =
      result?.code === 'not_explainer' ? 'Только рисующий может подтверждать угадывание'
      : result?.code === 'no_word' ? 'Слово ещё не выбрано'
      : result?.code === 'not_playing' ? 'Сейчас не время для угадывания'
      : result?.code === 'already_guessed' ? 'Этот игрок уже угадал'
      : result?.code === 'self_guess' ? 'Нельзя засчитать самого себя'
      : result?.code === 'guesser_not_found' ? 'Игрок не найден'
      : 'Не удалось засчитать угадывание';
    callback?.({ success: false, error: msg });
  });

  socket.on('game:start', (arg0, arg1) => {
    const callback = typeof arg0 === 'function' ? arg0 : typeof arg1 === 'function' ? arg1 : undefined;
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || room.hostId !== socket.id || !DRAW_GAMES.includes(room.gameType)) return;
    if (room.players.filter((p) => !p.isSpectator).length < 2) {
      callback?.({ success: false, error: 'Минимум 2 игрока' });
      return;
    }

    const EngineClass = room.gameType === 'sketch' ? SketchEngine : CrocodileEngine;
    const engine = new EngineClass(room);
    roomManager.setGameEngine(room.code, engine);

    const evPrefix = room.gameType === 'sketch' ? 'sketch' : 'crocodile';

    engine.on('word:choices', (data) => {
      io.to(data.playerId).emit(`${evPrefix}:word-choices`, {
        choices: data.choices,
        timeLeft: data.timeLeft,
        selectionTimeoutSec: data.selectionTimeoutSec,
      });
    });

    engine.on('turn:transition', (data) => {
      io.to(room.code).emit(`${evPrefix}:turn-transition`, {
        nextPlayerName: data?.nextPlayer?.name || '—',
        nextPlayerId: data?.nextPlayer?.id || null,
        delay: data?.delay ?? 2000,
      });
    });

    engine.on('empty:canvas:penalty', (data) => {
      io.to(room.code).emit(`${evPrefix}:penalty`, data);
      io.to(room.code).emit('room:chat-message', {
        message: `⚠️ Штраф −${data?.penalty ?? 1}: рисующий не нарисовал.`,
        system: true,
      });
    });

    engine.on('turn:started', (data) => {
      io.to(room.code).emit(`${evPrefix}:clear`);
      const word = String(data?.word || '');
      const wordLength = word.replace(/ /g, '').length;
      const wordPattern = word ? word.replace(/[^ ]/g, '_') : '';
      const { word: _secret, ...rest } = data || {};
      io.to(room.code).emit(`${evPrefix}:turn-started`, {
        ...rest,
        word: wordPattern,
        wordLength,
        wordPattern,
      });
    });

    engine.on('word:pick', (data) => {
      io.to(data.playerId).emit(`${evPrefix}:your-word`, { word: data.word });
    });

    engine.on('timer:tick', (timeLeft) => {
      io.to(room.code).emit(`${evPrefix}:timer`, timeLeft);
    });

    engine.on('word:guessed', (data) => {
      io.to(room.code).emit(`${evPrefix}:word-guessed`, data);
      io.to(room.code).emit('room:chat-message', {
        message: `✅ ${data.guesserName} угадал слово: ${data.word}!`,
        system: true
      });
      io.to(room.code).emit('room:updated', sanitizeRoom(room));
    });

    engine.on('turn:timeout', (data) => {
      io.to(room.code).emit('room:chat-message', {
        message: `⏰ Время вышло! Было загадано: ${data.word}`,
        system: true
      });
      io.to(room.code).emit(`${evPrefix}:turn-timeout`, { word: data.word });
    });

    engine.on('score:updated', (payload) => {
      io.to(room.code).emit(`${evPrefix}:score`, payload);
    });

    engine.on('game:ended', (payload) => {
      io.to(room.code).emit('game:ended', payload);
      room.status = 'waiting';
      room.updatedAt = new Date();
      roomManager.clearGameEngine(room.code);
      io.to(room.code).emit('room:updated', sanitizeRoom(room));
    });

    room.status = 'playing';
    io.to(room.code).emit('game:started', { gameType: room.gameType });
    io.to(room.code).emit('room:updated', sanitizeRoom(room));
    callback?.({ success: true });
    engine.start();
  });
}
