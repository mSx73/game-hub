/**
 * Immersive game experience tokens — mood, taglines, atmosphere for every game.
 */
import { getGameCover } from './gameCovers';
import { getAccent } from './gameAccents';
import { GAME_LABELS, GAME_ICONS } from './gameLabels';

const THEME_MOODS = {
  detective: {
    pattern: 'noir',
    particle: 'fog',
    bgBlend: 'multiply',
    intensity: 0.85,
  },
  bunker: {
    pattern: 'bunker',
    particle: 'dust',
    bgBlend: 'normal',
    intensity: 0.9,
  },
  draw: {
    pattern: 'canvas',
    particle: 'spark',
    bgBlend: 'screen',
    intensity: 0.75,
  },
  words: {
    pattern: 'letters',
    particle: 'float',
    bgBlend: 'soft-light',
    intensity: 0.7,
  },
  trivia: {
    pattern: 'grid',
    particle: 'pulse',
    bgBlend: 'overlay',
    intensity: 0.8,
  },
  party: {
    pattern: 'confetti',
    particle: 'burst',
    bgBlend: 'screen',
    intensity: 0.85,
  },
  music: {
    pattern: 'wave',
    particle: 'note',
    bgBlend: 'soft-light',
    intensity: 0.9,
  },
  action: {
    pattern: 'electric',
    particle: 'bolt',
    bgBlend: 'hard-light',
    intensity: 0.95,
  },
  social: {
    pattern: 'aurora',
    particle: 'glow',
    bgBlend: 'normal',
    intensity: 0.75,
  },
};

const TAGLINES = {
  mafia: 'Город засыпает. Доверяй никому.',
  mafia2: 'Роли, интриги, голосование — кто выживет?',
  bunker: 'Мест в убежище мало. Докажи свою ценность.',
  melody: 'Слушай. Угадывай. Пой вместе.',
  hat: 'Слово на кончике языка — объясни быстрее всех!',
  crocodile: 'Рисуй. Молчи. Пусть они догадаются.',
  'crocodile-verbs': 'Действия без слов — только жесты и линии.',
  'crocodile-nouns': 'Предметы на холсте — угадай по рисунку.',
  sketch: 'Быстрый скетч — одна минута на шедевр.',
  alias: 'Без однокоренных! Командный рывок за очками.',
  spy: 'Один шпион среди вас. Найди его.',
  quiz: 'Эрудиция на скорость — каждая секунда на счету.',
  meme: 'Смешнее всех — забираешь зал.',
  quiplash: 'Острый ответ бьёт точнее меча.',
  knowfriend: 'Насколько вы знаете друг друга?',
  fibbage: 'Правда спрятана среди лжи — найди её.',
  badadvice: 'Худший совет — лучшая награда.',
  triviamurder: 'Ошибся — и ты мёртв. Буквально.',
  wordbomb: 'Буква горит. Не задень мину.',
  associations: 'Цепочка ассоциаций — куда заведёт мысль?',
  rhyme: 'Рифма должна биться — и смешить.',
  categories: 'Буква выпала. Слово — сейчас!',
  lastword: 'Кто назовёт последним — тот герой.',
  anagrams: 'Переставь буквы — собери слово.',
  wordchain: 'Последняя буква — твой старт.',
  crossword: 'Пересечения букв — как в старом журнале.',
  debate: 'Аргумент решает всё.',
  truths: 'Две правды, одна ложь — найди её.',
  whoami: 'Задавай вопросы — узнай, кто ты.',
  wouldyourather: 'Дилемма без правильного ответа.',
  prediction: 'Кто из нас…? Угадай большинство.',
  psych: 'Читай мысли — или притворись.',
  werewolf: 'Луна полная. Оборотни среди нас.',
  judge: 'Ты — судья. Твоё слово — закон.',
  trust: 'Доверие или риск — что выберешь?',
  impostor: 'Один самозванец. Разоблачи его.',
  story: 'Одно предложение — и история оживает.',
  fakeartist: 'Художник или фейк? Голосуй.',
  wavelength: 'Попади в волну — попади в голову.',
  bluff: 'Выдумай определение — и продай его.',
  connect: 'Четыре слова — одна связь.',
  caption: 'Картинка ждёт твою подпись.',
  collage: 'Собери историю из кусочков.',
  emojiart: 'Рисуй эмодзи — без кисти.',
  emoji: 'Расшифруй фильм по эмодзи.',
  auction: 'Ставка на число — кто ближе?',
  ranking: 'Расставь по порядку — угадай мысль.',
  timeline: 'Год, событие, хронология — угадай.',
  priceisright: 'Сколько это стоит? Ставь смелее.',
  facts: 'Правда или вымысел — реши за секунду.',
  flags: 'Флаг — страна — победа.',
  logos: 'Бренд на кончике языка.',
  maps: 'Где это? Угадай место.',
  quotes: 'Кто сказал? Узнай автора.',
  chameleon: 'Один не знает слова. Найди хамелеона.',
  escalation: 'Каждый ход — круче предыдущего.',
  memory: 'Запомни. Повтори. Не ошибись.',
  hotpotato: 'Картошка горит — ответь быстрее.',
  fibbing: 'Кто врёт? Кто говорит правду?',
  bombparty: 'Буква — слово — не взорвись.',
  sequence: 'Продолжи ряд — логика решает.',
  reaction: 'Рефлексы решают — жми первым!',
  colors: 'Цвет мигнул — нажми правильный.',
  coopquiz: 'Вместе против времени.',
  teamwords: 'Команда против команды — без подготовки.',
  relay: 'Эстафета идей — передай дальше.',
  sync: 'Нажмите одновременно — в унисон.',
  password: 'Зашифруй слово — не скажи его.',
};

function hexToHue(hex) {
  const h = String(hex || '#7c5cfc').replace('#', '');
  if (h.length < 6) return '260';
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return '0';
  const d = max - min;
  let hue = 0;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) hue = ((b - r) / d + 2) * 60;
  else hue = ((r - g) / d + 4) * 60;
  return String(Math.round(hue));
}

export function getGameSkin(gameType) {
  const id = gameType || 'party';
  const cover = getGameCover({ id });
  const [accent, accent2] = getAccent(id);
  const mood = THEME_MOODS[cover.theme] || THEME_MOODS.party;

  return {
    id,
    label: GAME_LABELS[id] || id,
    emoji: cover.emoji || GAME_ICONS[id] || '🎮',
    tagline: TAGLINES[id] || 'Игра началась — вперёд!',
    theme: cover.theme,
    mood,
    cssVars: {
      '--gx-a': accent,
      '--gx-b': accent2,
      '--gx-hue': hexToHue(accent),
      '--gx-intensity': String(mood.intensity),
    },
  };
}

export default getGameSkin;
