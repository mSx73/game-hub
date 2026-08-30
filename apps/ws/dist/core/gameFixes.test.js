import { remapPlayerIdDeep } from './remapPlayerId.js';
import { FlagsEngine } from '../games/flags/FlagsEngine.js';
import { StoryEngine } from '../games/story/StoryEngine.js';
import { QuizEngine } from '../games/quiz/QuizEngine.js';
import { AliasEngine } from '../games/alias/AliasEngine.js';
import { CaptionEngine } from '../games/caption/CaptionEngine.js';
import { MemeBattleEngine } from '../games/meme/MemeBattleEngine.js';
import { PasswordEngine } from '../games/password/PasswordEngine.js';
import { HatEngine } from '../games/hat/HatEngine.js';
import { WordChainEngine } from '../games/wordchain/WordChainEngine.js';
import { LastWordEngine } from '../games/lastword/LastWordEngine.js';
import { SequenceEngine } from '../games/sequence/SequenceEngine.js';

const mkRoom = (n, extra = {}) => ({
  code: 'TEST',
  settings: {},
  players: Array.from({ length: n }, (_, i) => ({
    id: 'p' + i, name: 'P' + i, isOnline: true, isSpectator: false,
  })),
  spectators: [],
  ...extra,
});

describe('remapPlayerIdDeep — рефреш не ломает игрока', () => {
  test('Quiz: после remap игрок может отвечать новым id, счёт сохраняется', () => {
    const g = new QuizEngine(mkRoom(2));
    g.start();
    g.submitAnswer('p0', g.currentQuestion.correct); // старый id отвечает
    remapPlayerIdDeep(g, 'p1', 'NEW_SOCKET_ID_abc123');
    expect(g.players.find((p) => p.id === 'NEW_SOCKET_ID_abc123')).toBeTruthy();
    expect(g.players.find((p) => p.id === 'p1')).toBeFalsy();
    const ok = g.submitAnswer('NEW_SOCKET_ID_abc123', 0);
    expect(ok).toBe(true); // новый id принят
    g.cleanup();
  });

  test('Map-ключи и значения, Set и массивы строк ремапятся', () => {
    const fake = {
      players: [{ id: 'old' }],
      votes: new Map([['old', 'x'], ['y', 'old']]),
      ready: new Set(['old', 'z']),
      order: ['old', 'q'],
      activeSpeaker: 'old',
    };
    remapPlayerIdDeep(fake, 'old', 'new');
    expect(fake.players[0].id).toBe('new');
    expect(fake.votes.has('new')).toBe(true);
    expect(fake.votes.get('y')).toBe('new');
    expect(fake.ready.has('new')).toBe(true);
    expect(fake.order[0]).toBe('new');
    expect(fake.activeSpeaker).toBe('new');
  });
});

describe('FlagsEngine — нет двойных очков после угадывания', () => {
  test('второй правильный ответ в паузе отклоняется, endRound не дублируется', () => {
    const g = new FlagsEngine(mkRoom(2));
    g.start();
    const country = g.currentFlag.country;
    let roundEnded = 0;
    g.on('round:ended', () => roundEnded++);
    g.handleChat('p0', country);
    const scoreAfterFirst = g.players.find((p) => p.id === 'p0').score;
    expect(scoreAfterFirst).toBeGreaterThan(0);
    // фаза сменилась — поздний дубль не проходит
    expect(g.phase).toBe('reveal');
    g.handleChat('p1', country);
    expect(g.players.find((p) => p.id === 'p1').score).toBe(0);
    expect(roundEnded).toBe(1);
    g.cleanup();
  });
});

describe('AliasEngine — оффлайн игроки не остаются в ротации', () => {
  test('nextTurn удаляет игрока с isOnline=false из this.players', () => {
    const room = mkRoom(3);
    room.players[1].isOnline = false;
    const g = new AliasEngine(room);
    g.words = ['яблоко', 'груша', 'слива'];
    g.dictionaryLoaded = true;
    g.players = [
      { id: 'p0', name: 'P0', score: 0 },
      { id: 'p1', name: 'P1', score: 0 },
      { id: 'p2', name: 'P2', score: 0 },
    ];
    g.nextTurn();
    expect(g.players.some((p) => p.id === 'p1')).toBe(false);
    expect(g.players).toHaveLength(2);
    g.cleanup();
  });
});

describe('SpyEngine — ничья в голосовании', () => {
  test('при ничьей шпион ускользает (никто не обвинён)', () => {
    const { SpyEngine } = require('../games/spy/SpyEngine.js');
    const g = new SpyEngine(mkRoom(4));
    g.start();
    g.phase = 'voting';
    const results = [];
    g.on('voting:ended', (d) => results.push(d));
    // 2:2 — p0/p1 против p2, p2/p3 против p0
    g.vote('p0', 'p2'); g.vote('p1', 'p2');
    g.vote('p2', 'p0'); g.vote('p3', 'p0');
    expect(results).toHaveLength(1);
    expect(results[0].tie).toBe(true);
    expect(results[0].accused).toBeNull();
    expect(results[0].spyCaught).toBe(false);
    g.cleanup();
  });
});

describe('SyncEngine — оффлайн не блокирует ready', () => {
  test('setReady игнорирует оффлайновых при проверке allReady', () => {
    const { SyncEngine } = require('../games/sync/SyncEngine.js');
    const room = mkRoom(3);
    room.players[2].isOnline = false;
    const g = new SyncEngine(room);
    g.start();
    g.setReady('p0', true);
    g.setReady('p1', true);
    expect(g.state).toBe('countdown');
    g.cleanup();
  });
});

describe('KnowFriendEngine — нет двойных очков при resolveRound', () => {
  test('timer + all-answered race и поздние ответы не дублируют начисление', () => {
    const { KnowFriendEngine } = require('../games/knowfriend/KnowFriendEngine.js');
    const room = mkRoom(4);
    const g = new KnowFriendEngine({ ...room, settings: { answerTime: 30 } });
    g.start();
    const subjectId = g.subjectOrder[g.round - 1];
    const subjectAnswer = 0;
    g.answers[subjectId] = subjectAnswer;
    for (const p of g.players) {
      if (p.id === subjectId) continue;
      g.submitAnswer(p.id, subjectAnswer);
    }
    const guesser = g.players.find((p) => p.id !== subjectId);
    expect(guesser.score).toBe(100);
    g._resolveRound();
    expect(guesser.score).toBe(100);
    expect(g.phase).toBe('results');
    expect(g.submitAnswer(subjectId, subjectAnswer)).toBe(false);
    g.cleanup();
  });
});

describe('PasswordEngine — оффлайн пропускается в ротации ведущего', () => {
  test('nextClueGiver не возвращает оффлайн id', () => {
    const room = mkRoom(3);
    const g = new PasswordEngine(room);
    g.start();
    room.players[0].isOnline = false;
    g.clueGiverId = 'p0';
    expect(g.nextClueGiver()).toBe('p1');
    g.cleanup();
  });
});

describe('PasswordEngine — resolveRound не дублируется', () => {
  test('повторный resolveRound не эмитит round:ended снова', () => {
    const g = new PasswordEngine(mkRoom(2));
    g.start();
    g.startRound();
    g.state = 'guessing';
    let roundEnded = 0;
    g.on('round:ended', () => roundEnded++);
    g.resolveRound();
    g.resolveRound();
    expect(g.state).toBe('round-result');
    expect(roundEnded).toBe(1);
    g.cleanup();
  });
});

describe('CaptionEngine — нет двойных очков при resolveRound', () => {
  test('повторный resolveRound и поздний голос судьи не дублируют +3', () => {
    const g = new CaptionEngine(mkRoom(3));
    g.start();
    g.submitAnswer('p0', 'caption one');
    g.submitAnswer('p2', 'caption two');
    expect(g.phase).toBe('voting');
    g.castVote('p1', 0);
    const winnerId = g.votes.get('p1');
    const scoreAfterVote = g.players.find((p) => p.id === winnerId).score;
    expect(scoreAfterVote).toBe(3);
    g.resolveRound();
    expect(g.players.find((p) => p.id === winnerId).score).toBe(3);
    expect(g.phase).toBe('results');
    expect(g.castVote('p1', 1)).toBe(false);
    g.cleanup();
  });
});

describe('MemeBattleEngine — нет двойных очков при resolveRound', () => {
  test('timer + all-voted race не дублирует pointsPerWin', () => {
    const g = new MemeBattleEngine(mkRoom(3));
    g.start();
    g.submitAnswer('p1', 'meme one');
    g.submitAnswer('p2', 'meme two');
    expect(g.phase).toBe('voting');
    g.vote('p0', 0);
    g.vote('p1', 1);
    g.vote('p2', 0);
    const authorId = g._answerIndex[0].authorId;
    const scoreAfterVotes = g.players.find((p) => p.id === authorId).score;
    expect(scoreAfterVotes).toBe(g.pointsPerWin);
    g.resolveRound();
    expect(g.players.find((p) => p.id === authorId).score).toBe(g.pointsPerWin);
    expect(g.phase).toBe('results');
    g.cleanup();
  });
});

describe('TwoTruthsEngine — guessing phase resumes after resolve', () => {
  test('nextGuessRound resets phase so later rounds accept guesses', () => {
    const g = new TwoTruthsEngine(mkRoom(3));
    for (const p of g.players) {
      g.facts.set(p.id, {
        facts: [`${p.name} a`, `${p.name} b`, `${p.name} c`],
        lieIndex: 2,
      });
    }
    g.phase = 'results';
    g.currentPlayerIndex = -1;
    g.nextGuessRound();
    expect(g.phase).toBe('guessing');
    expect(g.currentFacts).toBeTruthy();
    const aboutId = g.currentFacts.playerId;
    const guesser = g.players.find((p) => p.id !== aboutId);
    expect(g.submitGuess(guesser.id, 2)).toBe(true);
    g.cleanup();
  });
});

describe('StoryEngine — noTimeLimit и оффлайн', () => {
  test('noTimeLimit: handlePlayerDisconnect передаёт ход', () => {
    const room = mkRoom(3, { settings: { noTimeLimit: true, maxStories: 1 } });
    const g = new StoryEngine(room);
    jest.useFakeTimers();
    g.start();
    jest.advanceTimersByTime(2100); // задержка перед startTurn
    expect(g.phase).toBe('turn');
    const current = g.players[g.currentTurnIndex];
    // эмулируем RoomManager.handleDisconnect
    current.isOnline = false;
    g.handlePlayerDisconnect(current.id);
    // ход ушёл дальше, а не завис
    expect(g.currentTurnIndex).toBeGreaterThan(0);
    g.cleanup();
    jest.useRealTimers();
  });

  test('startTurn пропускает оффлайновых', () => {
    const room = mkRoom(3, { settings: { noTimeLimit: true, maxStories: 1 } });
    room.players[0].isOnline = false; // первый оффлайн ещё до старта
    const g = new StoryEngine(room);
    jest.useFakeTimers();
    g.start();
    jest.advanceTimersByTime(2100);
    expect(g.players[g.currentTurnIndex].id).toBe('p1'); // p0 пропущен
    g.cleanup();
    jest.useRealTimers();
  });
});

describe('WordChainEngine — playing phase resumes after endRound', () => {
  test('nextRound resets phase so round 2 accepts chat', () => {
    const g = new WordChainEngine(mkRoom(2));
    g.start();
    g.endRound();
    expect(g.phase).toBe('results');
    g.nextRound();
    expect(g.phase).toBe('playing');
    expect(g.handleChat('p0', 'кот')).toBe(true);
    g.cleanup();
  });
});

describe('LastWordEngine — playing phase resumes after endRound', () => {
  test('nextRound resets phase so round 2 accepts words', () => {
    const g = new LastWordEngine(mkRoom(2));
    g.start();
    g.endRound();
    expect(g.phase).toBe('results');
    g.nextRound();
    expect(g.phase).toBe('playing');
    expect(g.handleChat('p0', 'яблоко')).toBe(true);
    g.cleanup();
  });
});

describe('SequenceEngine — playing phase resumes after endRound', () => {
  test('nextRound resets phase so round 2 accepts answers', () => {
    const g = new SequenceEngine(mkRoom(2));
    g.start();
    g.endRound();
    expect(g.phase).toBe('results');
    g.nextRound();
    expect(g.phase).toBe('playing');
    expect(g.currentSeq).toBeTruthy();
    expect(g.handleChat('p0', String(g.currentSeq.answer))).toBe(true);
    g.cleanup();
  });
});

describe('HatEngine — late guesses after round ends', () => {
  test('guess after timer endRound does not score or call endRound again', () => {
    const room = mkRoom(4);
    const g = new HatEngine(room);
    g.words = [{ text: 'яблоко', guessed: false, skipped: false, author: 'p0' }];
    g.currentRound = 1;
    g.currentTeam = 0;
    g.startRound();
    const word = g.currentWord.text;
    const teamBefore = g.currentTeam;
    const guesser = g.teams.get(teamBefore).find((p) => p.id !== g.currentExplainer);
    const scoreBefore = guesser.score;
    let roundEnded = 0;
    g.on('round:ended', () => roundEnded++);
    g.endRound();
    expect(g.currentTeam).toBe((teamBefore + 1) % 2);
    expect(g.guessWord(guesser.id, word)).toBe(false);
    expect(guesser.score).toBe(scoreBefore);
    g.endRound();
    expect(roundEnded).toBe(1);
    g.cleanup();
  });

  test('confirmManualGuess rejected after endRound', () => {
    const room = mkRoom(4);
    const g = new HatEngine(room);
    g.words = [{ text: 'груша', guessed: false, skipped: false, author: 'p0' }];
    g.startRound();
    const explainer = g.currentExplainer;
    const guesser = g.teams.get(g.currentTeam).find((p) => p.id !== explainer);
    g.endRound();
    const res = g.confirmManualGuess(explainer, guesser.id);
    expect(res.ok).toBe(false);
    g.cleanup();
  });
});
