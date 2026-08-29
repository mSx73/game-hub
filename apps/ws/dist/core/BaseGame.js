import { EventEmitter } from 'events';

/**
 * Base class for all game engines.
 * Centralizes room context, timer lifecycle, and broadcasting helpers.
 */
export class BaseGame extends EventEmitter {
  constructor(room = null, io = null) {
    super();
    this.room = room;
    this.io = io;
    this.players = room?.players ? [...room.players] : [];
    this.timers = {
      intervals: new Set(),
      timeouts: new Set(),
    };
    this._destroyed = false;
  }

  setContext(room, io) {
    this.room = room;
    this.io = io;
    this.players = room?.players ? [...room.players] : this.players;
  }

  registerTimeout(cb, ms) {
    if (this._destroyed) return null;
    const timeout = setTimeout(() => {
      this.timers.timeouts.delete(timeout);
      cb();
    }, ms);
    this.timers.timeouts.add(timeout);
    return timeout;
  }

  registerInterval(cb, ms) {
    if (this._destroyed) return null;
    const interval = setInterval(cb, ms);
    this.timers.intervals.add(interval);
    return interval;
  }

  clearManagedTimeout(timeout) {
    if (!timeout) return;
    clearTimeout(timeout);
    this.timers.timeouts.delete(timeout);
  }

  clearManagedInterval(interval) {
    if (!interval) return;
    clearInterval(interval);
    this.timers.intervals.delete(interval);
  }

  broadcast(event, data) {
    if (!this.io || !this.room?.code) return;
    this.io.to(this.room.code).emit(event, data);
  }

  cleanup() {
    this._destroyed = true;
    this.timers.intervals.forEach((id) => clearInterval(id));
    this.timers.timeouts.forEach((id) => clearTimeout(id));
    this.timers.intervals.clear();
    this.timers.timeouts.clear();
    this.removeAllListeners();
  }
}
