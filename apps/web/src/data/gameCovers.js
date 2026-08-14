/**
 * Тематические обложки игр для каталога на главной.
 * theme — ключ SVG-сцены; emoji — крупный декоративный символ на обложке.
 */
export const GAME_COVER_THEMES = {
  mafia2: { theme: 'detective', emoji: '🕵️' },
  mafia: { theme: 'detective', emoji: '🕵️' },
  werewolf: { theme: 'detective', emoji: '🐺' },
  spy: { theme: 'detective', emoji: '🕶️' },
  impostor: { theme: 'detective', emoji: '👤' },
  chameleon: { theme: 'detective', emoji: '🦎' },
  fibbing: { theme: 'detective', emoji: '🤫' },
  whoami: { theme: 'detective', emoji: '❓' },
  psych: { theme: 'detective', emoji: '🧠' },

  bunker: { theme: 'bunker', emoji: '☢️' },

  crocodile: { theme: 'draw', emoji: '🐊' },
  'crocodile-verbs': { theme: 'draw', emoji: '🐊' },
  'crocodile-nouns': { theme: 'draw', emoji: '🐊' },
  sketch: { theme: 'draw', emoji: '✏️' },
  fakeartist: { theme: 'draw', emoji: '🎨' },
  emojiart: { theme: 'draw', emoji: '🎨' },
  collage: { theme: 'draw', emoji: '🖼️' },

  hat: { theme: 'words', emoji: '🎩' },
  alias: { theme: 'words', emoji: '💬' },
  wordbomb: { theme: 'words', emoji: '💣' },
  bombparty: { theme: 'words', emoji: '💣' },
  associations: { theme: 'words', emoji: '🔗' },
  categories: { theme: 'words', emoji: '🏷️' },
  lastword: { theme: 'words', emoji: '⏱️' },
  anagrams: { theme: 'words', emoji: '🔄' },
  wordchain: { theme: 'words', emoji: '⛓️' },
  crossword: { theme: 'words', emoji: '📰' },
  rhyme: { theme: 'words', emoji: '🎵' },
  password: { theme: 'words', emoji: '🔐' },
  teamwords: { theme: 'words', emoji: '📝' },

  quiz: { theme: 'trivia', emoji: '🧠' },
  fibbage: { theme: 'trivia', emoji: '🤥' },
  triviamurder: { theme: 'trivia', emoji: '💀' },
  facts: { theme: 'trivia', emoji: '📚' },
  flags: { theme: 'trivia', emoji: '🌍' },
  logos: { theme: 'trivia', emoji: '🎯' },
  maps: { theme: 'trivia', emoji: '🗺️' },
  quotes: { theme: 'trivia', emoji: '💬' },
  timeline: { theme: 'trivia', emoji: '📅' },
  priceisright: { theme: 'trivia', emoji: '💰' },
  auction: { theme: 'trivia', emoji: '🔢' },
  ranking: { theme: 'trivia', emoji: '📊' },
  sequence: { theme: 'trivia', emoji: '🔢' },
  emoji: { theme: 'trivia', emoji: '🎬' },
  coopquiz: { theme: 'trivia', emoji: '🤝' },

  meme: { theme: 'party', emoji: '😂' },
  quiplash: { theme: 'party', emoji: '🎙️' },
  badadvice: { theme: 'party', emoji: '🩹' },
  caption: { theme: 'party', emoji: '💬' },
  bluff: { theme: 'party', emoji: '🎭' },
  escalation: { theme: 'party', emoji: '🔥' },
  judge: { theme: 'party', emoji: '⚖️' },

  melody: { theme: 'music', emoji: '🎵' },

  reaction: { theme: 'action', emoji: '⚡' },
  colors: { theme: 'action', emoji: '🌈' },
  hotpotato: { theme: 'action', emoji: '🥔' },
  memory: { theme: 'action', emoji: '🧩' },
  sync: { theme: 'action', emoji: '⏱️' },
  relay: { theme: 'action', emoji: '🏃' },

  knowfriend: { theme: 'social', emoji: '🫂' },
  debate: { theme: 'social', emoji: '🎤' },
  truths: { theme: 'social', emoji: '🤥' },
  wouldyourather: { theme: 'social', emoji: '⚖️' },
  prediction: { theme: 'social', emoji: '🔮' },
  trust: { theme: 'social', emoji: '🤝' },
  story: { theme: 'social', emoji: '📖' },
  wavelength: { theme: 'social', emoji: '📡' },
  connect: { theme: 'social', emoji: '🧲' },
};

const TAG_THEME_FALLBACK = {
  detective: { theme: 'detective', emoji: '🔍' },
  words: { theme: 'words', emoji: '💬' },
  trivia: { theme: 'trivia', emoji: '🧠' },
  creative: { theme: 'draw', emoji: '🎨' },
  funny: { theme: 'party', emoji: '😂' },
  action: { theme: 'action', emoji: '⚡' },
  social: { theme: 'social', emoji: '👥' },
  icebreaker: { theme: 'social', emoji: '🤝' },
  popular: { theme: 'party', emoji: '🔥' },
  new: { theme: 'party', emoji: '✨' },
  fast: { theme: 'action', emoji: '⚡' },
  chill: { theme: 'social', emoji: '☕' },
  bots: { theme: 'detective', emoji: '🤖' },
};

const DEFAULT_COVER = { theme: 'party', emoji: '🎮' };

export function getGameCover(game) {
  if (!game) return DEFAULT_COVER;
  if (GAME_COVER_THEMES[game.id]) return GAME_COVER_THEMES[game.id];
  for (const tag of game.tags || []) {
    if (TAG_THEME_FALLBACK[tag]) return TAG_THEME_FALLBACK[tag];
  }
  return { theme: DEFAULT_COVER.theme, emoji: game.icon || DEFAULT_COVER.emoji };
}
