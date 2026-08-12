import { remapPlayerIdDeep } from './remapPlayerId.js';
import { FlagsEngine } from '../games/flags/FlagsEngine.js';
import { StoryEngine } from '../games/story/StoryEngine.js';
import { QuizEngine } from '../games/quiz/QuizEngine.js';
import { AliasEngine } from '../games/alias/AliasEngine.js';

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

  test('nextTurn не пропускает следующего игрока после оффлайна объясняющего', () => {
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
    g.currentPlayerIndex = 2;
    let explainerId;
    g.on('turn:started', (d) => { explainerId = d.explainerId; });
    g.nextTurn();
    expect(explainerId).toBe('p2');
    g.cleanup();
  });

  test('nextTurn завершает игру когда все игроки оффлайн', () => {
    const room = mkRoom(2);
    room.players.forEach((p) => { p.isOnline = false; });
    const g = new AliasEngine(room);
    g.words = ['test'];
    g.dictionaryLoaded = true;
    let ended = null;
    g.on('game:ended', (d) => { ended = d; });
    g.nextTurn();
    expect(ended?.reason).toBe('no_players');
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

describe('StoryEngine — дисконнект автора не вешает игру', () => {
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
