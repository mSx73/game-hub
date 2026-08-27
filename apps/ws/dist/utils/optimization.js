import { deflate, inflate } from 'pako';
/** Батчинг обновлений состояния — объединяет частые обновления в один emit */
export class StateBatcher {
  constructor(io, eventName = 'game:state-batch') {
    this.io = io;
    this.eventName = eventName;
    this.pendingUpdates = new Map();
    this.flushTimer = null;
    this.FLUSH_INTERVAL = 50;
  }
  queueUpdate(roomCode, update) {
    const existing = this.pendingUpdates.get(roomCode) ?? {};
    this.pendingUpdates.set(roomCode, { ...existing, ...update });
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL);
    }
  }
  flush() {
    this.pendingUpdates.forEach((update, roomCode) => {
      this.io.to(roomCode).emit(this.eventName, update);
    });
    this.pendingUpdates.clear();
    this.flushTimer = null;
  }
  destroy() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.pendingUpdates.clear();
  }
}
/** Сжатие состояния для передачи по сети */
export function compressState(state) {
  const json = JSON.stringify(state);
  return deflate(json);
}
/** Распаковка состояния */
export function decompressState(compressed) {
  const json = inflate(compressed, { to: 'string' });
  return JSON.parse(json);
}
/** Rate limiting по игроку */
export class RateLimiter {
  constructor() {
    this.limits = new Map();
  }
  checkLimit(playerId, maxRequests, windowMs) {
    const now = Date.now();
    const window = now - windowMs;
    const requests = this.limits.get(playerId) ?? [];
    const recent = requests.filter((t) => t > window);
    if (recent.length >= maxRequests) return false;
    recent.push(now);
    this.limits.set(playerId, recent);
    return true;
  }
  reset(playerId) {
    this.limits.delete(playerId);
  }
}
