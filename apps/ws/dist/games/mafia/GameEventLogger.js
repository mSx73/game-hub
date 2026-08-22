export class GameEventLogger {
  constructor(engine) {
    this.events = [];
    this.engine = engine;
    this.setupListeners();
  }

  setupListeners() {
    const events = [
      'game:started',
      'game:phase-changed',
      'game:action-completed',
      'game:night-resolved',
      'game:lynched',
      'game:ended',
      'game:player-killed',
      'game:player-revived',
      'game:role-changed',
    ];

    events.forEach((event) => {
      this.engine.on(event, (...args) => this.log(event, args));
    });
  }

  log(type, data) {
    this.events.push({
      timestamp: Date.now(),
      type,
      data,
      stateSnapshot: this.getMinimalSnapshot(),
    });
  }

  getMinimalSnapshot() {
    const state = this.engine.getState?.();
    if (!state) return null;
    return {
      day: state.day,
      phase: state.phase,
      players: (state.players || []).map((p) => ({
        id: p.id,
        role: p.role,
        status: p.status,
        team: p.team,
      })),
    };
  }

  exportForReplay() {
    return JSON.stringify(this.events);
  }
}
