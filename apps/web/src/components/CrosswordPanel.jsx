import React, { useMemo, useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import './CrosswordPanel.css';

const DIR_LABEL = { across: 'По горизонтали', down: 'По вертикали' };
const DIR_ARROW = { across: '→', down: '↓' };

const MODE_COPY = {
  coop: { label: 'Совместно', desc: 'Одна сетка на всех. За каждое слово +10 очков каждому.' },
  corporate: { label: 'Корпоратив', desc: 'Большое поле на команду. Очки получает вся комната.' },
  duel: { label: 'Дуэль 1×1', desc: 'Только два игрока. Слово засчитывается тому, кто первым ввёл верный ответ.' },
  race: { label: 'Гонка', desc: 'От двух игроков. Слово — только первому, кто успел (как в дуэли, но для компании).' },
  solo_race: { label: 'Соло на время', desc: 'Один игрок, таймер, личный зачёт.' },
  solo_casual: { label: 'Соло спокойно', desc: 'Без таймера, в своём темпе.' },
};

/** Синхронно с CSS `--sw-natural-cell` — влияет на расчёт масштаба */
const NATURAL_CELL_PX = 28;
const MIN_CELL_VISIBLE_PX = 20;

const RU_KEYBOARD_ROWS = [
  ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х', 'Ъ'],
  ['Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э'],
  ['Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю', 'Ё'],
];

function isBlock(ch) {
  return ch === '#';
}

function cellAt(grid, r, c) {
  const row = grid[r];
  if (row == null) return '#';
  const s = String(row);
  return s[c] ?? '#';
}

function isRevealedLetter(ch) {
  return ch !== '.' && ch !== '#' && ch !== '' && ch !== undefined;
}

function clueCells(clue) {
  if (!clue || typeof clue.row !== 'number' || typeof clue.col !== 'number' || typeof clue.len !== 'number') return [];
  const { row, col, dir, len } = clue;
  const cells = [];
  for (let i = 0; i < len; i++) {
    const r = dir === 'across' ? row : row + i;
    const c = dir === 'across' ? col + i : col;
    cells.push({ r, c, i });
  }
  return cells;
}

function normLetter(key) {
  if (!key || key.length !== 1) return null;
  const upper = key.toUpperCase();
  if (/[А-ЯЁ]/i.test(upper)) return upper.replace(/Ё/g, 'Е');
  return null;
}

/** Визуальные переносы в духе журнальных сканвордов (подсказка читается строками). */
function formatClueDisplay(text) {
  const s = String(text || '—').trim();
  if (s.length <= 28) return s;
  const parts = [];
  let rest = s;
  while (rest.length > 0) {
    const chunk = rest.slice(0, 26);
    const lastSpace = chunk.lastIndexOf(' ');
    const take = lastSpace > 12 ? chunk.slice(0, lastSpace) : chunk;
    parts.push(take.trim());
    rest = rest.slice(take.length).trim();
  }
  return parts.join('\u200B · \u200B');
}

/**
 * @param {{
 *   grid?: string[],
 *   clues?: Array<{ num: number, dir: string, clue: string, row?: number, col?: number, len?: number }>,
 *   solvedNums?: number[],
 *   onSubmitWord?: (clueNum: number, word: string) => Promise<boolean>,
 *   wrongSignal?: number,
 *   mode?: string,
 *   players?: Array<{ id: string, name: string, score?: number }>,
 *   myPlayerId?: string,
 *   timeLeft?: number,
 *   timeLimited?: boolean,
 * }} props
 */
export function CrosswordPanel({
  grid = [],
  clues = [],
  solvedNums = [],
  onSubmitWord,
  wrongSignal = 0,
  mode = 'coop',
  players = [],
  myPlayerId = '',
  timeLeft = 0,
  timeLimited = true,
}) {
  const solvedSet = useMemo(() => new Set((solvedNums || []).map(Number)), [solvedNums]);
  const [draft, setDraft] = useState({});
  const [activeClueNum, setActiveClueNum] = useState(null);
  const [cursor, setCursor] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorFlash, setErrorFlash] = useState(false);
  const [vkbOpen, setVkbOpen] = useState(false);
  const boardRef = useRef(null);
  const viewportRef = useRef(null);
  const measureRef = useRef(null);
  const [boardScale, setBoardScale] = useState(1);
  const [boardNatural, setBoardNatural] = useState({ w: 0, h: 0 });

  const modeInfo = MODE_COPY[mode] || MODE_COPY.coop;
  const showVersusBoard = ['duel', 'race', 'solo_race'].includes(mode);

  useEffect(() => {
    if (!wrongSignal) return undefined;
    setErrorFlash(true);
    const t = setTimeout(() => setErrorFlash(false), 700);
    return () => clearTimeout(t);
  }, [wrongSignal]);

  const starters = useMemo(() => {
    const m = new Map();
    (clues || []).forEach((c) => {
      if (typeof c.row !== 'number' || typeof c.col !== 'number') return;
      const k = `${c.row},${c.col}`;
      const arr = m.get(k) || [];
      arr.push(c.num);
      m.set(k, arr);
    });
    m.forEach((nums, k) => {
      m.set(k, [...new Set(nums)].sort((a, b) => a - b));
    });
    return m;
  }, [clues]);

  const { across, down } = useMemo(() => {
    const a = [];
    const d = [];
    (clues || []).forEach((c) => {
      if (c.dir === 'across') a.push(c);
      else if (c.dir === 'down') d.push(c);
    });
    a.sort((x, y) => x.num - y.num);
    d.sort((x, y) => x.num - y.num);
    return { across: a, down: d };
  }, [clues]);

  const cluesByNum = useMemo(() => {
    const m = new Map();
    (clues || []).forEach((c) => m.set(c.num, c));
    return m;
  }, [clues]);

  const intersectionCountAt = useMemo(() => {
    const m = new Map();
    for (const cl of clues || []) {
      for (const { r, c } of clueCells(cl)) {
        const k = `${r},${c}`;
        m.set(k, (m.get(k) || 0) + 1);
      }
    }
    return m;
  }, [clues]);

  const unsolvedClues = useMemo(
    () => (clues || []).filter((c) => !solvedSet.has(c.num)),
    [clues, solvedSet],
  );

  const gridStats = useMemo(() => {
    let cols = 0;
    for (const row of grid || []) {
      cols = Math.max(cols, String(row || '').length);
    }
    return { rows: grid?.length || 0, cols };
  }, [grid]);

  const sortedPlayers = useMemo(() => {
    return [...(players || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [players]);

  const activeClue = activeClueNum != null ? cluesByNum.get(activeClueNum) : null;
  const activeCells = useMemo(() => (activeClue ? clueCells(activeClue) : []), [activeClue]);

  useEffect(() => {
    setDraft((prev) => {
      const next = { ...prev };
      let changed = false;
      grid.forEach((row, ri) => {
        String(row || '')
          .split('')
          .forEach((ch, ci) => {
            if (isRevealedLetter(ch)) {
              const k = `${ri},${ci}`;
              if (next[k]) {
                delete next[k];
                changed = true;
              }
            }
          });
      });
      return changed ? next : prev;
    });
  }, [grid]);

  useEffect(() => {
    if (activeClueNum != null && solvedSet.has(activeClueNum)) {
      const next = unsolvedClues[0];
      setActiveClueNum(next?.num ?? null);
      setCursor(0);
    }
  }, [solvedSet, activeClueNum, unsolvedClues]);

  useEffect(() => {
    if (activeClueNum == null && unsolvedClues.length > 0) {
      setActiveClueNum(unsolvedClues[0].num);
      setCursor(0);
    }
  }, [activeClueNum, unsolvedClues]);

  useEffect(() => {
    if (activeCells.length > 0 && cursor >= activeCells.length) {
      setCursor(activeCells.length - 1);
    }
  }, [activeCells, cursor]);

  const displayChar = useCallback(
    (r, c) => {
      const ch = cellAt(grid, r, c);
      if (isRevealedLetter(ch)) return ch;
      return draft[`${r},${c}`] || '';
    },
    [grid, draft],
  );

  const buildWordForClue = useCallback(
    (clue) => {
      const cells = clueCells(clue);
      return cells
        .map(({ r, c }) => {
          const ch = cellAt(grid, r, c);
          if (isRevealedLetter(ch)) return ch;
          return (draft[`${r},${c}`] || '').toUpperCase();
        })
        .join('');
    },
    [grid, draft],
  );

  const currentDraftWord = activeClue ? buildWordForClue(activeClue) : '';

  const setLetterAt = useCallback(
    (r, c, letter) => {
      const k = `${r},${c}`;
      setDraft((prev) => {
        const ch = cellAt(grid, r, c);
        if (isRevealedLetter(ch)) return prev;
        if (!letter) {
          const next = { ...prev };
          delete next[k];
          return next;
        }
        return { ...prev, [k]: letter };
      });
    },
    [grid],
  );

  const insertLetter = useCallback(
    (key) => {
      const letter = normLetter(key);
      if (!letter || !activeClue || !activeCells.length || solvedSet.has(activeClue.num)) return;
      const { r, c } = activeCells[cursor];
      setLetterAt(r, c, letter);
      if (cursor < activeCells.length - 1) setCursor((x) => x + 1);
    },
    [activeClue, activeCells, cursor, solvedSet, setLetterAt],
  );

  const focusBoard = () => {
    boardRef.current?.focus();
  };

  const moveCursor = useCallback(
    (delta) => {
      if (!activeCells.length) return;
      setCursor((i) => Math.max(0, Math.min(activeCells.length - 1, i + delta)));
    },
    [activeCells.length],
  );

  const handleSubmit = useCallback(async () => {
    if (!onSubmitWord || !activeClue || solvedSet.has(activeClue.num) || submitting) return;
    const word = buildWordForClue(activeClue);
    if (word.length !== activeClue.len) return;
    setSubmitting(true);
    try {
      await onSubmitWord(activeClue.num, word);
    } finally {
      setSubmitting(false);
    }
  }, [onSubmitWord, activeClue, solvedSet, submitting, buildWordForClue]);

  const selectClueByCell = useCallback(
    (r, c) => {
      const hits = (clues || []).filter((cl) => {
        if (solvedSet.has(cl.num)) return false;
        return clueCells(cl).some((cell) => cell.r === r && cell.c === c);
      });
      if (!hits.length) return;
      hits.sort((a, b) => a.num - b.num);
      const pick = hits.find((h) => h.num === activeClueNum) || hits[0];
      setActiveClueNum(pick.num);
      const cells = clueCells(pick);
      const idx = cells.findIndex((cell) => cell.r === r && cell.c === c);
      setCursor(idx >= 0 ? idx : 0);
      focusBoard();
    },
    [clues, solvedSet, activeClueNum],
  );

  const cycleClue = useCallback(
    (dir) => {
      if (!unsolvedClues.length) return;
      const idx = unsolvedClues.findIndex((c) => c.num === activeClueNum);
      const base = idx < 0 ? 0 : idx;
      const next = (base + dir + unsolvedClues.length) % unsolvedClues.length;
      setActiveClueNum(unsolvedClues[next].num);
      setCursor(0);
      focusBoard();
    },
    [unsolvedClues, activeClueNum],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (!activeClue || !activeCells.length || solvedSet.has(activeClue.num)) return;

      const letter = normLetter(e.key);
      if (letter) {
        e.preventDefault();
        insertLetter(e.key);
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        const { r, c } = activeCells[cursor];
        const ch = cellAt(grid, r, c);
        if (isRevealedLetter(ch)) {
          moveCursor(-1);
          return;
        }
        if (draft[`${r},${c}`]) {
          setLetterAt(r, c, '');
          return;
        }
        if (cursor > 0) {
          const pi = cursor - 1;
          const p = activeCells[pi];
          setCursor(pi);
          if (p && !isRevealedLetter(cellAt(grid, p.r, p.c))) {
            setLetterAt(p.r, p.c, '');
          }
        }
        return;
      }

      if (e.key === 'ArrowRight' && activeClue.dir === 'across') {
        e.preventDefault();
        moveCursor(1);
      }
      if (e.key === 'ArrowLeft' && activeClue.dir === 'across') {
        e.preventDefault();
        moveCursor(-1);
      }
      if (e.key === 'ArrowDown' && activeClue.dir === 'down') {
        e.preventDefault();
        moveCursor(1);
      }
      if (e.key === 'ArrowUp' && activeClue.dir === 'down') {
        e.preventDefault();
        moveCursor(-1);
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        cycleClue(e.shiftKey ? -1 : 1);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [
      activeClue,
      activeCells,
      cursor,
      grid,
      draft,
      solvedSet,
      setLetterAt,
      insertLetter,
      moveCursor,
      cycleClue,
      handleSubmit,
    ],
  );

  const total = clues?.length || 0;
  const done = solvedSet.size;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  const cellActive = (r, c) =>
    activeCells.some((cell, idx) => cell.r === r && cell.c === c && idx === cursor);
  const cellInActiveWord = (r, c) => activeCells.some((cell) => cell.r === r && cell.c === c);

  const timerLabel =
    !timeLimited || mode === 'solo_casual'
      ? null
      : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`;

  const fitBoardToViewport = useCallback(() => {
    const vp = viewportRef.current;
    const inner = measureRef.current;
    if (!vp || !inner) return;
    const nw = inner.offsetWidth;
    const nh = inner.offsetHeight;
    if (nw < 8 || nh < 8) return;
    const pad = 8;
    const aw = Math.max(120, vp.clientWidth - pad);
    const ah = Math.max(120, vp.clientHeight - pad);
    let s = Math.min(1, aw / nw, ah / nh);
    const minScaleForReading = MIN_CELL_VISIBLE_PX / NATURAL_CELL_PX;
    if (s * NATURAL_CELL_PX < MIN_CELL_VISIBLE_PX) {
      s = Math.min(1, Math.max(s, minScaleForReading));
    }
    setBoardScale(s);
    setBoardNatural({ w: nw, h: nh });
  }, []);

  useLayoutEffect(() => {
    fitBoardToViewport();
    const vp = viewportRef.current;
    const inner = measureRef.current;
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(fitBoardToViewport);
    });
    if (vp) ro.observe(vp);
    if (inner) ro.observe(inner);
    window.addEventListener('resize', fitBoardToViewport);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fitBoardToViewport);
    };
  }, [grid, fitBoardToViewport]);

  return (
    <div className="scanword">
      <header className="scanword__hero">
        <div className="scanword__brand">
          <h2 className="scanword__title">Сканворд</h2>
          <p className="scanword__lede">
            Пересечения букв · горизонталь и вертикаль
          </p>
        </div>
        <div className="scanword__meta">
          <div className="scanword__chip scanword__chip--mode" title={modeInfo.desc}>
            <span className="scanword__chip-label">Режим</span>
            <span className="scanword__chip-value">{modeInfo.label}</span>
          </div>
          {gridStats.rows > 0 && (
            <div className="scanword__chip">
              <span className="scanword__chip-label">Сетка</span>
              <span className="scanword__chip-value">
                {gridStats.cols}×{gridStats.rows}
              </span>
            </div>
          )}
          {timerLabel != null && (
            <div className={`scanword__chip scanword__chip--timer ${timeLeft <= 30 && timeLeft > 0 ? 'scanword__chip--urgent' : ''}`}>
              <span className="scanword__chip-label">Время</span>
              <span className="scanword__chip-value scanword__chip-mono">{timerLabel}</span>
            </div>
          )}
          <div className="scanword__ring" aria-label={`Прогресс ${progressPct}%`}>
            <svg viewBox="0 0 36 36" className="scanword__ring-svg">
              <path
                className="scanword__ring-bg"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="scanword__ring-fg"
                strokeDasharray={`${progressPct}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="scanword__ring-label">{progressPct}%</span>
          </div>
        </div>
      </header>

      {showVersusBoard && sortedPlayers.length > 0 && (
        <aside className="scanword__scores" aria-label="Очки">
          <span className="scanword__scores-title">Зачёт</span>
          <ul className="scanword__scores-list">
            {sortedPlayers.map((p, i) => (
              <li
                key={p.id}
                className={`scanword__scores-row ${p.id === myPlayerId ? 'scanword__scores-row--me' : ''}`}
              >
                <span className="scanword__scores-rank">{i + 1}</span>
                <span className="scanword__scores-name">{p.name}</span>
                <span className="scanword__scores-pts">{Number(p.score) || 0}</span>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <div className="scanword__layout">
        <section className="scanword__sheet" aria-label="Сетка сканворда">
          <div className="scanword__sheet-inner">
            <div ref={viewportRef} className="scanword__viewport">
              <div
                className="scanword__board-slot"
                style={{
                  width: boardNatural.w > 0 ? boardNatural.w * boardScale : '100%',
                  height: boardNatural.h > 0 ? boardNatural.h * boardScale : 'min(65vh, 720px)',
                }}
              >
                <div
                  className="scanword__board-scale"
                  style={{
                    transform: `scale(${boardScale})`,
                    transformOrigin: 'top left',
                    width: boardNatural.w > 0 ? boardNatural.w : undefined,
                    height: boardNatural.h > 0 ? boardNatural.h : undefined,
                  }}
                >
                  <div ref={measureRef} className="scanword__board-measure">
                    <div
                      ref={boardRef}
                      className="scanword__board scanword__board--natural"
                      role="grid"
                      tabIndex={0}
                      onKeyDown={handleKeyDown}
                    >
                      {grid.map((row, ri) => (
                        <div key={ri} className="scanword__row" role="row">
                          {String(row || '')
                            .split('')
                            .map((cell, ci) => {
                              if (isBlock(cell)) {
                                return <span key={ci} className="scanword__cell scanword__cell--block" role="gridcell" />;
                              }
                              const nums = starters.get(`${ri},${ci}`);
                              const revealed = isRevealedLetter(cell);
                              const letter = revealed ? cell : displayChar(ri, ci);
                              const active = cellActive(ri, ci);
                              const inWord = cellInActiveWord(ri, ci);
                              const crossN = intersectionCountAt.get(`${ri},${ci}`) || 0;
                              const isCrossing = crossN >= 2;
                              const cellKey = `${ri},${ci}`;
                              const hasDraftLetter = !revealed && Boolean(draft[cellKey]);

                              return (
                                <button
                                  type="button"
                                  key={ci}
                                  tabIndex={-1}
                                  className={[
                                    'scanword__cell',
                                    revealed ? 'scanword__cell--revealed' : 'scanword__cell--empty',
                                    hasDraftLetter && 'scanword__cell--draft',
                                    inWord && 'scanword__cell--in-word',
                                    active && 'scanword__cell--active',
                                    isCrossing && 'scanword__cell--cross',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                  role="gridcell"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectClueByCell(ri, ci)}
                                >
                                  {nums && nums.length > 0 && (
                                    <span className="scanword__cell-nums">{nums.join('·')}</span>
                                  )}
                                  {letter ? <span className="scanword__cell-char">{letter}</span> : null}
                                </button>
                              );
                            })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="scanword__hint">
            <strong>Черновик:</strong> вводимые буквы остаются в клетках до проверки. После верного ответа они
            закрепляются; при ошибке можно исправить и снова нажать «Проверить». Клик по клетке — выбор слова;
            уголок — пересечение двух слов.
            {boardScale < 0.998 && boardNatural.w > 0 && (
              <span className="scanword__hint-scale">
                {' '}
                Масштаб ≈{Math.round(boardScale * 100)}% — при необходимости прокрутите область сетки.
              </span>
            )}
          </p>
        </section>

        <section className="scanword__clues-wrap" aria-label="Вопросы и ввод">
          <div className="scanword__toolbar">
            <div className="scanword__actions">
              <button
                type="button"
                className={[
                  'scanword__check',
                  errorFlash && 'scanword__check--shake',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={
                  !onSubmitWord ||
                  !activeClue ||
                  solvedSet.has(activeClue?.num) ||
                  submitting ||
                  currentDraftWord.length !== activeClue?.len
                }
                title={
                  !activeClue
                    ? 'Выберите номер подсказки или кликните по клетке'
                    : solvedSet.has(activeClue.num)
                      ? 'Слово уже отгадано'
                      : currentDraftWord.length !== activeClue.len
                        ? `Введите все ${activeClue.len} букв (сейчас ${currentDraftWord.length}) — буквы сохраняются до проверки`
                        : 'Отправить слово на проверку (или Enter)'
                }
                onClick={() => void handleSubmit()}
              >
                {submitting ? 'Проверка…' : 'Проверить слово'}
              </button>
              {activeClue && (
                <span className="scanword__actions-meta">
                  №{activeClue.num} · {DIR_ARROW[activeClue.dir]} {activeClue.len} букв · введено {currentDraftWord.length}
                </span>
              )}
            </div>
            <button type="button" className="scanword__vkb-toggle" onClick={() => setVkbOpen((v) => !v)}>
              {vkbOpen ? 'Скрыть клавиатуру' : 'Экранная клавиатура'}
            </button>
          </div>
          {vkbOpen && (
            <div className="scanword__vkb" aria-label="Русская раскладка">
              {RU_KEYBOARD_ROWS.map((row, ri) => (
                <div key={ri} className="scanword__vkb-row">
                  {row.map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      className="scanword__vkb-key"
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertLetter(ch)}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          <details className="scanword__tips">
            <summary className="scanword__tips-summary">Подсказки по вводу</summary>
            <ul className="scanword__tips-list">
              <li>Буквы набираются в активной подсказке и <strong>не сбрасываются</strong>, пока вы не нажмёте «Проверить слово» (или Enter при полном слове).</li>
              <li>Неверный ответ <strong>не стирает</strong> ввод — поправьте буквы и проверьте снова.</li>
              <li>На пересечении одна буква для двух слов: она видна в обеих подсказках.</li>
              <li>
                <kbd>Tab</kbd> — другая подсказка · <kbd>Enter</kbd> — проверка, если набрано полное слово · стрелки — по
                клеткам текущего слова
              </li>
            </ul>
          </details>

          <h3 className="scanword__clues-heading">Вопросы</h3>
          <div className="scanword__clues scanword__clues--columns">
            {across.length > 0 && (
              <section className="scanword__clue-block" aria-labelledby="sw-across">
                <h3 id="sw-across" className="scanword__clue-heading">
                  <span className="scanword__clue-dir">{DIR_ARROW.across}</span> {DIR_LABEL.across}
                </h3>
                <ol className="scanword__clue-list">
                  {across.map((c) => (
                    <li key={`a-${c.num}`} className="scanword__clue-li">
                      <button
                        type="button"
                        tabIndex={-1}
                        className={`scanword__clue-btn ${solvedSet.has(c.num) ? 'scanword__clue-btn--done' : ''} ${activeClueNum === c.num ? 'scanword__clue-btn--active' : ''}`}
                        title={String(c.clue || '').trim() || `Подсказка ${c.num}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setActiveClueNum(c.num);
                          setCursor(0);
                          focusBoard();
                        }}
                        disabled={solvedSet.has(c.num)}
                      >
                        <span className="scanword__clue-num">{c.num}</span>
                        <span className="scanword__clue-text">{formatClueDisplay(c.clue)}</span>
                        {typeof c.len === 'number' && <span className="scanword__clue-len">{c.len}</span>}
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {down.length > 0 && (
              <section className="scanword__clue-block" aria-labelledby="sw-down">
                <h3 id="sw-down" className="scanword__clue-heading">
                  <span className="scanword__clue-dir">{DIR_ARROW.down}</span> {DIR_LABEL.down}
                </h3>
                <ol className="scanword__clue-list">
                  {down.map((c) => (
                    <li key={`d-${c.num}`} className="scanword__clue-li">
                      <button
                        type="button"
                        tabIndex={-1}
                        className={`scanword__clue-btn ${solvedSet.has(c.num) ? 'scanword__clue-btn--done' : ''} ${activeClueNum === c.num ? 'scanword__clue-btn--active' : ''}`}
                        title={String(c.clue || '').trim() || `Подсказка ${c.num}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setActiveClueNum(c.num);
                          setCursor(0);
                          focusBoard();
                        }}
                        disabled={solvedSet.has(c.num)}
                      >
                        <span className="scanword__clue-num">{c.num}</span>
                        <span className="scanword__clue-text">{formatClueDisplay(c.clue)}</span>
                        {typeof c.len === 'number' && <span className="scanword__clue-len">{c.len}</span>}
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        </section>
      </div>

      <footer className="scanword__footer">Кратко: черновик в клетках до проверки · см. «Подсказки по вводу» выше</footer>
    </div>
  );
}
