import { MafiaGameEngine } from './MafiaGameEngine.js';

function createEngine(overrides = {}) {
  const room = {
    players: [
      { id: 'p1', name: 'P1', isSpectator: false },
      { id: 'p2', name: 'P2', isSpectator: false },
      { id: 'p3', name: 'P3', isSpectator: false },
      { id: 'p4', name: 'P4', isSpectator: false },
      { id: 'p5', name: 'P5', isSpectator: false },
      { id: 'p6', name: 'P6', isSpectator: false },
      { id: 'p7', name: 'P7', isSpectator: false },
      { id: 'p8', name: 'P8', isSpectator: false },
    ],
    settings: {
      roles: { mafia: 1, sheriffs: 1, doctors: 1, maniacs: 1, poisoners: 0, putanas: 0 },
      timers: { roleReveal: 5, discussion: 60, voting: 30 },
    },
    ...overrides,
  };
  if (overrides.settings) {
    room.settings = { ...room.settings, ...overrides.settings };
  }
  return new MafiaGameEngine(room);
}

describe('MafiaGameEngine Critical Bug Fixes', () => {
  test('[БАГ-1] Connection status does not affect game status', () => {
    const engine = createEngine();
    const player = engine.state.players[0];

    player.status = 'dead';
    engine.onConnectionChange(player.id, false);

    expect(player.status).toBe('dead');
    expect(player.isOnline).toBe(false);
  });

  test('[БАГ-2] Poison + Kill + Heal logic — healed survives', () => {
    const engine = createEngine();
    const player = engine.state.players[0];
    player.status = 'alive';

    const results = {
      kills: new Set([player.id]),
      heals: new Set([player.id]),
      poisons: new Set([player.id]),
      blocks: new Set(),
    };

    engine.applyNightResults(results);

    expect(player.status).toBe('alive');
  });

  test('[БАГ-3] Maniac win with poisoned players', () => {
    const engine = createEngine({
      players: [
        { id: 'm1', name: 'Maniac', isSpectator: false },
        { id: 'm2', name: 'Mafia', isSpectator: false },
      ],
      settings: {
        roles: { mafia: 1, sheriffs: 0, doctors: 0, maniacs: 1, poisoners: 0, putanas: 0 },
        timers: { roleReveal: 5, discussion: 60, voting: 30 },
      },
    });
    const maniac = engine.state.players.find((p) => p.role === 'maniac');
    const mafia = engine.state.players.find((p) => p.team === 'mafia');

    expect(maniac).toBeDefined();
    expect(mafia).toBeDefined();

    engine.state.players.forEach((p) => {
      if (p !== maniac && p !== mafia) p.status = 'dead';
    });
    mafia.status = 'poisoned';

    const winner = engine.checkWinCondition();
    expect(winner).toBe('maniac');
  });

  test('[NEW] Mayor vote counts as two in resolveVoting', () => {
    const engine = createEngine();
    const [a, b, mayor] = engine.state.players;
    engine.state.players.forEach((pl) => {
      pl.status = 'dead';
    });
    a.status = 'alive';
    b.status = 'alive';
    mayor.status = 'alive';
    a.role = 'civilian';
    a.team = 'civilian';
    b.role = 'civilian';
    b.team = 'civilian';
    mayor.role = 'mayor';
    mayor.team = 'civilian';
    engine.dayActions.set(a.id, { type: 'vote', actor: a.id, target: b.id });
    engine.dayActions.set(mayor.id, { type: 'vote', actor: mayor.id, target: b.id });
    engine.resolveVoting();
    expect(b.status).toBe('dead');
    expect(a.status).toBe('alive');
  });

  test('[NEW] Bodyguard sacrifice sets deathCause', () => {
    const engine = createEngine();
    const bg = engine.state.players[0];
    bg.status = 'alive';
    const results = {
      kills: new Set([bg.id]),
      heals: new Set(),
      poisons: new Set(),
      blocks: new Set(),
      bodyguardDeaths: new Set([bg.id]),
    };
    engine.applyNightResults(results);
    expect(bg.status).toBe('dead');
    expect(bg.deathCause).toBe('bodyguard');
  });
});
