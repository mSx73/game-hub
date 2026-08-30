import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { connectSocket, setSessionName, setSessionRoom, socket } from '../services/socketService';
import './HomePage.css';

const GAMES = [
  { id: 'mafia', name: 'Мафия', icon: '🕵️‍♂️', description: 'Ролевая с детективным сюжетом', players: '4–12', tags: ['popular', 'social', 'bots'], featured: true },
  { id: 'hat', name: 'Шляпа', icon: '🎩', description: 'Объясняй слова на скорость', players: '2–8', tags: ['popular', 'words'] },
  { id: 'crocodile', name: 'Крокодил', icon: '🐊', description: 'Рисуй слово и угадывай', players: '2–12', tags: ['popular', 'action'] },
  { id: 'alias', name: 'Элиас', icon: '💬', description: 'Объясни без однокоренных', players: '2–12', tags: ['popular', 'words'] },
  { id: 'spy', name: 'Шпион', icon: '🕶️', description: 'Найди шпиона', players: '3–12', tags: ['popular', 'social', 'detective'] },
  { id: 'quiz', name: 'Квиз', icon: '🧠', description: 'Викторина для эрудитов', players: '2–20', tags: ['popular', 'trivia', 'fast'] },
  { id: 'meme', name: 'Мем Баттл', icon: '😂', description: 'Шути и голосуй', players: '3–16', tags: ['popular', 'creative', 'funny'] },
  { id: 'quiplash', name: 'Острослов', icon: '🎙️', description: 'Смешные ответы и дуэли', players: '3–8', tags: ['popular', 'creative', 'funny', 'new'], featured: true },
  { id: 'knowfriend', name: 'Узнай друга', icon: '🫂', description: 'Насколько хорошо вы знаете друг друга', players: '3–12', tags: ['popular', 'social', 'icebreaker', 'new'] },
  { id: 'fibbage', name: 'Предательский квиз', icon: '🤥', description: 'Придумай ложь, найди правду', players: '3–10', tags: ['popular', 'social', 'trivia', 'funny', 'new'] },
  { id: 'wordbomb', name: 'Слова-мины', icon: '💣', description: 'Не задень мину', players: '2–12', tags: ['words', 'action'] },
  { id: 'associations', name: 'Ассоциации', icon: '🔗', description: 'Цепочки ассоциаций', players: '3–8', tags: ['words', 'chill'] },
  { id: 'rhyme', name: 'Рифмоплёт', icon: '🎵', description: 'Сочини рифму', players: '3–12', tags: ['creative', 'funny', 'words'] },
  { id: 'categories', name: 'Категории', icon: '🏷️', description: 'Слово на букву', players: '2–12', tags: ['fast', 'words'] },
  { id: 'lastword', name: 'Последнее слово', icon: '⏱️', description: 'Кто назовёт последним', players: '2–12', tags: ['fast', 'words'] },
  { id: 'anagrams', name: 'Анаграммы', icon: '🔄', description: 'Составь слова из букв', players: '2–8', tags: ['words', 'fast', 'new'] },
  { id: 'wordchain', name: 'Цепочка слов', icon: '⛓️', description: 'Слово на последнюю букву', players: '2–12', tags: ['words', 'fast', 'new'] },
  { id: 'crossword', name: 'Сканворд', icon: '📰', description: 'Пересечения букв, как в журнале', players: '1–6', tags: ['words', 'chill', 'new'] },
  { id: 'debate', name: 'Дебаты', icon: '🎤', description: 'Аргументируй и побеждай', players: '4–16', tags: ['social', 'funny'] },
  { id: 'truths', name: 'Две правды', icon: '🤥', description: 'Найди ложь', players: '3–12', tags: ['social', 'icebreaker'] },
  { id: 'whoami', name: 'Кто я?', icon: '❓', description: 'Угадай персонажа', players: '3–10', tags: ['social', 'detective'] },
  { id: 'wouldyourather', name: 'Выбор', icon: '⚖️', description: 'Что бы ты выбрал?', players: '2–20', tags: ['social', 'icebreaker', 'fast'] },
  { id: 'prediction', name: 'Предсказание', icon: '🔮', description: 'Кто из нас?', players: '3–16', tags: ['social', 'icebreaker', 'new'] },
  { id: 'psych', name: 'Психолог', icon: '🧠', description: 'Угадай мысли', players: '3–12', tags: ['social', 'detective', 'new'] },
  { id: 'werewolf', name: 'Оборотни', icon: '🐺', description: 'Новая мафия', players: '5–16', tags: ['social', 'detective', 'new', 'bots'] },
  { id: 'judge', name: 'Судья', icon: '⚖️', description: 'Ты решаешь', players: '3–10', tags: ['social', 'funny', 'new'] },
  { id: 'trust', name: 'Доверие', icon: '🤝', description: 'Доверишься или рискнёшь?', players: '2–8', tags: ['social', 'strategy', 'new'] },
  { id: 'impostor', name: 'Самозванец', icon: '👤', description: 'Найди самозванца', players: '4–12', tags: ['social', 'detective', 'new'] },
  { id: 'story', name: 'Цепная история', icon: '📖', description: 'Сочиняйте вместе', players: '2–10', tags: ['creative', 'chill'] },
  { id: 'fakeartist', name: 'Фейк-художник', icon: '🎨', description: 'Кто не знает тему?', players: '3–10', tags: ['detective', 'creative', 'new'] },
  { id: 'wavelength', name: 'Волна', icon: '📡', description: 'Попади в шкалу', players: '3–12', tags: ['creative', 'social', 'new'] },
  { id: 'bluff', name: 'Блеф-клуб', icon: '🎭', description: 'Придумай определение', players: '3–10', tags: ['creative', 'funny', 'new'] },
  { id: 'connect', name: 'Связи', icon: '🧲', description: 'Найди связь', players: '3–12', tags: ['creative', 'funny', 'new'] },
  { id: 'sketch', name: 'Скетч', icon: '✏️', description: 'Рисуй и угадывай', players: '3–16', tags: ['creative', 'action', 'new'] },
  { id: 'caption', name: 'Подпись', icon: '💬', description: 'Придумай смешную подпись', players: '3–12', tags: ['creative', 'funny', 'new'] },
  { id: 'collage', name: 'Коллаж', icon: '🖼️', description: 'Создай историю', players: '2–8', tags: ['creative', 'chill', 'new'] },
  { id: 'emojiart', name: 'Эмодзи-арт', icon: '🎨', description: 'Рисуй эмодзи', players: '2–10', tags: ['creative', 'new'] },
  { id: 'emoji', name: 'Эмодзи', icon: '🎬', description: 'Угадай по эмодзи', players: '2–16', tags: ['fast', 'trivia'] },
  { id: 'auction', name: 'Аукцион чисел', icon: '🔢', description: 'Угадай число', players: '2–16', tags: ['trivia', 'funny', 'new'] },
  { id: 'ranking', name: 'Рейтинг', icon: '📊', description: 'Расставь по порядку', players: '2–12', tags: ['trivia', 'new'] },
  { id: 'timeline', name: 'Хронология', icon: '📅', description: 'Угадай год', players: '2–16', tags: ['trivia', 'new'] },
  { id: 'priceisright', name: 'Угадай цену', icon: '💰', description: 'Сколько это стоит?', players: '2–16', tags: ['trivia', 'funny', 'new'] },
  { id: 'facts', name: 'Факты', icon: '📚', description: 'Правда или ложь?', players: '2–12', tags: ['trivia', 'funny', 'new'] },
  { id: 'flags', name: 'Флаги', icon: '🌍', description: 'Узнай страну', players: '2–20', tags: ['trivia', 'fast', 'new'] },
  { id: 'logos', name: 'Логотипы', icon: '🎯', description: 'Узнай бренд', players: '2–12', tags: ['trivia', 'fast', 'new'] },
  { id: 'maps', name: 'Карты', icon: '🗺️', description: 'Угадай место', players: '2–8', tags: ['trivia', 'new'] },
  { id: 'quotes', name: 'Цитаты', icon: '💬', description: 'Угадай автора', players: '2–10', tags: ['trivia', 'new'] },
  { id: 'chameleon', name: 'Хамелеон', icon: '🦎', description: 'Кто не знает слово?', players: '3–10', tags: ['detective', 'social', 'new'] },
  { id: 'escalation', name: 'Переигрывай!', icon: '🔥', description: 'Назови круче', players: '3–10', tags: ['funny', 'action', 'new'] },
  { id: 'memory', name: 'Память', icon: '🧩', description: 'Запомни последовательность', players: '2–12', tags: ['fast', 'action', 'new'] },
  { id: 'hotpotato', name: 'Горячая картошка', icon: '🥔', description: 'Ответь пока не взорвалось', players: '3–10', tags: ['fast', 'action', 'new'] },
  { id: 'fibbing', name: 'Врун', icon: '🤫', description: 'Кто говорит правду?', players: '3–10', tags: ['social', 'detective', 'new'] },
  { id: 'bombparty', name: 'Бомба', icon: '💣', description: 'Буква на скорость', players: '2–12', tags: ['fast', 'words', 'new'] },
  { id: 'sequence', name: 'Последовательность', icon: '🔢', description: 'Продолжи ряд', players: '2–8', tags: ['fast', 'trivia', 'new'] },
  { id: 'reaction', name: 'Реакция', icon: '⚡', description: 'Нажми быстрее!', players: '2–12', tags: ['fast', 'action', 'new'] },
  { id: 'colors', name: 'Цвета', icon: '🌈', description: 'Нажми правильный', players: '2–8', tags: ['fast', 'action', 'new'] },
  { id: 'coopquiz', name: 'Командный квиз', icon: '🤝', description: 'Вместе против времени', players: '4–20', tags: ['trivia', 'new'] },
  { id: 'teamwords', name: 'Командные слова', icon: '📝', description: 'Угадай без подготовки', players: '4–16', tags: ['words', 'new'] },
  { id: 'relay', name: 'Эстафета', icon: '🏃', description: 'Передай дальше', players: '4–12', tags: ['creative', 'action', 'new'] },
  { id: 'sync', name: 'Синхро', icon: '⏱️', description: 'Нажмите одновременно', players: '2–8', tags: ['action', 'new'] },
  { id: 'password', name: 'Пароль', icon: '🔐', description: 'Зашифруй слово', players: '4–12', tags: ['words', 'creative', 'new'] },
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

const SUPPORTED_GAME_IDS = new Set([
  'quiplash', 'knowfriend', 'fibbage',
  'mafia', 'hat', 'crocodile', 'alias', 'spy', 'quiz', 'meme', 'wordbomb',
  'associations', 'rhyme', 'categories', 'lastword', 'anagrams', 'wordchain', 'crossword',
  'debate', 'truths', 'whoami', 'wouldyourather', 'prediction', 'psych', 'judge', 'trust',
  'impostor', 'story', 'fakeartist', 'wavelength', 'bluff', 'connect', 'caption',
  'collage', 'emojiart', 'emoji', 'auction', 'ranking', 'timeline', 'priceisright', 'facts',
  'flags', 'logos', 'maps', 'quotes', 'chameleon', 'escalation', 'memory', 'hotpotato',
  'fibbing', 'bombparty', 'sequence',
  // Восстановленные игры
  'reaction', 'colors', 'teamwords',
]);
// Курация (2026-05-21): прячем из каталога скучные/филлерные игры в духе salo.fun/Jackbox.
// Движки скрытых игр остаются в коде — чтобы вернуть игру, достаточно убрать её id отсюда.
const HIDDEN_GAME_IDS = new Set([
  'hat', 'rhyme', 'categories', 'lastword', 'wordchain', 'crossword', 'debate',
  'prediction', 'psych', 'werewolf', 'judge', 'trust', 'impostor', 'connect',
  'sketch', 'collage', 'emojiart', 'auction', 'ranking', 'timeline', 'priceisright',
  'facts', 'logos', 'maps', 'quotes', 'escalation', 'memory', 'hotpotato', 'sequence',
  'reaction', 'colors', 'coopquiz', 'teamwords', 'relay', 'sync', 'password',
]);
const VISIBLE_GAMES = GAMES.filter((game) => !HIDDEN_GAME_IDS.has(game.id));
const LAUNCHABLE_GAMES = VISIBLE_GAMES.filter((game) => SUPPORTED_GAME_IDS.has(game.id));
const COMING_SOON_GAMES = VISIBLE_GAMES.filter((game) => !SUPPORTED_GAME_IDS.has(game.id));

const readGameFromQuery = () => {
  if (typeof window === 'undefined') return null;
  const game = (new URLSearchParams(window.location.search).get('game') || '').trim();
  return game && LAUNCHABLE_GAMES.some((item) => item.id === game) ? game : null;
};

const normalizeGameSelection = (raw) => {
  if (!raw) return 'mafia';
  if (raw === 'crocodile-verbs' || raw === 'crocodile-nouns' || raw === 'crocodile') return 'crocodile';
  return raw;
};

const readInitialCrocodileMode = () => {
  const last = localStorage.getItem('lastGameType');
  if (last === 'crocodile-nouns') return 'nouns';
  if (last === 'crocodile-verbs') return 'verbs';
  const stored = localStorage.getItem('crocodileWordMode');
  return stored === 'nouns' ? 'nouns' : 'verbs';
};

function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeCategory, setActiveCategory] = useState('all');
  const [playerFilter, setPlayerFilter] = useState(null);
  const [search, setSearch] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState(localStorage.getItem('playerName') || '');
  const [selectedGameId, setSelectedGameId] = useState(
    normalizeGameSelection(readGameFromQuery() || localStorage.getItem('lastGameType') || 'mafia')
  );
  const [crocodileWordMode, setCrocodileWordMode] = useState(readInitialCrocodileMode);
  const [isCreating, setIsCreating] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [error, setError] = useState('');
  const [visitCount, setVisitCount] = useState(null);
  const [launches, setLaunches] = useState({});

  useEffect(() => {
    connectSocket();
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', () => setError('Ошибка подключения к серверу. Проверьте соединение.'));
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error');
    };
  }, []);

  useEffect(() => {
    const queryGame = (new URLSearchParams(location.search).get('game') || '').trim();
    if (!queryGame) return;
    const normalized = normalizeGameSelection(queryGame);
    if (LAUNCHABLE_GAMES.some((item) => item.id === normalized)) {
      setSelectedGameId(normalized);
    }
  }, [location.search]);

  useEffect(() => {
    if (!SUPPORTED_GAME_IDS.has(selectedGameId)) {
      setSelectedGameId('mafia');
    }
  }, [selectedGameId]);

  useEffect(() => {
    const storageKey = 'pff_visitor_id_v1';
    let visitorId = localStorage.getItem(storageKey);
    if (!visitorId) {
      visitorId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(storageKey, visitorId);
    }
    fetch('/api/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Number.isFinite(data.totalUnique)) {
          setVisitCount(data.totalUnique);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/launches')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.gameLaunches && typeof data.gameLaunches === 'object') {
          setLaunches(data.gameLaunches);
        }
      })
      .catch(() => {});
  }, []);

  const parsePlayerRange = (players) => {
    const match = players.match(/(\d+)[–-](\d+)/);
    if (!match) return { min: 0, max: 999 };
    return { min: Number(match[1]), max: Number(match[2]) };
  };

  const filteredGames = useMemo(
    () => {
      const sorted = [...LAUNCHABLE_GAMES].sort((a, b) => {
        const aLaunches = Number(launches[a.id] || 0);
        const bLaunches = Number(launches[b.id] || 0);
        if (bLaunches !== aLaunches) return bLaunches - aLaunches;
        return a.name.localeCompare(b.name, 'ru');
      });
      return sorted.filter((game) => {
        if (activeCategory !== 'all' && !game.tags.includes(activeCategory)) return false;
        const range = parsePlayerRange(game.players);
        if (playerFilter && (playerFilter < range.min || playerFilter > range.max)) {
          return false;
        }
        if (
          search &&
          !`${game.name} ${game.description}`.toLowerCase().includes(search.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      });
    },
    [activeCategory, launches, playerFilter, search]
  );

  const topPopularIds = useMemo(() => {
    const sorted = [...LAUNCHABLE_GAMES].sort((a, b) => {
      const aLaunches = Number(launches[a.id] || 0);
      const bLaunches = Number(launches[b.id] || 0);
      if (bLaunches !== aLaunches) return bLaunches - aLaunches;
      return a.name.localeCompare(b.name, 'ru');
    });
    return new Set(sorted.slice(0, 3).map((game) => game.id));
  }, [launches]);

  const createRoom = (gameId = selectedGameId) => {
    if (!SUPPORTED_GAME_IDS.has(gameId)) {
      setError('Эта игра еще не запущена на сервере.');
      return;
    }
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      setError('Введите имя перед стартом.');
      return;
    }
    if (!socket.connected) {
      setError('Сервер недоступен. Подождите переподключения и попробуйте снова.');
      return;
    }
    setIsCreating(true);
    setError('');

    const resolvedGameType =
      gameId === 'crocodile'
        ? crocodileWordMode === 'nouns'
          ? 'crocodile-nouns'
          : 'crocodile-verbs'
        : gameId;
    const settings = gameId === 'mafia' ? { targetPlayerCount: 6, options: { aiGameMaster: false } } : {};
    const ackTimer = setTimeout(() => {
      setIsCreating(false);
      setError('Сервер не ответил. Попробуйте еще раз.');
    }, 20000);

    socket.emit('room:create', { playerName: trimmedName, gameType: resolvedGameType, settings }, (response) => {
      clearTimeout(ackTimer);
      setIsCreating(false);
      if (!response?.success) {
        setError(response?.error || 'Не удалось создать комнату.');
        return;
      }
      const code = (response.room?.code || '').toUpperCase();
      localStorage.setItem('playerName', trimmedName);
      localStorage.setItem('lastGameType', resolvedGameType);
      if (gameId === 'crocodile') localStorage.setItem('crocodileWordMode', crocodileWordMode);
      setSessionName(trimmedName);
      setSessionRoom(code);
      fetch(`/api/launch/${encodeURIComponent(gameId)}`, { method: 'POST' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Number.isFinite(data.gameLaunchCount)) {
            setLaunches((prev) => ({ ...prev, [gameId]: data.gameLaunchCount }));
          }
        })
        .catch(() => {});
      navigate(`/room/${code}`);
    });
  };

  const openRandomGame = () => {
    const pool = filteredGames.length > 0 ? filteredGames : LAUNCHABLE_GAMES;
    if (!pool.length) {
      setError('Нет доступных игр для запуска.');
      return;
    }
    const random = pool[Math.floor(Math.random() * pool.length)];
    setSelectedGameId(random.id);
    setError('');
    createRoom(random.id);
  };

  const handleJoinRoom = (event) => {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError('Введите код комнаты.');
      return;
    }
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      setError('Введите имя перед входом в комнату.');
      return;
    }
    localStorage.setItem('playerName', trimmedName);
    setSessionName(trimmedName);
    setSessionRoom(code);
    navigate(`/room/${code}`);
  };

  return (
    <div className="home-shell">
      <header className="hf-topbar">
        <nav className="hf-topbar-inner">
          <div className="hf-left">
            <a className="hf-logo" href="/">
              PlayForFun
            </a>
            <div className="hf-links">
              <a className="is-active" href="#catalog">
                Каталог
              </a>
              <a href="#catalog">Комнаты</a>
              <a href="#how-it-works">Турниры</a>
            </div>
          </div>
          <form className="hf-join-form" onSubmit={handleJoinRoom}>
            <input
              type="text"
              value={playerName}
              onChange={(event) => {
                setPlayerName(event.target.value);
                setError('');
              }}
              placeholder="Ваше имя"
              maxLength={20}
            />
            <input
              type="text"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="Код комнаты..."
              maxLength={6}
            />
            <button type="submit">Войти по коду</button>
          </form>
        </nav>
      </header>

      <main className="hf-main">
        <section className="hf-hero">
          <div className="hf-hero-content">
            <h1>
              Собери компанию <br />
              за <span>30 секунд</span>
            </h1>
            <p>Играй с друзьями. Где угодно. Когда угодно.</p>
            <div className="hf-hero-actions">
              <button
                type="button"
                onClick={() => createRoom()}
                disabled={isCreating || !isConnected}
              >
                {isCreating ? 'Создаём комнату...' : 'Начать играть'}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={openRandomGame}
                disabled={isCreating || !isConnected}
              >
                Случайная игра
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                Смотреть демо
              </button>
            </div>
            <div className="hf-quick-status">
              <span className={isConnected ? 'ok' : 'bad'}>
                {isConnected ? '● Сервер на связи' : '● Переподключение...'}
              </span>
              <span>
                Выбрана игра: <strong>{LAUNCHABLE_GAMES.find((game) => game.id === selectedGameId)?.name || '—'}</strong>
              </span>
            </div>
            {selectedGameId === 'crocodile' && (
              <div className="hf-crocodile-mode" role="group" aria-label="Режим Крокодила">
                <span>Режим Крокодила:</span>
                <button
                  type="button"
                  className={crocodileWordMode === 'verbs' ? 'active' : ''}
                  onClick={() => setCrocodileWordMode('verbs')}
                >
                  Глаголы и действия
                </button>
                <button
                  type="button"
                  className={crocodileWordMode === 'nouns' ? 'active' : ''}
                  onClick={() => setCrocodileWordMode('nouns')}
                >
                  Существительные
                </button>
              </div>
            )}
            {error && <p className="hf-error">{error}</p>}
          </div>
        </section>

        <section className="hf-catalog" id="catalog">
          <div className="hf-catalog-shortcuts">
            <button type="button" onClick={() => setActiveCategory('popular')}>Популярные</button>
            <button type="button" onClick={() => setActiveCategory('new')}>Новые</button>
            <button type="button" onClick={() => setActiveCategory('all')}>По жанрам</button>
          </div>
          <div className="hf-filters-row">
            <div className="hf-filters">
              {CATEGORIES.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  className={activeCategory === category.id ? 'active' : ''}
                  onClick={() => setActiveCategory(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>
            <input
              className="hf-search"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по названию..."
            />
          </div>

          <div className="hf-player-filter">
            <span>Игроков:</span>
            {[2, 4, 6, 8, 12, 16].map((count) => (
              <button
                type="button"
                key={count}
                className={playerFilter === count ? 'active' : ''}
                onClick={() => setPlayerFilter((prev) => (prev === count ? null : count))}
              >
                {count}
              </button>
            ))}
            <button
              type="button"
              className={playerFilter === null ? 'active all' : 'all'}
              onClick={() => setPlayerFilter(null)}
            >
              Все
            </button>
          </div>

          <div className="hf-grid">
            {filteredGames.map((game) =>
              game.featured ? (
                <article
                  key={game.id}
                  className={`hf-card featured ${selectedGameId === game.id ? 'selected' : ''}`}
                  onClick={() => setSelectedGameId(game.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedGameId(game.id);
                    }
                  }}
                >
                  <p className="badge">Hot</p>
                  {topPopularIds.has(game.id) && <p className="hf-popular-badge">Популярное</p>}
                  <h3>{game.name}</h3>
                  <p>{game.description}</p>
                  <span>{game.players} игроков</span>
                  <small className="hf-launches">🔥 {Number(launches[game.id] || 0)} запусков</small>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedGameId(game.id);
                      createRoom(game.id);
                    }}
                    disabled={isCreating || !isConnected}
                  >
                    Играть сейчас
                  </button>
                </article>
              ) : (
                <article
                  key={game.id}
                  className={`hf-card ${selectedGameId === game.id ? 'selected' : ''}`}
                  onClick={() => setSelectedGameId(game.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedGameId(game.id);
                      createRoom(game.id);
                    }
                  }}
                >
                  <div className="icon">{game.icon}</div>
                  {topPopularIds.has(game.id) && <p className="hf-popular-badge">Популярное</p>}
                  <h4>{game.name}</h4>
                  <p>{game.description}</p>
                  <span>{game.players} игроков</span>
                  <small className="hf-launches">🔥 {Number(launches[game.id] || 0)} запусков</small>
                  <button
                    type="button"
                    className="hf-card-play-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedGameId(game.id);
                      createRoom(game.id);
                    }}
                    disabled={isCreating || !isConnected}
                  >
                    ▶ Играть
                  </button>
                </article>
              )
            )}

            {COMING_SOON_GAMES.length > 0 && (
              <article
                className="hf-card wide coming-soon-card"
                onClick={() => navigate('/coming-soon')}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate('/coming-soon');
                  }
                }}
              >
                <div className="hf-coming-soon-icon">🚀</div>
                <h3>Скоро: {COMING_SOON_GAMES.length} новых игр</h3>
                <p>Реакция, Бомба, Оборотни и другие. Подпишитесь на уведомления!</p>
                <span className="hf-coming-soon-badge">Coming Soon</span>
              </article>
            )}

            <article className="hf-card wide">
              <h3>Скоро: кастомные комнаты</h3>
              <p>Создавайте свои правила и приглашайте до 100 человек одновременно.</p>
              <span>Бета-тест</span>
            </article>
          </div>
        </section>

        <section className="hf-how" id="how-it-works">
          <h2>Как это работает</h2>
          <div className="hf-how-grid">
            <article>
              <div>1</div>
              <h4>Выбери игру</h4>
              <p>Сотни бесплатных браузерных игр для любой компании и настроения.</p>
            </article>
            <article>
              <div>2</div>
              <h4>Пригласи друзей</h4>
              <p>Просто отправь короткий код или ссылку. Регистрация не требуется.</p>
            </article>
            <article>
              <div>3</div>
              <h4>Играй</h4>
              <p>Наслаждайся процессом с телефона, планшета или компьютера.</p>
            </article>
          </div>
        </section>
        <section className="hf-support" id="support">
          <h3>Поддержать проект</h3>
          <p>
            Сервер работает на пожертвования. Если вам нравится проводить время с друзьями — поддержите
            проект, чтобы мы могли добавлять новые игры и содержать сервер.
          </p>
          <div className="hf-support-actions">
            <a className="hf-support-btn" href="https://www.donationalerts.com/r/stasplaytime" target="_blank" rel="noreferrer">
              Разовый донат
            </a>
            <a className="hf-support-btn secondary" href="https://boosty.to/msx73/donate" target="_blank" rel="noreferrer">
              (Boosty)
            </a>
          </div>
        </section>
      </main>

      <footer className="hf-footer">
        <div>
          <strong>PlayForFun</strong>
          <p>© 2026 PlayForFun. Игры для компании онлайн.</p>
          <p>{visitCount === null ? 'Нас уже ... человек' : `Нас уже ${visitCount} человек`}</p>
        </div>
        <div className="hf-footer-links">
          <a href="#catalog">Каталог</a>
          <a href="#support">Поддержка</a>
          <a href="https://playfofun.duckdns.org/" target="_blank" rel="noreferrer">Сайт</a>
          <a href="https://playfofun.duckdns.org/sitemap.xml" target="_blank" rel="noreferrer">Sitemap</a>
        </div>
        <a className="hf-donate-btn" href="https://www.donationalerts.com/r/stasplaytime">
          Закинуть на кофе
        </a>
      </footer>
    </div>
  );
}

export default HomePage;
