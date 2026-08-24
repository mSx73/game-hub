import { MafiaGameEngine } from './MafiaGameEngine.js';
import { AutopilotController } from './AutopilotController.js';

function makeRoom() {
  return {
    hostId: 'h1',
    players: [
      { id: 'h1', name: 'Host', isSpectator: false },
      { id: 'p2', name: 'P2', isSpectator: false },
      { id: 'p3', name: 'P3', isSpectator: false },
      { id: 'p4', name: 'P4', isSpectator: false },
    ],
    settings: {
      roles: { mafia: 1, sheriffs: 0, doctors: 0, maniacs: 0, poisoners: 0, putanas: 0, bodyguards: 0, journalists: 0, mayors: 0 },
      timers: { roleReveal: 0, donElection: 0, intro: 0, night: 0, discussion: 0, voting: 0 },
      options: { aiGameMaster: false, autopilot: true, chooseDonByVote: false, selfHealDoctor: true, equalVotesNoKill: false, equalVotesRandomLynch: true, firstNightNoKill: false },
    },
  };
}

describe('AutopilotController', () => {
  test('auto-completes pending voting actions', async () => {
    const engine = new MafiaGameEngine(makeRoom());
    const autopilot = new AutopilotController(engine, { enabled: true, pendingGraceMs: 5 });
    autopilot.attach();

    engine.start();
    engine.setPhase('voting');

    await new Promise((r) => setTimeout(r, 30));
    const state = engine.getState();
    expect(state.pendingActions.size).toBeLessThanOrEqual(1);
    expect(state.version).toBeGreaterThan(0);

    autopilot.cleanup();
  });
});

