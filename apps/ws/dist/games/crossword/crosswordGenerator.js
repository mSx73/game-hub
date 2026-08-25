/**
 * Автосборка кроссворда из списка слов (слова → сетка с пересечениями).
 */

/** Поле сборки для крупных кроссвордов (корпоратив до 60 слов на одной сетке). */
const GRID_DIM = 55;
const MID = Math.floor(GRID_DIM / 2);
const MAX_ATTEMPTS = 900;

function normWord(w) {
  return String(w || '')
    .toUpperCase()
    .replace(/Ё/g, 'Е')
    .replace(/[^А-ЯA-Z0-9]/g, '');
}

function key(r, c) {
  return `${r},${c}`;
}

function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * @param {Array<{ word: string, clue?: string | null }>} order
 * @returns {{ grid: string[], clues: Array<{ num: number, dir: string, clue: string, answer: string, row: number, col: number }> } | null}
 */
function tryBuildFromOrder(order, rng = Math.random) {
  const cells = new Map();
  const placed = [];

  const inBounds = (r, c) => r >= 0 && r < GRID_DIM && c >= 0 && c < GRID_DIM;

  function canPlace(row, col, dir, word) {
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;
    if (inBounds(row - dr, col - dc) && cells.has(key(row - dr, col - dc))) return false;
    if (inBounds(row + dr * word.length, col + dc * word.length) && cells.has(key(row + dr * word.length, col + dc * word.length)))
      return false;

    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (!inBounds(r, c)) return false;
      const k = key(r, c);
      const ch = word[i];
      if (cells.has(k)) {
        if (cells.get(k) !== ch) return false;
      } else {
        if (dir === 'across') {
          if (inBounds(r - 1, c) && cells.has(key(r - 1, c))) return false;
          if (inBounds(r + 1, c) && cells.has(key(r + 1, c))) return false;
        } else {
          if (inBounds(r, c - 1) && cells.has(key(r, c - 1))) return false;
          if (inBounds(r, c + 1) && cells.has(key(r, c + 1))) return false;
        }
      }
    }
    return true;
  }

  function commitPlace(row, col, dir, word, clue) {
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;
    for (let i = 0; i < word.length; i++) {
      cells.set(key(row + dr * i, col + dc * i), word[i]);
    }
    placed.push({ word, clue, row, col, dir });
  }

  const first = order[0].word;
  const startC = Math.max(1, MID - Math.floor(first.length / 2));
  if (!canPlace(MID, startC, 'across', first)) return null;
  commitPlace(MID, startC, 'across', first, order[0].clue);

  for (let wi = 1; wi < order.length; wi++) {
    const { word, clue } = order[wi];
    const tries = [];
    for (const [k, letter] of cells) {
      const [rs, cs] = k.split(',').map(Number);
      for (let i = 0; i < word.length; i++) {
        if (word[i] !== letter) continue;
        tries.push({ row: rs, col: cs - i, dir: 'across' });
        tries.push({ row: rs - i, col: cs, dir: 'down' });
      }
    }
    shuffle(tries, rng);
    let placedOk = false;
    for (const t of tries) {
      if (canPlace(t.row, t.col, t.dir, word)) {
        commitPlace(t.row, t.col, t.dir, word, clue);
        placedOk = true;
        break;
      }
    }
    if (!placedOk) return null;
  }

  let minR = GRID_DIM;
  let minC = GRID_DIM;
  let maxR = 0;
  let maxC = 0;
  for (const k of cells.keys()) {
    const [r, c] = k.split(',').map(Number);
    minR = Math.min(minR, r);
    minC = Math.min(minC, c);
    maxR = Math.max(maxR, r);
    maxC = Math.max(maxC, c);
  }

  const pad = 1;
  minR -= pad;
  minC -= pad;
  maxR += pad;
  maxC += pad;
  const h = maxR - minR + 1;
  const w = maxC - minC + 1;

  const grid = [];
  for (let r = 0; r < h; r++) {
    let row = '';
    for (let c = 0; c < w; c++) {
      row += cells.get(key(minR + r, minC + c)) || '#';
    }
    grid.push(row);
  }

  const shifted = placed.map((p) => ({
    word: p.word,
    clue: p.clue,
    row: p.row - minR,
    col: p.col - minC,
    dir: p.dir,
  }));

  shifted.sort((a, b) => a.row - b.row || a.col - b.col || (a.dir === 'across' ? -1 : 1));

  const clues = shifted.map((p, idx) => {
    const clueText =
      p.clue ||
      (p.dir === 'across' ? `По горизонтали, ${p.word.length} букв` : `По вертикали, ${p.word.length} букв`);
    return {
      num: idx + 1,
      dir: p.dir,
      clue: clueText,
      answer: p.word,
      row: p.row,
      col: p.col,
    };
  });

  return { grid, clues };
}

/**
 * @param {Array<{ word: string, clue?: string }>} entries
 * @param {{ rng?: () => number }} [opts]
 * @returns {{ grid: string[], clues: Array<{ num: number, dir: string, clue: string, answer: string, row: number, col: number }> } | null}
 */
export function generateCrosswordFromWordEntries(entries, opts = {}) {
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const raw = (entries || [])
    .map((e) => ({
      word: normWord(e.word),
      clue: String(e.clue || '').trim() || null,
    }))
    .filter((e) => e.word.length >= 2 && e.word.length <= 14);

  if (raw.length < 2) return null;

  const uniq = [...new Map(raw.map((e) => [e.word, e])).values()];
  if (uniq.length > 60) uniq.length = 60;

  const base = uniq.map((e) => ({ word: e.word, clue: e.clue }));

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let order;
    if (attempt % 2 === 0) {
      order = [...base];
      shuffle(order, rng);
      order.sort((a, b) => b.word.length - a.word.length);
    } else {
      const sorted = [...base].sort((a, b) => b.word.length - a.word.length);
      const bandW = Math.min(12, Math.max(3, Math.ceil(sorted.length / 5)));
      const band = sorted.slice(0, bandW);
      const anchor = band[attempt % band.length];
      const rest = sorted.filter((x) => x.word !== anchor.word);
      shuffle(rest, rng);
      rest.sort((a, b) => b.word.length - a.word.length);
      order = [anchor, ...rest];
    }
    const out = tryBuildFromOrder(order, rng);
    if (out) return out;
  }

  return null;
}
