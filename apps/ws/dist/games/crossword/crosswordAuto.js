import { parseCrosswordLexicon } from './crosswordLexicon.js';
import { generateCrosswordFromWordEntries } from './crosswordGenerator.js';

const CORPORATE_TARGET = 60;
const DEFAULT_TARGET = 18;
const MIN_FALLBACK = 6;

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Собирает кроссворд из встроенной базы слов и подсказок.
 * @param {{ targetCount?: number, seed?: number }} [opts]
 */
export function generateAutoCrossword(opts = {}) {
  const target = Math.min(
    CORPORATE_TARGET,
    Math.max(MIN_FALLBACK, Math.floor(Number(opts.targetCount) || DEFAULT_TARGET)),
  );
  const rng = typeof opts.seed === 'number' ? mulberry32(opts.seed % 2147483647) : Math.random;

  const pool = parseCrosswordLexicon();
  if (pool.length < MIN_FALLBACK) return null;

  const shufflePool = () => {
    const a = [...pool];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const maxN = Math.min(target, pool.length);
  for (let n = maxN; n >= MIN_FALLBACK; n--) {
    const rounds = n >= 45 ? 500 : n >= 25 ? 400 : 320;
    for (let r = 0; r < rounds; r++) {
      const shuffled = shufflePool();
      const slice = shuffled.slice(0, n).map((e) => ({ word: e.word, clue: e.clue }));
      const puzzle = generateCrosswordFromWordEntries(slice, { rng });
      if (puzzle) return puzzle;
    }
  }
  return null;
}

export { CORPORATE_TARGET, DEFAULT_TARGET };
