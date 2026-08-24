import { MelodyEngine, matchesGuess } from './MelodyEngine.js';

const mkRoom = (n, cfg = {}) => ({
  code: 'TEST',
  settings: { melodyConfig: cfg },
  players: Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, isSpectator: false })),
  spectators: [],
});

describe('matchesGuess — фаззи-сравнение', () => {
  const mel = { title: 'В лесу родилась ёлочка', aliases: ['елочка', 'в лесу родилась елочка'] };
  test('точное, алиас, ё/е, регистр, вхождение', () => {
    expect(matchesGuess('Ёлочка', mel)).toBe(true);
    expect(matchesGuess('елочка', mel)).toBe(true);
    expect(matchesGuess('в лесу родилась елочка!', mel)).toBe(true);
    expect(matchesGuess('лесу родилась', mel)).toBe(true);
  });
  test('мусор не проходит', () => {
    expect(matchesGuess('калинка', mel)).toBe(false);
    expect(matchesGuess('ел', mel)).toBe(false);
    expect(matchesGuess('', mel)).toBe(false);
  });
});

describe('MelodyEngine — раунды и попытки', () => {
  test('старт: интро → раунд 1, попытка 1 = 4 ноты, 30 очков', () => {
    jest.useFakeTimers();
    const g = new MelodyEngine(mkRoom(2));
    const snippets = [];
    g.on('melody:snippet', (d) => snippets.push(d));
    g.start();
    expect(g.phase).toBe('intro');
    jest.advanceTimersByTime(5100);
    expect(g.phase).toBe('guessing');
    expect(snippets[0].attempt).toBe(1);
    expect(snippets[0].notes).toHaveLength(4);
    expect(snippets[0].points).toBe(30);
    expect(snippets[0].category).toBeTruthy(); // категория объявляется с 1-й попытки
    g.cleanup(); jest.useRealTimers();
  });

  test('таймаут попытки → больше нот и меньше очков; после 3-й — reveal без победителя', () => {
    jest.useFakeTimers();
    const g = new MelodyEngine(mkRoom(2, { attemptTime: 10 }));
    const snippets = []; const reveals = [];
    g.on('melody:snippet', (d) => snippets.push(d));
    g.on('melody:reveal', (d) => reveals.push(d));
    g.start();
    jest.advanceTimersByTime(5100);      // intro → attempt 1
    jest.advanceTimersByTime(10100);     // → attempt 2
    expect(snippets[1].notes).toHaveLength(8);
    expect(snippets[1].points).toBe(20);
    jest.advanceTimersByTime(10100);     // → attempt 3 (вся мелодия)
    expect(snippets[2].notes.length).toBeGreaterThan(8);
    jest.advanceTimersByTime(10100);     // → reveal
    expect(g.phase).toBe('reveal');
    expect(reveals[0].winner).toBeNull();
    g.cleanup(); jest.useRealTimers();
  });

  test('правильный ответ даёт очки попытки и завершает раунд', () => {
    jest.useFakeTimers();
    const g = new MelodyEngine(mkRoom(2));
    g.start();
    jest.advanceTimersByTime(5100);
    const title = g.current.title;
    const res = g.submitGuess('p0', title);
    expect(res.correct).toBe(true);
    expect(g.getPlayer('p0').score).toBe(30);
    expect(g.phase).toBe('reveal');
    g.cleanup(); jest.useRealTimers();
  });

  test('кулдаун 2с между попытками игрока', () => {
    jest.useFakeTimers();
    const g = new MelodyEngine(mkRoom(2));
    g.start();
    jest.advanceTimersByTime(5100);
    expect(g.submitGuess('p0', 'неправильный ответ').correct).toBe(false);
    expect(g.submitGuess('p0', 'другая попытка').ok).toBe(false); // кулдаун
    g.cleanup(); jest.useRealTimers();
  });

  test('настройки хоста: rounds ограничивает игру, hints=false отключает подсказку', () => {
    jest.useFakeTimers();
    const g = new MelodyEngine(mkRoom(1, { rounds: 3, hints: false, attemptTime: 8 }));
    expect(g.maxRounds).toBe(3);
    const hosts = [];
    g.on('melody:host', (d) => hosts.push(d.text));
    g.start();
    jest.advanceTimersByTime(5100);
    g.emitHint();
    expect(hosts.some((t) => t.startsWith('Так уж и быть'))).toBe(false);
    g.cleanup(); jest.useRealTimers();
  });

  test('чарт-режим: превью вместо нот, угадывание по исполнителю, фолбэк при пустом пуле', async () => {
    jest.useFakeTimers();
    const mkChart = (resolver) => {
      const room = mkRoom(2, { mode: 'chart', attemptTime: 10 });
      return new MelodyEngine(room, null, { resolvePreview: resolver });
    };
    const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
    // happy-path: резолвер отдаёт превью
    const g = mkChart(async () => ({ previewUrl: 'https://x/preview.m4a', artwork: 'https://x/a.jpg' }));
    const snippets = [];
    g.on('melody:snippet', (d) => snippets.push(d));
    g.start();
    await flush();
    jest.advanceTimersByTime(5100);
    await flush();
    jest.advanceTimersByTime(1600); // на случай ретрая ожидания пула
    await flush();
    expect(g.mode).toBe('chart');
    expect(snippets[0].previewUrl).toBe('https://x/preview.m4a');
    expect(snippets[0].playSeconds).toBe(3);
    expect(snippets[0].notes).toBeNull();
    // угадываем по ИСПОЛНИТЕЛЮ
    const res = g.submitGuess('p0', g.current.artist);
    expect(res.correct).toBe(true);
    g.cleanup();

    // фолбэк: резолвер ничего не нашёл → движок честно уходит в ноты
    const g2 = mkChart(async () => null);
    g2.start();
    await flush();
    jest.advanceTimersByTime(5100);
    await flush();
    jest.advanceTimersByTime(1600);
    await flush();
    expect(g2.mode).toBe('notes');
    expect(g2.current.notes?.length).toBeGreaterThan(0);
    g2.cleanup();
    jest.useRealTimers();
  });

  test('фильтр категорий хоста ограничивает пул мелодий', () => {
    const g = new MelodyEngine(mkRoom(1, { categories: ['Классика'] }));
    expect(g._notesBank.length).toBeGreaterThan(0);
    expect(g._notesBank.every((m) => m.category === 'Классика')).toBe(true);
    // пустой/кривой выбор → весь банк
    const g2 = new MelodyEngine(mkRoom(1, { categories: ['Несуществующая'] }));
    expect(g2._notesBank.length).toBeGreaterThan(30);
    g.cleanup(); g2.cleanup();
  });

  test('игра заканчивается после maxRounds с победителем', () => {
    jest.useFakeTimers();
    const g = new MelodyEngine(mkRoom(2, { rounds: 3 }));
    const ended = [];
    g.on('game:ended', (d) => ended.push(d));
    g.start();
    jest.advanceTimersByTime(5100);
    for (let r = 0; r < 3; r++) {
      g.submitGuess('p0', g.current.title); // угадываем мгновенно
      jest.advanceTimersByTime(7100);       // reveal → следующий раунд
      jest.advanceTimersByTime(2100);       // сдвиг кулдауна
    }
    expect(g.phase).toBe('gameOver');
    expect(ended[0].winner.id).toBe('p0');
    expect(ended[0].winner.score).toBe(90);
    g.cleanup(); jest.useRealTimers();
  });
});
