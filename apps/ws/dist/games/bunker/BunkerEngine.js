import { BaseGame } from '../../core/BaseGame.js';

/* ============================================================================
 * BunkerEngine — «Бункер»: социальная выживалка-дедукция.
 *
 * Катастрофа уничтожает мир; мест в бункере хватает только половине.
 * У каждого — скрытый персонаж (профессия, здоровье, хобби, багаж, факт,
 * фобия, биология). Раунд: все вскрывают по одной характеристике →
 * обсуждение по очереди (голос в Discord) → голосование на изгнание.
 * Играют, пока живых не останется ровно по числу мест. Контент оригинальный.
 * ==========================================================================*/

const SCENARIOS = [
  { title: 'Ядерная зима', desc: 'Обмен ударами длился четыре часа. Поверхность непригодна для жизни минимум 25 лет: радиация, пепел, −40°C.' },
  { title: 'Споровая чума', desc: 'Грибок-паразит захватывает нервную систему за сутки. Споры в воздухе повсюду. Вакцины нет. Поверхность — смерть.' },
  { title: 'Падение «Гефеста»', desc: 'Астероид диаметром 4 км упал в Атлантику. Мегацунами, пылевая завеса, глобальный неурожай на 15 лет.' },
  { title: 'Восстание нейросетей', desc: 'Боевые дроны вышли из-под контроля и зачищают города по тепловым сигнатурам. Интернет мёртв, электроника — маяк для охотников.' },
  { title: 'Супервулкан', desc: 'Йеллоустоун проснулся. Пепел закрыл солнце на годы, кислотные дожди травят воду. Дышать снаружи можно только в противогазе.' },
  { title: 'Великий потоп', desc: 'Ледники растаяли за месяц. Уровень океана +70 метров. Материки превратились в архипелаги, цивилизация захлебнулась.' },
  { title: 'Вспышка «Гелиос»', desc: 'Солнечная супервспышка сожгла всю электронику и озоновый слой. Днём на поверхности смертельный ультрафиолет.' },
  { title: 'Вечная мерзлота', desc: 'Сбой климат-инженерии: температура падает на градус в день и не останавливается. Через месяц — −60°C по всей планете.' },
  { title: 'Исход насекомых', desc: 'Мутировавшая саранча съедает всё органическое, включая деревья и изоляцию проводов. Рои закрывают небо.' },
  { title: 'Молчаливый газ', desc: 'Разлом выпустил из недр тяжёлый токсичный газ. Он стелется по низинам и городам. Выжить можно только в герметичных убежищах.' },
];

const PROFESSIONS = [
  'Хирург', 'Инженер-атомщик', 'Фермер', 'Повар', 'Военный сапёр', 'Психолог',
  'Учитель физики', 'Электрик', 'Сантехник', 'Программист', 'Биолог', 'Охотник',
  'Строитель', 'Швея', 'Пилот вертолёта', 'Медсестра', 'Ветеринар', 'Химик',
  'Геолог', 'Пекарь', 'Кузнец', 'Автомеханик', 'Стоматолог', 'Акушерка',
  'Пивовар', 'Библиотекарь', 'Клоун', 'Блогер-миллионник', 'Астролог', 'Таксидермист',
  'Официант', 'Депутат городской думы', 'Массажист', 'Диджей', 'Крановщик', 'Пасечник',
];

const HEALTH = [
  'Полностью здоров', 'Астма', 'Диабет 2 типа', 'Сильная близорукость (−8)',
  'Аллергия на пыль', 'Панические атаки', 'Хроническая бессонница', 'Плоскостопие',
  'Здоров как бык, спортивное сердце', 'Протез левой ноги', 'Глухота на одно ухо',
  'Мигрени раз в неделю', 'Непереносимость лактозы', 'Больная спина', 'Здоров, но храпит как трактор',
  'Вегето-сосудистая дистония', 'Заикание при стрессе', 'Идеальный иммунитет — не болел 10 лет',
];

const HOBBIES = [
  'Огородничество', 'Стрельба из лука', 'Оригами', 'Шахматы', 'Паркур', 'Вязание',
  'Радиолюбитель', 'Выживальщик-любитель', 'Йога', 'Готовит на костре', 'Косплей',
  'Коллекционирует ножи', 'Настольные игры', 'Самогоноварение', 'Резьба по дереву',
  'Марафонский бег', 'Грибник со стажем', 'Пишет стихи', 'Скалолазание', 'Рыбалка',
];

const BAGGAGE = [
  'Полная аптечка', 'Канистра бензина (20 л)', 'Мешок семян овощей', 'Гитара',
  'Ящик тушёнки', 'Дизель-генератор', 'Аккордеон', 'Коллекция комиксов',
  'Швейцарский нож', 'Рация с запасными батареями', 'Огнетушитель', 'Надувная лодка',
  'Набор инструментов', 'Учебник по медицине', 'Мешок соли', 'Спальник и палатка',
  'Кофемашина', 'Ящик виски', 'Пять кг гвоздей', 'Солнечная панель',
];

const FACTS = [
  'Умеет доить корову', 'Знает азбуку Морзе', 'Чемпион района по покеру', 'Лунатик',
  'Бывший вожатый детского лагеря', 'Вегетарианец', 'Отсидел за кражу', 'Говорит на 4 языках',
  'Почётный донор крови', 'Умеет варить мыло', 'Панически боится ответственности',
  'Служил в стройбате', 'Выиграл миллион в лотерею и всё потратил', 'Умеет шить обувь',
  'Прошёл курсы первой помощи', 'Ни разу не был у стоматолога', 'Собирал дождевую воду на даче',
  'Знает наизусть «Робинзона Крузо»', 'Разводил кроликов', 'Умеет гнать дёготь',
];

const PHOBIAS = [
  'Клаустрофобия', 'Арахнофобия', 'Боязнь темноты', 'Социофобия', 'Боязнь крови',
  'Агорафобия', 'Боязнь громких звуков', 'Гермофобия (боязнь микробов)', 'Нет фобий',
  'Боязнь высоты', 'Боязнь врачей', 'Никтофобия', 'Боязнь замкнутых пространств с людьми',
];

/* ─────────── Карта бункера (как в референсе): что вас ждёт внутри ─────────── */
const BUNKER_SIZES = [40, 60, 80, 120, 200, 300];
const BUNKER_STAY = ['6 месяцев', '1 год', '2 года', '3 года', '5 лет', '10 лет'];
const BUNKER_FOOD = ['на 3 месяца', 'на полгода', 'на 1 год', 'на 2 года', 'на весь срок'];
const BUNKER_ITEMS = [
  'медпункт с запасом лекарств', 'оружейная комната', 'библиотека', 'дизель-генератор',
  'гидропонная ферма', 'мастерская с инструментами', 'радиостанция', 'спортзал',
  'бильярдный стол', 'аквариум с одной пираньей', 'запас семян', 'самогонный аппарат',
  'кинозал с проектором', 'швейная машинка', 'холодильная камера', 'теплица',
  'курятник с тремя курами', 'склад консервов', 'коллекция настольных игр', 'пианино',
  'сауна', 'грибная ферма', 'скважина с чистой водой', 'ящик динамита без инструкции',
];

/* ─────────── Карты действий: по одной на игрока, одноразовые ─────────── */
export const ACTION_CARDS = [
  { id: 'swap-profession', name: 'Кадровая рокировка', desc: 'Поменяйтесь профессиями с любым игроком', needsTarget: true },
  { id: 'xray', name: 'Рентген', desc: 'Вскрыть случайную скрытую карту любого игрока', needsTarget: true },
  { id: 'reroll-baggage', name: 'Контрабанда', desc: 'Заменить свой багаж на новый случайный', needsTarget: false },
  { id: 'immunity', name: 'Бронь', desc: 'В ближайшем голосовании вас нельзя изгнать', needsTarget: false },
  { id: 'double-vote', name: 'Право голоса', desc: 'Ваш голос в ближайшем голосовании считается за два', needsTarget: false },
];

export const CHARACTERISTIC_KEYS = ['bio', 'profession', 'health', 'hobby', 'baggage', 'fact', 'phobia'];
export const CHARACTERISTIC_LABELS = {
  bio: 'Биология', profession: 'Профессия', health: 'Здоровье',
  hobby: 'Хобби', baggage: 'Багаж', fact: 'Факт', phobia: 'Фобия',
};

const DEFAULT_DURATIONS = { intro: 14, reveal: 30, speech: 25, voting: 30, results: 7 };

const pickN = (arr, n) => {
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
};

export class BunkerEngine extends BaseGame {
  constructor(room = null, io = null, options = {}) {
    super(room, io);
    this.settings = room?.settings ?? {};
    this.durations = { ...DEFAULT_DURATIONS, ...(this.settings.bunkerDurations || {}), ...(options.durations || {}) };
    this.phase = 'waiting';
    this.round = 0;
    this.scenario = null;
    this.capacity = 0;
    this.activeSpeaker = null;
    this._speakOrder = [];
    this._speakIdx = -1;
    this._votes = new Map();       // voterId -> targetId
    this._tieCandidates = null;
    this._revote = false;
    this._heat = new Map();        // подозрительность для бот-голосования
    this.winner = null;
    this.stateVersion = 0;
  }

  /* ─────────── helpers ─────────── */
  touch() { this.stateVersion++; }
  getPlayer(id) { return this.players.find((p) => p.id === id) || null; }
  alive() { return this.players.filter((p) => p.alive); }

  /* ─────────── lifecycle ─────────── */
  start() {
    const pool = (this.room?.players || []).filter((p) => !p.isSpectator);
    this.scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    // Карта бункера: что известно об убежище до захода
    this.bunker = {
      size: BUNKER_SIZES[Math.floor(Math.random() * BUNKER_SIZES.length)],
      stay: BUNKER_STAY[Math.floor(Math.random() * BUNKER_STAY.length)],
      food: BUNKER_FOOD[Math.floor(Math.random() * BUNKER_FOOD.length)],
      items: pickN(BUNKER_ITEMS, 3),
    };

    const prof = pickN(PROFESSIONS, pool.length);
    const health = pickN(HEALTH, pool.length);
    const hobby = pickN(HOBBIES, pool.length);
    const baggage = pickN(BAGGAGE, pool.length);
    const fact = pickN(FACTS, pool.length);
    const phobia = pickN(PHOBIAS, pool.length);

    this.players = pool.map((p, i) => {
      const sex = Math.random() < 0.5 ? 'Мужчина' : 'Женщина';
      const age = 18 + Math.floor(Math.random() * 60);
      const exp = Math.max(1, Math.min(age - 17, 1 + Math.floor(Math.random() * 25)));
      const rawHealth = health[i % health.length];
      const severity = /здоров|иммунитет/i.test(rawHealth) ? '' : ` (${10 + Math.floor(Math.random() * 81)}%)`;
      return {
        id: p.id, name: p.name, bot: !!p.isBot,
        alive: true,
        card: {
          bio: `${sex}, ${age} ${age % 10 === 1 && age % 100 !== 11 ? 'год' : age % 10 >= 2 && age % 10 <= 4 && (age % 100 < 12 || age % 100 > 14) ? 'года' : 'лет'}`,
          profession: `${prof[i % prof.length]}, стаж ${exp} ${exp % 10 === 1 && exp % 100 !== 11 ? 'год' : exp % 10 >= 2 && exp % 10 <= 4 && (exp % 100 < 12 || exp % 100 > 14) ? 'года' : 'лет'}`,
          health: `${rawHealth}${severity}`,
          hobby: hobby[i % hobby.length],
          baggage: baggage[i % baggage.length],
          fact: fact[i % fact.length],
          phobia: phobia[i % phobia.length],
        },
        actionCard: { ...ACTION_CARDS[Math.floor(Math.random() * ACTION_CARDS.length)], used: false },
        immune: false,
        doubleVote: false,
        revealed: new Set(),
        revealedThisRound: false,
      };
    });

    this.capacity = Math.max(1, Math.floor(this.players.length / 2));
    this.phase = 'intro';
    this.round = 0;
    this.touch();
    this.emit('game:started', {});
    this.emit('bunker:phase', { phase: 'intro', duration: this.durations.intro });
    this.registerTimeout(() => this.startRevealPhase(), this.durations.intro * 1000);
    return this;
  }

  /* ─────────── ФАЗА ВСКРЫТИЯ ─────────── */
  startRevealPhase() {
    if (this.phase === 'gameOver') return;
    this.round += 1;
    this.phase = 'reveal';
    for (const p of this.players) p.revealedThisRound = false;
    this.touch();
    this.emit('bunker:phase', { phase: 'reveal', duration: this.durations.reveal, round: this.round });
    this._revealTimer = this.registerTimeout(() => this.autoRevealAndProceed(), this.durations.reveal * 1000);
    // боты вскрываются сами: первым делом профессию, дальше случайно
    for (const b of this.alive().filter((p) => p.bot)) {
      this.registerTimeout(() => {
        if (this.phase !== 'reveal' || !b.alive || b.revealedThisRound) return;
        const key = !b.revealed.has('profession') ? 'profession' : this.hiddenKeys(b)[0];
        if (key) this.reveal(b.id, key);
      }, 900 + Math.random() * 2500);
    }
  }

  hiddenKeys(p) {
    return CHARACTERISTIC_KEYS.filter((k) => !p.revealed.has(k));
  }

  reveal(playerId, key) {
    if (this.phase !== 'reveal') return { ok: false, error: 'Сейчас не фаза вскрытия' };
    const p = this.getPlayer(playerId);
    if (!p || !p.alive) return { ok: false, error: 'Недоступно' };
    if (p.revealedThisRound) return { ok: false, error: 'В этом раунде вы уже открыли карту' };
    if (!CHARACTERISTIC_KEYS.includes(key)) return { ok: false, error: 'Нет такой характеристики' };
    if (p.revealed.has(key)) return { ok: false, error: 'Уже открыто' };

    p.revealed.add(key);
    p.revealedThisRound = true;
    this.touch();
    this.emit('bunker:reveal', {
      playerId, playerName: p.name, key,
      label: CHARACTERISTIC_LABELS[key], value: p.card[key], round: this.round,
    });

    if (this.alive().every((x) => x.revealedThisRound)) {
      this.clearManagedTimeout(this._revealTimer);
      this.startDiscussion();
    }
    return { ok: true };
  }

  /** По таймеру вскрываем случайную карту тем, кто не успел. */
  autoRevealAndProceed() {
    if (this.phase !== 'reveal') return;
    for (const p of this.alive().filter((x) => !x.revealedThisRound)) {
      const key = this.hiddenKeys(p)[0];
      if (key) {
        p.revealed.add(key);
        p.revealedThisRound = true;
        this.emit('bunker:reveal', {
          playerId: p.id, playerName: p.name, key,
          label: CHARACTERISTIC_LABELS[key], value: p.card[key], round: this.round, auto: true,
        });
      }
    }
    this.touch();
    this.startDiscussion();
  }

  /* ─────────── ОБСУЖДЕНИЕ (очередь речи) ─────────── */
  startDiscussion() {
    if (this.phase === 'gameOver') return;
    this.phase = 'discussion';
    this._speakOrder = this.alive().map((p) => p.id);
    this._speakIdx = -1;
    this.touch();
    this.emit('bunker:phase', { phase: 'discussion', duration: this._speakOrder.length * this.durations.speech, round: this.round });
    this.nextSpeaker();
  }

  nextSpeaker() {
    this.clearManagedTimeout(this._speakTimer);
    this._speakIdx += 1;
    while (this._speakIdx < this._speakOrder.length) {
      const p = this.getPlayer(this._speakOrder[this._speakIdx]);
      const online = this.room?.players?.find((rp) => rp.id === p?.id)?.isOnline !== false;
      if (p && p.alive && (p.bot || online)) break;
      this._speakIdx += 1;
    }
    if (this._speakIdx >= this._speakOrder.length) {
      this.activeSpeaker = null;
      this.emit('bunker:speaking', { playerId: null });
      this.startVoting();
      return;
    }
    const id = this._speakOrder[this._speakIdx];
    this.activeSpeaker = id;
    this.touch();
    this.emit('bunker:speaking', { playerId: id, duration: this.durations.speech });
    const speaker = this.getPlayer(id);
    if (speaker?.bot) {
      this.registerTimeout(() => this.botSpeak(id), 500 + Math.random() * 600);
      this.registerTimeout(() => { if (this.activeSpeaker === id) this.nextSpeaker(); }, 2300 + Math.random() * 1300);
    } else {
      this._speakTimer = this.registerTimeout(() => { if (this.activeSpeaker === id) this.nextSpeaker(); }, this.durations.speech * 1000);
    }
  }

  finishSpeaking(playerId) {
    if (this.phase !== 'discussion' || playerId !== this.activeSpeaker) return { ok: false, error: 'Сейчас не ваш ход' };
    this.nextSpeaker();
    return { ok: true };
  }

  botSpeak(botId) {
    const b = this.getPlayer(botId);
    if (!b || !b.alive || this.activeSpeaker !== botId) return;
    const prof = b.revealed.has('profession') ? b.card.profession : null;
    const targetId = this._pickBotTarget(botId);
    const tn = targetId ? this.getPlayer(targetId)?.name : null;
    const lines = [];
    if (prof) lines.push(`Я ${prof.toLowerCase()} — бункеру без меня никак!`, `${prof} всегда пригодится, голосуйте умом.`);
    if (tn) lines.push(`Мне кажется, ${tn} нам не нужен.`, `Пользы от «${tn}» я пока не вижу.`);
    lines.push('Я за то, чтобы оставить полезных.', 'Давайте по делу: еда, руки, здоровье.');
    if (targetId) this._heat.set(targetId, (this._heat.get(targetId) || 0) + 1);
    this.emit('bunker:speech', { playerId: botId, text: lines[Math.floor(Math.random() * lines.length)] });
    // иногда бот разыгрывает свою карту действия
    if (b.actionCard && !b.actionCard.used && Math.random() < 0.3) {
      const t = b.actionCard.needsTarget ? this._pickBotTarget(botId) : null;
      if (!b.actionCard.needsTarget || t) this.useActionCard(botId, t);
    }
  }

  /* ─────────── ГОЛОСОВАНИЕ ─────────── */
  startVoting(candidates = null) {
    if (this.phase === 'gameOver') return;
    this.phase = candidates ? 'revote' : 'voting';
    this._revote = !!candidates;
    this._tieCandidates = candidates;
    this._votes.clear();
    this.touch();
    this.emit('bunker:phase', {
      phase: this.phase, duration: this.durations.voting, round: this.round,
      candidates: candidates || this.alive().map((p) => p.id),
    });
    this._voteTimer = this.registerTimeout(() => this.resolveVoting(), this.durations.voting * 1000);
    for (const b of this.alive().filter((p) => p.bot)) {
      this.registerTimeout(() => {
        if ((this.phase === 'voting' || this.phase === 'revote') && !this._votes.has(b.id)) {
          const t = this._pickBotTarget(b.id, candidates);
          if (t) this.vote(b.id, t);
        }
      }, 900 + Math.random() * 2200);
    }
  }

  _pickBotTarget(botId, candidates = null) {
    const pool = this.alive().filter((p) => p.id !== botId && (!candidates || candidates.includes(p.id)));
    if (!pool.length) return null;
    let best = null, bs = -Infinity;
    for (const p of pool) {
      const s = (this._heat.get(p.id) || 0) + Math.random() * 1.4;
      if (s > bs) { bs = s; best = p; }
    }
    return best?.id ?? null;
  }

  vote(voterId, targetId) {
    if (this.phase !== 'voting' && this.phase !== 'revote') return { ok: false, error: 'Сейчас не голосование' };
    const voter = this.getPlayer(voterId);
    if (!voter || !voter.alive) return { ok: false, error: 'Недоступно' };
    if (voterId === targetId) return { ok: false, error: 'Нельзя голосовать против себя' };
    const target = this.getPlayer(targetId);
    if (!target || !target.alive) return { ok: false, error: 'Цель недоступна' };
    if (this._tieCandidates && !this._tieCandidates.includes(targetId)) {
      return { ok: false, error: 'Голосовать можно только против кандидатов' };
    }
    this._votes.set(voterId, targetId);
    this._heat.set(targetId, (this._heat.get(targetId) || 0) + 0.6);
    this.touch();
    this.emit('bunker:vote-cast', { voterId, total: this._votes.size, required: this.alive().length });
    if (this._votes.size >= this.alive().length) {
      this.clearManagedTimeout(this._voteTimer);
      this.resolveVoting();
    }
    return { ok: true };
  }

  /* ─────────── КАРТЫ ДЕЙСТВИЙ ─────────── */
  useActionCard(playerId, targetId = null) {
    if (!['reveal', 'discussion', 'voting'].includes(this.phase)) {
      return { ok: false, error: 'Карту можно разыграть во время вскрытия, обсуждения или голосования' };
    }
    const p = this.getPlayer(playerId);
    if (!p || !p.alive) return { ok: false, error: 'Недоступно' };
    const card = p.actionCard;
    if (!card || card.used) return { ok: false, error: 'Карта действия уже использована' };
    const target = targetId ? this.getPlayer(targetId) : null;
    if (card.needsTarget && (!target || !target.alive || target.id === playerId)) {
      return { ok: false, error: 'Выберите другого живого игрока' };
    }

    let detail = '';
    switch (card.id) {
      case 'swap-profession': {
        const mine = p.card.profession;
        p.card.profession = target.card.profession;
        target.card.profession = mine;
        detail = `${p.name} и ${target.name} поменялись профессиями!`;
        break;
      }
      case 'xray': {
        const hidden = this.hiddenKeys(target);
        if (!hidden.length) return { ok: false, error: 'У игрока всё уже вскрыто' };
        const key = hidden[Math.floor(Math.random() * hidden.length)];
        target.revealed.add(key);
        this.emit('bunker:reveal', {
          playerId: target.id, playerName: target.name, key,
          label: CHARACTERISTIC_LABELS[key], value: target.card[key], round: this.round, auto: true,
        });
        detail = `${p.name} просветил карты ${target.name}`;
        break;
      }
      case 'reroll-baggage': {
        const inUse = new Set(this.players.map((x) => x.card.baggage));
        const free = BAGGAGE.filter((b) => !inUse.has(b));
        const nb = free.length ? free[Math.floor(Math.random() * free.length)] : BAGGAGE[Math.floor(Math.random() * BAGGAGE.length)];
        p.card.baggage = nb;
        detail = p.revealed.has('baggage')
          ? `${p.name} сменил багаж — теперь это «${nb}»`
          : `${p.name} втайне сменил свой багаж`;
        break;
      }
      case 'immunity':
        p.immune = true;
        detail = `${p.name} получает бронь: в ближайшем голосовании его нельзя изгнать`;
        break;
      case 'double-vote':
        p.doubleVote = true;
        detail = `Голос ${p.name} в ближайшем голосовании считается за два`;
        break;
      default:
        return { ok: false, error: 'Неизвестная карта' };
    }
    card.used = true;
    this.touch();
    this.emit('bunker:action-used', {
      playerId, playerName: p.name, cardName: card.name,
      targetId: target?.id ?? null, targetName: target?.name ?? null, detail,
    });
    return { ok: true };
  }

  resolveVoting() {
    if (this.phase !== 'voting' && this.phase !== 'revote') return;
    const tally = new Map();
    for (const [voterId, t] of this._votes) {
      if (this.getPlayer(t)?.immune) continue; // «Бронь»: голоса против сгорают
      const weight = this.getPlayer(voterId)?.doubleVote ? 2 : 1;
      tally.set(t, (tally.get(t) || 0) + weight);
    }

    let max = 0; const leaders = [];
    for (const [id, n] of tally) {
      if (n > max) { max = n; leaders.length = 0; leaders.push(id); }
      else if (n === max) leaders.push(id);
    }

    const tallyArr = [...tally.entries()].map(([id, n]) => ({ id, name: this.getPlayer(id)?.name, votes: n }));

    if (max === 0 || leaders.length === 0) return this.finishRound(null, tallyArr, 'no-votes');
    if (leaders.length === 1) return this.finishRound(leaders[0], tallyArr, 'exiled');

    if (!this._revote) {
      // ничья → переголосование только по лидерам
      this.emit('bunker:tie', { candidates: leaders.map((id) => ({ id, name: this.getPlayer(id)?.name })) });
      this.startVoting([...leaders]);
      return;
    }
    // вторая ничья — никто не изгнан
    return this.finishRound(null, tallyArr, 'tie');
  }

  finishRound(exiledId, tally, reason) {
    this.phase = 'results';
    // «Бронь» и «Право голоса» действуют на одно голосование
    for (const p of this.players) { p.immune = false; p.doubleVote = false; }
    const exiled = exiledId ? this.getPlayer(exiledId) : null;
    if (exiled) {
      exiled.alive = false;
      // изгнанному вскрываем ВСЁ — драматичный момент
      for (const k of CHARACTERISTIC_KEYS) exiled.revealed.add(k);
    }
    this.touch();
    this.emit('bunker:round-result', {
      round: this.round, reason, tally,
      exiled: exiled ? { id: exiled.id, name: exiled.name, card: exiled.card } : null,
      aliveCount: this.alive().length, capacity: this.capacity,
    });

    this.registerTimeout(() => {
      if (this.alive().length <= this.capacity) this.endGame();
      else this.startRevealPhase();
    }, this.durations.results * 1000);
  }

  endGame() {
    if (this.phase === 'gameOver') return;
    this.phase = 'gameOver';
    this.touch();
    const survivors = this.alive().map((p) => ({ id: p.id, name: p.name, card: p.card }));
    this.emit('game:ended', {
      winner: 'survivors',
      survivors,
      scenario: this.scenario,
      players: this.players.map((p) => ({ id: p.id, name: p.name, survived: p.alive, card: p.card })),
    });
  }

  /** RoomManager зовёт при дисконнекте: если ушёл текущий спикер — передаём слово. */
  handlePlayerDisconnect(playerId) {
    if (this.phase === 'discussion' && this.activeSpeaker === playerId) {
      this.nextSpeaker();
    }
  }

  /* ─────────── интерфейс сокета ─────────── */
  handleAction(playerId, action = {}) {
    switch (action.type) {
      case 'reveal': return this.reveal(playerId, action.key);
      case 'vote': return this.vote(playerId, action.target ?? action.targetId);
      case 'finish-speaking': return this.finishSpeaking(playerId);
      case 'use-action': return this.useActionCard(playerId, action.target ?? action.targetId);
      default: return { ok: false, error: `Неизвестное действие: ${action.type}` };
    }
  }

  publicState() {
    return {
      phase: this.phase,
      round: this.round,
      scenario: this.scenario,
      bunker: this.bunker,
      capacity: this.capacity,
      aliveCount: this.alive().length,
      activeSpeaker: this.activeSpeaker,
      version: this.stateVersion,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, alive: p.alive,
        revealed: Object.fromEntries([...p.revealed].map((k) => [k, p.card[k]])),
        revealedThisRound: p.revealedThisRound,
        actionUsed: !!p.actionCard?.used,
      })),
    };
  }

  getState() { return this.publicState(); }

  getPlayerState(playerId) {
    const base = this.publicState();
    const me = this.getPlayer(playerId);
    if (me) {
      base.you = {
        id: me.id, alive: me.alive,
        card: me.card,
        revealed: [...me.revealed],
        revealedThisRound: me.revealedThisRound,
        actionCard: me.actionCard ? { ...me.actionCard } : null,
      };
    }
    return base;
  }
}
