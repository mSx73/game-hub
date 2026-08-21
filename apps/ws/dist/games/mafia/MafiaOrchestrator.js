import { MAFIA_SOCKET_EVENTS } from '@playforfun/shared-types';

export class MafiaOrchestrator {
  constructor({
    io,
    room,
    engine,
    aiGameMaster,
    hostId,
    logger,
    narrationProvider,
  }) {
    this.io = io;
    this.room = room;
    this.engine = engine;
    this.aiGameMaster = !!aiGameMaster;
    this.hostId = hostId;
    this.logger = logger || console;
    this.narrationProvider = narrationProvider;
  }

  emitPlayerSnapshots() {
    const state = this.engine.getState();
    state.players.forEach((p) => {
      const personalState = this.engine.getPlayerState(p.id, this.hostId, this.aiGameMaster);
      if (!personalState) return;
      this.io.to(p.id).emit(MAFIA_SOCKET_EVENTS.STATE_UPDATE, personalState);
      this.io.to(p.id).emit(MAFIA_SOCKET_EVENTS.SNAPSHOT, personalState);
    });
    if (!this.aiGameMaster && this.hostId && !state.players.some((p) => p.id === this.hostId)) {
      const modState = this.engine.getPlayerState(this.hostId, this.hostId, this.aiGameMaster);
      if (modState) {
        this.io.to(this.hostId).emit(MAFIA_SOCKET_EVENTS.STATE_UPDATE, modState);
        this.io.to(this.hostId).emit(MAFIA_SOCKET_EVENTS.SNAPSHOT, modState);
      }
    }
  }

  async emitNarration(text, context = {}) {
    if (!text) return;
    try {
      const spoken = await this.narrationProvider?.transform(text, context);
      this.io.to(this.room.code).emit(MAFIA_SOCKET_EVENTS.AI_SPEAK, spoken || text);
    } catch (err) {
      this.logger.warn?.(`[MafiaOrchestrator] narration fallback: ${err.message}`);
      this.io.to(this.room.code).emit(MAFIA_SOCKET_EVENTS.AI_SPEAK, text);
    }
  }
}

