import { MafiaGame } from './MafiaGame.js';

const TEAM = {
  civilian: 'town', sheriff: 'town', doctor: 'town', putana: 'town', mayor: 'town',
  mafia: 'mafia', don: 'mafia', poisoner: 'mafia', maniac: 'maniac', vampire: 'vampire',
};

function makeGame(roles, options = {}) {
  const players = roles.map((r, i) => ({ id: 'p' + i, name: 'P' + i }));
  const g = new MafiaGame({ code: 'TEST', players }, null, options);
  g.players = roles.map((role, i) => ({
    id: 'p' + i, name: 'P' + i, role, team: TEAM[role], alive: true,
    poisoned: false, blockedTonight: false, immuneTonight: false,
    cannotVoteToday: false, pendingVampire: false, deathCause: null,
  }));
  g.phase = 'night';
  g.day = 1;
  g._nightActions.clear();
  return g;
}
const act = (g, actorId, target) => g._nightActions.set(actorId, { target });
const alive = (g, id) => g.getPlayer(id).alive;

describe('MafiaGame — матрица ночи', () => {
  test('Доктор лечит цель мафии — цель выживает', () => {
    const g = makeGame(['don', 'doctor', 'civilian', 'civilian']); // p0 don, p1 doc, p2,p3 civ
    act(g, 'p0', 'p2'); // don убивает p2
    act(g, 'p1', 'p2'); // doctor лечит p2
    const r = g.resolveNight();
    expect(r.kills).not.toContain('p2');
    expect(alive(g, 'p2')).toBe(true);
    g.cleanup();
  });

  test('Путана блокирует Дона → стреляет рядовой; цель Дона выживает', () => {
    const g = makeGame(['don', 'mafia', 'putana', 'civilian', 'civilian']);
    act(g, 'p2', 'p0'); // путана блокирует дона
    act(g, 'p0', 'p3'); // дон целит p3 (заблокирован)
    act(g, 'p1', 'p4'); // рядовой целит p4
    const r = g.resolveNight();
    expect(alive(g, 'p3')).toBe(true);   // выстрел дона отменён блоком
    expect(alive(g, 'p4')).toBe(false);  // стреляет рядовой
    expect(g.getPlayer('p0').cannotVoteToday).toBe(true); // путана лишила голоса
    g.cleanup();
  });

  test('Путана даёт цели иммунитет от убийства', () => {
    const g = makeGame(['don', 'putana', 'civilian', 'civilian']);
    act(g, 'p1', 'p2'); // путана навещает p2 → иммунитет
    act(g, 'p0', 'p2'); // дон стреляет в p2
    g.resolveNight();
    expect(alive(g, 'p2')).toBe(true);
    g.cleanup();
  });

  test('Маньяк может навестись на мафию без ошибки и убить', () => {
    const g = makeGame(['maniac', 'don', 'civilian']);
    const res = g.submitNightAction('p0', { target: 'p1' }); // маньяк → дон
    expect(res.ok).toBe(true); // не выдаём ошибку
    act(g, 'p1', 'p2'); // дон стреляет p2 чтобы не завершить игру раньше
    g.resolveNight();
    expect(alive(g, 'p1')).toBe(false); // дон убит маньяком
    g.cleanup();
  });

  test('Укус вампира по мафии не срабатывает; по мирному — помечает конверсию', () => {
    const g = makeGame(['vampire', 'don', 'civilian', 'civilian']);
    act(g, 'p0', 'p1'); // вампир кусает дона → fail
    g.resolveNight();
    expect(g.getPlayer('p1').pendingVampire).toBe(false);
    g.cleanup();

    const g2 = makeGame(['vampire', 'don', 'civilian', 'civilian']);
    act(g2, 'p0', 'p2'); // вампир кусает мирного p2
    g2.resolveNight();
    expect(g2.getPlayer('p2').pendingVampire).toBe(true);
    g2.cleanup();
  });

  test('Покусанный конвертируется в вампира на следующую ночь', () => {
    const g = makeGame(['vampire', 'don', 'civilian', 'civilian', 'civilian']);
    g.getPlayer('p2').pendingVampire = true;
    g.phase = 'day';
    g.startNight(); // переход к следующей ночи → конверсия
    expect(g.getPlayer('p2').role).toBe('vampire');
    expect(g.getPlayer('p2').team).toBe('vampire');
    g.cleanup();
  });

  test('Шериф видит мафию; Дон маскируется', () => {
    const g = makeGame(['sheriff', 'don', 'mafia', 'civilian']);
    act(g, 'p0', 'p2'); // проверяет рядового → мафия
    let checks = g.resolveNight().checks;
    expect(checks.find((c) => c.targetId === 'p2').isMafia).toBe(true);
    g.cleanup();

    const g2 = makeGame(['sheriff', 'don', 'mafia', 'civilian']);
    act(g2, 'p0', 'p1'); // проверяет дона → НЕ мафия (маскировка)
    checks = g2.resolveNight().checks;
    expect(checks.find((c) => c.targetId === 'p1').isMafia).toBe(false);
    g2.cleanup();
  });
});

describe('MafiaGame — отравление mid-speech', () => {
  test('Отравленный умирает через 5с после получения слова', () => {
    jest.useFakeTimers();
    const g = makeGame(['don', 'civilian', 'civilian', 'civilian'], { midSpeechPoisonMs: 5000 });
    g.getPlayer('p1').poisoned = true;
    const events = [];
    g.on('playerDiedMidSpeech', (d) => events.push(d.playerId));
    g.beginSpeakingTurn('p1');
    expect(alive(g, 'p1')).toBe(true); // ещё жив
    jest.advanceTimersByTime(5000);
    expect(alive(g, 'p1')).toBe(false); // умер на речи
    expect(events).toContain('p1');
    g.cleanup();
    jest.useRealTimers();
  });

  test('Неотравленный спикер не умирает', () => {
    jest.useFakeTimers();
    const g = makeGame(['don', 'civilian', 'civilian'], { midSpeechPoisonMs: 5000 });
    g.beginSpeakingTurn('p1');
    jest.advanceTimersByTime(5000);
    expect(alive(g, 'p1')).toBe(true);
    g.cleanup();
    jest.useRealTimers();
  });
});

describe('MafiaGame — ничьи и счётчик дней без казни', () => {
  test('2 дня подряд без казни → побеждает Мафия', () => {
    const g = makeGame(['don', 'civilian', 'civilian', 'civilian'], { maxDaysWithoutExecution: 2 });
    const ended = [];
    g.on('game:ended', (res) => ended.push(res.winner));
    g.phase = 'voting';
    g.noExecution('tie'); // день 1 без казни → счётчик 1
    expect(g.winner).toBeNull();
    expect(g.daysWithoutExecution).toBe(1);
    g.phase = 'voting';
    g.noExecution('tie'); // день 2 без казни → мафия
    expect(ended).toContain('mafia');
    g.cleanup();
  });

  test('Казнь обнуляет счётчик дней без казни', () => {
    const g = makeGame(['don', 'civilian', 'civilian', 'civilian', 'civilian']);
    g.daysWithoutExecution = 1;
    g.phase = 'voting';
    g.execute('p1');
    expect(g.daysWithoutExecution).toBe(0);
    expect(alive(g, 'p1')).toBe(false);
    g.cleanup();
  });
});

describe('MafiaGame — бот-мозг (эвристика)', () => {
  test('Мафия-бот ночью целит НЕ в свою команду', () => {
    const g = makeGame(['don', 'mafia', 'civilian', 'civilian', 'sheriff']);
    for (let i = 0; i < 10; i++) {
      const t = g.botNightTarget('p0'); // don
      expect(g.getPlayer(t).team).not.toBe('mafia');
    }
    g.cleanup();
  });

  test('Бот-шериф голосует за подтверждённую мафию', () => {
    const g = makeGame(['sheriff', 'don', 'civilian', 'civilian']);
    g._sheriffChecks.set('p0', new Map([['p1', true]])); // шериф знает: p1 мафия
    expect(g.botVoteTarget('p0')).toBe('p1');
    g.cleanup();
  });

  test('botSpeak шлёт реплику с playerId', () => {
    const g = makeGame(['civilian', 'don', 'civilian', 'civilian']);
    const said = [];
    g.on('bot:speech', (d) => said.push(d));
    g.botSpeak('p0');
    expect(said.length).toBe(1);
    expect(said[0].playerId).toBe('p0');
    expect(typeof said[0].text).toBe('string');
    g.cleanup();
  });
});

describe('MafiaGame — условия победы', () => {
  test('Город побеждает, когда нет угроз', () => {
    const g = makeGame(['don', 'civilian', 'civilian']);
    g.getPlayer('p0').alive = false; // дон мёртв
    const ended = [];
    g.on('game:ended', (r) => ended.push(r.winner));
    g.checkWin();
    expect(ended).toContain('town');
    g.cleanup();
  });

  test('Мафия побеждает при паритете', () => {
    const g = makeGame(['don', 'mafia', 'civilian', 'civilian']);
    g.getPlayer('p2').alive = false; // 2 мафии vs 1 мирный
    const ended = [];
    g.on('game:ended', (r) => ended.push(r.winner));
    g.checkWin();
    expect(ended).toContain('mafia');
    g.cleanup();
  });
});
