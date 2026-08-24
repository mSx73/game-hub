import { describe, test, expect, jest } from '@jest/globals';
import { remapPlayerIdDeep } from './remapPlayerId.js';
import { FlagsEngine } from '../games/flags/FlagsEngine.js';
import { StoryEngine } from '../games/story/StoryEngine.js';
import { QuizEngine } from '../games/quiz/QuizEngine.js';
import { AliasEngine } from '../games/alias/AliasEngine.js';
import { CategoriesEngine } from '../games/categories/CategoriesEngine.js';
import { ReactionEngine } from '../games/reaction/ReactionEngine.js';

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

describe('LogosEngine — нет двойных очков после угадывания', () => {
  test('второй правильный ответ в паузе отклоняется', () => {
    const { LogosEngine } = require('../games/logos/LogosEngine.js');
    const g = new LogosEngine(mkRoom(2));
    g.start();
    const answer = g.currentBrand.answer;
    let roundEnded = 0;
    g.on('round:ended', () => roundEnded++);
    g.handleChat('p0', answer);
    expect(g.phase).toBe('reveal');
    g.handleChat('p1', answer);
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

  test('setReady игнорирует игрока, покинувшего комнату (room:leave)', () => {
    const { SyncEngine } = require('../games/sync/SyncEngine.js');
    const room = mkRoom(3);
    const g = new SyncEngine(room);
    g.start();
    room.players = room.players.filter((p) => p.id !== 'p2');
    g.setReady('p0', true);
    g.setReady('p1', true);
    expect(g.state).toBe('countdown');
    g.cleanup();
  });
});

describe('PasswordEngine — оффлайн пропускается в ротации ведущего', () => {
  test('nextClueGiver не возвращает оффлайн id', () => {
    const { PasswordEngine } = require('../games/password/PasswordEngine.js');
    const room = mkRoom(3);
    const g = new PasswordEngine(room);
    g.start();
    room.players[0].isOnline = false;
    g.clueGiverId = 'p0';
    expect(g.nextClueGiver()).toBe('p1');
    g.cleanup();
  });
});

describe('TeamWordsEngine — skip-word только для объясняющего', () => {
  test('handleSkip отклоняет игрока не из роли explainer', () => {
    const { TeamWordsEngine } = require('../games/teamwords/TeamWordsEngine.js');
    const room = mkRoom(4);
    const g = new TeamWordsEngine(room);
    g.start();
    for (const p of room.players) g.setReady(p.id, true);
    expect(g.state).toBe('explaining');
    const explainer = g.currentExplainer;
    const opponent = room.players.find((p) => p.id !== explainer);
    expect(g.handleSkip(opponent.id)).toBe(false);
    expect(g.handleSkip(explainer)).toBe(true);
    g.cleanup();
  });
});

describe('ReactionEngine — реакция до сигнала не засчитывается', () => {
  test('handleReaction отклоняет клик до game:signal', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // delay = 1000ms
    const room = mkRoom(2);
    const g = new ReactionEngine(room);
    jest.useFakeTimers();
    g.start();
    g.setReady('p0', true);
    g.setReady('p1', true);
    jest.advanceTimersByTime(3000); // countdown -> startGame
    expect(g.state).toBe('active');
    expect(g.signalTime).toBeNull();
    expect(g.handleReaction('p0')).toBe(false);
    jest.advanceTimersByTime(1000); // signal fires
    expect(g.signalTime).not.toBeNull();
    expect(g.handleReaction('p0')).toBe(true);
    expect(g.winner).toBe('p0');
    g.cleanup();
    jest.useRealTimers();
    Math.random.mockRestore();
  });
});

describe('CategoriesEngine — endRound idempotent', () => {
  test('double endRound does not double scores; answers rejected during results', () => {
    const g = new CategoriesEngine(mkRoom(2));
    g.start();
    let roundEnded = 0;
    g.on('round:ended', () => roundEnded++);

    const cat = g.currentCategories[0];
    g.handleChat('p0', `${cat}: ${g.currentLetter}тест`);

    g.endRound();
    const scoreAfterFirst = g.players.find((p) => p.id === 'p0').score;
    expect(scoreAfterFirst).toBeGreaterThan(0);
    expect(g.phase).toBe('results');

    g.endRound();
    expect(g.players.find((p) => p.id === 'p0').score).toBe(scoreAfterFirst);
    expect(roundEnded).toBe(1);

    expect(g.handleChat('p1', `${g.currentCategories[1]}: ${g.currentLetter}другой`)).toBe(false);
    g.cleanup();
  });
});

describe('PriceEngine — resolveRound idempotent', () => {
  test('timer/all-answered race does not double-score', () => {
    const { PriceEngine } = require('../games/priceisright/PriceEngine.js');
    const g = new PriceEngine(mkRoom(2));
    g.start();
    const price = g.currentProduct.price;
    g.submitGuess('p0', price);
    g.submitGuess('p1', price - 1);
    g.resolveRound();
    const scoreAfterFirst = g.players.find((p) => p.id === 'p0').score;
    expect(scoreAfterFirst).toBeGreaterThan(0);
    expect(g.phase).toBe('results');
    g.resolveRound();
    expect(g.players.find((p) => p.id === 'p0').score).toBe(scoreAfterFirst);
    expect(g.submitGuess('p0', price)).toBe(false);
    g.cleanup();
  });
});

describe('TimelineEngine — resolveRound idempotent', () => {
  test('double resolveRound does not double-score; answers rejected during results', () => {
    const { TimelineEngine } = require('../games/timeline/TimelineEngine.js');
    const g = new TimelineEngine(mkRoom(2));
    g.start();
    const year = g.currentEvent.year;
    g.submitAnswer('p0', year);
    g.submitAnswer('p1', year + 1);
    g.resolveRound();
    const scoreAfterFirst = g.players.find((p) => p.id === 'p0').score;
    expect(scoreAfterFirst).toBeGreaterThan(0);
    expect(g.phase).toBe('results');
    g.resolveRound();
    expect(g.players.find((p) => p.id === 'p0').score).toBe(scoreAfterFirst);
    expect(g.submitAnswer('p1', year)).toBe(false);
    g.cleanup();
  });
});

describe('StoryEngine — noTimeLimit не зависает при disconnect', () => {
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
    room.players.find((p) => p.id === current.id).isOnline = false;
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
