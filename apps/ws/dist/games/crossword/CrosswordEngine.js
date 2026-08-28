import { EventEmitter } from 'events';
import { generateCrosswordFromWordEntries } from './crosswordGenerator.js';
import { generateAutoCrossword, CORPORATE_TARGET, DEFAULT_TARGET } from './crosswordAuto.js';
import { CROSSWORD_PUZZLES } from './crosswordPuzzles.js';

const MODES = new Set(['coop', 'corporate', 'duel', 'race', 'solo_race', 'solo_casual']);

function normalizeAnswer(s) {
  return String(s || '')
    .trim()
    .toUpperCase()
    .replace(/Ё/g, 'Е')
    .replace(/\s+/g, '');
}

function parseCrosswordGuess(raw) {
  const msg = String(raw || '').trim();
  if (!msg) return null;
  const withSep = msg.match(/^(\d+)\s*[:.\u2013\u2014\-]\s*(.+)$/u);
  if (withSep) {
    const num = parseInt(withSep[1], 10);
    const answer = withSep[2].trim();
    if (!Number.isNaN(num) && answer) return { num, answer };
  }
  const spaced = msg.match(/^(\d+)\s+(\S(?:.*\S)?)\s*$/u);
  if (spaced) {
    const num = parseInt(spaced[1], 10);
    const answer = spaced[2].trim();
    if (!Number.isNaN(num) && answer) return { num, answer };
  }
  return null;
}

function maskPuzzleGrid(rows) {
  return rows.map((row) =>
    String(row || '')
      .split('')
      .map((ch) => {
        if (ch === '.' || ch === '#') return ch;
        if (/[А-ЯЁA-Zа-яёa-z0-9]/u.test(ch)) return '.';
        return ch;
      })
      .join('')
  );
}

export class CrosswordEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter((p) => !p.isSpectator).map((p) => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.puzzleIndex = 0;
    this.grid = [];
    this.clues = [];
    this.filledClues = new Set();
    this._aborted = false;

    const cwOpt = this.settings.crosswordOptions || {};
    this.crosswordMode = MODES.has(cwOpt.mode) ? cwOpt.mode : 'coop';
    const rts = cwOpt.roundTimeSec;
    this.roundTime =
      this.crosswordMode === 'solo_casual'
        ? 0
        : typeof rts === 'number' && rts >= 0
          ? rts
          : this.settings.roundTime ?? 300;
    this.timeLimited = this.crosswordMode !== 'solo_casual' && this.roundTime > 0;
    this.clueFirstSolver = new Map();
    this.endReason = null;
  }

  start() {
    if (this._aborted) return;
    const custom = this.room.settings?.crosswordWords;
    const cwOpt = this.settings.crosswordOptions || {};
    let autoN = typeof cwOpt.autoWordCount === 'number' ? cwOpt.autoWordCount : null;
    if (autoN == null || Number.isNaN(autoN)) {
      autoN = this.crosswordMode === 'corporate' ? CORPORATE_TARGET : DEFAULT_TARGET;
    }
    autoN = Math.min(60, Math.max(6, Math.floor(autoN)));

    let puzzle = null;
    if (Array.isArray(custom) && custom.length >= 2) {
      puzzle = generateCrosswordFromWordEntries(custom);
      if (!puzzle) {
        return;
      }
    } else {
      const seed =
        (String(this.room.code || '')
          .split('')
          .reduce((a, ch) => a + ch.charCodeAt(0), 0) ^
          (Date.now() & 0x7fffffff)) >>>
        0;
      puzzle = generateAutoCrossword({ targetCount: autoN, seed });
      if (!puzzle) {
        this.puzzleIndex = Math.floor(Math.random() * CROSSWORD_PUZZLES.length);
        puzzle = CROSSWORD_PUZZLES[this.puzzleIndex];
      }
    }
    if (!puzzle || !Array.isArray(puzzle.grid) || !Array.isArray(puzzle.clues)) {
      this.emit('error', { message: 'Ошибка загрузки кроссворда' });
      return;
    }
    this.phase = 'playing';
    this.clues = puzzle.clues.map((c) => ({ ...c, answer: String(c.answer).toUpperCase().replace(/Ё/g, 'Е') }));
    this.filledClues.clear();
    this.clueFirstSolver.clear();
    this.endReason = null;
    this.timeLeft = this.timeLimited ? this.roundTime : 0;

    const maskedRows = maskPuzzleGrid(puzzle.grid);
    this.grid = maskedRows.map((row) => row.split(''));

    this.emit('round:started', {
      grid: this.grid.map((r) => r.join('')),
      clues: this.clues.map((c) => ({
        num: c.num,
        dir: c.dir,
        clue: c.clue,
        row: c.row,
        col: c.col,
        len: c.answer.length,
      })),
      solvedNums: [],
      timeLeft: this.timeLeft,
      mode: this.crosswordMode,
      timeLimited: this.timeLimited,
      players: this.players.map((p) => ({ id: p.id, name: p.name, score: p.score || 0 })),
    });

    if (this.timeLimited) {
      this.timer = setInterval(() => {
        if (this._aborted) return;
        this.timeLeft--;
        this.emit('timer:tick', this.timeLeft);
        if (this.timeLeft <= 0) {
          this.stopTimer();
          if (!this._aborted) this.endGame('timeout');
        }
      }, 1000);
    }
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  handleChat(playerId, message) {
    if (this._aborted) return false;
    if (this.phase !== 'playing') return false;
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return false;

    const parsed = parseCrosswordGuess(message);
    if (!parsed) return false;
    const { num, answer } = parsed;

    const clue = this.clues.find((c) => c.num === num);
    if (!clue || this.filledClues.has(num)) return false;

    const normalized = normalizeAnswer(answer);
    if (normalized !== clue.answer) {
      this.emit('guess:wrong', { playerId, clueNum: num });
      return false;
    }

    this.filledClues.add(num);
    this.updateGrid(clue);

    const mode = this.crosswordMode;
    if (mode === 'duel' || mode === 'race') {
      if (!this.clueFirstSolver.has(num)) {
        this.clueFirstSolver.set(num, playerId);
        player.score = (player.score || 0) + 10;
      }
    } else if (mode === 'coop' || mode === 'corporate') {
      this.players.forEach((p) => {
        p.score = (p.score || 0) + 10;
      });
    } else {
      player.score = (player.score || 0) + 10;
    }

    this.emit('word:guessed', {
      playerId,
      playerName: player.name,
      clueNum: num,
      answer: clue.answer,
      grid: this.grid.map((r) => r.join('')),
      solvedNums: [...this.filledClues].sort((a, b) => a - b),
      mode,
      timeLimited: this.timeLimited,
      pointsTo: mode === 'duel' || mode === 'race' ? this.clueFirstSolver.get(num) : playerId,
    });
    this.emit('score:updated', { players: this.players });

    if (this.filledClues.size >= this.clues.length) {
      this.stopTimer();
      this.endGame('complete');
    }
    return true;
  }

  updateGrid(clue) {
    const { answer, row, col, dir } = clue;
    for (let i = 0; i < answer.length; i++) {
      const r = dir === 'across' ? row : row + i;
      const c = dir === 'across' ? col + i : col;
      if (this.grid[r] && this.grid[r][c] !== undefined) {
        this.grid[r][c] = answer[i];
      }
    }
  }

  endGame(reason = 'complete') {
    if (this._aborted) return;
    if (this.phase === 'ended') return;
    this.stopTimer();
    this.phase = 'ended';
    this.endReason = reason;

    const sorted = this.players.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
    let winnerName = sorted[0]?.name;
    let winnerId = sorted[0]?.id;

    if (this.crosswordMode === 'coop' || this.crosswordMode === 'corporate') {
      winnerName = 'Команда';
      winnerId = null;
    } else if (this.crosswordMode === 'duel' && this.players.length === 2) {
      const [a, b] = sorted;
      if ((a?.score || 0) === (b?.score || 0)) {
        winnerName = 'Ничья';
        winnerId = null;
      }
    } else if (this.crosswordMode === 'race' && this.players.length >= 2) {
      const top = sorted[0]?.score || 0;
      const leaders = sorted.filter((p) => (p?.score || 0) === top);
      if (leaders.length !== 1) {
        winnerName = 'Ничья';
        winnerId = null;
      }
    }

    this.emit('game:ended', {
      reason,
      mode: this.crosswordMode,
      winner: winnerName,
      winnerId,
      scores: this.players.map((p) => ({ id: p.id, name: p.name, score: p.score || 0 })),
      filled: this.filledClues.size,
      total: this.clues.length,
    });
  }

  cleanup() {
    this._aborted = true;
    this.stopTimer();
    this.removeAllListeners();
  }
}
