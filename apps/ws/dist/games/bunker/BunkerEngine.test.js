import { BunkerEngine, CHARACTERISTIC_KEYS } from './BunkerEngine.js';

const mkRoom = (n) => ({
  code: 'TEST',
  settings: { bunkerDurations: { intro: 0.01, reveal: 5, speech: 5, voting: 5, results: 0.01 } },
  players: Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, isOnline: true, isSpectator: false })),
  spectators: [],
});

const startNow = (g) => {
  // пропускаем intro-таймер: сразу к первому раунду
  g.start();
  g.startRevealPhase();
  return g;
};

describe('BunkerEngine — базовая раздача', () => {
  test('капасити = половина игроков, у всех полные карты без повторов профессий', () => {
    const g = new BunkerEngine(mkRoom(8));
    g.start();
    expect(g.capacity).toBe(4);
    expect(g.players).toHaveLength(8);
    for (const p of g.players) {
      for (const k of CHARACTERISTIC_KEYS) expect(p.card[k]).toBeTruthy();
    }
    const profs = g.players.map((p) => p.card.profession);
    expect(new Set(profs).size).toBe(profs.length); // профессии уникальны
    g.cleanup();
  });
});

describe('BunkerEngine — фаза вскрытия', () => {
  test('игрок вскрывает одну карту за раунд; вторая отклоняется', () => {
    const g = startNow(new BunkerEngine(mkRoom(4)));
    expect(g.phase).toBe('reveal');
    expect(g.reveal('p0', 'profession').ok).toBe(true);
    expect(g.reveal('p0', 'health').ok).toBe(false); // уже вскрывался в этом раунде
    expect(g.players[0].revealed.has('profession')).toBe(true);
    g.cleanup();
  });

  test('когда все вскрылись — авто-переход к обсуждению', () => {
    const g = startNow(new BunkerEngine(mkRoom(3)));
    g.reveal('p0', 'profession');
    g.reveal('p1', 'profession');
    g.reveal('p2', 'profession');
    expect(g.phase).toBe('discussion');
    expect(g.activeSpeaker).toBe('p0');
    g.cleanup();
  });
});

describe('BunkerEngine — обсуждение и голосование', () => {
  const toVoting = (g) => {
    for (const p of g.players) g.reveal(p.id, 'profession');
    // все по очереди завершают речь
    while (g.phase === 'discussion') g.finishSpeaking(g.activeSpeaker);
    return g;
  };

  test('очередь речи проходит всех живых и уходит в голосование', () => {
    const g = toVoting(startNow(new BunkerEngine(mkRoom(3))));
    expect(g.phase).toBe('voting');
    g.cleanup();
  });

  test('большинство изгоняет; изгнанному вскрываются все карты', () => {
    const g = toVoting(startNow(new BunkerEngine(mkRoom(4))));
    g.vote('p0', 'p3');
    g.vote('p1', 'p3');
    g.vote('p2', 'p3');
    g.vote('p3', 'p0');
    expect(g.phase).toBe('results');
    const exiled = g.getPlayer('p3');
    expect(exiled.alive).toBe(false);
    expect(exiled.revealed.size).toBe(CHARACTERISTIC_KEYS.length);
    g.cleanup();
  });

  test('ничья → revote только по кандидатам; вторая ничья → никто не изгнан', () => {
    const g = toVoting(startNow(new BunkerEngine(mkRoom(4))));
    g.vote('p0', 'p1'); g.vote('p1', 'p0');
    g.vote('p2', 'p1'); g.vote('p3', 'p0'); // 2:2 → revote p0/p1
    expect(g.phase).toBe('revote');
    expect(g.vote('p2', 'p3').ok).toBe(false); // p3 не кандидат
    g.vote('p0', 'p1'); g.vote('p1', 'p0');
    g.vote('p2', 'p1'); g.vote('p3', 'p0'); // снова 2:2
    expect(g.phase).toBe('results');
    expect(g.alive()).toHaveLength(4); // никто не выбыл
    g.cleanup();
  });

  test('нельзя голосовать против себя и против мёртвого', () => {
    const g = toVoting(startNow(new BunkerEngine(mkRoom(4))));
    expect(g.vote('p0', 'p0').ok).toBe(false);
    g.getPlayer('p2').alive = false;
    expect(g.vote('p0', 'p2').ok).toBe(false);
    g.cleanup();
  });
});

describe('BunkerEngine — карты действий', () => {
  const toDiscussion = (g) => {
    for (const p of g.players) g.reveal(p.id, 'bio');
    return g;
  };

  test('у всех есть карта действия, бункер сгенерирован, стаж в профессии', () => {
    const g = new BunkerEngine(mkRoom(4));
    g.start();
    expect(g.bunker.size).toBeGreaterThan(0);
    expect(g.bunker.items).toHaveLength(3);
    for (const p of g.players) {
      expect(p.actionCard.id).toBeTruthy();
      expect(p.card.profession).toMatch(/стаж \d+/);
    }
    g.cleanup();
  });

  test('обмен профессиями работает и одноразовый', () => {
    const g = startNow(new BunkerEngine(mkRoom(4)));
    toDiscussion(g);
    const p0 = g.getPlayer('p0'); const p1 = g.getPlayer('p1');
    p0.actionCard = { id: 'swap-profession', name: 'Рокировка', needsTarget: true, used: false };
    const a = p0.card.profession; const b = p1.card.profession;
    expect(g.useActionCard('p0', 'p1').ok).toBe(true);
    expect(p0.card.profession).toBe(b);
    expect(p1.card.profession).toBe(a);
    expect(g.useActionCard('p0', 'p1').ok).toBe(false); // уже использована
    g.cleanup();
  });

  test('бронь сжигает голоса, двойной голос весит два', () => {
    const g = startNow(new BunkerEngine(mkRoom(4)));
    toDiscussion(g);
    while (g.phase === 'discussion') g.finishSpeaking(g.activeSpeaker);
    const p3 = g.getPlayer('p3');
    p3.immune = true;                       // бронь на p3
    g.getPlayer('p0').doubleVote = true;    // голос p0 ×2
    g.vote('p0', 'p1');                     // 2 голоса против p1
    g.vote('p1', 'p3'); g.vote('p2', 'p3'); g.vote('p3', 'p1'); // 2 «сгорают» + 1 против p1
    expect(g.phase).toBe('results');
    expect(g.getPlayer('p1').alive).toBe(false); // изгнан p1 (3 против), p3 спасён бронёй
    expect(p3.alive).toBe(true);
    // флаги сброшены после раунда
    expect(p3.immune).toBe(false);
    expect(g.getPlayer('p0').doubleVote).toBe(false);
    g.cleanup();
  });

  test('рентген вскрывает скрытую карту цели', () => {
    const g = startNow(new BunkerEngine(mkRoom(4)));
    toDiscussion(g);
    const p0 = g.getPlayer('p0');
    p0.actionCard = { id: 'xray', name: 'Рентген', needsTarget: true, used: false };
    const before = g.getPlayer('p1').revealed.size;
    expect(g.useActionCard('p0', 'p1').ok).toBe(true);
    expect(g.getPlayer('p1').revealed.size).toBe(before + 1);
    g.cleanup();
  });
});

describe('BunkerEngine — конец игры', () => {
  test('игра заканчивается, когда живых == мест; выжившие объявлены', () => {
    jest.useFakeTimers();
    const g = startNow(new BunkerEngine(mkRoom(4))); // capacity 2
    const ended = [];
    g.on('game:ended', (d) => ended.push(d));
    // раунд 1: изгоняем p3
    for (const p of g.players) g.reveal(p.id, 'profession');
    while (g.phase === 'discussion') g.finishSpeaking(g.activeSpeaker);
    g.vote('p0', 'p3'); g.vote('p1', 'p3'); g.vote('p2', 'p3'); g.vote('p3', 'p0');
    jest.advanceTimersByTime(100); // results → следующий раунд (живых 3 > 2)
    expect(g.phase).toBe('reveal');
    // раунд 2: изгоняем p2 → живых 2 == capacity → конец
    for (const p of g.alive()) g.reveal(p.id, 'health');
    while (g.phase === 'discussion') g.finishSpeaking(g.activeSpeaker);
    g.vote('p0', 'p2'); g.vote('p1', 'p2'); g.vote('p2', 'p0');
    jest.advanceTimersByTime(100);
    expect(g.phase).toBe('gameOver');
    expect(ended[0].survivors).toHaveLength(2);
    g.cleanup();
    jest.useRealTimers();
  });
});
