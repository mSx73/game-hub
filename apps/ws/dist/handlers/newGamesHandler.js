import { AliasEngine } from '../games/alias/AliasEngine.js';
import { SpyEngine } from '../games/spy/SpyEngine.js';
import { QuizEngine } from '../games/quiz/QuizEngine.js';
import { MemeBattleEngine } from '../games/meme/MemeBattleEngine.js';
import { WordBombEngine } from '../games/wordbomb/WordBombEngine.js';
import { DebateEngine } from '../games/debate/DebateEngine.js';
import { TwoTruthsEngine } from '../games/truths/TwoTruthsEngine.js';
import { StoryEngine } from '../games/story/StoryEngine.js';
import { EmojiDecodeEngine } from '../games/emoji/EmojiDecodeEngine.js';
import { WhoAmIEngine } from '../games/whoami/WhoAmIEngine.js';
import { FakeArtistEngine } from '../games/fakeartist/FakeArtistEngine.js';
import { LastWordEngine } from '../games/lastword/LastWordEngine.js';
import { AuctionEngine } from '../games/auction/AuctionEngine.js';
import { WavelengthEngine } from '../games/wavelength/WavelengthEngine.js';
import { RankingEngine } from '../games/ranking/RankingEngine.js';
import { ChameleonEngine } from '../games/chameleon/ChameleonEngine.js';
import { TimelineEngine } from '../games/timeline/TimelineEngine.js';
import { CategoriesEngine } from '../games/categories/CategoriesEngine.js';
import { RhymeEngine } from '../games/rhyme/RhymeEngine.js';
import { PriceEngine } from '../games/priceisright/PriceEngine.js';
import { WouldYouRatherEngine } from '../games/wouldyourather/WouldYouRatherEngine.js';
import { BluffEngine } from '../games/bluff/BluffEngine.js';
import { EscalationEngine } from '../games/escalation/EscalationEngine.js';
import { MemoryEngine } from '../games/memory/MemoryEngine.js';
import { HotPotatoEngine } from '../games/hotpotato/HotPotatoEngine.js';
import { FibbingEngine } from '../games/fibbing/FibbingEngine.js';
import { PredictionEngine } from '../games/prediction/PredictionEngine.js';
import { ConnectEngine } from '../games/connect/ConnectEngine.js';
import { CrosswordEngine } from '../games/crossword/CrosswordEngine.js';
import { AnagramsEngine } from '../games/anagrams/AnagramsEngine.js';
import { WordChainEngine } from '../games/wordchain/WordChainEngine.js';
import { FactsEngine } from '../games/facts/FactsEngine.js';
import { SequenceEngine } from '../games/sequence/SequenceEngine.js';
import { BombPartyEngine } from '../games/bombparty/BombPartyEngine.js';
import { PsychEngine } from '../games/psych/PsychEngine.js';
import { JudgeEngine } from '../games/judge/JudgeEngine.js';
import { TrustEngine } from '../games/trust/TrustEngine.js';
import { ImpostorEngine } from '../games/impostor/ImpostorEngine.js';
import { CaptionEngine } from '../games/caption/CaptionEngine.js';
import { EmojiArtEngine } from '../games/emojiart/EmojiArtEngine.js';
import { FlagsEngine } from '../games/flags/FlagsEngine.js';
import { LogosEngine } from '../games/logos/LogosEngine.js';
import { MapsEngine } from '../games/maps/MapsEngine.js';
import { QuotesEngine } from '../games/quotes/QuotesEngine.js';
import { CollageEngine } from '../games/collage/CollageEngine.js';
import { ReactionEngine } from '../games/reaction/ReactionEngine.js';
import { ColorsEngine } from '../games/colors/ColorsEngine.js';
import { TeamWordsEngine } from '../games/teamwords/TeamWordsEngine.js';
import { AssociationsEngine } from '../games/associations/AssociationsEngine.js';
import { QuiplashEngine } from '../games/quiplash/QuiplashEngine.js';
import { KnowFriendEngine } from '../games/knowfriend/KnowFriendEngine.js';
import { FibbageEngine } from '../games/fibbage/FibbageEngine.js';
import { sanitizeRoom } from '../utils/sanitize.js';

const ENGINE_MAP = {
  alias: AliasEngine, spy: SpyEngine, quiz: QuizEngine, meme: MemeBattleEngine,
  wordbomb: WordBombEngine, debate: DebateEngine, truths: TwoTruthsEngine,
  story: StoryEngine, emoji: EmojiDecodeEngine, whoami: WhoAmIEngine,
  fakeartist: FakeArtistEngine, lastword: LastWordEngine, auction: AuctionEngine,
  wavelength: WavelengthEngine, ranking: RankingEngine, chameleon: ChameleonEngine,
  timeline: TimelineEngine, categories: CategoriesEngine, rhyme: RhymeEngine,
  priceisright: PriceEngine, wouldyourather: WouldYouRatherEngine, bluff: BluffEngine,
  escalation: EscalationEngine, memory: MemoryEngine, hotpotato: HotPotatoEngine,
  fibbing: FibbingEngine, prediction: PredictionEngine, connect: ConnectEngine,
  crossword: CrosswordEngine,
  anagrams: AnagramsEngine,
  wordchain: WordChainEngine,
  facts: FactsEngine,
  sequence: SequenceEngine,
  bombparty: BombPartyEngine,
  psych: PsychEngine,
  judge: JudgeEngine,
  trust: TrustEngine,
  impostor: ImpostorEngine,
  caption: CaptionEngine,
  emojiart: EmojiArtEngine,
  flags: FlagsEngine,
  logos: LogosEngine,
  maps: MapsEngine,
  quotes: QuotesEngine,
  collage: CollageEngine,
  reaction: ReactionEngine,
  colors: ColorsEngine,
  teamwords: TeamWordsEngine,
  associations: AssociationsEngine,
  quiplash: QuiplashEngine,
  knowfriend: KnowFriendEngine,
  fibbage: FibbageEngine,
};

export const NEW_GAME_TYPES = new Set(Object.keys(ENGINE_MAP));

const MIN_PLAYERS = {
  spy: 3, debate: 4, truths: 3, whoami: 3, fakeartist: 3, chameleon: 3,
  wavelength: 3, ranking: 2, escalation: 3, fibbing: 3, prediction: 3, connect: 3,
  crossword: 1,
  anagrams: 2,
  wordchain: 2,
  facts: 2,
  sequence: 2,
  bombparty: 2,
  psych: 3,
  judge: 3,
  trust: 2,
  impostor: 4,
  caption: 3,
  emojiart: 2,
  flags: 2,
  logos: 2,
  maps: 2,
  quotes: 2,
  collage: 2,
  reaction: 2,
  colors: 2,
  teamwords: 4,
  quiplash: 3,
  knowfriend: 3,
  fibbage: 3,
};

function createNewEngine(room) {
  const Cls = ENGINE_MAP[room.gameType];
  return Cls ? new Cls(room) : null;
}

function wireGenericEvents(engine, io, code, gameType, roomManager) {
  engine.on('guess:wrong', (d) => {
    if (gameType === 'crossword' && d?.playerId) {
      io.to(d.playerId).emit('crossword:guess-wrong', { clueNum: d.clueNum });
    }
  });
  engine.on('game:ended', (d, stats) => {
    const payload = (stats && typeof stats === 'object') ? { winner: d, ...stats } : d;
    io.to(code).emit('game:ended', payload);
    const room = roomManager.getRoom(code);
    if (room && room.status === 'playing') {
      room.status = 'waiting';
      room.updatedAt = new Date();
      roomManager.clearGameEngine(code);
      io.to(code).emit('room:updated', sanitizeRoom(room));
    }
  });
  engine.on('timer:tick', (t) => io.to(code).emit(`${gameType}:timer`, t));
  engine.on('score:updated', (d) => io.to(code).emit(`${gameType}:score`, d));
  engine.on('error', (d) => io.to(code).emit('room:error', d?.message || 'Ошибка игры'));
  
  // NEW: Forward dictionary status events
  engine.on('dictionary:status', (d) => io.to(code).emit('dictionary:status', d));

  const forwardEvents = [
    'round:started', 'round:ended', 'turn:started', 'turn:timeout', 'turn:transition',
    'answer:submitted', 'answer:accepted', 'answer:rejected',
    'voting:started', 'voting:ended', 'vote:cast',
    'word:guessed', 'word:accepted', 'word:rejected',
    'hint:started', 'hint:submitted', 'clue:prompt', 'clue:submitted', 'guess:started', 'guess:submitted',
    'player:eliminated', 'choice:submitted', 'definition:submitted',
    'ranking:submitted', 'question:asked', 'question:started', 'question:ended', 'answer:revealed', 'guess:result',
    'sequence:shown', 'collecting:started', 'facts:submitted',
    'guessing:started', 'guessing:ended', 'sentence:submitted',
    'piece:submitted',
    'story:started', 'story:completed', 'round:timeout',
    'potato:passed', 'potato:exploded', 'potato:result', 'vote:submitted',
    'sequence:hidden',
    'mine:triggered',
    'phase:changed',
    'chain:completed', 'chain:started', 'chain:broken',
    'link:added', 'bonus:awarded', 'words:collected',
    'bomb:exploded',
    'bonus:first',
    // Новые события для reaction, colors, teamwords
    'player:joined', 'player:left', 'player:ready', 'player:reacted', 'player:correct', 'player:wrong',
    'game:countdown', 'game:signal', 'game:winner', 'game:round-started', 'game:guessing-started',
    'game:round-ended', 'game:timer',
    'game:word-changed', 'explainer:word', 'word:guessed', 'word:skipped', 'teams:updated',
  ];

  forwardEvents.forEach((ev) => {
    engine.on(ev, (d) => {
      let clientEv;
      if (ev === 'story:started' && gameType === 'story') clientEv = 'story:started';
      else if (ev === 'story:completed' && gameType === 'story') clientEv = 'story:completed';
      else if (ev === 'collecting:started' && gameType === 'truths') clientEv = 'truths:collecting';
      else if (ev === 'question:started' && gameType === 'quiz') clientEv = 'quiz:question';
      else if (ev === 'voting:ended' && gameType === 'fakeartist') clientEv = 'fakeartist:round-ended';
      else if (ev === 'question:ended' && gameType === 'quiz') clientEv = 'quiz:question-ended';
      else if (ev === 'round:timeout' && gameType === 'emoji') clientEv = 'emoji:timeout';
      else if (ev === 'word:guessed' && gameType === 'emojiart') clientEv = 'emojiart:guessed';
      else clientEv = `${gameType}:${ev.replace(/:/g, '-')}`;
      if (ev === 'round:started' && gameType === 'wavelength' && d?.psychicId) {
        const target = d?.target;
        const safe = { ...d };
        delete safe.target;
        io.to(code).emit(clientEv, safe);
        if (typeof target === 'number') io.to(d.psychicId).emit('wavelength:target', { target });
        return;
      }
      if (ev === 'round:started' && gameType === 'fibbing' && d?.truthTellerId) {
        const safe = { ...d };
        delete safe.truthTellerId;
        delete safe.truthTellerName;
        io.to(code).emit(clientEv, safe);
        io.to(d.truthTellerId).emit('fibbing:truth-teller', { isTruthTeller: true, question: d.question });
        return;
      }
      if (ev === 'turn:started' && gameType === 'story' && d?.player?.id) {
        const { previousText, ...rest } = d;
        io.to(code).except(d.player.id).emit('story:turn-started', rest);
        io.to(d.player.id).emit('story:turn-started', d);
        return;
      }
      if (ev === 'sentence:submitted' && gameType === 'story') {
        io.to(code).emit('story:sentence-submitted', { playerId: d?.playerId, playerName: d?.playerName, skipped: d?.skipped });
        return;
      }
      if (ev === 'word:guessed' && gameType === 'emoji') {
        const gid = d?.guesserId;
        if (gid) {
          io.to(gid).emit('emoji:guessed', {
            guesserId: gid,
            guesserName: d.guesserName,
            answer: d.answer,
            emojis: d.emojis,
            points: d.points,
            round: d.round,
            order: d.order,
          });
          io.to(code).except(gid).emit('emoji:guessed', {
            guesserId: gid,
            guesserName: d.guesserName,
            points: d.points,
            round: d.round,
          });
        } else {
          io.to(code).emit('emoji:guessed', d);
        }
        return;
      }
      io.to(code).emit(clientEv, d);
    });
  });

  engine.on('word:pick', (d) => {
    if (d?.playerId) io.to(d.playerId).emit(`${gameType}:your-word`, d);
    else io.to(code).emit(`${gameType}:word-pick`, d);
  });

  // Spy: эти события имеют нестандартные имена и не покрываются generic-форвардером.
  engine.on('spy:canGuess', (d) => io.to(code).emit('spy:can-guess', d));
  engine.on('spy:guess', (d) => io.to(code).emit('spy:guess-result', d));

  // Острослов: кастомные события дуэлей/результатов.
  engine.on('quiplash:matchup', (d) => io.to(code).emit('quiplash:matchup', d));
  engine.on('quiplash:matchup-result', (d) => io.to(code).emit('quiplash:matchup-result', d));
  engine.on('quiplash:vote-cast', (d) => io.to(code).emit('quiplash:vote-cast', d));

      engine.on('game:started', (d) => {
    if (gameType === 'quiplash' && d?.assignments) {
      Object.entries(d.assignments).forEach(([pid, prompts]) => {
        io.to(pid).emit('quiplash:prompts', { prompts, answerTime: d.answerTime });
      });
      io.to(code).emit('quiplash:phase', { phase: 'answering', answerTime: d.answerTime, totalPrompts: d.totalPrompts });
      return;
    }
    if (gameType === 'spy' && d?.players) {
      d.players.forEach((p) => io.to(p.id).emit('spy:role', {
        playerId: p.id, isSpy: p.role === 'spy', location: p.location || null,
      }));
      io.to(code).emit('spy:started', { playerCount: d.players.length });
    } else if (gameType === 'whoami' && d?.assignments) {
      Object.entries(d.assignments).forEach(([pid, others]) => {
        const oc = Object.entries(others).map(([oid, info]) => ({
          playerId: oid, playerName: info.name, character: info.character,
        }));
        io.to(pid).emit('whoami:assignment', { playerId: pid, othersCharacters: oc });
      });
      io.to(code).emit('whoami:started', { playerCount: Object.keys(d.assignments).length });
    } else if (gameType === 'fakeartist') {
      const players = d?.players || d?.assignments || [];
      players.forEach((p) => {
        io.to(p.id).emit('fakeartist:role', {
          playerId: p.id,
          isFakeArtist: p.role === 'fakeartist',
          category: p.category,
          word: p.word || null,
        });
      });
      io.to(code).emit('fakeartist:started', { round: d.round, maxRounds: d.maxRounds });
    } else if (gameType === 'chameleon' && d?.grid) {
      const players = d.players || d.assignments || [];
      players.forEach((p) => {
        io.to(p.id).emit('chameleon:role', {
          playerId: p.id,
          isChameleon: p.role === 'chameleon',
          secretWord: p.secretWord || null,
        });
      });
      io.to(code).emit('chameleon:started', { grid: d.grid, gridTitle: d.gridTitle });
    } else if (gameType === 'impostor' && d?.players) {
      d.players.forEach((p) => {
        io.to(p.id).emit('impostor:role', {
          playerId: p.id,
          isImpostor: p.isImpostor,
          profession: p.profession,
        });
      });
      io.to(code).emit('impostor:started', { round: d.round, maxRounds: d.maxRounds });
    } else if (gameType === 'wavelength' && d?.psychicId) {
      io.to(d.psychicId).emit('wavelength:target', { target: d.target });
      io.to(code).emit('wavelength:started', { psychicId: d.psychicId, extremes: d.extremes });
    } else {
      const safe = { ...d };
      delete safe.players;
      delete safe.assignments;
      delete safe.secretWord;
      delete safe.correctAnswer;
      delete safe.target;
      delete safe.truthTellerId;
      delete safe.truthTellerName;
      io.to(code).emit(`${gameType}:started`, safe);
    }
  });
}

const CROSSWORD_CORPORATE_WORDS = 60;

const CROSSWORD_MODES = new Set(['coop', 'corporate', 'duel', 'race', 'solo_race', 'solo_casual']);

function normalizeCrosswordOptions(raw) {
  const mode = CROSSWORD_MODES.has(raw?.mode) ? raw.mode : 'coop';
  let roundTimeSec = 300;
  if (mode === 'solo_casual') {
    roundTimeSec = 0;
  } else {
    const sec = Number(raw?.roundTimeSec);
    const min = Number(raw?.roundTimeMin ?? raw?.roundMinutes);
    if (Number.isFinite(sec) && sec > 0) {
      roundTimeSec = Math.min(4 * 3600, Math.floor(sec));
    } else if (Number.isFinite(min) && min > 0) {
      roundTimeSec = Math.min(4 * 3600, Math.floor(min * 60));
    }
    if (roundTimeSec < 60) roundTimeSec = 300;
  }
  let autoWordCount;
  const awc = Number(raw?.autoWordCount);
  if (Number.isFinite(awc)) {
    autoWordCount = Math.min(60, Math.max(6, Math.floor(awc)));
  }
  return { mode, roundTimeSec, autoWordCount };
}

function parseCrosswordStartWords(raw) {
  if (raw === undefined || raw === null) return { ok: true, words: null };
  if (!Array.isArray(raw)) return { ok: false, error: 'Неверный формат списка слов' };
  if (raw.length < 2) return { ok: false, error: 'Нужно минимум 2 слова' };
  if (raw.length > 60) return { ok: false, error: 'Не больше 60 слов' };
  const words = [];
  for (const item of raw) {
    let word;
    let clue;
    if (typeof item === 'string') {
      const parts = item.split('|');
      word = parts[0];
      clue = parts[1]?.trim();
    } else if (item && typeof item === 'object' && typeof item.word === 'string') {
      word = item.word;
      clue = item.clue != null ? String(item.clue).trim() : '';
    } else continue;
    const n = String(word || '')
      .toUpperCase()
      .replace(/Ё/g, 'Е')
      .replace(/[^А-ЯA-Z0-9]/g, '');
    if (n.length < 2 || n.length > 14) {
      return { ok: false, error: `Слово «${word}»: нужна длина 2–14 букв (кириллица)` };
    }
    words.push({ word: n, clue: clue ? String(clue).slice(0, 200) : undefined });
  }
  if (words.length < 2) return { ok: false, error: 'Нужно минимум 2 подходящих слова' };
  return { ok: true, words };
}

export function registerNewGamesHandler(io, socket, roomManager, gameManager = null) {
  socket.on('game:start', (arg0, arg1) => {
    let payload = {};
    let callback = arg1;
    if (typeof arg0 === 'function') {
      callback = arg0;
      payload = {};
    } else if (arg0 && typeof arg0 === 'object') {
      payload = arg0;
    }

    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || room.hostId !== socket.id) return;
    if (!NEW_GAME_TYPES.has(room.gameType)) return;
    if (room.status === 'playing') {
      callback?.({ success: false, error: 'Игра уже запущена' });
      return;
    }

    const min = MIN_PLAYERS[room.gameType] ?? 2;
    const activePlayers = room.players.filter((p) => !p.isSpectator);
    if (activePlayers.length < min) {
      callback?.({ success: false, error: `Минимум ${min} игрока для этой игры` });
      return;
    }

    if (room.gameType === 'crossword') {
      const cw = parseCrosswordStartWords(payload.crosswordWords);
      if (!cw.ok) {
        callback?.({ success: false, error: cw.error });
        return;
      }
      const cwOpts = normalizeCrosswordOptions(payload.crosswordOptions);
      const liveHumans = activePlayers.filter((p) => !p.isBot);
      if (cwOpts.mode === 'corporate') {
        if (liveHumans.length < 2) {
          callback?.({
            success: false,
            error: 'Корпоративный режим: нужны минимум 2 участника в комнате (не зрители).',
          });
          return;
        }
        if (cw.words) {
          if (cw.words.length !== CROSSWORD_CORPORATE_WORDS) {
            callback?.({
              success: false,
              error: `Корпоративный режим: в списке должно быть ровно ${CROSSWORD_CORPORATE_WORDS} слов или оставьте поле пустым для автогенерации.`,
            });
            return;
          }
          const uniq = new Set(cw.words.map((w) => w.word));
          if (uniq.size !== CROSSWORD_CORPORATE_WORDS) {
            callback?.({
              success: false,
              error: 'Корпоративный режим: все 60 слов в списке должны быть разными (без повторов).',
            });
            return;
          }
        }
      }
      if (cwOpts.mode === 'duel' && liveHumans.length !== 2) {
        callback?.({
          success: false,
          error: 'Режим «Дуэль»: нужны ровно 2 живых игрока в комнате (не боты, не зрители).',
        });
        return;
      }
      if (cwOpts.mode === 'race' && liveHumans.length < 2) {
        callback?.({
          success: false,
          error: 'Режим «Гонка»: нужны минимум 2 живых игрока (не зрители).',
        });
        return;
      }
      if ((cwOpts.mode === 'solo_race' || cwOpts.mode === 'solo_casual') && liveHumans.length !== 1) {
        callback?.({
          success: false,
          error: 'Одиночный режим: в комнате должен быть ровно один игрок.',
        });
        return;
      }
      room.settings = { ...(room.settings || {}) };
      if (cw.words) room.settings.crosswordWords = cw.words;
      else delete room.settings.crosswordWords;
      room.settings.crosswordOptions = cwOpts;
    }

    try {
      const engine = createNewEngine(room);
      if (!engine) {
        callback?.({ success: false, error: 'Неизвестный тип игры' });
        return;
      }

      roomManager.setGameEngine(room.code, engine);
      wireGenericEvents(engine, io, room.code, room.gameType, roomManager);

      engine.start();

      if (room.gameType === 'crossword' && engine.phase !== 'playing') {
        roomManager.clearGameEngine(room.code);
        callback?.({
          success: false,
          error:
            'Не удалось составить сетку: слова должны пересекаться по общим буквам. Добавьте или замените слова.',
        });
        return;
      }

      room.status = 'playing';
      room.updatedAt = new Date();
      io.to(room.code).emit('game:started', { gameType: room.gameType });
      io.to(room.code).emit('room:updated', sanitizeRoom(room));
      callback?.({ success: true });
    } catch (err) {
      console.error(`[${room.gameType} start error]`, err);
      roomManager.clearGameEngine(room.code);
      room.status = 'waiting';
      callback?.({ success: false, error: err.message });
    }
  });

  socket.on('game:action', (action, callback) => {
    if (gameManager?.handleAction?.(socket, action, callback)) return;

    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || !NEW_GAME_TYPES.has(room.gameType) || room.status !== 'playing') return;

    const engine = roomManager.getGameEngine(room.code);
    if (!engine) return;

    const t = action?.type;
    const gameType = room.gameType;

    if (typeof engine.handleAction === 'function') {
      engine.handleAction(socket.id, action);
      callback?.({ success: true });
      return;
    }

    switch (t) {
      case 'vote':
        if (gameType === 'rhyme' && engine.vote) engine.vote(socket.id, action.answerIdx ?? action.index ?? action.targetIndex);
        else if (gameType === 'bluff' && engine.castVote) engine.castVote(socket.id, action.defIdx ?? action.index ?? action.targetIndex);
        else if (gameType === 'fibbing' && engine.castVote) engine.castVote(socket.id, action.answerIdx ?? action.index ?? action.targetIndex);
        else if (gameType === 'connect' && engine.castVote) engine.castVote(socket.id, action.answerIdx ?? action.index ?? action.targetIndex);
        else if (gameType === 'caption' && engine.castVote) engine.castVote(socket.id, action.answerIdx ?? action.index ?? action.targetIndex);
        else if (gameType === 'psych' && engine.castVote) engine.castVote(socket.id, { index: action.answerIdx ?? action.answerIndex, playerId: action.targetId });
        else if (gameType === 'prediction' && engine.submitVote) engine.submitVote(socket.id, action.targetId ?? action.votedForId);
        else if (gameType === 'impostor' && engine.vote) engine.vote(socket.id, action.targetId ?? action.votedForId);
        else if (gameType === 'collage' && engine.submitCollageVote) engine.submitCollageVote(socket.id, action.pieceIndex ?? action.index ?? action.answerIdx);
        else if (gameType === 'fakeartist' && engine.vote) engine.vote(socket.id, action.targetId);
        else if (engine.vote) engine.vote(socket.id, action.targetId ?? action.vote ?? action.answerId ?? action.index);
        else if (engine.castVote) engine.castVote(socket.id, action.targetId ?? action.targetIndex ?? action.index);
        else if (engine.submitVote) engine.submitVote(socket.id, action.targetId ?? action.votedForId);
        break;
      case 'answer':
        if (engine.submitAnswer) {
          if (gameType === 'quiz') {
            const idx = action.answerIndex ?? action.index;
            if (typeof idx === 'number' && !Number.isNaN(idx)) engine.submitAnswer(socket.id, idx);
          } else {
            engine.submitAnswer(socket.id, action.text ?? action.value ?? action.answer);
          }
        }
        break;
      case 'start-voting':
        if (engine.startVoting) engine.startVoting();
        break;
      case 'submit-facts':
        if (engine.submitFacts) engine.submitFacts(socket.id, action.facts, action.lieIndex);
        break;
      case 'guess':
        if (engine.submitGuess) engine.submitGuess(socket.id, action.guess ?? action.value ?? action.guessIndex);
        break;
      case 'submit-association':
        if (engine.submitAssociation) engine.submitAssociation(socket.id, action.word);
        break;
      case 'submit-sentence':
        if (gameType === 'collage' && engine.submitPiece) engine.submitPiece(socket.id, action.text);
        else if (engine.submitSentence) engine.submitSentence(socket.id, action.text);
        break;
      case 'ask':
        if (engine.askQuestion) engine.askQuestion(socket.id, action.question);
        break;
      case 'vote-yn':
        if (engine.voteYesNo) engine.voteYesNo(socket.id, action.vote);
        break;
      case 'pass':
        if (engine.passTurn) engine.passTurn(socket.id);
        break;
      case 'spy-guess':
        if (engine.spyGuess) engine.spyGuess(socket.id, action.location);
        break;
      case 'clue':
        if (engine.submitClue) engine.submitClue(socket.id, action.clue ?? action.text);
        break;
      case 'submit-ranking':
        if (engine.submitRanking) engine.submitRanking(socket.id, action.ranking);
        break;
      case 'submit-definition':
        if (engine.submitDefinition) engine.submitDefinition(socket.id, action.text);
        break;
      case 'submit-hint':
        if (engine.submitHint) engine.submitHint(socket.id, action.hint ?? action.text);
        break;
      case 'chameleon-guess':
        if (engine.submitGuess) engine.submitGuess(socket.id, action.word ?? action.guess ?? action.text);
        break;
      case 'fakeartist-guess':
        if (engine.submitGuess) engine.submitGuess(socket.id, action.word ?? action.guess ?? action.text);
        break;
      case 'choice':
        if (gameType === 'judge' && engine.submitChoice) engine.submitChoice(socket.id, action.choice);
        else if (gameType === 'trust' && engine.submitChoice) engine.submitChoice(socket.id, action.choice);
        else if (engine.submitChoice) engine.submitChoice(socket.id, action.choice);
        break;
      case 'sequence':
        if (engine.submitSequence) engine.submitSequence(socket.id, action.sequence);
        break;
      case 'submit-connection':
        if (engine.submitConnection) engine.submitConnection(socket.id, action.text);
        break;
      case 'confirm-guess':
        if (engine.confirmGuess) engine.confirmGuess(socket.id, action.guesserId);
        break;
      case 'quiplash-answer':
        if (engine.submitAnswer) engine.submitAnswer(socket.id, action.promptId, action.text);
        break;
      case 'quiplash-vote':
        if (engine.vote) engine.vote(socket.id, action.answerId);
        break;
      case 'fib-lie': {
        const res = engine.submitLie ? engine.submitLie(socket.id, action.text) : { success: false };
        callback?.(res);
        break;
      }
      case 'fib-choose':
        if (engine.choose) engine.choose(socket.id, action.optionId);
        break;
      // Обработчики для новых игр
      case 'ready':
        if (gameType === 'reaction' && engine.setReady) engine.setReady(socket.id, action.ready ?? true);
        else if (gameType === 'colors' && engine.setReady) engine.setReady(socket.id, action.ready ?? true);
        else if (gameType === 'teamwords' && engine.setReady) engine.setReady(socket.id, action.ready ?? true);
        break;
      case 'react':
        if (gameType === 'reaction' && engine.handleReaction) engine.handleReaction(socket.id);
        break;
      case 'guess-color':
        if (gameType === 'colors' && engine.handleGuess) engine.handleGuess(socket.id, action.index ?? action.guessIndex);
        break;
      case 'guess-word':
        if (gameType === 'teamwords' && engine.handleGuess) engine.handleGuess(socket.id, action.guess ?? action.text);
        break;
      case 'skip-word':
        if (gameType === 'teamwords' && engine.handleSkip) engine.handleSkip();
        break;
    }
    callback?.({ success: true });
  });

  socket.on('crossword:submit-word', (payload, callback) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room || room.gameType !== 'crossword' || room.status !== 'playing') {
      callback?.({ success: false, error: 'Кроссворд сейчас не идёт' });
      return;
    }
    const engine = roomManager.getGameEngine(room.code);
    if (!engine || typeof engine.handleChat !== 'function') {
      callback?.({ success: false, error: 'Игра не активна' });
      return;
    }
    const clueNum = parseInt(String(payload?.clueNum ?? payload?.num ?? ''), 10);
    const word = String(payload?.word ?? '').trim();
    if (Number.isNaN(clueNum) || !word) {
      callback?.({ success: false, error: 'Укажите слово' });
      return;
    }
    const ok = engine.handleChat(socket.id, `${clueNum}:${word}`);
    callback?.({
      success: ok,
      error: ok ? undefined : 'Не подходит или слово уже отгадано',
    });
  });
}
