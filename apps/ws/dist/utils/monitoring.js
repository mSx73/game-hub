import { createLogger, transports, format } from 'winston';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
const logsDir = join(process.cwd(), 'logs');
if (!existsSync(logsDir)) {
  try {
    mkdirSync(logsDir, { recursive: true });
  } catch {
    // ignore
  }
}
const fileTransports = [];
if (existsSync(logsDir)) {
  fileTransports.push(
    new transports.File({ filename: join(logsDir, 'error.log'), level: 'error' }),
    new transports.File({ filename: join(logsDir, 'combined.log') })
  );
}
export const logger = createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
    ...fileTransports,
  ],
});
/** Метрики игр */
export class GameMetrics {
  constructor() {
    this.gamesStarted = 0;
    this.gamesFinished = 0;
    this.totalDuration = 0;
  }
  recordGameStart() {
    this.gamesStarted++;
    logger.info('Game started', { metric: 'games_started', value: this.gamesStarted });
  }
  recordGameEnd(durationMs, playerCount) {
    this.gamesFinished++;
    this.totalDuration += durationMs;
    const avgDuration = this.totalDuration / this.gamesFinished;
    logger.info('Game ended', {
      metric: 'games_finished',
      duration_ms: durationMs,
      player_count: playerCount,
      avg_duration_ms: Math.round(avgDuration),
    });
  }
  getStats() {
    return {
      gamesStarted: this.gamesStarted,
      gamesFinished: this.gamesFinished,
      avgDuration: this.gamesFinished > 0 ? this.totalDuration / this.gamesFinished : 0,
    };
  }
}
