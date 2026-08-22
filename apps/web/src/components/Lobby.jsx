import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket, connectSocket, getSessionRoom, setSessionName, setSessionRoom } from '../services/socketService';
import './LobbyRedesigned.css';
import './LobbyPlayerFilter.css';
import './LobbyMobile.css';
import { FeedbackModal } from './FeedbackModal';

function useInView(opts = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting),
      { threshold: opts.threshold ?? 0.08, rootMargin: opts.rootMargin ?? '0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [opts.threshold, opts.rootMargin]);
  return [ref, inView];
}

const GAMES = [
  // ========== POPULAR GAMES ==========
  { id: 'mafia', name: 'Мафия', icon: '🕵️‍♂️', description: 'Классическая мафия', players: '4–12', tags: ['popular', 'social', 'bots'], rules: 'Классика: Дон/Мафия, Шериф, Доктор и мирные. Ночью — действия ролей, днём — обсуждение и голосование.' },
  { id: 'hat', name: 'Шляпа', icon: '🎩', description: 'Объясняй слова на скорость', players: '2–8', tags: ['popular', 'words'], rules: 'Добавляйте слова, объясняйте команде, угадывающие пишут в чат.' },
  { id: 'crocodile', name: 'Крокодил', icon: '🐊', description: 'Рисуй слово — выбери тип слов внизу', players: '2–12', tags: ['popular', 'action'], rules: 'Выберите внизу экрана: глаголы/действия или существительные. Один рисует, остальные пишут отгадку в чат.' },
  { id: 'alias', name: 'Элиас', icon: '💬', description: 'Объясни без однокоренных', players: '2–12', tags: ['popular', 'words'], rules: 'Объясняйте слово без однокоренных. Очки за скорость.' },
  { id: 'spy', name: 'Шпион', icon: '🕶️', description: 'Найди шпиона', players: '3–12', tags: ['popular', 'social', 'detective'], rules: 'Все знают локацию, кроме шпиона. Вычислите его!' },
  { id: 'quiz', name: 'Квиз', icon: '🧠', description: 'Викторина для эрудитов', players: '2–20', tags: ['popular', 'trivia', 'fast'], rules: '4 варианта, один ответ на вопрос (после правильного ответа сменить нельзя). Хост может загрузить свой .txt до старта. Очки за верность и скорость.' },
  { id: 'meme', name: 'Мем Баттл', icon: '😂', description: 'Шути и голосуй', players: '3–16', tags: ['popular', 'creative', 'funny'], rules: 'Ситуация → смешной ответ → голосование за лучший.' },

  // ========== WORD GAMES ==========
  { id: 'wordbomb', name: 'Слова-мины', icon: '💣', description: 'Не задень мину!', players: '2–12', tags: ['words', 'action'], rules: 'Как Элиас, но есть запретные мины-слова.' },
  { id: 'associations', name: 'Ассоциации', icon: '🔗', description: 'Цепочки ассоциаций', players: '3–8', tags: ['words', 'chill'], rules: 'Стройте цепочку ассоциаций, голосуйте за связь.' },
  { id: 'rhyme', name: 'Рифмоплёт', icon: '🎵', description: 'Сочини рифму', players: '3–12', tags: ['creative', 'funny', 'words'], rules: 'Слово → сочините рифму → голосование за лучшую.' },
  { id: 'categories', name: 'Категории', icon: '🏷️', description: 'Слово на букву', players: '2–12', tags: ['fast', 'words'], rules: 'В общий чат: «Категория:слово» (название как в списке). Одна буква на раунд — каждое слово должно начинаться с неё. Заполни все 5 категорий. Очки за слово, бонус если ответ уникален, ещё бонус самому быстрому полному ряду.' },
  { id: 'lastword', name: 'Последнее слово', icon: '⏱️', description: 'Кто назовёт последним?', players: '2–12', tags: ['fast', 'words'], rules: 'Называйте слова по категории. Последний до таймера — бонус!' },
  { id: 'anagrams', name: 'Анаграммы', icon: '🔄', description: 'Составь слова из букв', players: '2–8', tags: ['words', 'fast', 'new'], rules: 'Даны буквы → составьте как можно больше слов за время. Длинные слова = больше очков!' },
  { id: 'wordchain', name: 'Цепочка слов', icon: '⛓️', description: 'Слово на последнюю букву', players: '2–12', tags: ['words', 'fast', 'new'], rules: 'Следующее слово должно начинаться на последнюю букву предыдущего. Не повторяйтесь!' },
  { id: 'crossword', name: 'Сканворд', icon: '📰', description: 'Пересечения букв, как в журнале', players: '1–6', tags: ['words', 'chill', 'new'], rules: 'Совместно или в соревновании: сетка с общими буквами, режимы коопа и гонки.' },

  // ========== SOCIAL & DEDUCTION ==========
  { id: 'debate', name: 'Дебаты', icon: '🎤', description: 'Аргументируй и побеждай', players: '4–16', tags: ['social', 'funny'], rules: 'Двое спорят на абсурдную тему, зрители голосуют.' },
  { id: 'truths', name: 'Две правды', icon: '🤥', description: 'Найди ложь', players: '3–12', tags: ['social', 'icebreaker'], rules: '2 правды и 1 ложь о себе. Угадай, что ложь.' },
  { id: 'whoami', name: 'Кто я?', icon: '❓', description: 'Угадай персонажа', players: '3–10', tags: ['social', 'detective'], rules: 'Вам назначен персонаж. Задавайте вопросы да/нет.' },
  { id: 'wouldyourather', name: 'Выбор', icon: '⚖️', description: 'Что бы ты выбрал?', players: '2–20', tags: ['social', 'icebreaker', 'fast'], rules: 'Каждый раунд два варианта (А/Б), один выбор за таймер. Очки: попал в большинство — больше; в меньшинство — меньше; при ничьей всем ответившим поровну. Не выбрал — 0.' },
  { id: 'prediction', name: 'Предсказание', icon: '🔮', description: 'Кто из нас?', players: '3–16', tags: ['social', 'icebreaker', 'new'], rules: 'Вопрос о группе → голосуйте за игрока. Совпавшие с большинством — очки.' },
  { id: 'psych', name: 'Психолог', icon: '🧠', description: 'Угадай мысли', players: '3–12', tags: ['social', 'detective', 'new'], rules: 'Все пишут ответ на вопрос. Психолог должен угадать, кто как ответил.' },
  { id: 'werewolf', name: 'Оборотни', icon: '🐺', description: 'Новая мафия', players: '5–16', tags: ['social', 'detective', 'new', 'bots'], rules: 'Классика мафии с ролями: оборотни, охотник, пророк, телохранитель.' },
  { id: 'judge', name: 'Судья', icon: '⚖️', description: 'Ты решаешь', players: '3–10', tags: ['social', 'funny', 'new'], rules: 'Судья задаёт ситуацию с двумя сторонами. Все аргументируют, судья решает кто прав.' },
  { id: 'trust', name: 'Доверие', icon: '🤝', description: 'Доверишься или рискнёшь?', players: '2–8', tags: ['social', 'strategy', 'new'], rules: 'Все одновременно: «Доверие» или «Предательство». Если все доверяют — всем больше очков; если все предают — мало; если смесь — предателям выгоднее. Несколько раундов, сумма очков в конце.' },
  { id: 'impostor', name: 'Самозванец', icon: '👤', description: 'Найди самозванца', players: '4–12', tags: ['social', 'detective', 'new'], rules: 'Все получают одну профессию, один — другую. Найдите самозванца по вопросам.' },

  // ========== CREATIVE GAMES ==========
  { id: 'story', name: 'Цепная история', icon: '�', description: 'Сочиняйте вместе', players: '2–10', tags: ['creative', 'chill'], rules: 'По очереди добавляйте предложения, голосуйте за лучший вклад.' },
  { id: 'fakeartist', name: 'Фейк-художник', icon: '🎨', description: 'Кто не знает тему?', players: '3–10', tags: ['detective', 'creative', 'new'], rules: 'Все дают подсказки к слову, один не знает тему. Найдите его!' },
  { id: 'wavelength', name: 'Волна', icon: '📡', description: 'Попади в шкалу', players: '3–12', tags: ['creative', 'social', 'new'], rules: 'Один даёт подсказку к позиции на шкале. Угадайте число 0–100.' },
  { id: 'bluff', name: 'Блеф-клуб', icon: '🎭', description: 'Придумай определение', players: '3–10', tags: ['creative', 'funny', 'new'], rules: 'Редкое слово → придумайте фейковое определение. Голосование за «правду».' },
  { id: 'connect', name: 'Связи', icon: '🧲', description: 'Найди связь', players: '3–12', tags: ['creative', 'funny', 'new'], rules: 'Два слова → найдите творческую связь → голосование за лучшую.' },
  { id: 'sketch', name: 'Скетч', icon: '✏️', description: 'Рисуй и угадывай', players: '3–16', tags: ['creative', 'action', 'new'], rules: 'Как Pictionary: рисуйте слово, остальные угадывают. Очки за скорость!' },
  { id: 'caption', name: 'Подпись', icon: '💬', description: 'Придумай смешную подпись', players: '3–12', tags: ['creative', 'funny', 'new'], rules: 'Слово/тема → все пишут подписи → голосование за смешнейшую.' },
  { id: 'collage', name: 'Коллаж', icon: '🖼️', description: 'Создай историю', players: '2–8', tags: ['creative', 'chill', 'new'], rules: 'Общая зацепка → по очереди каждый дописывает фрагмент. Потом все голосуют за чужой фрагмент: +очки за голоса и бонус лидеру раунда. Несколько раундов, сумма очков.' },
  { id: 'emojiart', name: 'Эмодзи-арт', icon: '🎨', description: 'Рисуй эмодзи', players: '2–10', tags: ['creative', 'new'], rules: 'По очереди один игрок — художник: видит слово и показывает его только эмодзи в общем чате. Остальные угадывают слово сообщением в чат. Очки угадавшему и бонус художнику за каждого угадавшего. Несколько раундов.' },

  // ========== TRIVIA & KNOWLEDGE ==========
  { id: 'emoji', name: 'Эмодзи', icon: '🎬', description: 'Угадай по эмодзи', players: '2–16', tags: ['fast', 'trivia'], rules: 'По эмодзи угадайте название в общем чате. За раунд засчитывается только первая верная отгадка; остальным ответ не подсвечивается (без спойлеров).' },
  { id: 'auction', name: 'Аукцион чисел', icon: '�', description: 'Угадай число', players: '2–16', tags: ['trivia', 'funny', 'new'], rules: 'Абсурдные вопросы с числовым ответом. Ближайший побеждает.' },
  { id: 'ranking', name: 'Рейтинг', icon: '📊', description: 'Расставь по порядку', players: '2–12', tags: ['trivia', 'new'], rules: '5 предметов + критерий. Расставьте по порядку!' },
  { id: 'timeline', name: 'Хронология', icon: '📅', description: 'Угадай год', players: '2–16', tags: ['trivia', 'new'], rules: 'Историческое событие → угадайте год. Ближайший побеждает.' },
  { id: 'priceisright', name: 'Угадай цену', icon: '💰', description: 'Сколько это стоит?', players: '2–16', tags: ['trivia', 'funny', 'new'], rules: 'Реальный товар → угадайте цену в рублях. Ближайший без перебора.' },
  { id: 'facts', name: 'Факты', icon: '📚', description: 'Правда или ложь?', players: '2–12', tags: ['trivia', 'funny', 'new'], rules: 'Факт → угадайте правда это или ложь. Удивительные факты мира!' },
  { id: 'flags', name: 'Флаги', icon: '🌍', description: 'Узнай страну', players: '2–20', tags: ['trivia', 'fast', 'new'], rules: 'Показывается флаг → угадайте страну. Чем быстрее, тем больше очков!' },
  { id: 'logos', name: 'Логотипы', icon: '🎯', description: 'Узнай бренд', players: '2–12', tags: ['trivia', 'fast', 'new'], rules: 'Подсказка о бренде → угадайте название. Уровни сложности!' },
  { id: 'maps', name: 'Карты', icon: '🗺️', description: 'Угадай место', players: '2–8', tags: ['trivia', 'new'], rules: 'Описание места → угадайте город/страну. От улицы до страны!' },
  { id: 'quotes', name: 'Цитаты', icon: '💬', description: 'Угадай автора', players: '2–10', tags: ['trivia', 'new'], rules: 'Цитата → угадайте кто сказал. От фильмов до философов!' },

  // ========== ACTION & FAST ==========
  { id: 'chameleon', name: 'Хамелеон', icon: '🦎', description: 'Кто не знает слово?', players: '3–10', tags: ['detective', 'social', 'new'], rules: 'Сетка 16 слов. Один не знает секретное. Дайте подсказки, найдите его.' },
  { id: 'escalation', name: 'Переигрывай!', icon: '🔥', description: 'Назови круче', players: '3–10', tags: ['funny', 'action', 'new'], rules: 'Промпт → по очереди назовите что-то более экстремальное. Не выдержал — вылетай.' },
  { id: 'memory', name: 'Память', icon: '🧩', description: 'Запомни последовательность', players: '2–12', tags: ['fast', 'action', 'new'], rules: 'Растущая последовательность → повтори. Ошибся — выбыл.' },
  { id: 'hotpotato', name: 'Горячая картошка', icon: '🥔', description: 'Ответь пока не взорвалось', players: '3–10', tags: ['fast', 'action', 'new'], rules: 'Случайный таймер + вопрос. Ответь быстро или потеряй жизнь!' },
  { id: 'fibbing', name: 'Врун', icon: '🤫', description: 'Кто говорит правду?', players: '3–10', tags: ['social', 'detective', 'new'], rules: 'Один отвечает правдиво, остальные врут. Угадай настоящий ответ.' },
  { id: 'bombparty', name: 'Бомба', icon: '💣', description: 'Буква на скорость', players: '2–12', tags: ['fast', 'words', 'new'], rules: 'Дана буква и тема. Назови слово пока не взорвалась бомба-таймер!' },
  { id: 'sequence', name: 'Последовательность', icon: '🔢', description: 'Продолжи ряд', players: '2–8', tags: ['fast', 'trivia', 'new'], rules: 'Показан ряд чисел/букв → продолжите. Например: 2, 4, 8, 16...' },
  { id: 'reaction', name: 'Реакция', icon: '⚡', description: 'Нажми быстрее!', players: '2–12', tags: ['fast', 'action', 'new'], rules: 'Сигнал → первый нажавший отвечает. Если правильно — очко!' },
  { id: 'colors', name: 'Цвета', icon: '🌈', description: 'Нажми правильный', players: '2–8', tags: ['fast', 'action', 'new'], rules: 'Цветное слово на цветном фоне → нажми правильный цвет быстро!' },

  // ========== CO-OP & TEAM ==========
  { id: 'coopquiz', name: 'Командный квиз', icon: '🤝', description: 'Вместе против времени', players: '4–20', tags: ['trivia', 'new'], rules: 'Команды совместно отвечают на вопросы. Обсуждайте в чате команды!' },
  { id: 'teamwords', name: 'Командные слова', icon: '📝', description: 'Угадай без подготовки', players: '4–16', tags: ['words', 'new'], rules: 'Две команды объясняют свои слова одновременно. Перекрёстные угадывания!' },
  { id: 'relay', name: 'Эстафета', icon: '🏃', description: 'Передай дальше', players: '4–12', tags: ['creative', 'action', 'new'], rules: 'Первый рисует, второй описывает словами, третий рисует по описанию...' },
  { id: 'sync', name: 'Синхро', icon: '⏱️', description: 'Нажмите одновременно', players: '2–8', tags: ['action', 'new'], rules: 'Цель: нажать кнопку одновременно с партнёром. Чем ближе — тем лучше!' },
  { id: 'password', name: 'Пароль', icon: '🔐', description: 'Зашифруй слово', players: '4–12', tags: ['words', 'creative', 'new'], rules: 'Каждая команда даёт по одному слову-подсказке. Угадайте пароль!' },
];

const CATEGORIES = [
  { id: 'all', label: 'Все игры' },
  { id: 'popular', label: 'Популярные' },
  { id: 'new', label: 'Новинки' },
  { id: 'fast', label: 'Быстрые' },
  { id: 'social', label: 'Социальные' },
  { id: 'creative', label: 'Творческие' },
  { id: 'words', label: 'Слова' },
  { id: 'trivia', label: 'Эрудиция' },
  { id: 'detective', label: 'Детектив' },
  { id: 'funny', label: 'Весёлые' },
  { id: 'action', label: 'Активные' },
  { id: 'icebreaker', label: 'Знакомство' },
];

function Lobby() {
  const [playerName, setPlayerName] = useState(localStorage.getItem('playerName') || '');
  const readInitialCrocodileWordMode = () => {
    const last = localStorage.getItem('lastGameType');
    if (last === 'crocodile-nouns') return 'nouns';
    if (last === 'crocodile-verbs') return 'verbs';
    const m = localStorage.getItem('crocodileWordMode');
    return m === 'nouns' ? 'nouns' : 'verbs';
  };

  const [gameType, setGameType] = useState(() => {
    const raw = localStorage.getItem('lastGameType') || 'mafia';
    if (raw === 'crocodile-verbs' || raw === 'crocodile-nouns' || raw === 'crocodile') return 'crocodile';
    return raw;
  });
  const [crocodileWordMode, setCrocodileWordMode] = useState(readInitialCrocodileWordMode);
  const [roomCodeToJoin, setRoomCodeToJoin] = useState('');
  const [lastRooms, setLastRooms] = useState(JSON.parse(localStorage.getItem('lastRooms') || '[]'));
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [showRules, setShowRules] = useState(null);
  const [isDonationOpen, setIsDonationOpen] = useState(false);
  const [targetPlayerCount, setTargetPlayerCount] = useState(6);
  const [mafiaAiGameMaster, setMafiaAiGameMaster] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [openRooms, setOpenRooms] = useState([]);
  const [showRecentRooms, setShowRecentRooms] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showRoomsPopover, setShowRoomsPopover] = useState(false);
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [playerCountFilter, setPlayerCountFilter] = useState(null); // null = any
  const [isAlone, setIsAlone] = useState(false); // NEW: "Я один/одна" checkbox
  // Helper to parse player count range from string like "4–12"
  const parsePlayerRange = (rangeStr) => {
    if (!rangeStr) return { min: 0, max: 999 };
    const match = rangeStr.match(/(\d+)[–-](\d+)/);
    if (match) {
      return { min: parseInt(match[1]), max: parseInt(match[2]) };
    }
    const single = rangeStr.match(/(\d+)/);
    if (single) {
      const num = parseInt(single[1]);
      return { min: num, max: num };
    }
    return { min: 0, max: 999 };
  };

  const filteredGames = GAMES.filter((g) => {
    if (activeFilter !== 'all' && !g.tags?.includes(activeFilter)) return false;
    if (searchQuery && !g.name.toLowerCase().includes(searchQuery.toLowerCase()) && !g.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    // Filter by player count
    if (playerCountFilter !== null) {
      const range = parsePlayerRange(g.players);
      if (playerCountFilter < range.min || playerCountFilter > range.max) return false;
    }
    // NEW: Filter for single player games when "I'm alone" is checked
    if (isAlone) {
      const range = parsePlayerRange(g.players);
      if (range.min > 1) return false;
    }
    return true;
  });

  const [revealRef, revealInView] = useInView({ threshold: 0.06 });
  const navigate = useNavigate();

  useEffect(() => {
    connectSocket();

    const activeRoom = getSessionRoom();
    if (activeRoom) {
      navigate(`/room/${activeRoom}`);
      return;
    }
    
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', (_err) => setError('Ошибка подключения к серверу'));

    const loadRooms = () => {
      socket.emit('room:list', (res) => {
        if (res?.success) setOpenRooms(res.rooms || []);
      });
    };
    loadRooms();
    const timer = setInterval(loadRooms, 4000);
    
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error');
      clearInterval(timer);
    };
  }, []);

  const saveRoomToLast = (code, type) => {
    const newLast = [{ code, type, date: new Date().toISOString() }, ...lastRooms.filter(r => r.code !== code)].slice(0, 5);
    setLastRooms(newLast);
    localStorage.setItem('lastRooms', JSON.stringify(newLast));
  };

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setError('Введи своё имя');
      return;
    }
    if (!socket.connected) {
      setError('Нет связи с сервером. Подожди зелёный индикатор и попробуй снова.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    localStorage.setItem('playerName', playerName);

    const resolvedGameType =
      gameType === 'crocodile'
        ? crocodileWordMode === 'nouns'
          ? 'crocodile-nouns'
          : 'crocodile-verbs'
        : gameType;

    const settings =
      gameType === 'mafia'
        ? { targetPlayerCount, options: { aiGameMaster: mafiaAiGameMaster, isAlone } }
        : { isAlone };
    const ackTimer = setTimeout(() => {
      setIsLoading(false);
      setError((prev) => prev || 'Сервер не ответил. Обнови страницу и попробуй ещё раз.');
    }, 20000);
    socket.emit(
      'room:create',
      { playerName, gameType: resolvedGameType, settings, title: createTitle, password: createPassword },
      (response) => {
      clearTimeout(ackTimer);
      setIsLoading(false);
      if (response?.success) {
        const code = (response.room?.code || '').toUpperCase();
        try {
          localStorage.setItem('lastGameType', resolvedGameType);
          if (gameType === 'crocodile') localStorage.setItem('crocodileWordMode', crocodileWordMode);
        } catch {
          /* ignore */
        }
        saveRoomToLast(code, resolvedGameType);
        if (createPassword) sessionStorage.setItem(`room_password_${code}`, createPassword);
        setSessionRoom(code);
        navigate(`/room/${code}`);
      } else {
        setError(response?.error || 'Ошибка создания комнаты');
      }
    });
  };

  const handleJoinRoom = (e) => {
    if (e) e.preventDefault();
    if (!playerName.trim()) {
      setError('Введи имя перед входом');
      return;
    }
    if (!roomCodeToJoin.trim()) {
      setError('Введи код друга');
      return;
    }
    
    const code = roomCodeToJoin.trim().toUpperCase();
    localStorage.setItem('playerName', playerName);
    if (joinPassword) sessionStorage.setItem(`room_password_${code}`, joinPassword);
    setSessionRoom(code);
    navigate(`/room/${code}`);
  };

  return (
    <>
      {/* Header (connection status inline) */}
      <header className="lobby-header">
        <div className="lobby-header-logo">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`} title={isConnected ? 'Подключено' : 'Переподключение...'}>
        <span className="connection-dot"></span>
          </div>
          <span className="logo-icon">🎮</span>
          <span className="logo-text">PlayForFun</span>
      </div>
        <div className="lobby-header-center">
          <div className="lobby-nickname-frame">
            <input
              type="text"
              id="name"
              className="lobby-nickname-input"
              data-testid="player-name-input"
              value={playerName}
              onChange={(e) => {
                setPlayerName(e.target.value);
                setError('');
              }}
              placeholder="Ваше имя"
              maxLength={20}
              autoComplete="nickname"
            />
          </div>
          {/* NEW: "Я один" checkbox */}
          <label className="alone-checkbox">
            <input
              type="checkbox"
              checked={isAlone}
              onChange={(e) => {
                setIsAlone(e.target.checked);
                if (e.target.checked) {
                  setPlayerCountFilter(1);
                } else {
                  setPlayerCountFilter(null);
                }
              }}
            />
            <span>🎮 Я один/одна</span>
          </label>
          {error && <span className="error-text">{error}</span>}
        </div>
        <div className="lobby-header-right">
          <button
            type="button"
            className="lobby-secondary-btn lobby-join-by-code-btn"
            title="Присоединиться по коду комнаты"
            onClick={() => setShowJoinModal(true)}
          >
            <span className="join-btn-label-full">Присоединиться по коду</span>
            <span className="join-btn-label-short">По коду</span>
          </button>
          {openRooms.length > 0 && (
            <div className="rooms-dropdown-wrapper">
              <button 
                className="lobby-secondary-btn"
                onClick={() => setShowRoomsPopover(!showRoomsPopover)}
              >
                Комнаты ▼
              </button>
              {showRoomsPopover && (
                <div className="rooms-popover">
                  <p className="rooms-popover-label">Популярные</p>
                  {openRooms.slice(0, 6).map((r) => (
                    <button
                      key={r.code}
                      className="room-item"
                      onClick={() => {
                        const code = (r.code || '').toUpperCase();
                        setRoomCodeToJoin(code);
                        setShowRoomsPopover(false);
                        if (!r.hasPassword) {
                          setSessionRoom(code);
                          navigate(`/room/${code}`);
                        }
                      }}
                    >
                      {r.title || r.code} • {r.gameType} • {r.players}/{r.maxPlayers}{r.hasPassword ? ' 🔒' : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="lobby-content" id="catalog">
        <div className="game-section">
          <div className="game-section-header">
            <p className="game-section-subtitle">{GAMES.length} игр для весёлой компании</p>
          </div>

          <div className="game-filters">
            {CATEGORIES.map((cat) => (
              <button 
                key={cat.id} 
                className={`filter-chip ${activeFilter === cat.id ? 'active' : ''}`} 
                onClick={() => setActiveFilter(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Player Count Filter */}
          <div className="player-count-filter">
            <label className="filter-label">
              👥 Игроков: {playerCountFilter === null ? 'Любое' : playerCountFilter}
            </label>
            <div className="player-count-presets">
              {[2, 4, 6, 8, 12, 16].map((count) => (
                <button
                  key={count}
                  className={`player-count-chip ${playerCountFilter === count ? 'active' : ''}`}
                  onClick={() => setPlayerCountFilter(playerCountFilter === count ? null : count)}
                >
                  {count}
                </button>
              ))}
              <button
                className={`player-count-chip ${playerCountFilter === null ? 'active' : ''}`}
                onClick={() => setPlayerCountFilter(null)}
              >
                Все
              </button>
            </div>
          </div>

          <div className="search-container">
            <input
              type="text"
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск игры..."
            />
          </div>

        <div className="game-select">
            {filteredGames.map((game, i) => (
            <div
              key={game.id}
                role="button"
                tabIndex={0}
                data-testid={`game-card-${game.id}`}
              className={`game-card ${gameType === game.id ? 'selected' : ''}`}
                style={{ ['--card-i']: i }}
                onClick={() => {
                  setGameType(game.id);
                  localStorage.setItem('lastGameType', game.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setGameType(game.id);
                    localStorage.setItem('lastGameType', game.id);
                  }
                }}
            >
              <div className="game-card-rules" onClick={(e) => { e.stopPropagation(); setShowRules(game); }}>?</div>
                <div className="game-card-icon">{game.icon}</div>
                <div className="game-card-name">{game.name}</div>
                <div className="game-card-badge">{game.players} · {game.description}</div>
            </div>
          ))}
        </div>

          <h2 className="how-it-works-heading">
            Как это <span className="how-it-works-accent">работает</span>
          </h2>
          <div className="how-it-works">
            <div className="how-step">
              <div className="how-step-num">1</div>
              <div className="how-step-title">Выбери игру</div>
              <div className="how-step-desc">Мафия, Шляпа, Крокодил или Ассоциации</div>
            </div>
            <div className="how-step">
              <div className="how-step-num">2</div>
              <div className="how-step-title">Пригласи друзей</div>
              <div className="how-step-desc">Отправь код комнаты — заходят по ссылке</div>
            </div>
            <div className="how-step">
              <div className="how-step-num">3</div>
              <div className="how-step-title">Играй</div>
              <div className="how-step-desc">Без регистрации, прямо в браузере</div>
            </div>
        </div>

          <div className="donation-section">
            <div className="donation-icon">☕</div>
            <h3 className="donation-title">Поддержите проект</h3>
            <p className="donation-text">Ваши донаты помогают оплачивать сервера и добавлять новые игры.</p>
            <a href="https://www.donationalerts.com/r/stasplaytime" target="_blank" rel="noopener noreferrer" className="donation-btn">
              <span>♥</span>
              <span>Закинуть на кофе</span>
            </a>
        </div>
        
          <div className="lobby-page-footer">
          <div className="footer-links">
              <button type="button" className="footer-link-button" onClick={() => setShowFeedbackModal(true)}>
                Обратная связь
              </button>
            <a href="mailto:support@playfofun.ru">Поддержка</a>
              <a href="/terms" onClick={(e) => e.preventDefault()}>Пользовательское соглашение</a>
            </div>
            <p>&copy; 2026 PlayForFun — Лучшие игры для компаний. Без регистрации.</p>
          </div>
        </div>
      </div>

      {/* Sticky Footer with Main Action */}
      <footer className="lobby-footer">
        <div className="lobby-footer-content">
          {/* Selected Game Info */}
          {gameType && (
            <div className="selected-game-info">
              <div className="selected-game-icon">
                {GAMES.find(g => g.id === gameType)?.icon}
              </div>
              <div className="selected-game-details">
                <div className="selected-game-name">
                  {GAMES.find(g => g.id === gameType)?.name}
                </div>
                <div className="selected-game-desc">
                  {GAMES.find((g) => g.id === gameType)?.players} · {GAMES.find((g) => g.id === gameType)?.description}
                </div>
                {gameType === 'crocodile' && (
                  <div className="selected-game-crocodile-hint">
                    Сейчас:{' '}
                    <strong>
                      {crocodileWordMode === 'nouns' ? 'существительные' : 'глаголы и действия'}
                    </strong>
                    {' — переключите ниже'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mafia Settings (inline when selected) */}
          {gameType === 'mafia' && (
            <div className="mafia-footer-settings">
              <div className="mafia-players-slider">
                <label>🤖 {targetPlayerCount} игроков</label>
                <input
                  type="range"
                  min={4}
                  max={12}
                  value={targetPlayerCount}
                  onChange={(e) => setTargetPlayerCount(Number(e.target.value))}
                />
              </div>
              <label className="mafia-ai-option">
                <input
                  type="checkbox"
                  checked={mafiaAiGameMaster}
                  onChange={(e) => setMafiaAiGameMaster(e.target.checked)}
                />
                <span>🎙 ИИ ведущий</span>
              </label>
              <p className="mafia-footer-settings-hint">
                {mafiaAiGameMaster
                  ? 'Вы играете с ролью, фазы ведёт ИИ. Голосовой чат и боты — в комнате. Расширенный стол: телохранитель, журналист, мэр и классические роли.'
                  : 'Вы ведёте сами — без карты, минимум 4 игрока за столом. Голос и боты в комнате; на большом столе появляются телохранитель, журналист и мэр.'}
              </p>
            </div>
          )}

          {gameType === 'crocodile' && (
            <div className="lobby-crocodile-mode" role="group" aria-label="Тип слов для крокодила">
              <span className="lobby-crocodile-mode-label">Какие слова загадывать</span>
              <div className="lobby-crocodile-mode-toggle">
                <button
                  type="button"
                  className={`lobby-crocodile-mode-btn ${crocodileWordMode === 'verbs' ? 'active' : ''}`}
                  onClick={() => {
                    setCrocodileWordMode('verbs');
                    try {
                      localStorage.setItem('crocodileWordMode', 'verbs');
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  Глаголы и действия
                </button>
                <button
                  type="button"
                  className={`lobby-crocodile-mode-btn ${crocodileWordMode === 'nouns' ? 'active' : ''}`}
                  onClick={() => {
                    setCrocodileWordMode('nouns');
                    try {
                      localStorage.setItem('crocodileWordMode', 'nouns');
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  Существительные
                </button>
              </div>
            </div>
          )}

          {/* Room Settings Toggle */}
          <div className="room-settings-expand">
            <button 
              className="room-settings-toggle"
              onClick={() => setShowRoomSettings(!showRoomSettings)}
            >
              ⚙ Настройки
            </button>
          </div>

          {/* Main Action Button */}
          <button 
            type="button"
            className="lobby-main-btn" 
            data-testid="create-room-btn"
            onClick={handleCreateRoom} 
            disabled={isLoading || !socket.connected || !playerName.trim()}
          >
            {isLoading ? 'Создаём...' : '▶ Начать игру'}
          </button>
        </div>

        {/* Room Settings Panel */}
        {showRoomSettings && (
          <div className="room-settings-panel">
            <input 
              type="text" 
              data-testid="create-title-input" 
              value={createTitle} 
              onChange={(e) => setCreateTitle(e.target.value)} 
              placeholder="Название комнаты (необязательно)" 
              maxLength={64} 
            />
            <input 
              type="text" 
              data-testid="create-password-input" 
              value={createPassword} 
              onChange={(e) => setCreatePassword(e.target.value)} 
              placeholder="Пароль (необязательно)" 
              maxLength={64} 
            />
          </div>
        )}
      </footer>

      {/* Join Modal */}
      {showJoinModal && (
        <div className="join-modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="join-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Присоединиться к игре</h3>
            <form onSubmit={handleJoinRoom}>
              <input
                type="text"
                data-testid="join-code-input"
                value={roomCodeToJoin}
                onChange={(e) => setRoomCodeToJoin(e.target.value.toUpperCase())}
                placeholder="КОД"
                maxLength={6}
                autoFocus
              />
              <input
                type="text"
                data-testid="join-password-input"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                placeholder="Пароль (если есть)"
                maxLength={64}
              />
              <div className="join-modal-buttons">
                <button 
                  type="button" 
                  className="btn btn-sm" 
                  onClick={() => setShowJoinModal(false)}
                >
                  Отмена
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary-action" 
                  data-testid="join-room-btn" 
                  disabled={!roomCodeToJoin}
                >
                  Войти
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <FeedbackModal open={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />

      {/* Rules Modal */}
      {showRules && (
        <div className="modal">
          <div className="modal-backdrop" onClick={() => setShowRules(null)}></div>
          <div className="modal-content">
            <div className="modal-header">
              <h2>{showRules.name} — Правила</h2>
              <button className="modal-close" onClick={() => setShowRules(null)}>&times;</button>
            </div>
            <div className="modal-body">
              {showRules.rules}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Lobby;
