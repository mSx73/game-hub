/* Единый словарь русских названий игр (id → название).
   Используется как фолбэк везде, где иначе показался бы сырой id. */
export const GAME_LABELS = {
  mafia: 'Мафия',
  mafia2: 'Мафия',
  bunker: 'Бункер',
  melody: 'Угадай мелодию',
  hat: 'Шляпа',
  crocodile: 'Крокодил',
  'crocodile-verbs': 'Крокодил · действия',
  'crocodile-nouns': 'Крокодил · предметы',
  sketch: 'Скетч',
  associations: 'Ассоциации',
  alias: 'Элиас', spy: 'Шпион', quiz: 'Квиз', meme: 'Мем Баттл',
  wordbomb: 'Слова-мины', debate: 'Дебаты', truths: 'Две правды',
  story: 'Цепная история', collage: 'Коллаж',
  emoji: 'Эмодзи', whoami: 'Кто я?',
  fakeartist: 'Фейк-художник', lastword: 'Последнее слово', auction: 'Аукцион',
  wavelength: 'Волна', ranking: 'Рейтинг', chameleon: 'Хамелеон',
  timeline: 'Хронология', categories: 'Категории', rhyme: 'Рифмоплёт',
  priceisright: 'Угадай цену', wouldyourather: 'Что бы ты выбрал?',
  bluff: 'Блеф-клуб', escalation: 'Переигрывай!', memory: 'Память',
  crossword: 'Сканворд', anagrams: 'Анаграммы',
  wordchain: 'Цепочка слов', facts: 'Факты', sequence: 'Последовательность', bombparty: 'Бомба',
  psych: 'Психолог', judge: 'Судья', trust: 'Доверие', impostor: 'Самозванец',
  caption: 'Подпись', emojiart: 'Эмодзи-арт', flags: 'Флаги', logos: 'Логотипы', maps: 'Карты', quotes: 'Цитаты',
  hotpotato: 'Горячая картошка', fibbing: 'Врун', prediction: 'Предсказание',
  connect: 'Связи', badadvice: 'Плохой совет', triviamurder: 'Квиз на выживание',
  sync: 'Синхро', password: 'Пароль',
  quiplash: 'Острослов', knowfriend: 'Узнай друга', fibbage: 'Предательский квиз',
  reaction: 'Реакция', colors: 'Цвета', teamwords: 'Командные слова',
};

/* Иконки игр (совпадают с каталогом на главной) */
export const GAME_ICONS = {
  mafia2: '🕵️‍♂️', mafia: '🕵️‍♂️', bunker: '☢️', hat: '🎩', crocodile: '🐊',
  'crocodile-verbs': '🐊', 'crocodile-nouns': '🐊', sketch: '✏️',
  alias: '💬', spy: '🕶️', quiz: '🧠', meme: '😂', quiplash: '🎙️', knowfriend: '🫂',
  fibbage: '🤥', badadvice: '🩹', triviamurder: '💀', wordbomb: '💣', associations: '🔗',
  rhyme: '🎵', categories: '🏷️', lastword: '⏱️', anagrams: '🔄', wordchain: '⛓️',
  crossword: '📰', debate: '🎤', truths: '🤥', whoami: '❓', wouldyourather: '⚖️',
  prediction: '🔮', psych: '🧠', judge: '⚖️', trust: '🤝', impostor: '👤', story: '📖',
  fakeartist: '🎨', wavelength: '📡', bluff: '🎭', connect: '🧲', caption: '💬',
  collage: '🖼️', emojiart: '🎨', emoji: '🎬', auction: '🔨', ranking: '📊',
  timeline: '📅', priceisright: '💰', facts: '📚', flags: '🌍', logos: '🎯',
  maps: '🗺️', quotes: '💬', chameleon: '🦎', escalation: '🔥', memory: '🧩',
  hotpotato: '🥔', fibbing: '🤫', bombparty: '💣', sequence: '🔢', reaction: '⚡',
  colors: '🌈', teamwords: '📝', sync: '⏱️', password: '🔐', melody: '🎧',
};

export default GAME_LABELS;
