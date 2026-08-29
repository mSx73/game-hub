// Единая цветовая идентичность игр (используется в хабе и в лобби).
// accent — основной цвет, accent2 — для градиента плитки/кнопки.
export const GAME_ACCENTS = {
  mafia: ['#ef4444', '#b91c1c'],
  crocodile: ['#22c55e', '#15803d'],
  'crocodile-verbs': ['#22c55e', '#15803d'],
  'crocodile-nouns': ['#22c55e', '#15803d'],
  mafia2: ['#ef4444', '#b91c1c'],
  bunker: ['#f59e0b', '#92400e'],
  melody: ['#ec4899', '#0e7490'],
  alias: ['#f59e0b', '#d97706'],
  spy: ['#6366f1', '#4338ca'],
  quiz: ['#3b82f6', '#1d4ed8'],
  meme: ['#ec4899', '#be185d'],
  quiplash: ['#a855f7', '#7e22ce'],
  knowfriend: ['#14b8a6', '#0f766e'],
  fibbage: ['#f97316', '#c2410c'],
  badadvice: ['#ef4444', '#dc2626'],
  wordbomb: ['#f43f5e', '#be123c'],
  associations: ['#8b5cf6', '#6d28d9'],
  anagrams: ['#06b6d4', '#0e7490'],
  truths: ['#eab308', '#a16207'],
  whoami: ['#d946ef', '#a21caf'],
  wouldyourather: ['#0ea5e9', '#0369a1'],
  story: ['#f472b6', '#db2777'],
  fakeartist: ['#a3e635', '#4d7c0f'],
  wavelength: ['#2dd4bf', '#0d9488'],
  bluff: ['#c084fc', '#9333ea'],
  caption: ['#fb923c', '#ea580c'],
  emoji: ['#facc15', '#ca8a04'],
  flags: ['#38bdf8', '#0284c7'],
  chameleon: ['#4ade80', '#16a34a'],
  fibbing: ['#fbbf24', '#d97706'],
  bombparty: ['#fb7185', '#e11d48'],
  triviamurder: ['#dc2626', '#7f1d1d'],
  sync: ['#06b6d4', '#0e7490'],
  password: ['#a855f7', '#7e22ce'],
};

// Цвета по жанру — запасной вариант для игр без явного акцента.
export const TAG_ACCENTS = {
  trivia: ['#3b82f6', '#1d4ed8'],
  words: ['#06b6d4', '#0e7490'],
  social: ['#a855f7', '#7e22ce'],
  detective: ['#6366f1', '#4338ca'],
  creative: ['#ec4899', '#be185d'],
  funny: ['#f97316', '#c2410c'],
  action: ['#f43f5e', '#be123c'],
  icebreaker: ['#14b8a6', '#0f766e'],
};

const DEFAULT_ACCENT = ['#7c5cfc', '#5a2ec4'];

// Принимает объект игры ({ id, tags }) ИЛИ строковый gameType.
export function getAccent(game) {
  if (!game) return DEFAULT_ACCENT;
  if (typeof game === 'string') {
    return GAME_ACCENTS[game] || DEFAULT_ACCENT;
  }
  if (GAME_ACCENTS[game.id]) return GAME_ACCENTS[game.id];
  for (const tag of game.tags || []) {
    if (TAG_ACCENTS[tag]) return TAG_ACCENTS[tag];
  }
  return DEFAULT_ACCENT;
}
