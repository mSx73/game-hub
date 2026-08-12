import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useGlobalEffects } from '../context/GlobalEffectsContext';
import { socket, connectSocket, setSessionRoom, setSessionName, getSessionName } from '../services/socketService';
import { CrocodileCanvas } from '../components/CrocodileCanvas';
import { CrosswordPanel } from '../components/CrosswordPanel';
import { MafiaGameTable } from '../components/mafia';
import { useMafiaGameState } from '../components/mafia/hooks';
import GameLayoutWrapper from '../components/GameLayoutWrapper';
import { Timer, MiniTimer } from '../components/Timer';
import { PrimaryButton, SecondaryButton, Button } from '../components/Button';
import { useToast } from '../components/Toast';
import DictionaryStatus from '../components/DictionaryStatus';
import { GameRulesDisclosure, GameRulesBulletList, GameScoreboardBlock } from '../components/GameRulesDisclosure';
import { getStaticHelp, buildRankedScoreRows } from '../data/gameRulesHelp';
import { MAFIA_PHASE_LABELS, getMafiaActionTypeForPhase } from '@playforfun/shared-types';
import './RoomPage.css';
import '../styles/games-unified-skin.css';
import '../components/LobbyRedesigned.css';
import { CrocodileLuxeChrome, CrocodileLuxeBottomNav } from '../games/crocodile/CrocodileLuxeChrome';
import '../games/crocodile/croc-luxe.css';

const CROSSWORD_CORPORATE_WORD_COUNT = 60;
const CROSSWORD_AUTO_SIZE_PRESETS = [12, 18, 24, 30, 36, 45, 60];

const CROSSWORD_MODE_LABELS = {
  coop: 'Совместно',
  corporate: 'Корпоратив',
  duel: 'Дуэль 1×1',
  race: 'Гонка',
  solo_race: 'Соло на время',
  solo_casual: 'Соло без таймера',
};

const GAME_LOBBY_INFO = {
  mafia:        { emoji: '🎭', desc: 'Мирные жители против Мафии. Вычисляйте врага днём, выживайте ночью.' },
  hat:          { emoji: '🎩', desc: 'Объясняйте слова из шляпы без однокоренных. Команда с большим счётом побеждает.' },
  alias:        { emoji: '💡', desc: 'Объясняйте слова без однокоренных — команда угадывает как можно больше за время.' },
  wordbomb:     { emoji: '💣', desc: 'Объясняйте слово, не называя «мин» — запретных слов. Назвал мину — минус очки и конец хода.' },
  crocodile:    { emoji: '🖍️', desc: 'Рисуйте, пока команда угадывает слово. Без слов и букв!' },
  associations: { emoji: '💭', desc: 'Дайте одно слово-ассоциацию. Голосуйте за ту, что совпадёт с авторской.' },
  spy:          { emoji: '🕵️', desc: 'Один из вас — Шпион и не знает место. Задавайте вопросы, вычисляйте!' },
  quiz:         { emoji: '❓', desc: 'Тест на знания — 4 варианта ответа. Правильные ответы дают очки.' },
  lastword:     { emoji: '🗣️', desc: 'Называйте слова в категории. Кто скажет последнее — получает бонус!' },
  auction:      { emoji: '🔨', desc: 'Назовите число или дату. Ближайший к правильному ответу побеждает.' },
  wavelength:   { emoji: '📡', desc: 'Один задаёт подсказку, остальные угадывают место на шкале между двумя полюсами.' },
  ranking:      { emoji: '📊', desc: 'Расставьте варианты в правильном порядке по заданному критерию.' },
  rhyme:        { emoji: '🎵', desc: 'Придумайте рифму к слову — голосуйте за самую меткую.' },
  priceisright: { emoji: '💰', desc: 'Угадайте цену товара. Не превысьте, но угадайте как можно точнее.' },
  bluff:        { emoji: '🃏', desc: 'Придумайте убедительное определение слова. Голосуйте за самое правдоподобное.' },
  escalation:   { emoji: '📈', desc: 'Каждый ход задание усложняется. Принимайте или отклоняйте — сообща!' },
  memory:       { emoji: '🧠', desc: 'Запомните последовательность цветных символов и восстановите её по памяти.' },
  anagrams:     { emoji: '🔤', desc: 'Составляйте слова из предложенных букв. Длинные слова — больше очков.' },
  wordchain:    { emoji: '🔗', desc: 'Слова по цепочке: каждое начинается на последнюю букву предыдущего.' },
  facts:        { emoji: '🧪', desc: 'Факт или миф? Нажмите «Правда» или «Ложь» — кто угадает больше, тот выиграет.' },
  sequence:     { emoji: '🔢', desc: 'Найдите следующее число в последовательности. Первый правильный ответ победит!' },
  bombparty:    { emoji: '💣', desc: 'Слово с заданной буквой в категории — успейте до взрыва!' },
  psych:        { emoji: '🔮', desc: 'Один игрок — Психолог: он угадывает, кто что ответил. Остальные — вводят ответ.' },
  judge:        { emoji: '⚖️', desc: 'Спорная ситуация, два лагеря. Убеждайте Судью голосом — и только он выносит вердикт.' },
  impostor:     { emoji: '🕵️', desc: 'У всех одна профессия — кроме Самозванца. Найдите его прежде, чем он сольётся.' },
  caption:      { emoji: '🎬', desc: 'Придумайте самую смешную подпись к ситуации. Судья выбирает победителя.' },
  flags:        { emoji: '🏳️', desc: 'Угадайте страну по флагу! Первый правильный ответ побеждает.' },
  logos:        { emoji: '🏷️', desc: 'Опознайте бренд по подсказке. Первый правильный ответ выигрывает.' },
  maps:         { emoji: '🗺️', desc: 'Угадайте город по описанию достопримечательностей.' },
  quotes:       { emoji: '💬', desc: 'Знаменитая цитата — угадайте автора первым.' },
  hotpotato:    { emoji: '🥔', desc: 'Горячая картошка передаётся по кругу. У кого взорвётся — отвечает на вопрос!' },
  fibbing:      { emoji: '🤥', desc: 'Один знает правду, остальные выдумывают. Голосуйте за ответ, который звучит правдиво.' },
  prediction:   { emoji: '🔮', desc: 'Угадайте, кто из игроков лучше всего ответит на вопрос. Точный прогноз — очки!' },
  connect:      { emoji: '🔗', desc: 'Два слова. Найдите слово, которое их объединяет. Лучший ответ получает голоса.' },
  meme:         { emoji: '😂', desc: 'Подберите самую смешную подпись к мему. Голосуйте за лучший вариант!' },
  debate:       { emoji: '🗣️', desc: 'Дискутируйте за и против тезиса. Голосуйте за лучший аргумент.' },
  truths:       { emoji: '🕵️', desc: 'Две правды и одна ложь. Угадайте, какое утверждение выдумано!' },
  story:        { emoji: '📖', desc: 'Создайте историю вместе — каждый добавляет одно предложение по очереди.' },
  emoji:        { emoji: '😎', desc: 'Угадайте слово по эмодзи! Первый правильный ответ побеждает.' },
  whoami:       { emoji: '🤔', desc: 'Задавайте вопросы с ответами «да/нет» и угадайте, какой вы персонаж.' },
  fakeartist:   { emoji: '🎨', desc: 'Все рисуют одно слово — кроме Фейк-художника. Найдите его!' },
  chameleon:    { emoji: '🦎', desc: 'Все знают тему — кроме Хамелеона. Называйте подсказки и вычисляйте!' },
  collage:      { emoji: '🖼️', desc: 'Создайте коллаж вместе, добавляя эмодзи по очереди. Голосуйте за лучший!' },
  emojiart:     { emoji: '🎭', desc: 'Нарисуйте слово эмодзи. Команда угадывает — чем быстрее, тем лучше!' },
  categories:   { emoji: '📋', desc: 'Называйте слова в заданной категории. Кто не успевает — выбывает.' },
  wouldyourather: { emoji: '🤷', desc: 'Что бы вы выбрали? Голосуйте и сравнивайте с остальными.' },
  trust:        { emoji: '🤝', desc: 'Угадайте, как другие ответят. Чем точнее прогноз — тем больше очков.' },
  crossword:    { emoji: '📝', desc: 'Разгадывайте кроссворд вместе или в гонке. Хост настраивает режим.' },
  timeline:     { emoji: '📅', desc: 'Угадайте год исторического события. Ближайший к правильному ответу — в плюсе.' },
  sketch:       { emoji: '✏️', desc: 'Рисуйте слова как Крокодил, но в свободном стиле. Команда угадывает!' },
  'crocodile-nouns': { emoji: '🐊', desc: 'Рисуйте только предметы — команда угадывает без слов.' },
  'crocodile-verbs': { emoji: '🐊', desc: 'Рисуйте только действия — объяснить жестами сложнее!' },
  reaction:     { emoji: '⚡', desc: 'Ждите сигнала — кто быстрее нажмёт кнопку, тот побеждает!' },
  colors:       { emoji: '🎨', desc: 'Цвет показан, название написано другое. Нажмите цвет НАПИСАННОГО слова!' },
  teamwords:    { emoji: '🏆', desc: 'Командная игра: объясняющий жестами, слова на языке — команда угадывает.' },
};

const GAME_LABELS = {
  mafia: 'Мафия',
  hat: 'Шляпа',
  crocodile: 'Крокодил',
  'crocodile-verbs': 'Крокодил · действия',
  'crocodile-nouns': 'Крокодил · предметы',
  associations: 'Ассоциации',
  alias: 'Элиас', spy: 'Шпион', quiz: 'Квиз', meme: 'Мем Баттл',
  wordbomb: 'Слова-мины', debate: 'Дебаты', truths: 'Две правды',
  story: 'Цепная история',
  collage: 'Коллаж',
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
  sketch: 'Скетч',
  hotpotato: 'Горячая картошка', fibbing: 'Врун', prediction: 'Предсказание',
  connect: 'Связи', monopoly: 'Монополия', kowall: 'K.O.Wall',
};

const isCrocodileDrawGame = (gt) =>
  gt === 'crocodile' || gt === 'crocodile-verbs' || gt === 'crocodile-nouns' || gt === 'sketch';

const crocodileFamilyTitle = (gameType) => {
  if (gameType === 'sketch') return 'Скетч';
  if (gameType === 'crocodile-nouns') return 'Крокодил · предметы';
  if (gameType === 'crocodile-verbs') return 'Крокодил · действия';
  return 'Крокодил';
};

function CrocSelectionCountdown({ deadline }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  if (remaining <= 0) return null;
  return <span className="croc-selection-countdown"> · авто-выбор через {remaining}s</span>;
}

const MAFIA_ROLE_INFO = {
  civilian: { title: 'Мирный житель', desc: 'Днём обсуждайте и голосуйте. Ночью вы спите.' },
  mafia: { title: 'Мафия', desc: 'Ночью выбирайте жертву. Днём притворяйтесь мирным.' },
  don: { title: 'Дон', desc: 'Вы мафия. Ночью проверяйте, кто шериф.' },
  sheriff: { title: 'Шериф', desc: 'Ночью проверяйте игроков. Днём убеждайте город.' },
  doctor: { title: 'Доктор', desc: 'Ночью лечите игрока, чтобы спасти от убийства.' },
  putana: { title: 'Путана', desc: 'Ночью посещайте игрока: его голос на следующем голосовании не учитывается.' },
  poisoner: { title: 'Отравитель', desc: 'Ночью выбирайте цель для отравления.' },
  maniac: { title: 'Маньяк', desc: 'Ночью выбирайте жертву. У вас своя победа.' },
  bodyguard: {
    title: 'Телохранитель',
    desc: 'Ночью выберите жителя: если его хотели убить, вы погибаете вместо него.',
  },
  journalist: {
    title: 'Журналист',
    desc: 'Ночью проверяйте игрока: «красный» — любая мафия, включая дона.',
  },
  mayor: {
    title: 'Мэр',
    desc: 'Пассивная роль города. Ваш голос на дневном голосовании считается за два.',
  },
};

function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  // useNavigate() без data router = useNavigateUnstable(): колбэк меняет identity при смене pathname/matches.
  // Нельзя класть navigate в deps эффекта сокета — иначе бесконечные teardown → room:leave → снова join → «мигание» комнаты.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const { triggerShake, rainbowMode } = useGlobalEffects();
  const toast = useToast();
  const [room, setRoom] = useState(null);
  const roomStatusRef = useRef(null);
  roomStatusRef.current = room;
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [copySuccess, setCopySuccess] = useState('');
  const [newNickname, setNewNickname] = useState(localStorage.getItem('playerName') || '');
  const [gameState, setGameState] = useState(null);
  const [phase, setPhase] = useState('waiting');
  const [phaseTimer, setPhaseTimer] = useState(0);
  const [phaseTimerMax, setPhaseTimerMax] = useState(0);
  const [actionPrompt, setActionPrompt] = useState(null);
  const [actionStatus, setActionStatus] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [speakingTurn, setSpeakingTurn] = useState(null);
  const [selectedRoleMap, setSelectedRoleMap] = useState({});
  const [aiMessages, setAiMessages] = useState([]);
  const [mafiaPhaseOverlay, setMafiaPhaseOverlay] = useState(null);
  const mafiaPhaseOverlayTimerRef = useRef(null);
  const [hostActAsPlayer, setHostActAsPlayer] = useState('');
  const [mafiaMobileTab, setMafiaMobileTab] = useState('table');
  const [gameHistory, setGameHistory] = useState([]);
  const [sfxEnabled, setSfxEnabled] = useState(() => localStorage.getItem('room-sfx-enabled') !== '0');
  const [mafiaSetupDetailsOpen, setMafiaSetupDetailsOpen] = useState(false);
  const [mafiaInvestigationLog, setMafiaInvestigationLog] = useState([]);
  const [mafiaGameStats, setMafiaGameStats] = useState(null);
  /** Сброс локального UI мини-игр после host:end-game (см. docs/IMPROVEMENT_SPEC.md). */
  const resetGameUiAfterHostAbortRef = useRef(() => {});
  const prevGameTypeRef = useRef(null);

  const [hatWordsInput, setHatWordsInput] = useState('');
  const [hatSubmitted, setHatSubmitted] = useState(false);
  const [hatTimer, setHatTimer] = useState(0);
  const [hatRoundTime, setHatRoundTime] = useState(60);
  const [hatWord, setHatWord] = useState('');
  const [hatIsExplainer, setHatIsExplainer] = useState(false);
  const [hatConfirmInFlight, setHatConfirmInFlight] = useState(false);
  const [hatRoundInfo, setHatRoundInfo] = useState(null);
  const [hatPanicMode, setHatPanicMode] = useState(false);
  const [hatScoreboard, setHatScoreboard] = useState(null);
  const [hatRoundSummary, setHatRoundSummary] = useState(null);

  const [assocWordsInput, setAssocWordsInput] = useState('');
  const [assocSubmitted, setAssocSubmitted] = useState(false);
  const [assocTurn, setAssocTurn] = useState(null);
  const [assocWordInput, setAssocWordInput] = useState('');
  const [assocVoting, setAssocVoting] = useState(null);
  const [assocVoteChoice, setAssocVoteChoice] = useState(null);
  const [assocLastResult, setAssocLastResult] = useState(null);
  const [assocFlash, setAssocFlash] = useState(false);
  const [assocFlashColor, setAssocFlashColor] = useState('#7850ff');
  const [assocScores, setAssocScores] = useState([]);

  const [crocTurn, setCrocTurn] = useState(null);
  const [crocTimer, setCrocTimer] = useState(0);
  const [crocMyWord, setCrocMyWord] = useState('');
  const [crocScore, setCrocScore] = useState([]);
  const [crocStrokes, setCrocStrokes] = useState([]);
  const [crocWordChoices, setCrocWordChoices] = useState(null);
  const [crocTimeoutWord, setCrocTimeoutWord] = useState(null);
  const crocGuessInputRef = useRef(null);
  const [aliasGuessSending, setAliasGuessSending] = useState(false);
  const [aliasTransition, setAliasTransition] = useState(null);
  // Кого уже засчитали как угадавшего на текущем ходу (синк по событию
  // *:word-guessed: и для manual-confirm от рисующего, и для чат-угадывания).
  // Так кнопки рисующего дизейблятся для уже-угадавших, чтобы он не дублировал.
  const [crocGuessedIds, setCrocGuessedIds] = useState(() => new Set());
  // Клики, по которым ещё не пришёл callback от сервера — локальный disabled,
  // чтобы дабл-тап по одной кнопке не слал два emit'а.
  const [crocConfirmingIds, setCrocConfirmingIds] = useState(() => new Set());
  const [crocTransition, setCrocTransition] = useState(null);
  const [crocSelectionDeadline, setCrocSelectionDeadline] = useState(0);

  const [spyRole, setSpyRole] = useState(null);
  const [spyGuessOptions, setSpyGuessOptions] = useState(null);
  const [spyResult, setSpyResult] = useState(null);
  const [spyTimer, setSpyTimer] = useState(0);
  // Острослов (Quiplash)
  const [quiplashPhase, setQuiplashPhase] = useState(null); // 'answering' | 'voting' | 'reveal'
  const [quiplashPrompts, setQuiplashPrompts] = useState([]);
  const [quiplashMyPromptIds, setQuiplashMyPromptIds] = useState(() => new Set());
  const [quiplashAnswers, setQuiplashAnswers] = useState({});
  const [quiplashSubmitted, setQuiplashSubmitted] = useState(() => new Set());
  const [quiplashMatchup, setQuiplashMatchup] = useState(null);
  const [quiplashVoted, setQuiplashVoted] = useState(false);
  const [quiplashVoteCount, setQuiplashVoteCount] = useState({ voted: 0, total: 0 });
  const [quiplashResult, setQuiplashResult] = useState(null);
  const [quiplashScore, setQuiplashScore] = useState([]);
  const [quiplashTimer, setQuiplashTimer] = useState(0);
  const [quiplashTotal, setQuiplashTotal] = useState(0);
  // Узнай друга
  const [knowfriendRound, setKnowfriendRound] = useState(null);
  const [knowfriendAnswered, setKnowfriendAnswered] = useState(false);
  const [knowfriendResult, setKnowfriendResult] = useState(null);
  const [knowfriendScore, setKnowfriendScore] = useState([]);
  const [knowfriendTimer, setKnowfriendTimer] = useState(0);
  const [knowfriendProgress, setKnowfriendProgress] = useState({ answered: 0, total: 0 });
  // Предательский квиз (Fibbage)
  const [fibbagePhase, setFibbagePhase] = useState(null);
  const [fibbageRound, setFibbageRound] = useState(null);
  const [fibbageLie, setFibbageLie] = useState('');
  const [fibbageLieSubmitted, setFibbageLieSubmitted] = useState(false);
  const [fibbageOptions, setFibbageOptions] = useState([]);
  const [fibbageChosen, setFibbageChosen] = useState(null);
  const [fibbageResult, setFibbageResult] = useState(null);
  const [fibbageScore, setFibbageScore] = useState([]);
  const [fibbageTimer, setFibbageTimer] = useState(0);
  const [fibbageProgress, setFibbageProgress] = useState({ n: 0, total: 0 });
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [quizSelectedAnswer, setQuizSelectedAnswer] = useState(null);
  const [quizCorrectAnswer, setQuizCorrectAnswer] = useState(null);
  const [quizScores, setQuizScores] = useState([]);
  const [quizOptionsLocked, setQuizOptionsLocked] = useState(false);
  const [categoriesRound, setCategoriesRound] = useState(null);
  const [categoriesScores, setCategoriesScores] = useState([]);
  const [categoriesMyProgress, setCategoriesMyProgress] = useState(null);
  const categoriesRoundRef = useRef(null);
  categoriesRoundRef.current = categoriesRound;
  const [wyrRound, setWyrRound] = useState(null);
  const [wyrScores, setWyrScores] = useState([]);
  const [wyrMyPick, setWyrMyPick] = useState(null);
  const [wyrBreakSummary, setWyrBreakSummary] = useState('');
  const [trustRound, setTrustRound] = useState(null);
  const [trustScores, setTrustScores] = useState([]);
  const [trustMyChoice, setTrustMyChoice] = useState(null);
  const [trustBreakSummary, setTrustBreakSummary] = useState('');
  const [collageRoundMeta, setCollageRoundMeta] = useState(null);
  const [collageDisplay, setCollageDisplay] = useState('');
  const [collageTurn, setCollageTurn] = useState(null);
  const [collageVoting, setCollageVoting] = useState(null);
  const [collagePieceInput, setCollagePieceInput] = useState('');
  const [collageScores, setCollageScores] = useState([]);
  const [collageMyVote, setCollageMyVote] = useState(null);
  const [collageBreakSummary, setCollageBreakSummary] = useState('');
  const [emojiartScores, setEmojiartScores] = useState([]);
  const [emojiartRound, setEmojiartRound] = useState(null);
  const [emojiartSecretWord, setEmojiartSecretWord] = useState('');
  const [emojiartBreakSummary, setEmojiartBreakSummary] = useState('');
  const [memePrompt, setMemePrompt] = useState(null);
  const [memeAnswerInput, setMemeAnswerInput] = useState('');
  const [memeVotingData, setMemeVotingData] = useState(null);
  const [memeWinner, setMemeWinner] = useState(null);
  const [memeRoflTooltip, setMemeRoflTooltip] = useState(null);
  const [debateRound, setDebateRound] = useState(null);
  const [debateVotingOpen, setDebateVotingOpen] = useState(false);
  const [truthsPhase, setTruthsPhase] = useState('waiting');
  const [truthsFacts, setTruthsFacts] = useState(['', '', '']);
  const [truthsLieIndex, setTruthsLieIndex] = useState(2);
  const [truthsGuessing, setTruthsGuessing] = useState(null);
  const [storyTurn, setStoryTurn] = useState(null);
  const [storySentenceInput, setStorySentenceInput] = useState('');
  const [storyFullText, setStoryFullText] = useState('');
  const [storyRound, setStoryRound] = useState({ round: 1, max: 3 });
  const [storyNoTimeLimit, setStoryNoTimeLimit] = useState(false);
  const [emojiRound, setEmojiRound] = useState(null);
  const [whoamiAssignment, setWhoamiAssignment] = useState(null);
  const [whoamiQuestionInput, setWhoamiQuestionInput] = useState('');
  const [whoamiGuessInput, setWhoamiGuessInput] = useState('');
  const [genericTimer, setGenericTimer] = useState(0);
  const [genericScore, setGenericScore] = useState([]);
  const [fakeartistRole, setFakeartistRole] = useState(null);
  const [fakeartistHintPrompt, setFakeartistHintPrompt] = useState(null);
  const [fakeartistVoting, setFakeartistVoting] = useState(null);
  const [fakeartistGuessPhase, setFakeartistGuessPhase] = useState(false);
  const [fakeartistHintInput, setFakeartistHintInput] = useState('');
  const [fakeartistGuessInput, setFakeartistGuessInput] = useState('');
  const [chameleonRole, setChameleonRole] = useState(null);
  const [chameleonCluePrompt, setChameleonCluePrompt] = useState(null);
  const [chameleonVoting, setChameleonVoting] = useState(null);
  const [chameleonGuessPhase, setChameleonGuessPhase] = useState(null);
  const [chameleonClueInput, setChameleonClueInput] = useState('');
  const [chameleonGuessInput, setChameleonGuessInput] = useState('');
  const [chameleonReveal, setChameleonReveal] = useState(null); // { guess, correct, actualWord }
  const [genericRound, setGenericRound] = useState(null);
  const [numericRoundReveal, setNumericRoundReveal] = useState(null);
  const [timelineRoundResult, setTimelineRoundResult] = useState(null);
  const [newGameInput, setNewGameInput] = useState('');
  const [newGameSelected, setNewGameSelected] = useState('');
  const [crosswordWordsInput, setCrosswordWordsInput] = useState('');
  const [crosswordHostMode, setCrosswordHostMode] = useState('coop');
  const [crosswordRoundMin, setCrosswordRoundMin] = useState(5);
  const [crosswordWrongSignal, setCrosswordWrongSignal] = useState(0);
  const [crosswordAutoWordCount, setCrosswordAutoWordCount] = useState(18);
  const [fibbingIsTruthTeller, setFibbingIsTruthTeller] = useState(false);
  const [wavelengthTarget, setWavelengthTarget] = useState(null);
  const [wavelengthRoundResult, setWavelengthRoundResult] = useState(null);
  const [rankingDraft, setRankingDraft] = useState([]);
  const [rankingRoundResult, setRankingRoundResult] = useState(null);
  const [rhymeRoundResult, setRhymeRoundResult] = useState(null);
  const [bluffRoundResult, setBluffRoundResult] = useState(null);
  const [bluffDefCount, setBluffDefCount] = useState(0);
  const [escalationCurrentPlayerId, setEscalationCurrentPlayerId] = useState(null);
  const [memoryRoundResult, setMemoryRoundResult] = useState(null);
  const [memorySelected, setMemorySelected] = useState([]);
  const [anagramsRoundResult, setAnagramsRoundResult] = useState(null);
  const [wordchainChain, setWordchainChain] = useState([]);
  const [wordchainNextLetter, setWordchainNextLetter] = useState(null);
  const [wordchainRoundResult, setWordchainRoundResult] = useState(null);
  const [factsRoundResult, setFactsRoundResult] = useState(null);
  const [factsAnswerCount, setFactsAnswerCount] = useState(0);
  const [factsMyChoice, setFactsMyChoice] = useState(null); // 'yes' | 'no' | null
  const [sequenceRoundResult, setSequenceRoundResult] = useState(null);
  const [bombpartyExploded, setBombpartyExploded] = useState(false);
  const [bombpartyUsedWords, setBombpartyUsedWords] = useState([]);
  const [psychRoundResult, setPsychRoundResult] = useState(null);
  const [judgeRoundResult, setJudgeRoundResult] = useState(null);
  const [captionAnswerCount, setCaptionAnswerCount] = useState(0);
  const [captionRoundResult, setCaptionRoundResult] = useState(null);
  const [impostorRoundResult, setImpostorRoundResult] = useState(null);
  const [flagsRoundResult, setFlagsRoundResult] = useState(null);
  const [logosRoundResult, setLogosRoundResult] = useState(null);
  const [mapsRoundResult, setMapsRoundResult] = useState(null);
  const [quotesRoundResult, setQuotesRoundResult] = useState(null);
  const [fibbingRoundResult, setFibbingRoundResult] = useState(null);
  const [predictionRoundResult, setPredictionRoundResult] = useState(null);
  const [connectRoundResult, setConnectRoundResult] = useState(null);

  // ===== reaction / colors / teamwords =====
  const [reactionPhase, setReactionPhase] = useState('waiting'); // waiting | countdown | signal | finished
  const [reactionCountdown, setReactionCountdown] = useState(null);
  const [reactionReadyIds, setReactionReadyIds] = useState(new Set());
  const [reactionPlayers, setReactionPlayers] = useState([]);
  const [reactionResult, setReactionResult] = useState(null);
  const [reactionMyReacted, setReactionMyReacted] = useState(false);

  const [colorsPhase, setColorsPhase] = useState('waiting'); // waiting | showing | guessing
  const [colorsRound, setColorsRound] = useState(null);
  const [colorsReadyIds, setColorsReadyIds] = useState(new Set());
  const [colorsTimer, setColorsTimer] = useState(0);
  const [colorsAnswered, setColorsAnswered] = useState(false);

  const [teamwordsTeams, setTeamwordsTeams] = useState(null);
  const [teamwordsMyWord, setTeamwordsMyWord] = useState(null);
  const [teamwordsReadyIds, setTeamwordsReadyIds] = useState(new Set());
  const [teamwordsPhase, setTeamwordsPhase] = useState('waiting'); // waiting | explaining | guessing | roundEnd
  const [teamwordsGuessInput, setTeamwordsGuessInput] = useState('');

  const [roleCardDismissed, setRoleCardDismissed] = useState(false);
  const [lastDeathReveal, setLastDeathReveal] = useState(null);

  const hatMyTeamId = useMemo(() => {
    const teams = hatScoreboard?.teams;
    if (!Array.isArray(teams)) return null;
    for (const t of teams) {
      if (t?.players?.some((p) => p.id === socket.id)) return t.teamId;
    }
    return null;
  }, [hatScoreboard]);

  const hatBestTeamTotal = useMemo(() => {
    const teams = hatScoreboard?.teams;
    if (!Array.isArray(teams) || teams.length === 0) return 0;
    return Math.max(...teams.map((x) => x.teamTotal ?? 0));
  }, [hatScoreboard]);

  const mafiaStateSync = useMafiaGameState({
    roomId,
    setGameState,
    setPhase,
    setPhaseTimer,
    setPhaseTimerMax,
    setActionPrompt,
    setActionStatus,
    setGameHistory,
    setMafiaInvestigationLog,
    setRoleCardDismissed,
    toast,
  });

  useEffect(() => {
    if (room?.status === 'waiting' && room?.gameType === 'crossword') {
      const o = room.settings?.crosswordOptions;
      if (o && typeof o === 'object') {
        if (['coop', 'corporate', 'duel', 'solo_race', 'solo_casual'].includes(o.mode)) setCrosswordHostMode(o.mode);
        if (typeof o.roundTimeSec === 'number' && o.roundTimeSec >= 60) {
          setCrosswordRoundMin(Math.max(1, Math.round(o.roundTimeSec / 60)));
        }
        if (typeof o.autoWordCount === 'number' && o.autoWordCount >= 6 && o.autoWordCount <= 60) {
          setCrosswordAutoWordCount(o.autoWordCount);
        }
      }
    }
  }, [room?.status, room?.gameType, room?.settings?.crosswordOptions]);

  useEffect(() => {
    connectSocket();
    const playerName = getSessionName() || localStorage.getItem('playerName');
    
    if (!playerName) {
      navigateRef.current('/');
      return;
    }
    setSessionRoom(roomId);
    setSessionName(playerName);

    // Restore Mafia role from localStorage if available
    const savedMafiaRole = localStorage.getItem('mafia-current-role');
    if (savedMafiaRole) {
      try {
        const { role, roomId: savedRoomId, timestamp } = JSON.parse(savedMafiaRole);
        // Only restore if it's for the current room and less than 24 hours old
        if (savedRoomId === roomId && Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          setGameState(prev => ({ ...prev, myRole: role }));
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Handle beforeunload to prevent accidental page close during game
    const handleBeforeUnload = (e) => {
      if (roomStatusRef.current?.status === 'playing') {
        e.preventDefault();
        e.returnValue = 'Игра активна. Вы уверены, что хотите покинуть комнату?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const onConnect = () => {
      setIsConnected(true);
      const code = (roomId || '').toUpperCase();
      const roomPassword = sessionStorage.getItem(`room_password_${code}`) || '';
      const attemptJoin = (asSpectator = false) => {
        socket.emit('room:join', { code, playerName, password: roomPassword, asSpectator }, (response) => {
          if (response?.success) {
          setRoom(response.room);
          const lastRooms = JSON.parse(localStorage.getItem('lastRooms') || '[]');
            const newLast = [
              { code: response.room?.code, type: response.room?.gameType, date: new Date().toISOString() },
              ...lastRooms.filter((r) => r.code !== response.room?.code),
            ].slice(0, 5);
          localStorage.setItem('lastRooms', JSON.stringify(newLast));
          } else if (!asSpectator && response?.error === 'Игра уже началась') {
            attemptJoin(true);
        } else {
            setError(response?.error || 'Не удалось войти в комнату');
        }
      });
      };
      attemptJoin(false);
    };

    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:updated', (updatedRoom) => {
      setRoom(updatedRoom);
      // После естественного конца партии сервер шлёт status: waiting — убираем «залипание» на phase: gameOver
      if (updatedRoom?.status === 'waiting') {
        setPhase('waiting');
      }
    });
    socket.on('room:chat-message', (msg) => {
      if (msg?.system && msg?.message) toast.info(msg.message, { duration: 4000 });
    });
    socket.on('room:error', (err) => {
      const r = roomStatusRef.current;
      const kick = err === 'Вас исключили из комнаты';
      const softMafia = r?.gameType === 'mafia' && r?.status === 'playing' && !kick;
      /** Движки мини-игр шлют room:error на служебные сбои — не затираем экран комнаты (кажется «выкинуло»). */
      const softMiniGame =
        !kick &&
        r?.gameType === 'crossword' &&
        (r?.status === 'playing' || r?.status === 'waiting');
      if (softMafia || softMiniGame) {
        toast.error(String(err || 'Ошибка'));
        triggerShake();
        return;
      }
      setError(err);
      if (err) triggerShake();
    });
    socket.on('game:action-rejected', (payload) => {
      const msg = typeof payload === 'string' ? payload : payload?.message || 'Действие сейчас недоступно';
      toast.warning(msg);
      triggerShake();
    });
    socket.on('wavelength:target', (d) => setWavelengthTarget(typeof d?.target === 'number' ? d.target : null));
    socket.on('wavelength:round-ended', (d) => {
      setWavelengthRoundResult(d ?? null);
      setTimeout(() => setWavelengthRoundResult(null), 4000);
    });
    socket.on('fibbing:truth-teller', (d) => setFibbingIsTruthTeller(!!d?.isTruthTeller));
    socket.on('game:started', mafiaStateSync.onGameStarted);
    socket.on('game:snapshot', mafiaStateSync.onGameSnapshot);
    socket.on('game:state-update', mafiaStateSync.onGameStateUpdate);
    socket.on('game:phase-changed', mafiaStateSync.onPhaseChanged);
    socket.on('game:phase-changed', (nextPhase) => {
      if (
        nextPhase !== 'discussion' &&
        nextPhase !== 'intro' &&
        nextPhase !== 'voting' &&
        nextPhase !== 'votingRevote'
      ) {
        setSpeakingTurn(null);
      }
      const PHASE_CINEMATIC = {
        'night-start': { icon: '🌙', label: 'НОЧЬ', type: 'night' },
        'morning':     { icon: '☀️', label: 'УТРО', type: 'morning' },
        'voting':      { icon: '⚖️', label: 'ГОЛОСОВАНИЕ', type: 'vote' },
        'discussion':  { icon: '💬', label: 'ОБСУЖДЕНИЕ', type: 'day' },
        'gameOver':    { icon: '🏁', label: 'КОНЕЦ ИГРЫ', type: 'end' },
      };
      const cinematic = PHASE_CINEMATIC[nextPhase];
      if (cinematic) {
        setMafiaPhaseOverlay(cinematic);
        if (mafiaPhaseOverlayTimerRef.current) clearTimeout(mafiaPhaseOverlayTimerRef.current);
        mafiaPhaseOverlayTimerRef.current = setTimeout(() => setMafiaPhaseOverlay(null), 2500);
      }
    });
    socket.on('game:action-required', (payload) => mafiaStateSync.onActionRequired(payload, setSelectedTarget));
    socket.on('game:action-result', mafiaStateSync.onActionResult);
    socket.on('game:speaking-turn', (payload) => {
      if (!payload?.playerName) return;
      setSpeakingTurn(payload);
      const phaseLabel = payload?.phase === 'intro'
        ? 'Представление'
        : (payload?.phase === 'voting' || payload?.phase === 'votingRevote' ? 'Голосование' : 'Обсуждение');
      const msg = `${phaseLabel}: слово у ${payload.playerName}${payload?.durationSec ? ` (${payload.durationSec}с)` : ''}`;
      setActionStatus(msg);
      setGameHistory((prev) => [...prev.slice(-39), { t: Date.now(), text: msg }]);
    });
    socket.on('game:night-resolved', (payload) => {
      setActionStatus(
        `Ночь: убиты ${payload?.killed?.join(', ') || 'никто'}; отравлены ${payload?.poisoned?.join(', ') || 'никто'}`
      );
      setGameHistory((prev) => [
        ...prev.slice(-39),
        { t: Date.now(), text: `Ночь: убиты ${payload?.killed?.join(', ') || 'никто'}, отравлены ${payload?.poisoned?.join(', ') || 'никто'}` },
      ]);
    });
    socket.on('game:player-killed', (playerId, cause, payload) => {
      const killedInfo = payload?.player || {};
      const killedPlayer = { id: playerId, name: killedInfo.name || 'Игрок', role: killedInfo.role };
      setLastDeathReveal({
        player: killedPlayer,
        role: killedInfo.role,
        cause:
          cause === 'lynched'
            ? 'Линч'
            : cause === 'mafia'
              ? 'Мафия'
              : cause === 'poison'
                ? 'Отравление'
                : cause === 'maniac'
                  ? 'Маньяк'
                  : cause === 'bodyguard'
                    ? 'Телохранитель'
                    : cause,
      });
      setActionStatus(`Игрок выбыл (${cause}): ${killedPlayer.name}`);
      setGameHistory((prev) => [
        ...prev.slice(-39),
        { t: Date.now(), text: `${killedPlayer.name} выбыл (${cause || 'неизвестно'})` },
      ]);
      setGameState((prev) => {
        if (!prev?.players) return prev;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === playerId ? { ...p, status: 'dead', deathCause: cause || p.deathCause, role: killedInfo.role ?? p.role } : p
          ),
        };
      });
    });
    socket.on('game:player-revived', (playerId) => {
      setActionStatus(`Игрок воскрешен: ${playerId}`);
      setGameState((prev) => {
        if (!prev?.players) return prev;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === playerId ? { ...p, status: 'alive', deathCause: undefined } : p
          ),
        };
      });
    });
    socket.on('game:vote-tie', (candidates) => {
      const names = (candidates || []).join(', ');
      setActionStatus(names ? `Ничья между: ${names}` : 'Ничья на голосовании');
    });
    socket.on('game:city-sleeps-no-execution', () => {
      setActionStatus('Повторная ничья: город засыпает без казни');
      setGameHistory((prev) => [
        ...prev.slice(-39),
        { t: Date.now(), text: 'Повторная ничья: город засыпает без казни' },
      ]);
    });
    socket.on('game:multiple-lynched', (ids) => setActionStatus(`Множественный линч: ${ids?.join(', ') || '-'}`));
    socket.on('game:ended', (d) => {
      const data = typeof d === 'object' ? d : { winner: d };
      if (data?.mafiaPartyReset) {
        setGameState(null);
        setPhase('waiting');
        setActionPrompt(null);
        setSelectedRoleMap({});
        setMafiaInvestigationLog([]);
        setMafiaGameStats(null);
        setLastDeathReveal(null);
        setSpeakingTurn(null);
        setRoleCardDismissed(false);
        try {
          localStorage.removeItem('mafia-current-role');
        } catch {
          /* ignore */
        }
        setActionStatus('Партия сброшена. Можно начать заново.');
        toast.info('Ведущий сбросил партию. Нажмите «Начать игру».');
        return;
      }
      if (data?.abortedByHost) {
        resetGameUiAfterHostAbortRef.current();
        setPhase('waiting');
        setGameState(null);
        setActionPrompt(null);
        setSelectedRoleMap({});
        setMafiaInvestigationLog([]);
        setMafiaGameStats(null);
        setLastDeathReveal(null);
        setRoleCardDismissed(false);
        try {
          localStorage.removeItem('mafia-current-role');
        } catch {
          /* ignore */
        }
        setActionStatus('Игра остановлена ведущим');
        toast.info('Ведущий завершил игру. Можно начать снова.');
        return;
      }
      if (
        data?.winner &&
        typeof data.winner === 'object' &&
        typeof data.winner.teamId === 'number' &&
        Array.isArray(data?.results) &&
        data.results.length > 0 &&
        typeof data.results[0]?.teamId === 'number'
      ) {
        setHatScoreboard({
          teams: data.results.map((r) => ({
            teamId: r.teamId,
            players: (r.players || []).map((p) => ({
              id: p.id,
              name: p.name,
              score: typeof p.score === 'number' ? p.score : 0,
            })),
            teamTotal:
              typeof r.score === 'number'
                ? r.score
                : (r.players || []).reduce((s, p) => s + (p.score || 0), 0),
          })),
          gameOver: true,
        });
      }
      if (data?.gameType === 'quiz' && Array.isArray(data?.players)) {
        setQuizScores(
          data.players.map((p) => ({
            id: p.id,
            name: p.name,
            score: typeof p.score === 'number' ? p.score : 0,
          }))
        );
        setQuizQuestion(null);
        setQuizSelectedAnswer(null);
      }
      if (data?.gameType === 'categories' && Array.isArray(data?.players)) {
        setCategoriesScores(
          data.players.map((p) => ({
            id: p.id,
            name: p.name,
            score: typeof p.score === 'number' ? p.score : 0,
          }))
        );
        setCategoriesRound(null);
        setCategoriesMyProgress(null);
      }
      if (data?.gameType === 'wouldyourather' && Array.isArray(data?.players)) {
        setWyrScores(
          data.players.map((p) => ({
            id: p.id,
            name: p.name,
            score: typeof p.score === 'number' ? p.score : 0,
          }))
        );
        setWyrRound(null);
        setWyrMyPick(null);
        setWyrBreakSummary('');
      }
      if (data?.gameType === 'trust' && Array.isArray(data?.players)) {
        setTrustScores(
          data.players.map((p) => ({
            id: p.id,
            name: p.name,
            score: typeof p.score === 'number' ? p.score : 0,
          }))
        );
        setTrustRound(null);
        setTrustMyChoice(null);
        setTrustBreakSummary('');
      }
      if (data?.gameType === 'collage' && Array.isArray(data?.players)) {
        setCollageScores(
          data.players.map((p) => ({
            id: p.id,
            name: p.name,
            score: typeof p.score === 'number' ? p.score : 0,
          }))
        );
        setCollageRoundMeta(null);
        setCollageTurn(null);
        setCollageVoting(null);
        setCollageMyVote(null);
        setCollageBreakSummary('');
      }
      if (data?.gameType === 'emojiart' && Array.isArray(data?.players)) {
        setEmojiartScores(
          data.players.map((p) => ({
            id: p.id,
            name: p.name,
            score: typeof p.score === 'number' ? p.score : 0,
          }))
        );
        setEmojiartRound(null);
        setEmojiartSecretWord('');
        setEmojiartBreakSummary('');
      }
      if (data?.gameType === 'associations' && Array.isArray(data?.players)) {
        setAssocScores(
          data.players.map((p) => ({
            id: p.id,
            name: p.name,
            score: typeof p.score === 'number' ? p.score : 0,
          }))
        );
      }
      setPhase('gameOver');
      setActionPrompt(null);
      if (roomStatusRef.current?.gameType === 'mafia') {
        setMafiaInvestigationLog([]);
        if (Array.isArray(data?.players)) setMafiaGameStats(data.players);
      }
      if (data?.fullStory != null && data.fullStory !== '') {
        setStoryFullText(data.fullStory);
        setActionStatus('Игра завершена. Ваша история:');
      } else {
        const w = data?.winner;
        const winnerLabel =
          w == null
            ? 'не определен'
            : typeof w === 'string'
              ? w
              : typeof w?.name === 'string'
                ? w.name
                : Array.isArray(w?.players)
                  ? w.players.map((p) => p?.name).filter(Boolean).join(', ') || `Команда ${w.teamId ?? ''}`
                  : 'не определен';
        setActionStatus(`Игра завершена. Победитель: ${winnerLabel}`);
      }
    });

    socket.on('ai:speak', (text) => {
      setAiMessages((prev) => [...prev.slice(-30), { text, time: Date.now() }]);
    });

    socket.on('hat:phaseChanged', (data) => {
      setActionStatus(data?.phase === 'collecting-words' ? 'Шляпа: добавьте слова' : '');
      if (data?.phase === 'collecting-words') setHatScoreboard(null);
    });
    socket.on('hat:wordsAdded', (data) => {
      if (data?.playerId === socket.id) setHatSubmitted(true);
    });
    socket.on('hat:wordsComplete', () => {
      setActionStatus('Слова собраны, раунд начинается');
    });
    socket.on('hat:roundStarted', (data) => {
      const safe =
        data &&
        ({
          explainer: data.explainer,
          explainerName: data.explainerName,
          team: data.team,
          timeLeft: data.timeLeft,
          roundTime: data.roundTime,
          guessCandidates: data.guessCandidates,
        });
      setHatRoundInfo(safe || null);
      setHatIsExplainer(data?.explainer === socket.id);
      setHatRoundTime(Number(data?.timeLeft ?? data?.roundTime) || 60);
      setHatTimer(Number(data?.timeLeft ?? data?.roundTime) || 60);
      setHatConfirmInFlight(false);
      if (data?.explainer !== socket.id) setHatWord('');
      setHatRoundSummary(null);
    });
    socket.on('hat:newWord', (data) => {
      setHatConfirmInFlight(false);
      setHatIsExplainer(!!data?.isExplainer);
      if (data?.isExplainer) setHatWord(data?.word || '');
      else setHatWord('');
      setHatRoundInfo((prev) => {
        const base = prev || {};
        const next = { ...base };
        if (data?.explainer != null) next.explainer = data.explainer;
        if (data?.explainerName != null) next.explainerName = data.explainerName;
        if (Array.isArray(data?.guessCandidates)) next.guessCandidates = data.guessCandidates;
        return Object.keys(next).length ? next : prev;
      });
    });
    socket.on('hat:timerUpdate', (t) => setHatTimer(Number(t) || 0));
    socket.on('hat:wordGuessed', (data) => {
      setActionStatus(`Шляпа: ${data?.guesserName || 'Игрок'} угадал слово ${data?.word || ''}`);
      confetti({ origin: { x: 0.5, y: 0.5 }, spread: 100, startVelocity: 30, particleCount: 80 });
    });
    socket.on('hat:wordSkipped', () => {
      setActionStatus('Шляпа: слово пропущено');
    });
    socket.on('hat:roundEnded', (data) => {
      setHatRoundSummary({ team: data?.team, score: data?.score ?? 0 });
    });
    socket.on('hat:scoreboard', (data) => {
      if (data && Array.isArray(data.teams)) setHatScoreboard(data);
    });

    socket.on('associations:chain-started', (data) => {
      setAssocTurn((prev) => ({ ...prev, previousWord: data?.firstWord, endWord: data?.endWord ?? null }));
      setAssocVoting(null);
    });
    socket.on('associations:turn-started', (data) => {
      setAssocTurn((prev) => ({ ...(data || {}), endWord: prev?.endWord ?? null }));
      setAssocVoting(null);
      if (Array.isArray(data?.scoreboard)) setAssocScores(data.scoreboard);
    });
    socket.on('associations:voting-started', (data) => {
      setAssocVoting(data || null);
    });
    socket.on('associations:voting-ended', (data) => {
      if (Array.isArray(data?.scoreboard)) setAssocScores(data.scoreboard);
      setAssocVoting((prev) => {
        const result = data ? { ...data, link: prev?.link } : null;
        setAssocLastResult(result);
        return prev;
      });
      setAssocVoteChoice(null);
      setActionStatus(`Ассоциации: голосование завершено (${data?.valid ? 'принято' : 'отклонено'})`);
      setTimeout(() => {
        setAssocLastResult(null);
        setAssocVoting(null);
      }, 1200);
    });
    socket.on('associations:chain-broken', (data) => {
      setActionStatus(`Цепочка разорвана — слово «${data?.word || '?'}» отклонено`);
    });
    socket.on('associations:words-collected', () => {
      setAssocSubmitted(true);
    });

    socket.on('crocodile:word-choices', (data) => {
      setCrocWordChoices({ choices: data?.choices || [], timeLeft: data?.timeLeft ?? 0 });
      const sec = Number(data?.selectionTimeoutSec);
      setCrocSelectionDeadline(sec > 0 ? Date.now() + sec * 1000 : 0);
    });
    socket.on('sketch:word-choices', (data) => {
      setCrocWordChoices({ choices: data?.choices || [], timeLeft: data?.timeLeft ?? 0 });
      const sec = Number(data?.selectionTimeoutSec);
      setCrocSelectionDeadline(sec > 0 ? Date.now() + sec * 1000 : 0);
    });
    socket.on('crocodile:turn-started', (data) => {
      setCrocWordChoices(null);
      setCrocSelectionDeadline(0);
      setCrocTurn(data || null);
      if (data?.explainerId !== socket.id) setCrocMyWord('');
      setCrocStrokes([]);
      setCrocTimer(Number(data?.timeLeft) || 0);
      setCrocTimeoutWord(null);
      setCrocGuessedIds(new Set());
      setCrocConfirmingIds(new Set());
      setCrocTransition(null);
    });
    socket.on('crocodile:turn-transition', (data) => {
      setCrocTransition({ name: data?.nextPlayerName || '—' });
      setCrocMyWord('');
      window.setTimeout(() => setCrocTransition(null), Number(data?.delay) || 2000);
    });
    socket.on('crocodile:penalty', (data) => {
      if (data?.playerId === socket.id) toast.error(`Штраф −${data?.penalty ?? 1}: пустой холст`);
    });
    socket.on('sketch:turn-transition', (data) => {
      setCrocTransition({ name: data?.nextPlayerName || '—' });
      setCrocMyWord('');
      window.setTimeout(() => setCrocTransition(null), Number(data?.delay) || 2000);
    });
    socket.on('sketch:penalty', (data) => {
      if (data?.playerId === socket.id) toast.error(`Штраф −${data?.penalty ?? 1}: пустой холст`);
    });
    socket.on('crocodile:turn-timeout', (data) => {
      setCrocTimeoutWord(data?.word || null);
    });
    socket.on('crocodile:your-word', (data) => {
      setCrocMyWord(data?.word || '');
    });
    socket.on('crocodile:timer', (t) => setCrocTimer(Number(t) || 0));
    socket.on('crocodile:word-guessed', (data) => {
      setActionStatus(`Крокодил: ${data?.guesserName || 'Игрок'} угадал слово ${data?.word || ''}`);
      if (data?.guesserId) {
        setCrocGuessedIds((prev) => {
          const next = new Set(prev);
          next.add(data.guesserId);
          return next;
        });
      }
    });
    socket.on('crocodile:score', (payload) => {
      setCrocScore(payload?.players || []);
    });
    socket.on('sketch:turn-started', (data) => {
      setCrocWordChoices(null);
      setCrocSelectionDeadline(0);
      setCrocTurn(data || null);
      setCrocMyWord('');
      setCrocStrokes([]);
      setCrocTimer(Number(data?.timeLeft) || 0);
      setCrocGuessedIds(new Set());
      setCrocConfirmingIds(new Set());
      setCrocTransition(null);
    });
    socket.on('sketch:your-word', (data) => setCrocMyWord(data?.word || ''));
    socket.on('sketch:timer', (t) => setCrocTimer(Number(t) || 0));
    socket.on('sketch:word-guessed', (data) => {
      setActionStatus(`Скетч: ${data?.guesserName || 'Игрок'} угадал «${data?.word || ''}»`);
      if (data?.guesserId) {
        setCrocGuessedIds((prev) => {
          const next = new Set(prev);
          next.add(data.guesserId);
          return next;
        });
      }
    });
    socket.on('sketch:score', (payload) => setCrocScore(payload?.players || []));
    socket.on('sketch:draw', (data) => {
      if (data?.senderId === socket.id) return;
      setCrocStrokes((prev) => {
        if (data?.type === 'fill' && typeof data.x === 'number' && typeof data.y === 'number') {
          return [...prev, { type: 'fill', x: data.x, y: data.y, color: data.color || '#000000' }];
        }
        return [...prev, { points: data?.points || [], color: data?.color || '#000', width: data?.width || 3 }];
      });
    });
    socket.on('sketch:clear', () => setCrocStrokes([]));
    socket.on('sketch:undo', () => setCrocStrokes((prev) => prev.slice(0, -1)));
    socket.on('crocodile:draw', (data) => {
      if (data?.senderId === socket.id) return;
      setCrocStrokes((prev) => {
        if (data?.type === 'fill' && typeof data.x === 'number' && typeof data.y === 'number') {
          return [...prev, { type: 'fill', x: data.x, y: data.y, color: data.color || '#000000' }];
        }
        return [...prev, { points: data?.points || [], color: data?.color || '#000', width: data?.width || 3 }];
      });
    });
    socket.on('crocodile:clear', () => setCrocStrokes([]));
    socket.on('crocodile:undo', () => setCrocStrokes((prev) => prev.slice(0, -1)));

    // Alias
    socket.on('alias:turn-started', (d) => {
      setCrocTurn(d);
      setCrocMyWord('');
      setAliasGuessSending(false);
      setAliasTransition(null);
    });
    socket.on('alias:your-word', (d) => {
      setCrocMyWord(d?.word || '');
      setAliasGuessSending(false);
    });
    socket.on('alias:word-guessed', (d) => setActionStatus(`Элиас: ${d?.guesserName} угадал «${d?.word}»`));
    socket.on('alias:turn-timeout', () => setActionStatus('Элиас: время вышло'));
    socket.on('alias:turn-transition', (d) => {
      setAliasTransition({ name: d?.nextPlayer?.name || '—' });
      setCrocMyWord('');
      window.setTimeout(() => setAliasTransition(null), Number(d?.delay) || 2000);
    });
    socket.on('alias:timer', (t) => setCrocTimer(Number(t) || 0));
    socket.on('alias:score', (d) => setCrocScore(d?.players || []));

    // Spy
    socket.on('spy:role', (d) => { setSpyRole(d); setSpyResult(null); setSpyGuessOptions(null); });
    socket.on('spy:timer', (t) => setSpyTimer(typeof t === 'number' ? t : (t?.timeLeft ?? 0)));
    socket.on('spy:voting-started', () => { setDebateVotingOpen(true); setSpyGuessOptions(null); });
    socket.on('spy:voting-ended', (d) => {
      setDebateVotingOpen(false);
      setSpyResult({
        phase: 'voted',
        spyCaught: !!d?.spyCaught,
        spyName: d?.spyName || '—',
        accusedName: d?.accusedName || '—',
        location: d?.location || null,
      });
    });
    socket.on('spy:can-guess', (d) => {
      if (d?.spyId === socket.id) setSpyGuessOptions(Array.isArray(d?.locations) ? d.locations : []);
    });
    socket.on('spy:guess-result', (d) => {
      setSpyGuessOptions(null);
      setSpyResult((prev) => ({ ...(prev || {}), phase: 'guessed', guessCorrect: !!d?.correct, actualLocation: d?.actualLocation }));
      setActionStatus(`Шпион ${d?.correct ? 'угадал' : 'не угадал'} локацию`);
    });

    // Quiz
    socket.on('quiz:question', (d) => {
      setQuizOptionsLocked(false);
      setQuizQuestion(d);
      setQuizSelectedAnswer(null);
      setQuizCorrectAnswer(null);
      const r = roomStatusRef.current;
      if (r?.gameType === 'quiz' && Array.isArray(r.players)) {
        setQuizScores((prev) => {
          if (prev.length > 0) return prev;
          return r.players
            .filter((p) => !p.isSpectator)
            .map((p) => ({ id: p.id, name: p.name, score: 0 }));
        });
      }
    });
    socket.on('quiz:question-ended', (d) => {
      setQuizOptionsLocked(true);
      setQuizCorrectAnswer(d?.correctAnswer ?? null);
      setActionStatus(
        `Правильный ответ: ${typeof d?.correctText === 'string' ? d.correctText : d?.correctAnswer != null ? String(d.correctAnswer) : '—'}`
      );
    });
    socket.on('quiz:score', (d) => {
      const raw = Array.isArray(d?.players) ? d.players : Array.isArray(d) ? d : [];
      setQuizScores(
        raw.map((p) => ({
          id: p.id,
          name: p.name,
          score: typeof p.score === 'number' && !Number.isNaN(p.score) ? p.score : Number(p.score) || 0,
        }))
      );
    });
    socket.on('quiz:timer', (t) => setGenericTimer(Number(t) || 0));

    // Meme
    socket.on('meme:round-started', (d) => { setMemePrompt(d); setMemeAnswerInput(''); setMemeVotingData(null); setMemeWinner(null); });
    socket.on('meme:voting-started', (d) => setMemeVotingData(d));
    socket.on('meme:round-ended', (d) => {
      setMemeWinner(d?.winner || null);
      setActionStatus(`Мем раунд: победил ${d?.winner?.authorName || d?.winnerName || '—'}`);
      setTimeout(() => setMemeWinner(null), 4000);
    });
    socket.on('meme:score', (d) => setGenericScore(d?.players || []));
    socket.on('meme:timer', (t) => setGenericTimer(Number(t) || 0));

    // WordBomb
    socket.on('wordbomb:turn-started', (d) => {
      setCrocTurn(d);
      setCrocMyWord('');
      setCrocGuessedIds(new Set());
      setCrocConfirmingIds(new Set());
    });
    socket.on('wordbomb:your-word', (d) => setCrocMyWord(`${d?.word} | Мины: ${(d?.mineWords || []).join(', ')}`));
    socket.on('wordbomb:word-guessed', (d) => {
      setActionStatus(`Слова-мины: ${d?.guesserName || 'Игрок'} угадал «${d?.word || ''}»`);
      if (d?.guesserId) setCrocGuessedIds((prev) => new Set(prev).add(d.guesserId));
    });
    socket.on('wordbomb:mine-triggered', (d) => setActionStatus(`💥 Мина! ${d?.playerName || 'Кто-то'} сказал запретное слово «${d?.mineWord || ''}»`));
    socket.on('wordbomb:turn-timeout', () => setActionStatus('Время вышло'));
    socket.on('wordbomb:timer', (t) => setCrocTimer(Number(t) || 0));
    socket.on('wordbomb:score', (d) => setCrocScore(d?.players || []));

    // Debate
    socket.on('debate:round-started', (d) => { setDebateRound(d); setDebateVotingOpen(false); });
    socket.on('debate:voting-started', () => setDebateVotingOpen(true));
    socket.on('debate:round-ended', (d) => { setDebateVotingOpen(false); setActionStatus(`Дебаты: победил ${d?.winnerName || '—'}`); });
    socket.on('debate:timer', (t) => setGenericTimer(Number(t) || 0));
    socket.on('debate:score', (d) => setGenericScore(d?.players || []));

    // Truths
    socket.on('truths:collecting', () => setTruthsPhase('collecting'));
    socket.on('truths:guessing-started', (d) => { setTruthsPhase('guessing'); setTruthsGuessing(d); });
    socket.on('truths:guessing-ended', (d) => setActionStatus(`Ложь была: факт #${(d?.correctAnswer ?? 0) + 1}`));
    socket.on('truths:score', (d) => setGenericScore(d?.players || []));

    // Story
    socket.on('story:started', (d) => {
      setStoryFullText('');
      setStoryRound({ round: d?.storyRound ?? 1, max: d?.maxStories ?? 3 });
      setStoryNoTimeLimit(!!d?.noTimeLimit);
    });
    socket.on('story:turn-started', (d) => {
      setStoryTurn(d);
      setStorySentenceInput('');
      if (d?.noTimeLimit !== undefined) setStoryNoTimeLimit(!!d.noTimeLimit);
      if (d?.player?.id === socket.id && d?.previousText != null) setStoryFullText(d.previousText);
      else if (d?.player?.id !== socket.id) setStoryFullText('');
    });
    socket.on('story:sentence-submitted', (d) => { if (d?.playerId === socket.id) setStoryFullText(''); });
    socket.on('story:completed', () => { setStoryTurn(null); setStoryFullText(''); });
    socket.on('story:timer', (t) => setGenericTimer(Number(t) || 0));
    socket.on('story:score', (d) => setGenericScore(d?.players || []));

    // Emoji
    socket.on('emoji:round-started', (d) => setEmojiRound(d));
    socket.on('emoji:guessed', (d) => {
      const pts = d?.points ?? 0;
      if (d?.answer != null && d?.guesserId === socket.id) {
        setActionStatus(`Эмодзи: вы угадали первым — «${d.answer}» (+${pts} очк.)`);
      } else {
        setActionStatus(
          `Эмодзи: ${d?.guesserName || 'Игрок'} угадал(а) первым (+${pts} очк.). Ответ не показываем остальным — раунд закрыт.`,
        );
      }
    });
    socket.on('emoji:timeout', (d) => setActionStatus(`Время вышло. Ответ: ${d?.answer || '—'}`));
    socket.on('emoji:timer', (t) => setGenericTimer(Number(t) || 0));
    socket.on('emoji:score', (d) => setGenericScore(d?.players || []));

    // WhoAmI
    socket.on('whoami:assignment', (d) => setWhoamiAssignment(d));
    socket.on('whoami:question', (d) => setActionStatus(`Вопрос: ${d?.question}`));
    socket.on('whoami:answer', (d) => setActionStatus(`Ответ: ${d?.answer}`));
    socket.on('whoami:guess-result', (d) => setActionStatus(`${d?.playerName} ${d?.correct ? 'угадал' : 'не угадал'} — ${d?.character || ''}`));

    // FakeArtist
    socket.on('fakeartist:role', (d) => setFakeartistRole(d));
    socket.on('fakeartist:started', (d) => { setFakeartistVoting(null); setFakeartistGuessPhase(false); setGenericRound(d); });
    socket.on('fakeartist:hint-started', (d) => { setFakeartistHintPrompt(d); setFakeartistHintInput(''); });
    socket.on('fakeartist:hint-submitted', (d) => setActionStatus(`Подсказка: ${d?.playerName} — ${d?.hint || '—'}`));
    socket.on('fakeartist:voting-started', (d) => { setFakeartistVoting(d); setFakeartistHintPrompt(null); });
    socket.on('fakeartist:round-ended', (d) => setActionStatus(`Раунд: ${d?.caught ? 'Фейк пойман!' : 'Фейк ушёл!'} ${d?.accusedName || ''}`));
    socket.on('fakeartist:guess', (d) => { setFakeartistGuessPhase(true); setFakeartistVoting(null); if (d?.correct !== undefined) setActionStatus(d.correct ? `Угадал: ${d.actualWord}` : `Не угадал. Слово: ${d.actualWord}`); });

    // Chameleon
    socket.on('chameleon:role', (d) => setChameleonRole(d));
    socket.on('chameleon:started', (d) => { setChameleonVoting(null); setChameleonGuessPhase(null); setChameleonReveal(null); setGenericRound(d); });
    socket.on('chameleon:clue-prompt', (d) => { setChameleonCluePrompt(d); setChameleonClueInput(''); });
    socket.on('chameleon:clue-submitted', (d) => setActionStatus(`Подсказка: ${d?.playerName} — ${d?.clue || '—'}`));
    socket.on('chameleon:voting-started', (d) => { setChameleonVoting(d); setChameleonCluePrompt(null); });
    socket.on('chameleon:round-ended', (d) => setActionStatus(`Раунд: ${d?.caught ? 'Хамелеон пойман!' : 'Хамелеон ушёл!'}`));
    socket.on('chameleon:guess', (d) => { setChameleonVoting(null); if (d?.grid) setChameleonGuessPhase(d); else if (d?.correct !== undefined) { setChameleonReveal(d); setChameleonGuessPhase(null); setTimeout(() => setChameleonReveal(null), 5000); } });

    socket.on('categories:timer', (t) => setGenericTimer(Number(t) || 0));
    socket.on('categories:score', (d) => {
      const raw = Array.isArray(d?.players) ? d.players : Array.isArray(d) ? d : [];
      setCategoriesScores(
        raw.map((p) => ({
          id: p.id,
          name: p.name,
          score: typeof p.score === 'number' && !Number.isNaN(p.score) ? p.score : Number(p.score) || 0,
        }))
      );
    });
    socket.on('categories:round-started', (d) => {
      setCategoriesRound(d && typeof d === 'object' ? d : null);
      setCategoriesMyProgress(null);
      const r = roomStatusRef.current;
      if (r?.gameType === 'categories' && Array.isArray(r.players)) {
        setCategoriesScores((prev) => {
          if (prev.length > 0) return prev;
          return r.players
            .filter((p) => !p.isSpectator)
            .map((p) => ({ id: p.id, name: p.name, score: 0 }));
        });
      }
    });
    socket.on('categories:round-ended', (d) => {
      if (d?.letter != null && Array.isArray(d?.categories)) {
        setActionStatus(`Раунд ${d.round ?? ''}: буква «${d.letter}». Очки начислены — следующий раунд скоро.`);
      }
    });
    socket.on('categories:answer-accepted', (d) => {
      if (d?.playerId === socket.id) setCategoriesMyProgress((prev) => {
        const cats = prev?.cats ? { ...prev.cats } : {};
        if (d.category) cats[d.category] = d.answer ?? true;
        return { filled: d.filled ?? 0, total: d.total ?? 0, cats };
      });
    });
    socket.on('categories:answer-rejected', (d) => {
      if (d?.playerId !== socket.id) return;
      const msg =
        d.reason === 'wrong_letter'
          ? `Слово должно начинаться на букву «${categoriesRoundRef.current?.letter ?? '…'}» (ё = е).`
          : d.reason === 'invalid_category'
            ? 'Сначала укажите название категории из списка, как в примере.'
            : d.reason === 'already_answered'
              ? 'Вы уже ответили в этой категории в этом раунде.'
              : 'Ответ не принят.';
      setActionStatus(msg);
    });
    socket.on('categories:bonus-first', (d) => {
      setActionStatus(
        `⚡ ${d?.playerName || 'Игрок'} первым заполнил все категории — в конце раунда бонус за скорость (+${roomStatusRef.current?.settings?.speedBonus ?? 3}).`
      );
    });

    socket.on('wouldyourather:timer', (t) => setGenericTimer(Number(t) || 0));
    socket.on('wouldyourather:score', (d) => {
      const raw = Array.isArray(d?.players) ? d.players : Array.isArray(d) ? d : [];
      setWyrScores(
        raw.map((p) => ({
          id: p.id,
          name: p.name,
          score: typeof p.score === 'number' && !Number.isNaN(p.score) ? p.score : Number(p.score) || 0,
        }))
      );
    });
    socket.on('wouldyourather:round-started', (d) => {
      setWyrBreakSummary('');
      setWyrMyPick(null);
      setWyrRound(d && typeof d === 'object' ? d : null);
      const r = roomStatusRef.current;
      if (r?.gameType === 'wouldyourather' && Array.isArray(r.players)) {
        setWyrScores((prev) => {
          if (prev.length > 0) return prev;
          return r.players
            .filter((p) => !p.isSpectator)
            .map((p) => ({ id: p.id, name: p.name, score: 0 }));
        });
      }
    });
    socket.on('trust:timer', (t) => setGenericTimer(Number(t) || 0));
    socket.on('trust:score', (d) => {
      const raw = Array.isArray(d?.players) ? d.players : Array.isArray(d) ? d : [];
      setTrustScores(
        raw.map((p) => ({
          id: p.id,
          name: p.name,
          score: typeof p.score === 'number' && !Number.isNaN(p.score) ? p.score : Number(p.score) || 0,
        }))
      );
    });
    socket.on('trust:round-started', (d) => {
      setTrustBreakSummary('');
      setTrustMyChoice(null);
      setTrustRound(d && typeof d === 'object' ? d : null);
      const r = roomStatusRef.current;
      if (r?.gameType === 'trust' && Array.isArray(r.players)) {
        setTrustScores((prev) => {
          if (prev.length > 0) return prev;
          return r.players
            .filter((p) => !p.isSpectator)
            .map((p) => ({ id: p.id, name: p.name, score: 0 }));
        });
      }
    });
    socket.on('trust:round-ended', (d) => {
      const mine = d?.results?.find((x) => x.id === socket.id);
      const n = d?.totalPlayers ?? 0;
      const a = Array.isArray(d?.choices)
        ? d.choices.filter((c) => c?.choice != null).length
        : Number(d?.answeredCount) || 0;
      const t = Array.isArray(d?.choices)
        ? d.choices.filter((c) => c?.choice === 'trust').length
        : Number(d?.trustCount) || 0;
      const pt = d?.pointsTrust ?? 1;
      const pb = d?.pointsBetray ?? 3;
      const pbt = d?.pointsBothTrust ?? 2;
      const pbb = d?.pointsBothBetray ?? 0;
      let line = '';
      if (a === 0) {
        line = 'Никто не успел выбрать — в раунде очки не начислены.';
      } else if (a === n && t === n) {
        line = `Все выбрали доверие — каждый получает по +${pbt} очк.`;
      } else if (a === n && t === 0) {
        line = `Все выбрали предательство — каждый получает по +${pbb} очк.`;
      } else {
        line = `Смесь голосов (${t} доверие, ${a - t} предательство из ${a} ответивших): доверие +${pt}, предательство +${pb}.`;
      }
      if (mine != null) {
        if (mine.choice == null) line += ' Вы не голосовали — 0 за раунд.';
        else line += ` Вам +${mine.earned ?? 0}.`;
      }
      setTrustBreakSummary(line);
    });

    socket.on('collage:timer', (t) => setGenericTimer(Number(t) || 0));
    socket.on('collage:score', (d) => {
      const raw = Array.isArray(d?.players) ? d.players : Array.isArray(d) ? d : [];
      setCollageScores(
        raw.map((p) => ({
          id: p.id,
          name: p.name,
          score: typeof p.score === 'number' && !Number.isNaN(p.score) ? p.score : Number(p.score) || 0,
        }))
      );
    });
    socket.on('collage:round-started', (d) => {
      setCollageVoting(null);
      setCollageMyVote(null);
      setCollageBreakSummary('');
      setCollageTurn(null);
      setCollagePieceInput('');
      setCollageRoundMeta(d && typeof d === 'object' ? { round: d.round, maxRounds: d.maxRounds } : null);
      setCollageDisplay(typeof d?.seed === 'string' ? d.seed : '');
      const r = roomStatusRef.current;
      if (r?.gameType === 'collage' && Array.isArray(r.players)) {
        setCollageScores((prev) => {
          if (prev.length > 0) return prev;
          return r.players
            .filter((p) => !p.isSpectator)
            .map((p) => ({ id: p.id, name: p.name, score: 0 }));
        });
      }
    });
    socket.on('collage:turn-started', (d) => {
      setCollageTurn(d && typeof d === 'object' ? d : null);
      if (d?.collageSoFar != null) setCollageDisplay(String(d.collageSoFar));
    });
    socket.on('collage:piece-submitted', (d) => {
      if (d?.collageSoFar != null) setCollageDisplay(String(d.collageSoFar));
    });
    socket.on('collage:voting-started', (d) => {
      setCollageVoting(d && typeof d === 'object' ? d : null);
      setCollageMyVote(null);
      if (d?.collageFull != null) setCollageDisplay(String(d.collageFull));
    });
    socket.on('collage:voting-ended', (d) => {
      const tallies = Array.isArray(d?.tallies) ? d.tallies : [];
      const pv = d?.pointsPerVote ?? 2;
      const bonus = d?.bonusRoundWinner ?? 3;
      const parts = tallies.map((t) => {
        const b = t.bonus > 0 ? ` (+${bonus} за лучший вклад)` : '';
        return `${t.authorName}: ${t.votes} голос. → +${t.earned} очк.${b}`;
      });
      const mine = tallies.find((t) => t.authorId === socket.id);
      let line = `Раунд ${d?.round ?? '—'}: ${parts.join(' · ') || 'голосов не было'}.`;
      if (mine != null) line += ` Ваш фрагмент: ${mine.votes} голос., всего +${mine.earned} за раунд.`;
      setCollageBreakSummary(line);
      setCollageVoting(null);
    });

    socket.on('emojiart:timer', (t) => setGenericTimer(Number(t) || 0));
    socket.on('emojiart:score', (d) => {
      const raw = Array.isArray(d?.players) ? d.players : Array.isArray(d) ? d : [];
      setEmojiartScores(
        raw.map((p) => ({
          id: p.id,
          name: p.name,
          score: typeof p.score === 'number' && !Number.isNaN(p.score) ? p.score : Number(p.score) || 0,
        }))
      );
    });
    socket.on('emojiart:round-started', (d) => {
      setEmojiartSecretWord('');
      setEmojiartBreakSummary('');
      setEmojiartRound(d && typeof d === 'object' ? d : null);
      const r = roomStatusRef.current;
      if (r?.gameType === 'emojiart' && Array.isArray(r.players)) {
        setEmojiartScores((prev) => {
          if (prev.length > 0) return prev;
          return r.players
            .filter((p) => !p.isSpectator)
            .map((p) => ({ id: p.id, name: p.name, score: 0 }));
        });
      }
    });
    socket.on('emojiart:your-word', (d) => {
      setEmojiartSecretWord(typeof d?.word === 'string' ? d.word : '');
    });
    socket.on('emojiart:guessed', (d) => {
      const pg = d?.pointsGuess ?? 2;
      const pd = d?.pointsDrawer ?? 1;
      setActionStatus(
        `Эмодзи-арт: ${d?.playerName || 'Игрок'} угадал(а) «${d?.word || '—'}» (+${pg} угадавшему, +${pd} художнику).`
      );
    });
    socket.on('emojiart:round-ended', (d) => {
      const w = d?.word || '—';
      const solvers = Array.isArray(d?.solverNames) ? d.solverNames.filter(Boolean) : [];
      const who =
        solvers.length > 0
          ? `Угадали: ${solvers.join(', ')}.`
          : 'Никто не угадал за время раунда.';
      setEmojiartBreakSummary(`Слово было: «${w}». ${who}`);
    });

    socket.on('wouldyourather:round-ended', (d) => {
      const st = roomStatusRef.current?.settings || {};
      const maj = st.pointsForMajority ?? 2;
      const min = st.pointsForMinority ?? 0;
      const tie = st.pointsForTie ?? 1;
      const mine = d?.results?.find((x) => x.id === socket.id);
      let line = '';
      if (d?.countA === d?.countB) {
        line = `Итог раунда: ничья ${d.countA}:${d.countB}. Все ответившие получают по ${tie} очк.`;
      } else {
        const side = d?.majorityChoice === 'A' ? 'A' : 'B';
        const label = side === 'A' ? d?.optionA : d?.optionB;
        line = `Итог: большинство — вариант ${side}${label ? ` («${label}»)` : ''} (${Math.max(d.countA, d.countB)} голос.). За попадание в большинство +${maj}, за меньшинство +${min}.`;
      }
      if (mine != null) {
        if (mine.choice == null) line += ' Вы не успели выбрать — 0 за раунд.';
        else line += ` Вам начислено +${mine.earned ?? 0}.`;
      }
      setWyrBreakSummary(line);
    });

    const GENERIC_GAMES = ['fakeartist', 'lastword', 'auction', 'wavelength', 'ranking', 'chameleon', 'timeline', 'rhyme', 'priceisright', 'bluff', 'escalation', 'memory', 'hotpotato', 'fibbing', 'prediction', 'connect', 'crossword', 'anagrams', 'wordchain', 'facts', 'sequence', 'bombparty', 'psych', 'judge', 'impostor', 'caption', 'flags', 'logos', 'maps', 'quotes'];
    GENERIC_GAMES.forEach((gt) => {
      socket.on(`${gt}:timer`, (t) => setGenericTimer(Number(t) || 0));
      socket.on(`${gt}:score`, (d) => setGenericScore(d?.players || []));
      socket.on(`${gt}:round-started`, (d) => {
        if (gt === 'timeline') setTimelineRoundResult(null);
        if (gt === 'auction' || gt === 'priceisright') setNumericRoundReveal(null);
        if (gt === 'ranking') { setRankingDraft([]); setRankingRoundResult(null); }
        if (gt === 'rhyme') setRhymeRoundResult(null);
        if (gt === 'bluff') { setBluffRoundResult(null); setBluffDefCount(0); }
        if (gt === 'memory') { setMemoryRoundResult(null); setMemorySelected([]); }
        if (gt === 'anagrams') setAnagramsRoundResult(null);
        if (gt === 'wordchain') { setWordchainChain([]); setWordchainNextLetter(null); setWordchainRoundResult(null); }
        if (gt === 'facts') { setFactsRoundResult(null); setFactsAnswerCount(0); setFactsMyChoice(null); }
        if (gt === 'sequence') setSequenceRoundResult(null);
        if (gt === 'bombparty') { setBombpartyExploded(false); setBombpartyUsedWords([]); }
        if (gt === 'psych') setPsychRoundResult(null);
        if (gt === 'judge') setJudgeRoundResult(null);
        if (gt === 'caption') { setCaptionAnswerCount(0); setCaptionRoundResult(null); }
        if (gt === 'impostor') setImpostorRoundResult(null);
        if (gt === 'flags') setFlagsRoundResult(null);
        if (gt === 'logos') setLogosRoundResult(null);
        if (gt === 'maps') setMapsRoundResult(null);
        if (gt === 'quotes') setQuotesRoundResult(null);
        if (gt === 'fibbing') setFibbingRoundResult(null);
        if (gt === 'prediction') setPredictionRoundResult(null);
        if (gt === 'connect') setConnectRoundResult(null);
        if (gt === 'crossword' && d && typeof d.timeLeft === 'number') setGenericTimer(d.timeLeft);
        setGenericRound(typeof d === 'object' && d ? { __event: 'round-started', ...d } : d);
      });
      socket.on(`${gt}:turn-started`, (d) => setGenericRound(typeof d === 'object' && d ? { __event: 'turn-started', ...d } : d));
      socket.on(`${gt}:voting-started`, (d) => setGenericRound(typeof d === 'object' && d ? { __event: 'voting-started', ...d } : d));
      socket.on(`${gt}:guess-started`, (d) => setGenericRound(typeof d === 'object' && d ? { __event: 'guess-started', ...d } : d));
      socket.on(`${gt}:sequence-shown`, (d) => setGenericRound(typeof d === 'object' && d ? { __event: 'sequence-shown', ...d } : d));
      socket.on(`${gt}:sequence-hidden`, (d) => setGenericRound(typeof d === 'object' && d ? { __event: 'sequence-hidden', ...d } : d));
      socket.on(`${gt}:potato-passed`, (d) => setGenericRound(typeof d === 'object' && d ? { __event: 'potato-passing', ...d } : d));
      socket.on(`${gt}:potato-exploded`, (d) => setGenericRound(typeof d === 'object' && d ? { __event: 'potato-exploded', ...d } : d));
      socket.on(`${gt}:potato-result`, (d) => setActionStatus(d?.correct ? `${d?.playerName} ответил верно!` : `${d?.playerName} не успел — -1 жизнь`));
    });
    socket.on('auction:round-ended', (d) => {
      setNumericRoundReveal(d && typeof d === 'object' ? { __game: 'auction', ...d } : null);
    });
    socket.on('priceisright:round-ended', (d) => {
      setNumericRoundReveal(d && typeof d === 'object' ? { __game: 'priceisright', ...d } : null);
    });
    socket.on('crossword:guess-wrong', () => {
      setCrosswordWrongSignal((n) => n + 1);
    });
    socket.on('crossword:word-guessed', (d) => {
      setGenericRound((prev) => {
        if (!prev) {
          return d?.grid
            ? {
                __event: 'round-started',
                grid: d.grid,
                solvedNums: d.solvedNums || [],
                mode: d.mode,
                timeLimited: d.timeLimited,
              }
            : prev;
        }
        return {
          ...prev,
          grid: d.grid ?? prev.grid,
          solvedNums: Array.isArray(d.solvedNums) ? d.solvedNums : prev.solvedNums,
          mode: d.mode ?? prev.mode,
          timeLimited: d.timeLimited ?? prev.timeLimited,
        };
      });
      if (d?.playerName && d?.answer) {
        const pts =
          d.mode === 'coop' || d.mode === 'corporate'
            ? '+10 каждому'
            : d.mode === 'duel' || d.mode === 'race'
              ? '+10 первому на слово'
              : '+10';
        setActionStatus(`${d.playerName} угадал(а) «${d.answer}» (${pts})`);
      }
    });
    socket.on('anagrams:word-accepted', (d) => {
      if (d?.playerName && d?.word) setActionStatus(`${d.playerName}: ${d.word} (+${d?.points || 0})`);
    });
    socket.on('anagrams:word-rejected', (d) => {
      if (d?.playerName && d?.word && d?.reason) {
        const reason = d.reason === 'duplicate' ? 'уже было' : d.reason === 'invalid_letters' ? 'не из букв' : 'нет в словаре';
        setActionStatus(`${d.playerName}: «${d.word}» — ${reason}`);
      }
    });
    socket.on('wordchain:word-accepted', (d) => {
      if (d?.playerName && d?.word) setActionStatus(`${d.playerName}: ${d.word} → след. буква: ${d?.nextLetter || '—'}`);
      if (Array.isArray(d?.chain)) setWordchainChain(d.chain);
      if (d?.nextLetter) setWordchainNextLetter(d.nextLetter);
    });
    socket.on('wordchain:round-ended', (d) => {
      setWordchainRoundResult(d ?? null);
      setTimeout(() => setWordchainRoundResult(null), 6000);
    });
    socket.on('bombparty:word-accepted', (d) => {
      if (d?.playerName && d?.word) {
        setActionStatus(`${d.playerName}: ${d.word} ✓`);
        setBombpartyUsedWords((prev) => [{ word: d.word, playerName: d.playerName, ts: Date.now() }, ...prev].slice(0, 20));
      }
    });
    socket.on('bombparty:bomb-exploded', () => {
      setBombpartyExploded(true);
    });
    socket.on('psych:round-ended', (d) => {
      setPsychRoundResult(d ?? null);
      setTimeout(() => setPsychRoundResult(null), 7000);
    });
    socket.on('judge:round-ended', (d) => {
      setJudgeRoundResult(d ?? null);
      setTimeout(() => setJudgeRoundResult(null), 5000);
    });
    socket.on('caption:answer-submitted', (d) => {
      if (d?.total !== undefined) setCaptionAnswerCount(d.total);
    });
    socket.on('caption:round-ended', (d) => {
      setCaptionRoundResult(d ?? null);
      setTimeout(() => setCaptionRoundResult(null), 5000);
    });
    socket.on('impostor:round-ended', (d) => {
      setImpostorRoundResult(d ?? null);
      setTimeout(() => setImpostorRoundResult(null), 7000);
    });
    socket.on('flags:word-guessed', (d) => {
      setFlagsRoundResult(d ?? null);
      setTimeout(() => setFlagsRoundResult(null), 4000);
    });
    socket.on('flags:round-ended', (d) => {
      setFlagsRoundResult((prev) => prev ?? d ?? null);
      setTimeout(() => setFlagsRoundResult(null), 4000);
    });
    socket.on('logos:word-guessed', (d) => {
      setLogosRoundResult(d ?? null);
      setTimeout(() => setLogosRoundResult(null), 4000);
    });
    socket.on('logos:round-ended', (d) => {
      setLogosRoundResult((prev) => prev ?? d ?? null);
      setTimeout(() => setLogosRoundResult(null), 4000);
    });
    socket.on('maps:word-guessed', (d) => {
      setMapsRoundResult(d ?? null);
      setTimeout(() => setMapsRoundResult(null), 4000);
    });
    socket.on('maps:round-ended', (d) => {
      setMapsRoundResult((prev) => prev ?? d ?? null);
      setTimeout(() => setMapsRoundResult(null), 4000);
    });
    socket.on('quotes:word-guessed', (d) => {
      setQuotesRoundResult(d ?? null);
      setTimeout(() => setQuotesRoundResult(null), 4000);
    });
    socket.on('quotes:round-ended', (d) => {
      setQuotesRoundResult((prev) => prev ?? d ?? null);
      setTimeout(() => setQuotesRoundResult(null), 4000);
    });
    socket.on('fibbing:round-ended', (d) => {
      setFibbingRoundResult(d ?? null);
      setTimeout(() => setFibbingRoundResult(null), 6000);
    });
    socket.on('prediction:round-ended', (d) => {
      setPredictionRoundResult(d ?? null);
      setTimeout(() => setPredictionRoundResult(null), 5000);
    });
    socket.on('connect:round-ended', (d) => {
      setConnectRoundResult(d ?? null);
      setTimeout(() => setConnectRoundResult(null), 5000);
    });
    socket.on('facts:round-ended', (d) => {
      setFactsRoundResult(d ?? null);
      setTimeout(() => setFactsRoundResult(null), 5000);
    });
    socket.on('facts:answer-submitted', (d) => {
      if (d?.total !== undefined) setFactsAnswerCount(d.total);
    });
    socket.on('ranking:round-ended', (d) => {
      setRankingRoundResult(d ?? null);
      setTimeout(() => setRankingRoundResult(null), 5000);
    });
    socket.on('rhyme:round-ended', (d) => {
      setRhymeRoundResult(d ?? null);
      setTimeout(() => setRhymeRoundResult(null), 5000);
    });
    socket.on('bluff:definition-submitted', (d) => { if (d?.total != null) setBluffDefCount(d.total); });
    socket.on('bluff:round-ended', (d) => {
      setBluffRoundResult(d ?? null);
      setTimeout(() => setBluffRoundResult(null), 6000);
    });
    socket.on('escalation:turn-started', (d) => {
      if (d?.playerId) setEscalationCurrentPlayerId(d.playerId);
    });
    socket.on('escalation:player-eliminated', (d) => {
      if (d?.playerName) setActionStatus(`❌ ${d.playerName} выбывает!`);
    });
    socket.on('memory:round-ended', (d) => {
      setMemoryRoundResult(d ?? null);
      setTimeout(() => setMemoryRoundResult(null), 6000);
    });
    socket.on('anagrams:round-ended', (d) => {
      setAnagramsRoundResult(d ?? null);
      setTimeout(() => setAnagramsRoundResult(null), 7000);
    });
    socket.on('lastword:word-accepted', (d) => {
      if (d?.playerName && d?.word) setActionStatus(`${d.playerName}: «${d.word}» ✓`);
    });
    socket.on('lastword:word-rejected', (d) => {
      if (d?.word) {
        const reason = d.reason === 'duplicate' ? 'уже было названо' : 'не засчитано';
        setActionStatus(`«${d.word}» — ${reason}`);
      }
    });
    socket.on('lastword:round-ended', (d) => {
      if (d?.lastPlayerName && d?.lastWord?.word) {
        setActionStatus(`Последнее слово: «${d.lastWord.word}» — ${d.lastPlayerName} (+бонус!)`);
      }
    });
    socket.on('timeline:round-ended', (d) => {
      setTimelineRoundResult(d);
      setTimeout(() => setTimelineRoundResult(null), 6000);
    });
    socket.on('sequence:answer-accepted', (d) => {
      if (d?.playerName && d?.answer) setActionStatus(`${d.playerName} угадал: ${d.answer}`);
    });
    socket.on('sequence:round-ended', (d) => {
      setSequenceRoundResult(d ?? null);
      setTimeout(() => setSequenceRoundResult(null), 4000);
    });
    socket.on('psych:guessing-started', (d) => setGenericRound(d ? { __event: 'guessing-started', ...d } : d));
    socket.on('impostor:role', (d) => setGenericRound((prev) => (prev ? { ...prev, __impostorRole: d } : { __impostorRole: d })));
    socket.on('impostor:started', (d) => setGenericRound(d ? { __event: 'round-started', ...d } : d));

    // ===== reaction listeners =====
    socket.on('reaction:player-joined', (d) => setReactionPlayers((prev) => prev.some((p) => p.id === d.playerId) ? prev : [...prev, { id: d.playerId, name: d.playerName, score: 0 }]));
    socket.on('reaction:player-left', (d) => { setReactionPlayers((prev) => prev.filter((p) => p.id !== d.playerId)); setReactionReadyIds((prev) => { const s = new Set(prev); s.delete(d.playerId); return s; }); });
    socket.on('reaction:player-ready', (d) => setReactionReadyIds((prev) => { const s = new Set(prev); d.ready ? s.add(d.playerId) : s.delete(d.playerId); return s; }));
    socket.on('reaction:game-countdown', (d) => { setReactionPhase('countdown'); setReactionCountdown(d.countdown); });
    socket.on('reaction:game-signal', () => { setReactionPhase('signal'); setReactionMyReacted(false); });
    socket.on('reaction:player-reacted', (d) => { if (d.playerId === socket.id) setReactionMyReacted(true); setReactionPlayers((prev) => prev.map((p) => p.id === d.playerId ? { ...p, score: d.score, reactionTime: d.reactionTime } : p)); });
    socket.on('reaction:game-winner', (d) => { setReactionPhase('finished'); setReactionResult(d); setReactionPlayers(d.scores || []); });
    socket.on('reaction:game-round-ended', () => { setReactionPhase('waiting'); setReactionReadyIds(new Set()); setReactionMyReacted(false); setReactionResult(null); });

    // ===== colors listeners =====
    socket.on('colors:player-joined', (d) => setReactionPlayers((prev) => prev.some((p) => p.id === d.playerId) ? prev : [...prev, { id: d.playerId, name: d.playerName }]));
    socket.on('colors:player-ready', (d) => setColorsReadyIds((prev) => { const s = new Set(prev); d.ready ? s.add(d.playerId) : s.delete(d.playerId); return s; }));
    socket.on('colors:game-round-started', (d) => { setColorsPhase('showing'); setColorsRound(d); setColorsTimer(d.timeLeft ?? 3); setColorsAnswered(false); });
    socket.on('colors:game-guessing-started', (d) => { setColorsPhase('guessing'); setColorsRound(d); setColorsTimer(d.timeLeft ?? 10); setColorsAnswered(false); });
    socket.on('colors:game-timer', (d) => setColorsTimer(typeof d === 'number' ? d : (d?.timeLeft ?? 0)));
    socket.on('colors:player-correct', (d) => { if (d.playerId === socket.id) setActionStatus(`✅ Верно! +${d.points} очков`); });
    socket.on('colors:player-wrong', (d) => { if (d.playerId === socket.id) setActionStatus(`❌ Неверно — ${d.lives} жизней осталось`); });
    socket.on('colors:game-round-ended', () => { setColorsPhase('waiting'); setColorsReadyIds(new Set()); });

    // ===== Острослов (Quiplash) =====
    socket.on('quiplash:prompts', (d) => {
      const prompts = Array.isArray(d?.prompts) ? d.prompts : [];
      setQuiplashPrompts(prompts);
      setQuiplashMyPromptIds(new Set(prompts.map((p) => p.promptId)));
      setQuiplashAnswers({});
      setQuiplashSubmitted(new Set());
      setQuiplashMatchup(null);
      setQuiplashResult(null);
      setQuiplashScore([]);
      setQuiplashPhase('answering');
      setQuiplashTimer(Number(d?.answerTime) || 0);
    });
    socket.on('quiplash:phase', (d) => {
      if (d?.phase) setQuiplashPhase(d.phase);
      if (d?.totalPrompts != null) setQuiplashTotal(Number(d.totalPrompts) || 0);
      if (d?.answerTime != null) setQuiplashTimer(Number(d.answerTime) || 0);
    });
    socket.on('quiplash:timer', (t) => setQuiplashTimer(typeof t === 'number' ? t : (t?.timeLeft ?? 0)));
    socket.on('quiplash:matchup', (d) => {
      setQuiplashMatchup(d);
      setQuiplashResult(null);
      setQuiplashVoted(false);
      setQuiplashVoteCount({ voted: 0, total: 0 });
      setQuiplashPhase('voting');
      setQuiplashTimer(Number(d?.voteTime) || 0);
    });
    socket.on('quiplash:vote-cast', (d) => setQuiplashVoteCount({ voted: Number(d?.voted) || 0, total: Number(d?.total) || 0 }));
    socket.on('quiplash:matchup-result', (d) => {
      setQuiplashResult(d);
      if (Array.isArray(d?.scoreboard)) setQuiplashScore(d.scoreboard);
      setQuiplashPhase('reveal');
    });

    // ===== Узнай друга =====
    socket.on('knowfriend:round-started', (d) => {
      setKnowfriendRound(d);
      setKnowfriendAnswered(false);
      setKnowfriendResult(null);
      setKnowfriendProgress({ answered: 0, total: d?.total ?? 0 });
      setKnowfriendTimer(Number(d?.answerTime) || 0);
    });
    socket.on('knowfriend:timer', (t) => setKnowfriendTimer(typeof t === 'number' ? t : (t?.timeLeft ?? 0)));
    socket.on('knowfriend:answer-submitted', (d) => setKnowfriendProgress({ answered: Number(d?.answered) || 0, total: Number(d?.total) || 0 }));
    socket.on('knowfriend:round-ended', (d) => {
      setKnowfriendResult(d);
      if (Array.isArray(d?.scoreboard)) setKnowfriendScore(d.scoreboard);
    });

    // ===== Предательский квиз (Fibbage) =====
    socket.on('fibbage:round-started', (d) => {
      setFibbageRound(d);
      setFibbagePhase('lies');
      setFibbageLie('');
      setFibbageLieSubmitted(false);
      setFibbageOptions([]);
      setFibbageChosen(null);
      setFibbageResult(null);
      setFibbageProgress({ n: 0, total: 0 });
      setFibbageTimer(Number(d?.lieTime) || 0);
    });
    socket.on('fibbage:timer', (t) => setFibbageTimer(typeof t === 'number' ? t : (t?.timeLeft ?? 0)));
    socket.on('fibbage:answer-submitted', (d) => setFibbageProgress({ n: Number(d?.submitted) || 0, total: Number(d?.total) || 0 }));
    socket.on('fibbage:voting-started', (d) => {
      setFibbageOptions(Array.isArray(d?.options) ? d.options : []);
      setFibbageRound((prev) => ({ ...(prev || {}), question: d?.question ?? prev?.question }));
      setFibbagePhase('choosing');
      setFibbageChosen(null);
      setFibbageProgress({ n: 0, total: 0 });
      setFibbageTimer(Number(d?.chooseTime) || 0);
    });
    socket.on('fibbage:vote-cast', (d) => setFibbageProgress({ n: Number(d?.picked) || 0, total: Number(d?.total) || 0 }));
    socket.on('fibbage:round-ended', (d) => {
      setFibbageResult(d);
      if (Array.isArray(d?.scoreboard)) setFibbageScore(d.scoreboard);
      setFibbagePhase('reveal');
    });

    // ===== teamwords listeners =====
    socket.on('teamwords:teams-updated', (d) => setTeamwordsTeams(d));
    socket.on('teamwords:player-ready', (d) => setTeamwordsReadyIds((prev) => { const s = new Set(prev); d.ready ? s.add(d.playerId) : s.delete(d.playerId); return s; }));
    socket.on('teamwords:explainer-word', (d) => setTeamwordsMyWord(d?.word ?? null));
    socket.on('teamwords:game-word-changed', (d) => setTeamwordsMyWord((prev) => { if (d?.isExplainer) return d.word; return prev; }));
    socket.on('teamwords:game-round-started', (d) => { setTeamwordsPhase('explaining'); setTeamwordsTeams((prev) => prev ? { ...prev, ...d.teams } : d.teams); });
    socket.on('teamwords:game-guessing-started', () => setTeamwordsPhase('guessing'));
    socket.on('teamwords:word-guessed', (d) => setActionStatus(`${d.playerName || '?'} угадал: ${d.word || '?'}`));
    socket.on('teamwords:word-skipped', (d) => setActionStatus(`Слово пропущено`));
    socket.on('teamwords:game-round-ended', (d) => { setTeamwordsPhase('roundEnd'); setTeamwordsTeams(d?.teams ?? null); setTeamwordsMyWord(null); });

    if (socket.connected) onConnect();

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      socket.emit('room:leave');
      setSessionRoom(null);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:updated');
      socket.off('room:chat-message');
      socket.off('room:error');
      socket.off('game:action-rejected');
      socket.off('wavelength:target');
      socket.off('fibbing:truth-teller');
      socket.off('game:started');
      socket.off('game:snapshot');
      socket.off('game:state-update');
      socket.off('game:phase-changed');
      socket.off('game:action-required');
      socket.off('game:action-result');
      socket.off('game:speaking-turn');
      socket.off('game:night-resolved');
      socket.off('game:player-killed');
      socket.off('game:player-revived');
      socket.off('game:vote-tie');
      socket.off('game:city-sleeps-no-execution');
      socket.off('game:multiple-lynched');
      socket.off('game:ended');
      socket.off('ai:speak');
      socket.off('hat:phaseChanged');
      socket.off('hat:wordsAdded');
      socket.off('hat:wordsComplete');
      socket.off('hat:roundStarted');
      socket.off('hat:newWord');
      socket.off('hat:timerUpdate');
      socket.off('hat:wordGuessed');
      socket.off('hat:wordSkipped');
      socket.off('hat:roundEnded');
      socket.off('hat:scoreboard');
      socket.off('associations:chain-started');
      socket.off('associations:turn-started');
      socket.off('associations:voting-started');
      socket.off('associations:voting-ended');
      socket.off('associations:chain-broken');
      socket.off('associations:words-collected');
      socket.off('crocodile:word-choices');
      socket.off('crocodile:turn-timeout');
      socket.off('sketch:word-choices');
      socket.off('crocodile:turn-started');
      socket.off('crocodile:your-word');
      socket.off('crocodile:timer');
      socket.off('crocodile:word-guessed');
      socket.off('crocodile:score');
      socket.off('crocodile:draw');
      socket.off('crocodile:clear');
      socket.off('sketch:turn-started');
      socket.off('sketch:your-word');
      socket.off('sketch:timer');
      socket.off('sketch:word-guessed');
      socket.off('sketch:score');
      socket.off('sketch:draw');
      socket.off('sketch:clear');
      socket.off('quiplash:prompts');
      socket.off('quiplash:phase');
      socket.off('quiplash:timer');
      socket.off('quiplash:matchup');
      socket.off('quiplash:vote-cast');
      socket.off('quiplash:matchup-result');
      socket.off('knowfriend:round-started');
      socket.off('knowfriend:timer');
      socket.off('knowfriend:answer-submitted');
      socket.off('knowfriend:round-ended');
      socket.off('fibbage:round-started');
      socket.off('fibbage:timer');
      socket.off('fibbage:answer-submitted');
      socket.off('fibbage:voting-started');
      socket.off('fibbage:vote-cast');
      socket.off('fibbage:round-ended');
      socket.off('sketch:undo');
      socket.off('crocodile:undo');
      // New games cleanup
      ['alias:turn-started','alias:your-word','alias:word-guessed','alias:turn-timeout','alias:timer','alias:score',
       'spy:role','spy:voting-started','spy:voting-ended','spy:guess-result','spy:can-guess',
       'quiz:question','quiz:question-ended','quiz:score','quiz:timer',
       'meme:round-started','meme:voting-started','meme:round-ended','meme:score','meme:timer',
       'wordbomb:turn-started','wordbomb:your-word','wordbomb:word-guessed','wordbomb:mine-triggered','wordbomb:turn-timeout','wordbomb:timer','wordbomb:score',
       'debate:round-started','debate:voting-started','debate:round-ended','debate:timer','debate:score',
       'truths:collecting','truths:guessing-started','truths:guessing-ended','truths:score',
       'story:started','story:turn-started','story:sentence-submitted','story:completed','story:timer','story:score',
       'emoji:round-started','emoji:guessed','emoji:timeout','emoji:timer','emoji:score',
       'whoami:assignment','whoami:question','whoami:answer','whoami:guess-result',
       'fakeartist:role','fakeartist:started','fakeartist:hint-started','fakeartist:hint-submitted','fakeartist:voting-started','fakeartist:round-ended','fakeartist:guess',
       'chameleon:role','chameleon:started','chameleon:clue-prompt','chameleon:clue-submitted','chameleon:voting-started','chameleon:round-ended','chameleon:guess'
      ].forEach((e) => socket.off(e));
      [
        'categories:timer',
        'categories:score',
        'categories:round-started',
        'categories:round-ended',
        'categories:answer-accepted',
        'categories:answer-rejected',
        'categories:bonus-first',
      ].forEach((ev) => socket.off(ev));
      ['wouldyourather:timer', 'wouldyourather:score', 'wouldyourather:round-started', 'wouldyourather:round-ended'].forEach(
        (ev) => socket.off(ev)
      );
      ['trust:timer', 'trust:score', 'trust:round-started', 'trust:round-ended'].forEach((ev) => socket.off(ev));
      [
        'collage:timer',
        'collage:score',
        'collage:round-started',
        'collage:turn-started',
        'collage:piece-submitted',
        'collage:voting-started',
        'collage:voting-ended',
      ].forEach((ev) => socket.off(ev));
      [
        'emojiart:timer',
        'emojiart:score',
        'emojiart:round-started',
        'emojiart:your-word',
        'emojiart:guessed',
        'emojiart:round-ended',
      ].forEach((ev) => socket.off(ev));
      ['fakeartist', 'lastword', 'auction', 'wavelength', 'ranking', 'chameleon', 'timeline', 'rhyme', 'priceisright', 'bluff', 'escalation', 'memory', 'hotpotato', 'fibbing', 'prediction', 'connect', 'crossword', 'anagrams', 'wordchain', 'facts', 'sequence', 'bombparty', 'psych', 'judge', 'impostor', 'caption', 'flags', 'logos', 'maps', 'quotes'].forEach((gt) => {
        socket.off(`${gt}:timer`); socket.off(`${gt}:score`); socket.off(`${gt}:round-started`); socket.off(`${gt}:turn-started`);
        socket.off(`${gt}:potato-passed`); socket.off(`${gt}:potato-exploded`); socket.off(`${gt}:potato-result`);
      });
      socket.off('auction:round-ended');
      socket.off('priceisright:round-ended');
      socket.off('crossword:guess-wrong');
      socket.off('crossword:word-guessed');
      socket.off('anagrams:word-accepted');
      socket.off('anagrams:word-rejected');
      socket.off('wordchain:word-accepted');
      socket.off('bombparty:word-accepted');
      socket.off('facts:round-ended');
      socket.off('facts:answer-submitted');
      socket.off('sequence:round-ended');
      socket.off('bombparty:bomb-exploded');
      socket.off('psych:round-ended');
      socket.off('judge:round-ended');
      socket.off('caption:answer-submitted');
      socket.off('caption:round-ended');
      socket.off('impostor:round-ended');
      ['reaction', 'colors', 'teamwords'].forEach((gt) => {
        ['player-joined','player-left','player-ready','game-countdown','game-signal','player-reacted','game-winner','game-round-ended','game-round-started','game-guessing-started','game-timer','player-correct','player-wrong','teams-updated','explainer-word','game-word-changed','word-guessed','word-skipped'].forEach((ev) => socket.off(`${gt}:${ev}`));
      });
      socket.off('flags:word-guessed'); socket.off('flags:round-ended');
      socket.off('logos:word-guessed'); socket.off('logos:round-ended');
      socket.off('maps:word-guessed'); socket.off('maps:round-ended');
      socket.off('quotes:word-guessed'); socket.off('quotes:round-ended');
      socket.off('fibbing:round-ended');
      socket.off('prediction:round-ended');
      socket.off('connect:round-ended');
      socket.off('lastword:word-accepted');
      socket.off('lastword:word-rejected');
      socket.off('lastword:round-ended');
      socket.off('wavelength:round-ended');
      socket.off('ranking:round-ended');
      socket.off('rhyme:round-ended');
      socket.off('bluff:definition-submitted');
      socket.off('bluff:round-ended');
      socket.off('escalation:turn-started');
      socket.off('escalation:player-eliminated');
      socket.off('memory:round-ended');
      socket.off('anagrams:round-ended');
      socket.off('wordchain:round-ended');
      socket.off('timeline:round-ended');
      socket.off('sequence:answer-accepted');
      socket.off('psych:guessing-started');
      socket.off('impostor:role');
      socket.off('impostor:started');
    };
    // Только roomId: navigate из RR7 нестабилен и не должен перезапускать сокет-эффект (см. navigateRef).
  }, [roomId]);

  useEffect(() => {
    setRoleCardDismissed(false);
    setMafiaInvestigationLog([]);
    setCrosswordWordsInput('');
    setNewGameInput('');
    setNewGameSelected('');
    setFibbingIsTruthTeller(false);
    setWavelengthTarget(null);
    setWavelengthRoundResult(null);
  }, [room?.code]);

  useEffect(() => {
    const prev = prevGameTypeRef.current;
    prevGameTypeRef.current = room?.gameType;
    if (prev === 'quiz' && room?.gameType !== 'quiz') setQuizScores([]);
    if (prev === 'categories' && room?.gameType !== 'categories') {
      setCategoriesScores([]);
      setCategoriesRound(null);
      setCategoriesMyProgress(null);
    }
    if (prev === 'wouldyourather' && room?.gameType !== 'wouldyourather') {
      setWyrScores([]);
      setWyrRound(null);
      setWyrMyPick(null);
      setWyrBreakSummary('');
    }
    if (prev === 'trust' && room?.gameType !== 'trust') {
      setTrustScores([]);
      setTrustRound(null);
      setTrustMyChoice(null);
      setTrustBreakSummary('');
    }
    if (prev === 'collage' && room?.gameType !== 'collage') {
      setCollageScores([]);
      setCollageRoundMeta(null);
      setCollageDisplay('');
      setCollageTurn(null);
      setCollageVoting(null);
      setCollagePieceInput('');
      setCollageMyVote(null);
      setCollageBreakSummary('');
    }
    if (prev === 'emojiart' && room?.gameType !== 'emojiart') {
      setEmojiartScores([]);
      setEmojiartRound(null);
      setEmojiartSecretWord('');
      setEmojiartBreakSummary('');
    }
  }, [room?.gameType]);

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(''), 2000);
    });
  };

  const isHost = room?.hostId === socket.id;
  const mafiaTargetPlayers = Math.min(room?.maxPlayers || 12, Math.max(4, Number(room?.settings?.targetPlayerCount) || 6));
  const mafiaSetupAiEnabled = !!room?.settings?.options?.aiGameMaster;
  const mafiaNightTimer = Number(room?.settings?.timers?.night) || 60;
  const mafiaVotingTimer = Number(room?.settings?.timers?.voting) || 60;
  const mafiaCount = Number(room?.settings?.roles?.mafia) || 1;

  const quizScoreRows = useMemo(() => {
    if (!quizScores.length) return [];
    const sorted = [...quizScores].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
    });
    let prevRank = 0;
    return sorted.map((p, i) => {
      const rank = i === 0 || p.score < sorted[i - 1].score ? i + 1 : prevRank;
      prevRank = rank;
      return {
        ...p,
        rank,
        isSelf: p.id === socket.id,
        medal: rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null,
      };
    });
  }, [quizScores]);

  const quizSpeedBonusMax = room?.settings?.speedBonusMax ?? 5;
  const quizTotalQuestions = quizQuestion?.totalQuestions ?? room?.settings?.maxQuestions;

  const categoriesScoreRows = useMemo(() => {
    if (!categoriesScores.length) return [];
    const sorted = [...categoriesScores].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
    });
    let prevRank = 0;
    return sorted.map((p, i) => {
      const rank = i === 0 || p.score < sorted[i - 1].score ? i + 1 : prevRank;
      prevRank = rank;
      return {
        ...p,
        rank,
        isSelf: p.id === socket.id,
        medal: rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null,
      };
    });
  }, [categoriesScores]);

  const categoriesPts = room?.settings?.pointsForValid ?? 1;
  const categoriesUnique = room?.settings?.uniquenessBonus ?? 2;
  const categoriesSpeed = room?.settings?.speedBonus ?? 3;

  const wyrScoreRows = useMemo(() => {
    if (!wyrScores.length) return [];
    const sorted = [...wyrScores].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
    });
    let prevRank = 0;
    return sorted.map((p, i) => {
      const rank = i === 0 || p.score < sorted[i - 1].score ? i + 1 : prevRank;
      prevRank = rank;
      return {
        ...p,
        rank,
        isSelf: p.id === socket.id,
        medal: rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null,
      };
    });
  }, [wyrScores]);

  const wyrPtsMaj = room?.settings?.pointsForMajority ?? 2;
  const wyrPtsMin = room?.settings?.pointsForMinority ?? 0;
  const wyrPtsTie = room?.settings?.pointsForTie ?? 1;

  const trustScoreRows = useMemo(() => {
    if (!trustScores.length) return [];
    const sorted = [...trustScores].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
    });
    let prevRank = 0;
    return sorted.map((p, i) => {
      const rank = i === 0 || p.score < sorted[i - 1].score ? i + 1 : prevRank;
      prevRank = rank;
      return {
        ...p,
        rank,
        isSelf: p.id === socket.id,
        medal: rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null,
      };
    });
  }, [trustScores]);

  const trustPtsTrust = room?.settings?.pointsTrust ?? 1;
  const trustPtsBetray = room?.settings?.pointsBetray ?? 3;
  const trustPtsBothTrust = room?.settings?.pointsBothTrust ?? 2;
  const trustPtsBothBetray = room?.settings?.pointsBothBetray ?? 0;

  const collageScoreRows = useMemo(() => {
    if (!collageScores.length) return [];
    const sorted = [...collageScores].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
    });
    let prevRank = 0;
    return sorted.map((p, i) => {
      const rank = i === 0 || p.score < sorted[i - 1].score ? i + 1 : prevRank;
      prevRank = rank;
      return {
        ...p,
        rank,
        isSelf: p.id === socket.id,
        medal: rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null,
      };
    });
  }, [collageScores]);

  const collagePtsVote = room?.settings?.pointsPerVote ?? 2;
  const collageBonusWinner = room?.settings?.bonusRoundWinner ?? 3;
  const collagePieceMin = collageTurn?.pieceMin ?? room?.settings?.pieceMinLen ?? 2;
  const collagePieceMax = collageTurn?.pieceMax ?? room?.settings?.pieceMaxLen ?? 160;

  const emojiartScoreRows = useMemo(() => {
    if (!emojiartScores.length) return [];
    const sorted = [...emojiartScores].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
    });
    let prevRank = 0;
    return sorted.map((p, i) => {
      const rank = i === 0 || p.score < sorted[i - 1].score ? i + 1 : prevRank;
      prevRank = rank;
      return {
        ...p,
        rank,
        isSelf: p.id === socket.id,
        medal: rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null,
      };
    });
  }, [emojiartScores]);

  const emojiartPtsGuess = emojiartRound?.pointsGuess ?? room?.settings?.pointsGuess ?? 2;
  const emojiartPtsDrawer = emojiartRound?.pointsDrawer ?? room?.settings?.pointsDrawer ?? 1;

  const genericScoreRows = useMemo(() => buildRankedScoreRows(genericScore, socket.id), [genericScore]);
  const crocScoreRows = useMemo(() => buildRankedScoreRows(crocScore, socket.id), [crocScore]);
  const assocScoreRows = useMemo(() => buildRankedScoreRows(assocScores, socket.id), [assocScores]);
  const quiplashScoreRows = useMemo(() => buildRankedScoreRows(quiplashScore, socket.id), [quiplashScore]);
  const knowfriendScoreRows = useMemo(() => buildRankedScoreRows(knowfriendScore, socket.id), [knowfriendScore]);
  const fibbageScoreRows = useMemo(() => buildRankedScoreRows(fibbageScore, socket.id), [fibbageScore]);

  resetGameUiAfterHostAbortRef.current = () => {
    setGameState(null);
    setPhaseTimer(0);
    setSelectedTarget('');
    setSelectedRoleMap({});
    setHatWordsInput('');
    setHatSubmitted(false);
    setHatTimer(0);
    setHatRoundTime(60);
    setHatWord('');
    setHatIsExplainer(false);
    setHatRoundInfo(null);
    setHatPanicMode(false);
    setHatScoreboard(null);
    setAssocWordsInput('');
    setAssocSubmitted(false);
    setAssocTurn(null);
    setAssocWordInput('');
    setAssocVoting(null);
    setAssocVoteChoice(null);
    setAssocLastResult(null);
    setAssocFlash(false);
    setAssocFlashColor('#7850ff');
    setAssocScores([]);
    setCrocTurn(null);
    setCrocTimer(0);
    setCrocMyWord('');
    setCrocScore([]);
    setCrocStrokes([]);
    setCrocWordChoices(null);
    setSpyRole(null);
    setQuizQuestion(null);
    setQuizSelectedAnswer(null);
    setQuizScores([]);
    setQuizOptionsLocked(false);
    setCategoriesRound(null);
    setCategoriesScores([]);
    setCategoriesMyProgress(null);
    setWyrRound(null);
    setWyrScores([]);
    setWyrMyPick(null);
    setWyrBreakSummary('');
    setTrustRound(null);
    setTrustScores([]);
    setTrustMyChoice(null);
    setTrustBreakSummary('');
    setCollageRoundMeta(null);
    setCollageDisplay('');
    setCollageTurn(null);
    setCollageVoting(null);
    setCollagePieceInput('');
    setCollageScores([]);
    setCollageMyVote(null);
    setCollageBreakSummary('');
    setEmojiartScores([]);
    setEmojiartRound(null);
    setEmojiartSecretWord('');
    setEmojiartBreakSummary('');
    setMemePrompt(null);
    setMemeAnswerInput('');
    setMemeVotingData(null);
    setMemeWinner(null);
    setMemeRoflTooltip(null);
    setDebateRound(null);
    setDebateVotingOpen(false);
    setTruthsPhase('waiting');
    setTruthsFacts(['', '', '']);
    setTruthsLieIndex(2);
    setTruthsGuessing(null);
    setStoryTurn(null);
    setStorySentenceInput('');
    setStoryFullText('');
    setStoryRound({ round: 1, max: 3 });
    setEmojiRound(null);
    setWhoamiAssignment(null);
    setWhoamiQuestionInput('');
    setWhoamiGuessInput('');
    setGenericTimer(0);
    setGenericScore([]);
    setFakeartistRole(null);
    setFakeartistHintPrompt(null);
    setFakeartistVoting(null);
    setFakeartistGuessPhase(false);
    setFakeartistHintInput('');
    setFakeartistGuessInput('');
    setChameleonRole(null);
    setChameleonCluePrompt(null);
    setChameleonVoting(null);
    setChameleonGuessPhase(null);
    setChameleonReveal(null);
    setChameleonClueInput('');
    setChameleonGuessInput('');
    setGenericRound(null);
    setNumericRoundReveal(null);
    setTimelineRoundResult(null);
    setNewGameInput('');
    setNewGameSelected('');
    setFibbingIsTruthTeller(false);
    setWavelengthTarget(null);
  };

  // Шляпа: режим паники — пробел на мгновение размывает слово
  useEffect(() => {
    if (!room || room.gameType !== 'hat' || !hatIsExplainer || !hatWord) return;
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setHatPanicMode(true);
        setTimeout(() => setHatPanicMode(false), 400);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [room?.gameType, hatIsExplainer, hatWord]);

  useEffect(() => {
    if (phaseTimer <= 0) return undefined;
    const id = setInterval(() => {
      setPhaseTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [phaseTimer]);

  const changeNickname = () => {
    socket.emit('room:change-nickname', newNickname, (res) => {
      if (res?.success) {
        localStorage.setItem('playerName', newNickname);
      } else {
        setError(res?.error || 'Не удалось сменить ник');
      }
    });
  };

  const startGame = () => {
    let payload = {};
    if (room?.gameType === 'crossword') {
      const lines = String(crosswordWordsInput || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const useCustomWords = lines.length >= 2;
      if (crosswordHostMode === 'corporate' && useCustomWords && lines.length !== CROSSWORD_CORPORATE_WORD_COUNT) {
        toast.error(
          `Корпоратив со своим списком: нужно ровно ${CROSSWORD_CORPORATE_WORD_COUNT} строк или очистите поле для автогенерации.`,
        );
        return;
      }
      const roundTimeSec =
        crosswordHostMode === 'solo_casual'
          ? 0
          : Math.max(60, Math.round(Number(crosswordRoundMin) || 5) * 60);
      payload = {
        crosswordOptions: {
          mode: crosswordHostMode,
          roundTimeSec,
          autoWordCount: crosswordAutoWordCount,
        },
      };
      if (useCustomWords) {
        payload.crosswordWords = lines;
      }
    }
    socket.emit('game:start', payload, (res) => {
      if (res?.success === false) toast.error(res.error || 'Не удалось начать игру');
    });
  };

  const endHostedGame = () => {
    if (!window.confirm('Завершить игру для всех и вернуться в ожидание в этой комнате?')) return;
    socket.emit('host:end-game', (res) => {
      if (res?.success === false) toast.error(res.error || 'Не удалось завершить игру');
    });
  };

  const resetMafiaParty = () => {
    if (
      !window.confirm(
        'Сбросить партию для всех? Роли и прогресс обнулятся, комната вернётся в ожидание.',
      )
    ) {
      return;
    }
    socket.emit('host:reset-mafia-party', (res) => {
      if (res?.success === false) toast.error(res.error || 'Не удалось сбросить партию');
    });
  };

  const parseWordsInput = (raw) =>
    String(raw || '')
      .split(/[\n,;]/)
      .map((x) => x.trim())
      .filter(Boolean);

  const submitHatWords = () => {
    const words = parseWordsInput(hatWordsInput);
    socket.emit('game:action', { type: 'add-words', words }, (res) => {
      if (res?.success) {
        setHatSubmitted(true);
        setActionStatus('Слова отправлены в шляпу');
      } else {
        // Не setError — иначе весь RoomPage сменяется на экран «ошибка» и кажется, что выкинуло из комнаты
        toast.error(res?.error || 'Не удалось отправить слова');
      }
    });
  };

  const skipHatWord = () => {
    socket.emit('game:action', { type: 'skip-word' }, (res) => {
      if (res?.success === false) setError(res.error || 'Нельзя пропустить слово');
    });
  };

  const confirmHatGuess = (guesserId) => {
    if (!guesserId || hatConfirmInFlight) return;
    setHatConfirmInFlight(true);
    socket.emit('game:action', { type: 'hat:confirm-guess', guesserId }, (res) => {
      setHatConfirmInFlight(false);
      if (res?.success === false) toast.error(res?.error || 'Не удалось засчитать');
    });
  };

  const normalizeLie = (s) => String(s || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
  const submitFibbageLie = () => {
    const text = fibbageLie.trim();
    if (!text) return;
    socket.emit('game:action', { type: 'fib-lie', text }, (res) => {
      if (res && res.success === false) { toast.error(res.error || 'Не принято'); return; }
      setFibbageLieSubmitted(true);
    });
  };

  const submitAssociationsWords = () => {
    const words = parseWordsInput(assocWordsInput);
    const distinct = [...new Set(words.map((w) => w.toLowerCase().trim()).filter((w) => w.length >= 2))];
    if (distinct.length < 3) {
      toast.error('Нужно минимум 3 разных слова (по 2+ буквы)');
      return;
    }
    socket.emit('game:action', { type: 'add-words', words });
    setAssocSubmitted(true);
    setActionStatus('Слова отправлены — ждём остальных игроков');
  };

  const submitAssociationWord = () => {
    if (!assocWordInput.trim()) return;
    const colors = ['#7850ff', '#00f5d4', '#f472b6', '#fbbf24', '#10b981'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    setAssocFlashColor(color);
    setAssocFlash(true);
    setTimeout(() => setAssocFlash(false), 150);
    socket.emit('game:action', { type: 'submit-association', word: assocWordInput.trim() });
    setAssocWordInput('');
  };

  const voteAssociation = (vote) => {
    setAssocVoteChoice(vote);
    socket.emit('game:action', { type: 'vote', vote: Boolean(vote) });
  };

  const leaveRoomAndGoHome = () => {
    socket.emit('room:leave');
    setSessionRoom(null);
    navigate('/');
  };

  const handleDeathRevealComplete = useCallback(() => setLastDeathReveal(null), []);

  const submitAction = () => {
    if (!selectedTarget) return;
    const actionType = getMafiaActionTypeForPhase(phase);
    if (!actionType) return;
    socket.emit('game:action', { type: actionType, targetId: selectedTarget });
    setActionStatus('Действие отправлено');
    setSelectedTarget('');
    setActionPrompt(null);
  };

  const sendHostCommand = (eventName, ...args) => {
    socket.emit(eventName, ...args, (res) => {
      if (res?.success === false) setError(res.error || 'Команда отклонена');
    });
  };
  const sendDangerHostCommand = (question, eventName, ...args) => {
    if (!window.confirm(question)) return;
    sendHostCommand(eventName, ...args);
  };

  const playerById = useMemo(() => {
    const map = new Map();
    room?.players?.forEach((p) => map.set(p.id, p));
    (gameState?.players || []).forEach((p) => map.set(p.id, { ...map.get(p.id), ...p }));
    return map;
  }, [room, gameState?.players]);

  const mafiaPlayers = gameState?.players || [];
  const players = room?.players || [];

  const mafiaVotedCount = useMemo(() => {
    const dv = gameState?.dayVotes;
    if (!dv) return 0;
    return dv instanceof Map ? dv.size : Object.keys(dv).length;
  }, [gameState?.dayVotes]);

  const mafiaTotalVoters = useMemo(() => {
    return mafiaPlayers.filter(
      (p) => (p.status === 'alive' || p.status === 'poisoned') && !p.cannotVoteNextDay
    ).length;
  }, [mafiaPlayers]);

  const alivePlayers = mafiaPlayers.filter((p) => p.status === 'alive' || p.status === 'poisoned');
  const deadPlayers = mafiaPlayers.filter((p) => p.status === 'dead');
  const mafiaModerator = !!gameState?.isModerator;
  const meInMafiaGame = mafiaPlayers.find((p) => p.id === socket.id);
  const canSubmitMafiaVote =
    !mafiaModerator &&
    (phase === 'voting' || phase === 'votingRevote') &&
    meInMafiaGame &&
    (meInMafiaGame.status === 'alive' || meInMafiaGame.status === 'poisoned') &&
    !!actionPrompt;
  const mafiaVoteDisabledReason =
    (phase === 'voting' || phase === 'votingRevote') && !canSubmitMafiaVote
      ? mafiaModerator
        ? 'Вы ведёте игру без карты — голосуйте через блок «Играть за игрока» в панели ведущего.'
        : !actionPrompt
          ? 'Ваш голос уже учтён или сейчас не требуется действие.'
          : 'Выбывшие игроки не участвуют в голосовании.'
      : null;

  const isMafiaNight = room?.gameType === 'mafia' && String(phase || '').startsWith('night-');
  const isMafiaNoirMode = room?.gameType === 'mafia' && room?.status !== 'waiting';
  const isCrocodileLuxeMode = isCrocodileDrawGame(room?.gameType) && room?.status !== 'waiting';
  const crocGuessActive =
    isCrocodileLuxeMode &&
    crocTurn?.explainerId === socket.id &&
    !crocTransition &&
    !(crocWordChoices?.choices?.length > 0);

  const handleCrocConfirmGuess = useCallback((guesserId) => {
    setCrocConfirmingIds((prev) => new Set(prev).add(guesserId));
    socket.emit('crocodile:manual-confirm', { guesserId }, (res) => {
      setCrocConfirmingIds((prev) => {
        const next = new Set(prev);
        next.delete(guesserId);
        return next;
      });
      if (!res?.success) toast.error(res?.error || 'Не удалось засчитать');
    });
  }, [toast]);
  const showMafiaDebugPanels = Boolean(import.meta.env.DEV);
  const isMafiaRoleActive = isMafiaNight && actionPrompt && gameState?.myRole;
  const hostNightActions = Array.isArray(gameState?.hostNightActions) ? gameState.hostNightActions : [];
  const isHumanMafiaHostMode =
    room?.gameType === 'mafia' &&
    room?.status === 'playing' &&
    isHost &&
    !room?.settings?.options?.aiGameMaster;
  const isHostSpeechPhase = phase === 'intro' || phase === 'discussion' || phase === 'voting' || phase === 'votingTieDiscussion' || phase === 'votingRevote';
  const mafiaPhaseProgress = phaseTimer > 0
    ? Math.max(0, Math.min(100, Math.round((phaseTimer / Math.max(1, (room?.settings?.timers?.night || 60))) * 100)))
    : 0;

  useEffect(() => {
    localStorage.setItem('room-sfx-enabled', sfxEnabled ? '1' : '0');
  }, [sfxEnabled]);

  useEffect(() => {
    if (!sfxEnabled) return;
    if (!room || room.gameType !== 'mafia') return;
    if (phase === 'voting' || phase === 'votingRevote' || phase === 'gameOver') {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = phase === 'voting' || phase === 'votingRevote' ? 'triangle' : 'sine';
      osc.frequency.value = phase === 'voting' || phase === 'votingRevote' ? 640 : 420;
      gain.gain.value = 0.035;
      osc.start();
      osc.stop(ac.currentTime + 0.12);
      osc.onended = () => ac.close();
    }
  }, [phase, room, sfxEnabled]);

  if (error) return <div className="container"><div className="error">{error}</div><button className="btn" onClick={() => navigate('/')}>В лобби</button></div>;
  if (!room) return <div className="container"><div className="phase">Подключение...</div></div>;

  return (
    <>
      <DictionaryStatus socket={socket} />
      {isMafiaNight && (
        <div className="mafia-night-overlay" aria-hidden />
      )}
      {assocFlash && (
        <div
          className="assoc-flash-overlay active"
          style={{ background: assocFlashColor }}
          aria-hidden
        />
      )}
      <div className={`connection-bar ${isConnected ? 'connected' : 'disconnected'}`}>
        <span className="connection-dot"></span>
        <span className="connection-text">{isConnected ? 'В комнате' : 'Потеряно соединение...'}</span>
      </div>
      {!isConnected && (
        <div className="reconnect-overlay" role="status" aria-live="polite">
          <div className="reconnect-card">
            <div className="reconnect-spinner" aria-hidden />
            <p className="reconnect-title">Переподключение...</p>
            <p className="reconnect-hint">Не закрывайте вкладку — восстанавливаем соединение</p>
          </div>
        </div>
      )}
      {mafiaPhaseOverlay && room?.gameType === 'mafia' && (
        <div className={`mafia-phase-overlay mafia-phase-overlay--${mafiaPhaseOverlay.type}`} aria-hidden="true">
          <div className="mafia-phase-overlay__card">
            <span className="mafia-phase-overlay__icon">{mafiaPhaseOverlay.icon}</span>
            <span className="mafia-phase-overlay__label">{mafiaPhaseOverlay.label}</span>
          </div>
        </div>
      )}

      <div
        className={`container screen-enter room-page${
          room.gameType === 'mafia' && room.status !== 'waiting' ? ' room-page--mafia-playing' : ''
        }${
          room.gameType === 'mafia' && room.status !== 'waiting' && isHost ? ' room-page--mafia-host' : ''
        }`}
      >
        {!isMafiaNoirMode && !isCrocodileLuxeMode && (
          <>
            <div className="room-id-container" style={{ display: 'block', textAlign: 'center', padding: 'var(--space-5)' }}>
              <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.15rem' }} data-testid="room-title">{room.title || 'Игровая комната'}</p>
              <div className="room-id" data-testid="room-code">{room.code}</div>
              <div className="room-copy-buttons">
                <button className="btn btn-sm" onClick={() => copyToClipboard(room.code, 'code')}>
                  {copySuccess === 'code' ? '✓ Скопировано' : 'Копировать код'}
                </button>
                <button className="btn btn-sm" onClick={() => copyToClipboard(window.location.href, 'link')}>
                  {copySuccess === 'link' ? '✓ Ссылка скопирована' : 'Копировать ссылку'}
                </button>
              </div>
            </div>
            
            <div className="game-hud">
              <div>
                <span className="game-hud-label">Игра</span>{' '}
                <span className="game-hud-value">{GAME_LABELS[room.gameType] || room.gameType}</span>
              </div>
              <div>
                <span className="game-hud-label">Статус</span>{' '}
                <span className="game-hud-value" data-testid="status-value">{room.status === 'waiting' ? 'Ожидание' : MAFIA_PHASE_LABELS[phase] || phase}</span>
              </div>
              {room.status !== 'waiting' && phaseTimer > 0 && (
                <div className={`timer-display ${phaseTimer <= 10 ? 'urgent' : ''}`}>{phaseTimer}s</div>
              )}
            </div>
          </>
        )}

        {isMafiaNoirMode && (
          <>
            <header className="mafia-noir-topbar">
              <div className="mafia-noir-topbar__brand">MAFIA NOIR</div>
              <div className="mafia-noir-topbar__meta">
                <span>{room.title || 'Игровая комната'}</span>
                <span>Код: {room.code}</span>
                <span>{MAFIA_PHASE_LABELS[phase] || phase}</span>
                {phaseTimer > 0 && <span>{String(Math.floor(phaseTimer / 60)).padStart(2, '0')}:{String(phaseTimer % 60).padStart(2, '0')}</span>}
              </div>
            </header>

            <aside className="mafia-noir-panel mafia-noir-panel--left">
              <section className="mafia-noir-card">
                <div className="mafia-noir-card__head">
                  <h3>ИИ Ведущий</h3>
                </div>
                <div className="mafia-noir-scroll">
                  {aiMessages.length === 0 ? (
                    <p className="mafia-noir-empty">Ожидаем реплики ведущего...</p>
                  ) : (
                    aiMessages.slice(-12).reverse().map((m, idx) => (
                      <div key={`${m.time || idx}`} className="mafia-noir-log-row">
                        <span>{new Date(m.time || Date.now()).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                        <p>{m.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
              {showMafiaDebugPanels && (
                <section className="mafia-noir-card">
                  <div className="mafia-noir-card__head">
                    <h3>Журнал игры</h3>
                  </div>
                  <div className="mafia-noir-scroll">
                    {gameHistory.slice(-20).reverse().map((item, idx) => (
                      <div key={`${item.t}-${idx}`} className="mafia-noir-log-row">
                        <span>{new Date(item.t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                        <p>{item.text}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {showMafiaDebugPanels && (
                <section className="mafia-noir-card mafia-noir-card--checks">
                  <div className="mafia-noir-card__head">
                    <h3>Проверки</h3>
                  </div>
                  <div className="mafia-noir-scroll">
                    {mafiaInvestigationLog.length === 0 ? (
                      <p className="mafia-noir-empty">Пока нет проверок</p>
                    ) : (
                      mafiaInvestigationLog.slice(-8).reverse().map((row, idx) => (
                        <div key={`${row.t}-${idx}`} className="mafia-noir-check-row">
                          <span>{new Date(row.t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                          <p>{row.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}
              {isHost && (
                <section className="mafia-noir-card mafia-noir-card--host">
                  <div className="mafia-noir-card__head">
                    <h3>Панель ведущего</h3>
                  </div>
                  <div className="mafia-noir-host-actions">
                    {!room.settings?.options?.aiGameMaster && (
                      <>
                        <button type="button" onClick={() => sendHostCommand('host:next-phase')}>След. фаза</button>
                        <button type="button" onClick={() => sendHostCommand('host:set-phase', 'voting')}>Голосование</button>
                        <button type="button" onClick={() => sendHostCommand('host:set-phase', 'vote-result')}>Итог голос.</button>
                      </>
                    )}
                    <button type="button" onClick={resetMafiaParty}>Сброс партии</button>
                  </div>
                </section>
              )}
            </aside>

            <aside className="mafia-noir-panel mafia-noir-panel--right">
              {(gameState?.myTeam === 'mafia' || (isHost && phase !== 'waiting')) && gameState?.mafiaMates?.length > 0 && (
                <section className="mafia-noir-card">
                  <div className="mafia-noir-card__head">
                    <h3>Команда мафии</h3>
                  </div>
                  <div className="mafia-noir-scroll">
                    {(gameState.mafiaMates || []).map((mate) => (
                      <div key={mate.id} className="mafia-noir-message">
                        <strong>{mate.name}</strong>
                        <span style={{ opacity: 0.6, fontSize: '0.8em', marginLeft: 6 }}>{mate.role || 'мафия'}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '8px 12px', fontSize: '0.8em', opacity: 0.6 }}>
                    Координируйтесь в Discord
                  </div>
                </section>
              )}
            </aside>
          </>
        )}

        {isCrocodileLuxeMode && (
          <CrocodileLuxeChrome
            roomCode={room.code}
            crocTimer={crocTimer}
            crocScoreRows={crocScoreRows}
            crocTurn={crocTurn}
            players={players}
            socketId={socket.id}
            crocGuessedIds={crocGuessedIds}
            crocConfirmingIds={crocConfirmingIds}
            onConfirmGuess={handleCrocConfirmGuess}
            guessActive={crocGuessActive}
          />
        )}
          
        {isHost && room.status === 'playing' && room.gameType !== 'mafia' && !isCrocodileLuxeMode && (
          <aside className="host-control-panel" aria-label="Панель ведущего">
            <div className="host-control-panel__header">
              <span className="host-control-panel__badge" aria-hidden>🎙</span>
              <div>
                <h2 className="host-control-panel__title">Панель ведущего</h2>
                <p className="host-control-panel__hint">
                  Управление этой комнатой. Другие комнаты не затрагиваются.
                </p>
          </div>
            </div>
            <div className="host-control-panel__actions">
              <button
                type="button"
                className="btn host-control-panel__btn-danger"
                data-testid="host-end-game-btn"
                onClick={endHostedGame}
              >
                Завершить игру
              </button>
            </div>
          </aside>
        )}

        {room.gameType === 'mafia' && room.status !== 'waiting' && (
          <div className="mafia-mobile-tabs" role="tablist" aria-label="Навигация мобильной мафии">
            <button type="button" className={`mafia-mobile-tabs__btn ${mafiaMobileTab === 'table' ? 'active' : ''}`} onClick={() => setMafiaMobileTab('table')}>Стол</button>
            <button type="button" className={`mafia-mobile-tabs__btn ${mafiaMobileTab === 'control' ? 'active' : ''}`} onClick={() => setMafiaMobileTab('control')}>Управление</button>
          </div>
        )}

        <div
          className={`room-content-grid ${room.gameType === 'mafia' && room.status !== 'waiting' ? 'mafia-ops-layout' : ''} ${isCrocodileLuxeMode ? 'croc-luxe-layout' : ''}`}
          data-mafia-mobile-tab={mafiaMobileTab}
        >
        {room.gameType === 'mafia' && room.status !== 'waiting' && (
          <GameLayoutWrapper
            gameType="mafia"
            room={room}
            socket={socket}
            players={players}
          >
            <div className="game-area mafia-table-area">
              <MafiaGameTable
                playerId={socket.id}
                isHost={isHost}
                isModerator={mafiaModerator}
                canSubmitVote={canSubmitMafiaVote}
                voteDisabledReason={mafiaVoteDisabledReason}
                theme={localStorage.getItem('mafia-theme') || 'default'}
                soundEnabled={sfxEnabled}
                rainbowMode={rainbowMode}
                phase={phase}
                phaseTimer={phaseTimer}
                phaseTimerMax={phaseTimerMax}
                actionStatus={actionStatus}
                players={mafiaPlayers.map((p) => ({ ...(playerById.get(p.id) || {}), ...p }))}
                actionPrompt={actionPrompt}
                selectedTarget={selectedTarget}
                playerById={playerById}
                onSelectTarget={setSelectedTarget}
                onSubmitAction={(targetId) => {
                  if (!targetId) return;
                  const actionType = getMafiaActionTypeForPhase(phase);
                  if (!actionType) return;
                  socket.emit('game:action', { type: actionType, targetId });
                  setActionStatus('Действие отправлено');
                  setSelectedTarget('');
                  setActionPrompt(null);
                }}
                myRole={gameState?.myRole}
                roleCardDismissed={roleCardDismissed}
                onRoleCardDismiss={() => setRoleCardDismissed(true)}
                lastDeathReveal={lastDeathReveal}
                onDeathRevealComplete={handleDeathRevealComplete}
                voteCandidates={(phase === 'voting' || phase === 'votingRevote' || phase === 'vote-result')
                  ? (actionPrompt?.validTargets || alivePlayers.map((p) => p.id))
                  : []}
                voteCounts={(() => {
                  const tally = gameState?.voteTally;
                  if (tally && typeof tally === 'object' && !Array.isArray(tally)) return tally;
                  const dv = gameState?.dayVotes;
                  if (!dv) return {};
                  const counts = {};
                  const entries = dv instanceof Map ? [...dv.values()] : Object.values(dv || {});
                  entries.forEach((vote) => {
                    const targetId = typeof vote === 'string' ? vote : vote?.target;
                    if (!targetId) return;
                    counts[targetId] = (counts[targetId] || 0) + 1;
                  });
                  return counts;
                })()}
                onVoteSubmit={(targetId) => {
                  socket.emit('game:action', { type: 'vote', targetId });
                  setActionStatus('Голос отправлен');
                }}
                votedCount={mafiaVotedCount}
                totalVoters={mafiaTotalVoters}
                investigationLog={mafiaInvestigationLog}
                mafiaMates={gameState?.mafiaMates || []}
                gameStats={mafiaGameStats}
                speakingPlayerId={speakingTurn?.playerId || null}
              />
            </div>
          </GameLayoutWrapper>
        )}
        {room.gameType === 'mafia' && room.status !== 'waiting' && phase === 'intro' && (
          <div className="game-area" style={{ marginTop: 18 }}>
            <div className="phase">🎙️ Вступление</div>
            <div style={{ opacity: 0.9 }}>
              Ведущий даёт вводные и предлагает каждому коротко представиться (имя, стиль игры, договорённости).
            </div>
            {isHost && (
              <div style={{ marginTop: 10, opacity: 0.9 }}>
                {room.settings?.options?.aiGameMaster
                  ? 'ИИ ведёт игру. Таймеры сменяют фазы автоматически.'
                  : 'Когда готовы — жмите «Следующая фаза» в панели ведущего.'}
              </div>
            )}
          </div>
        )}

        {room.status === 'waiting' && (
          room.gameType === 'mafia' ? (
            <section className="mafia-setup-stage">
              <div className="mafia-setup-stage__media" aria-hidden="true">
                <div className="mafia-setup-stage__smoke" />
                <img
                  alt=""
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAZ9UbtHHN-eoU7HmXTS-oM7VmVOjbe0EHx6JE9wGMWXR3D93WE619k0Yk1Ufnzc4nTWAEgVceFvGZX_ck3fAjvNHWpw1T_ulUDf5TPws0JS9WTufrZ_tHxzCQkwMkCoNIRbgktiQ6rSU7nPmvqqYthNGMBoFZexM0OuFtUXA_3CP3EQJgOH406FHWR0Nv1P4UqyvEZbeT9s-DRg_tx5LXx5qpEeXxd2Az3rxeVCJpuqfBCRnI8h2tVG3gUora7sfp-uGoEAWxhy-U"
                />
              </div>
              <div className="mafia-setup-stage__panel">
                <button
                  type="button"
                  className="mafia-setup-close"
                  onClick={leaveRoomAndGoHome}
                  aria-label="Выйти в меню"
                >
                  ✕
                </button>

                <div className="mafia-setup-head">
                  <p>Настройка сессии</p>
                  <h2>
                    МАФИЯ: <span>ПАРАМЕТРЫ ИГРЫ</span>
                  </h2>
                </div>

                <div className="mafia-setup-card">
                  <div className="mafia-setup-row">
                    <strong>Количество игроков</strong>
                    <span>{mafiaTargetPlayers}</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={Math.min(12, room?.maxPlayers || 12)}
                    value={mafiaTargetPlayers}
                    disabled={!isHost}
                    onChange={(e) =>
                      socket.emit('room:update-settings', { targetPlayerCount: Number(e.target.value) || 6 })
                    }
                  />
                  <div className="mafia-setup-scale">
                    {[4, 6, 8, 10, 12].map((n) => (
                      <span key={n}>{n}</span>
                    ))}
                  </div>
                </div>

                <div className="mafia-setup-grid">
                  <label className="mafia-setup-card mafia-setup-card--toggle">
                    <div>
                      <strong>ИИ-ведущий</strong>
                      <p>Нарратив и логика игры</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={mafiaSetupAiEnabled}
                      disabled={!isHost}
                      onChange={(e) =>
                        socket.emit('room:update-settings', { options: { aiGameMaster: e.target.checked } })
                      }
                    />
                  </label>

                  <button
                    type="button"
                    className="mafia-setup-card mafia-setup-card--action"
                    onClick={() => setMafiaSetupDetailsOpen((prev) => !prev)}
                    disabled={!isHost}
                  >
                    <div>
                      <strong>Роли и таймеры</strong>
                      <p>Распределение карт</p>
                    </div>
                    <span>{mafiaSetupDetailsOpen ? '▾' : '▸'}</span>
                  </button>
                </div>

                {mafiaSetupDetailsOpen && (
                  <div className="mafia-setup-card mafia-setup-details">
                    <label>
                      Таймер ночи (сек)
                      <input
                        type="number"
                        min={20}
                        max={180}
                        value={mafiaNightTimer}
                        disabled={!isHost}
                        onChange={(e) =>
                          socket.emit('room:update-settings', {
                            timers: { night: Math.min(180, Math.max(20, Number(e.target.value) || 60)) },
                          })
                        }
                      />
                    </label>
                    <label>
                      Таймер голосования (сек)
                      <input
                        type="number"
                        min={20}
                        max={180}
                        value={mafiaVotingTimer}
                        disabled={!isHost}
                        onChange={(e) =>
                          socket.emit('room:update-settings', {
                            timers: { voting: Math.min(180, Math.max(20, Number(e.target.value) || 60)) },
                          })
                        }
                      />
                    </label>
                    <label>
                      Количество мафии
                      <input
                        type="number"
                        min={1}
                        max={3}
                        value={mafiaCount}
                        disabled={!isHost}
                        onChange={(e) =>
                          socket.emit('room:update-settings', {
                            roles: { mafia: Math.min(3, Math.max(1, Number(e.target.value) || 1)) },
                          })
                        }
                      />
                    </label>
                  </div>
                )}

                <div className="mafia-setup-note">
                  Система берет на себя все расчеты и таймеры. При включенном ИИ команды будут озвучены синтезом речи.
                </div>

                {isHost ? (
                  <button
                    className="mafia-setup-start"
                    data-testid="start-game-btn"
                    onClick={startGame}
                  >
                    Начать игру ▶
                  </button>
                ) : (
                  <p className="mafia-setup-waiting">Ожидаем, пока хост запустит игру...</p>
                )}

                <div className="nickname-change">
                  <div className="nickname-row">
                    <div className="lobby-nickname-frame room-nickname-frame">
                      <input
                        className="lobby-nickname-input"
                        value={newNickname}
                        onChange={(e) => setNewNickname(e.target.value)}
                        maxLength={20}
                        placeholder="Ваш ник"
                        autoComplete="nickname"
                      />
                    </div>
                    <button type="button" className="btn btn-sm" onClick={changeNickname}>
                      Сменить
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : (
          <div className="game-area" style={{ textAlign: 'center' }}>
            {room.gameType === 'mafia' && room.hostId === socket.id && (
              <div style={{ marginBottom: 16, textAlign: 'left', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!room.settings?.options?.aiGameMaster}
                    onChange={(e) => {
                      socket.emit('room:update-settings', { options: { aiGameMaster: e.target.checked } });
                    }}
                  />
                  <span>🎙 ИИ ведущий — играть как игрок</span>
                </label>
                <p style={{ margin: '4px 0 0 24px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {room.settings?.options?.aiGameMaster
                    ? 'ИИ ведёт игру — вы получаете роль и играете наравне с остальными.'
                    : 'Вы человек-ведущий: карту не получаете, в состав не входите; нужно минимум 4 игрока за столом без учёта вас.'}
                </p>
                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Таймер ночи (сек)</span>
                    <input
                      type="number"
                      min={20}
                      max={180}
                      defaultValue={room.settings?.timers?.night ?? 60}
                      onBlur={(e) => socket.emit('room:update-settings', { timers: { night: Number(e.target.value) || 60 } })}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Таймер голосования (сек)</span>
                    <input
                      type="number"
                      min={20}
                      max={180}
                      defaultValue={room.settings?.timers?.voting ?? 60}
                      onBlur={(e) => socket.emit('room:update-settings', { timers: { voting: Number(e.target.value) || 60 } })}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Количество мафии</span>
                    <input
                      type="number"
                      min={1}
                      max={3}
                      defaultValue={room.settings?.roles?.mafia ?? 1}
                      onBlur={(e) => socket.emit('room:update-settings', { roles: { mafia: Number(e.target.value) || 1 } })}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={sfxEnabled}
                      onChange={(e) => setSfxEnabled(e.target.checked)}
                    />
                    <span>Звуковые уведомления</span>
                  </label>
                </div>
              </div>
            )}
            {room.gameType === 'story' && room.hostId === socket.id && (
              <div style={{ marginBottom: 16, textAlign: 'left', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!room.settings?.noTimeLimit}
                    onChange={(e) => {
                      socket.emit('room:update-settings', { noTimeLimit: e.target.checked });
                    }}
                  />
                  <span>⏳ Без времени — следующий сразу после отправки</span>
                </label>
                <p style={{ margin: '4px 0 0 24px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Таймер отключён: ход переходит к следующему, как только игрок отправит предложение
                </p>
              </div>
            )}
            {room.gameType === 'quiz' && room.hostId === socket.id && (
              <div className="quiz-host-pack">
                <div className="quiz-host-pack-title">Свои вопросы (.txt, до 10 МБ)</div>
                <p className="quiz-host-pack-desc">
                  Загрузите файл <strong>до начала игры</strong>. Каждый вопрос — блок из 6 строк, блоки разделяйте строкой <code>---</code>. Строки с <code>#</code> в начале игнорируются.
                </p>
                <pre className="quiz-host-pack-sample" aria-label="Пример формата">
{`Какой океан самый большой?
Тихий
Атлантический
Индийский
Северный Ледовитый
correct:0
---
Столица Франции?
Лион
Марсель
Париж
Ницца
correct:2`}
                </pre>
                <label className="quiz-host-pack-file">
                  <span className="btn btn-sm">Выбрать .txt</span>
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    className="quiz-host-pack-file-input"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      if (f.size > 10 * 1024 * 1024) {
                        toast.error('Файл больше 10 МБ');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        const text = typeof reader.result === 'string' ? reader.result : '';
                        socket.emit('room:quiz-upload', { text }, (res) => {
                          if (res?.success) toast.success(`Загружено вопросов: ${res.count}`);
                          else toast.error(res?.error || 'Не удалось разобрать файл');
                        });
                      };
                      reader.onerror = () => toast.error('Не удалось прочитать файл');
                      reader.readAsText(f, 'UTF-8');
                    }}
                  />
                </label>
                {typeof room.settings?.quizCustomQuestionCount === 'number' && room.settings.quizCustomQuestionCount > 0 ? (
                  <p className="quiz-host-pack-status">
                    В пакете: <strong>{room.settings.quizCustomQuestionCount}</strong> вопросов
                    <button
                      type="button"
                      className="btn btn-sm quiz-host-pack-clear"
                      onClick={() => {
                        socket.emit('room:quiz-clear-custom', {}, (res) => {
                          if (res?.success) toast.info('Свой набор сброшен, будет стандартная база');
                          else toast.error(res?.error || 'Не удалось сбросить');
                        });
                      }}
                    >
                      Сбросить
                    </button>
                  </p>
                ) : (
                  <p className="quiz-host-pack-status muted">Сейчас — стандартная база вопросов</p>
                )}
              </div>
            )}
            {room.gameType === 'crossword' && room.hostId === socket.id && (
              <div
                className="quiz-host-pack"
                style={{ maxWidth: crosswordHostMode === 'corporate' ? 560 : 480, margin: '0 auto 20px', textAlign: 'left' }}
              >
                <div className="quiz-host-pack-title">Сканворд: слова и подсказки</div>
                <p className="quiz-host-pack-desc" style={{ marginBottom: 8 }}>
                  {crosswordHostMode === 'corporate' ? (
                    <>
                      <strong>Корпоратив:</strong> одно поле для всех, минимум 2 игрока. Очки за слово — всей комнате.
                      Оставьте поле ниже пустым: сервер <strong>сам подберёт {CROSSWORD_CORPORATE_WORD_COUNT} слов</strong> из
                      базы и <strong>расставит</strong> их на сетке с <strong>готовыми вопросами</strong>. Либо вставьте свои{' '}
                      {CROSSWORD_CORPORATE_WORD_COUNT} уникальных слов.
                    </>
                  ) : (
                    <>
                      <strong>Автогенерация:</strong> пустое поле — сервер выбирает слова из встроенной базы, составляет
                      пересечения и подставляет <strong>подсказки-вопросы</strong>. Свой список (2–60 строк) перекрывает
                      автоматику: сетка строится из ваших слов; подсказка — текст после «|» или авто-текст.
                    </>
                  )}
                </p>
                <textarea
                  className="generic-input"
                  rows={crosswordHostMode === 'corporate' ? 14 : 10}
                  value={crosswordWordsInput}
                  onChange={(e) => setCrosswordWordsInput(e.target.value)}
                  placeholder={'КОТ\nЛОМ\nОКЕАН | Большой водоём\nРОК'}
                  style={{ width: '100%', minHeight: crosswordHostMode === 'corporate' ? 280 : 200, resize: 'vertical', fontFamily: 'inherit' }}
                />
                <p className="quiz-host-pack-desc muted" style={{ marginTop: 8, fontSize: '0.8rem' }}>
                  {crosswordHostMode === 'corporate' ? (
                    <>
                      Свой список: ровно {CROSSWORD_CORPORATE_WORD_COUNT} строк, слова не повторяются. Формат:{' '}
                      <code>СЛОВО</code> или <code>СЛОВО | подсказка</code>. Кириллица, 2–14 букв.
                    </>
                  ) : (
                    <>
                      По одному слову в строке. Формат: <code>СЛОВО | текст подсказки</code>. 2–60 слов, 2–14 букв,
                      пересечения по общим буквам.
                    </>
                  )}
                </p>
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem' }}>
                    Режим
                    <select
                      className="generic-input"
                      value={crosswordHostMode}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCrosswordHostMode(v);
                        if (v === 'corporate') setCrosswordAutoWordCount(CROSSWORD_CORPORATE_WORD_COUNT);
                      }}
                      style={{ minWidth: 200 }}
                    >
                      <option value="coop">Совместно — одна сетка, +10 всем за слово</option>
                      <option value="corporate">
                        Корпоратив — большое поле, {CROSSWORD_CORPORATE_WORD_COUNT} слов, мин. 2 игрока
                      </option>
                      <option value="race">Гонка — 2+ игроков, слово только первому</option>
                      <option value="duel">Дуэль 1×1 — ровно 2 игрока, слово первому</option>
                      <option value="solo_race">Соло на время</option>
                      <option value="solo_casual">Соло без таймера</option>
                    </select>
                  </label>
                  {crosswordHostMode !== 'solo_casual' && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem' }}>
                      Минут на партию
                      <input
                        className="generic-input"
                        type="number"
                        min={1}
                        max={240}
                        value={crosswordRoundMin}
                        onChange={(e) => setCrosswordRoundMin(Number(e.target.value) || 5)}
                        style={{ width: 88 }}
                      />
                    </label>
                  )}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem' }}>
                    Слов при автогенерации
                    <select
                      className="generic-input"
                      value={crosswordAutoWordCount}
                      onChange={(e) => setCrosswordAutoWordCount(Number(e.target.value) || 18)}
                      style={{ minWidth: 120 }}
                      disabled={
                        String(crosswordWordsInput || '')
                          .split('\n')
                          .map((l) => l.trim())
                          .filter(Boolean).length >= 2
                      }
                    >
                      {CROSSWORD_AUTO_SIZE_PRESETS.map((n) => (
                        <option key={n} value={n}>
                          {n} слов
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {String(crosswordWordsInput || '')
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean).length >= 2 && (
                  <p className="quiz-host-pack-desc muted" style={{ marginTop: 8, fontSize: '0.8rem' }}>
                    Указан свой список — число «при автогенерации» не используется.
                  </p>
                )}
              </div>
            )}
            {GAME_LOBBY_INFO[room.gameType] && (
              <div className="lobby-game-info-card">
                <span className="lobby-game-info-emoji">{GAME_LOBBY_INFO[room.gameType].emoji}</span>
                <p className="lobby-game-info-desc">{GAME_LOBBY_INFO[room.gameType].desc}</p>
              </div>
            )}
            {room.hostId === socket.id && (
              <button className="btn btn-primary-action" data-testid="start-game-btn" onClick={startGame}>
              Начать игру
            </button>
          )}
            {room.hostId !== socket.id && (
              <p style={{ color: 'var(--text-muted)' }}>Ожидаем, пока хост запустит игру...</p>
            )}
            <div className="nickname-change">
              <div className="nickname-row">
                <div className="lobby-nickname-frame room-nickname-frame">
                  <input
                    className="lobby-nickname-input"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    maxLength={20}
                    placeholder="Ваш ник"
                    autoComplete="nickname"
                  />
                </div>
                <button type="button" className="btn btn-sm" onClick={changeNickname}>
                  Сменить
                </button>
              </div>
            </div>
          </div>
          )
        )}

        <div className="room-side-stack">
        <div className="players">
          {room.players.map((p) => {
            const mafiaP = mafiaPlayers.find((x) => x.id === p.id);
            return (
            <div key={p.id} className={`player ${p.id === socket.id ? 'active' : ''} ${!p.isOnline ? 'disconnected' : ''}`}>
                <div className="player-avatar">{p.name[0]}</div>
              <span>{p.name}</span>
              {p.id === room.hostId && <span title="Хост"> 👑</span>}
                {mafiaP?.role ? (
                  <span className={`role-badge ${mafiaP.role}`}>{mafiaP.role}</span>
                ) : mafiaP && room?.gameType === 'mafia' && room?.status !== 'waiting' ? (
                  <span className="role-badge role-hidden">???</span>
                ) : null}
                {mafiaP?.status === 'dead' && <span className="role-badge dead">мёртв</span>}
                {!p.isOnline && <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: 4 }}>оффлайн</span>}
            </div>
            );
          })}
        </div>

        </div>

        {room.gameType === 'hat' &&
          (room.status !== 'waiting' || (phase === 'gameOver' && hatScoreboard?.teams?.length)) && (
          <GameLayoutWrapper
            gameType="hat"
            room={room}
            socket={socket}
            players={players}
           
          >
            <div className={`game-area hat-game ${phase === 'gameOver' ? 'hat-game--postgame' : ''}`}>
              <div className="game-area-title">
                Шляпа{phase === 'gameOver' && hatScoreboard?.gameOver ? ' · итоги' : ''}
              </div>
              <GameRulesDisclosure>
                <GameRulesBulletList items={getStaticHelp('hat').bullets} />
              </GameRulesDisclosure>
              {hatScoreboard?.teams?.length > 0 && (
                <div className="hat-scoreboard" aria-label="Счёт в шляпе">
                  <div className="hat-scoreboard__head">
                    <span className="hat-scoreboard__title">Очки</span>
                    {typeof hatScoreboard.gameRound === 'number' && !hatScoreboard.gameOver && (
                      <span className="hat-scoreboard__meta">Круг {hatScoreboard.gameRound}</span>
                    )}
                  </div>
                  <div className="hat-scoreboard__grid">
                    {hatScoreboard.teams.map((t) => {
                      const isTurn = !hatScoreboard.gameOver && hatScoreboard.currentTeam === t.teamId;
                      const isMyTeam = hatMyTeamId === t.teamId;
                      const isWinner =
                        hatScoreboard.gameOver &&
                        hatBestTeamTotal > 0 &&
                        (t.teamTotal ?? 0) === hatBestTeamTotal;
                      return (
                        <div
                          key={t.teamId}
                          className={`hat-score-team ${isTurn ? 'hat-score-team--turn' : ''} ${isMyTeam ? 'hat-score-team--mine' : ''} ${isWinner ? 'hat-score-team--winner' : ''}`}
                        >
                          <div className="hat-score-team__header">
                            <span className="hat-score-team__name">Команда {t.teamId + 1}</span>
                            <span className="hat-score-team__total" title="Сумма личных очков команды">
                              {t.teamTotal ?? 0}
                            </span>
                          </div>
                          <ul className="hat-score-team__players">
                            {(t.players || []).map((p) => (
                              <li
                                key={p.id}
                                className={`hat-score-player ${p.id === socket.id ? 'hat-score-player--self' : ''}`}
                              >
                                <span className="hat-score-player__name">{p.name || 'Игрок'}</span>
                                <span className="hat-score-player__pts">{p.score ?? 0}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                  {typeof hatScoreboard.pointsToWin === 'number' && hatScoreboard.pointsToWin > 0 && (
                    <div className="hat-scoreboard__goal" aria-label="До победы">
                      <span className="hat-scoreboard__goal-label">До победы</span>
                      {hatScoreboard.teams.map((t) => {
                        const cap = hatScoreboard.pointsToWin;
                        const val = t.teamTotal ?? 0;
                        const pct = Math.min(100, Math.round((val / cap) * 100));
                        return (
                          <div key={`g-${t.teamId}`} className="hat-goal-row">
                            <span className="hat-goal-row__lab">К{t.teamId + 1}</span>
                            <div className="hat-goal-row__track">
                              <div className="hat-goal-row__fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="hat-goal-row__nums">
                              {val}/{cap}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!hatScoreboard.gameOver &&
                    hatScoreboard.currentTeam != null &&
                    room.status !== 'waiting' && (
                      <div className="hat-scoreboard__footer">
                        <span className="hat-scoreboard__turn">
                          Ход команды <strong>{hatScoreboard.currentTeam + 1}</strong>
                        </span>
                        {typeof hatScoreboard.roundScore === 'number' && (
                          <span className="hat-scoreboard__round-words">
                            Слов в этом раунде: <strong>{hatScoreboard.roundScore}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  <p className="hat-scoreboard__legend">
                    За угаданное слово: <strong>+1</strong> объясняющему.
                    {hatScoreboard.skipPenaltyActive ? (
                      <> Пропуск слова: <strong>−1</strong> каждому в команде (не ниже 0).</>
                    ) : null}
                  </p>
                </div>
              )}
              {room.status !== 'waiting' && phase !== 'gameOver' && !hatSubmitted && (
                <div className="hat-words-section hat-words-card">
                  <p className="hat-instruction">Добавьте 3 слова (через запятую или с новой строки)</p>
                  <textarea
                    className="hat-words-input"
                    value={hatWordsInput}
                    onChange={(e) => setHatWordsInput(e.target.value)}
                    rows={3}
                    placeholder="Например: стол, стул, лампа"
                  />
                  <Button variant="secondary" size="sm" onClick={submitHatWords}>
                    Отправить слова
                  </Button>
                </div>
              )}
              {room.status !== 'waiting' && phase !== 'gameOver' && (
                <>
                  <div className="hat-status-bar">
                    <span className="hat-status-pill">
                      Раунд <strong>{hatRoundInfo?.team != null ? hatRoundInfo.team + 1 : '—'}</strong>
                    </span>
                    <span className={`hat-status-pill hat-timer-pill ${hatTimer <= 10 && hatTimer > 0 ? 'hat-timer-pill--urgent' : ''}`}>
                      ⏱ {hatTimer}s
                    </span>
                    <span className="hat-panic-hint" title="Скрыть слово от посторонних глаз">
                      Пробел — паника
                    </span>
                  </div>
                  {hatPanicMode && (
                    <div className="hat-panic-indicator" role="status" aria-live="polite">
                      🔒 Режим паники
                    </div>
                  )}
                  {hatRoundSummary && (
                    <div className="hat-round-summary" role="status" aria-live="polite">
                      <span className="hat-round-summary__icon">🎩</span>
                      <span className="hat-round-summary__text">
                        Раунд завершён — Команда {(hatRoundSummary.team ?? 0) + 1} угадала{' '}
                        <strong>{hatRoundSummary.score}</strong>{' '}
                        {hatRoundSummary.score === 1 ? 'слово' : hatRoundSummary.score < 5 ? 'слова' : 'слов'}
                      </span>
                    </div>
                  )}
                  {hatIsExplainer ? (
                    <div className={`hat-explainer-card ${hatTimer <= 10 && hatTimer > 0 ? 'hat-explainer-card--urgent' : ''}`}>
                      <div className="hat-explainer-card__inner">
                        <div className="hat-word-label">Ваше слово</div>
                        <div className={`hat-word-display ${hatPanicMode ? 'hat-word-display--panic' : ''}`}>
                          {hatWord || 'Ждём слово...'}
                        </div>
                        <p className="hat-manual-guess-hint">
                          Кто угадал? Нажмите имя игрока — засчитается угадывание.
                        </p>
                        {Array.isArray(hatRoundInfo?.guessCandidates) && hatRoundInfo.guessCandidates.length > 0 ? (
                          <div className="hat-guess-candidates" role="group" aria-label="Кто угадал слово">
                            {hatRoundInfo.guessCandidates.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                className="hat-guess-chip"
                                disabled={hatConfirmInFlight}
                                onClick={() => confirmHatGuess(c.id)}
                              >
                                <span className="hat-guess-chip__mark" aria-hidden>✓</span>
                                {c.name || 'Игрок'}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="hat-guess-empty">
                            В команде нет других игроков онлайн — ожидается подтверждение вручную.
                          </p>
                        )}
                        <div className="hat-actions-row">
                          <SecondaryButton onClick={skipHatWord} className="hat-skip-btn">
                            Пропустить слово
                          </SecondaryButton>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="hat-guesser-card">
                      <p className="hat-explainer-hint">
                        Сейчас объясняет: <strong>{hatRoundInfo?.explainerName || '—'}</strong>
                      </p>
                      <p className="hat-guesser-tip">
                        Назовите слово вслух — ведущий подтвердит угадывание.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </GameLayoutWrapper>
        )}

        {room.gameType === 'associations' && room.status !== 'waiting' && (
          <div className="game-area assoc-game">
            <div className="game-area-title">Ассоциации</div>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('associations').bullets} />
            </GameRulesDisclosure>
            {!assocSubmitted && (
              <div className="assoc-words-section">
                <p className="assoc-instruction">Добавьте 3 слова (через запятую или с новой строки)</p>
                <textarea
                  className="assoc-words-input"
                  value={assocWordsInput}
                  onChange={(e) => setAssocWordsInput(e.target.value)}
                  rows={3}
                  placeholder="Например: кошка, собака, птица"
                />
                <Button variant="secondary" size="sm" onClick={submitAssociationsWords}>
                  Отправить слова
                </Button>
              </div>
            )}
            {assocTurn && (
              <div className="assoc-status">
                <span className="assoc-status-item">Ход: <strong>{assocTurn.player?.name || '—'}</strong></span>
                <span className="assoc-status-sep">·</span>
                <span className="assoc-status-item">Слово: <strong className="assoc-current-word">{assocTurn.previousWord || '—'}</strong></span>
                {assocTurn.endWord && (
                  <>
                    <span className="assoc-status-sep">→</span>
                    <span className="assoc-status-item assoc-end-word">Финиш: <strong>{assocTurn.endWord}</strong></span>
                  </>
                )}
              </div>
            )}
            {assocTurn?.player?.id === socket.id && (
              <div className="assoc-input-row">
                <input 
                  className="assoc-input"
                  value={assocWordInput} 
                  onChange={(e) => setAssocWordInput(e.target.value)} 
                  placeholder="Ваша ассоциация" 
                />
                <Button variant="primary" size="sm" onClick={submitAssociationWord}>
                  Отправить
                </Button>
              </div>
            )}
            {(assocVoting || assocLastResult) && (
              <div className="assoc-voting-block">
                <div className={`assoc-cards-scene ${assocLastResult ? (assocLastResult.valid ? 'match' : 'difference') : ''}`}>
                  <div className="assoc-card selected">
                    <div className="assoc-card-inner">{(assocVoting?.link || assocLastResult?.link)?.previousWord || '—'}</div>
                  </div>
                  <div className={`assoc-link-line ${assocLastResult && !assocLastResult.valid ? 'bounce' : ''}`}>
                    <svg viewBox="0 0 60 4" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="assoc-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="rgba(120,80,255,0.9)" />
                          <stop offset="100%" stopColor="rgba(0,245,212,0.9)" />
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="2" x2="60" y2="2" />
                    </svg>
                  </div>
                  <div className="assoc-card selected">
                    <div className="assoc-card-inner">{(assocVoting?.link || assocLastResult?.link)?.word || '—'}</div>
                  </div>
                </div>
                {!assocLastResult && (
                  <>
                    <div className="assoc-vote-prompt">Связь корректна?</div>
                    <div className="assoc-vote-cards">
                      <div
                        className={`assoc-vote-card ${assocVoteChoice === true ? 'selected yes' : ''}`}
                        onClick={() => voteAssociation(true)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && voteAssociation(true)}
                      >
                        <div className="assoc-vote-card-inner">Связано</div>
                      </div>
                      <div
                        className={`assoc-vote-card ${assocVoteChoice === false ? 'selected no' : ''}`}
                        onClick={() => voteAssociation(false)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && voteAssociation(false)}
                      >
                        <div className="assoc-vote-card-inner">Не связано</div>
                      </div>
                    </div>
                  </>
                )}
                {assocLastResult && (
                  <div className={`assoc-result-banner ${assocLastResult.valid ? 'assoc-result-banner--ok' : 'assoc-result-banner--bad'}`}>
                    {assocLastResult.valid ? '✓ Связь принята' : '✗ Связь отклонена'}
                  </div>
                )}
              </div>
            )}
            <GameScoreboardBlock rows={assocScoreRows} legend={getStaticHelp('associations').scoreLegend} />
          </div>
        )}

        {isCrocodileDrawGame(room.gameType) && room.status !== 'waiting' && (
          isCrocodileLuxeMode ? (
            <div className="game-area croc-game croc-luxe-main room-page__croc-luxe-main">
              {isCrocodileLuxeMode && crocTurn?.explainerId !== socket.id && (crocTurn?.wordPattern || crocTurn?.wordLength > 0) && (
                <div className="croc-letter-banner" role="status">
                  <span className="croc-letter-banner__label">Букв в слове:</span>
                  <strong>{crocTurn.wordLength ?? crocTurn.word?.replace(/ /g, '').length ?? '?'}</strong>
                  {crocTurn.wordPattern && (
                    <span className="croc-letter-banner__pattern">{crocTurn.wordPattern}</span>
                  )}
                </div>
              )}
              {crocTimeoutWord && (
                <div className="croc-timeout-reveal" role="status" aria-live="polite">
                  <span className="croc-timeout-reveal__icon">⏰</span>
                  <span className="croc-timeout-reveal__label">Время вышло! Слово было:</span>
                  <span className="croc-timeout-reveal__word">{crocTimeoutWord}</span>
                </div>
              )}
              {crocTransition ? (
                <div className="croc-transition">
                  <div className="croc-transition-label">Следующий ход</div>
                  <div className="croc-transition-name">{crocTransition.name}</div>
                </div>
              ) : crocWordChoices?.choices?.length > 0 ? (
                <div className="croc-word-choices">
                  <p className="croc-word-choices-label">
                    Выберите слово для рисования
                    {crocSelectionDeadline > 0 && (
                      <CrocSelectionCountdown deadline={crocSelectionDeadline} />
                    )}
                  </p>
                  <div className="croc-word-choices-buttons">
                    {crocWordChoices.choices.map((word, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="croc-word-choice"
                        onClick={() => {
                          socket.emit('crocodile:select-word', idx, (res) => {
                            if (res?.success) setCrocWordChoices(null);
                            else toast.error(res?.error || 'Не удалось выбрать слово');
                          });
                        }}
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="croc-canvas-wrapper">
                  <CrocodileCanvas
                    isExplainer={crocTurn?.explainerId === socket.id}
                    className="croc-luxe-canvas"
                    strokes={crocStrokes}
                    onDraw={(stroke) => {
                      setCrocStrokes((prev) => [...prev, stroke]);
                      socket.emit('crocodile:draw', stroke);
                    }}
                    onClear={() => {
                      setCrocStrokes([]);
                      socket.emit('crocodile:clear');
                    }}
                    onUndo={() => {
                      setCrocStrokes((prev) => prev.slice(0, -1));
                      socket.emit('crocodile:undo');
                    }}
                  />
                </div>
              )}
              {crocMyWord && crocTurn?.explainerId === socket.id && (
                <div className="croc-word-section croc-word-section--luxe">
                  <div className="croc-word-label">Ваше слово</div>
                  <div className="croc-word">{crocMyWord}</div>
                </div>
              )}
            </div>
          ) : (
          <GameLayoutWrapper
            gameType={room.gameType}
            room={room}
            socket={socket}
            players={players}
          >
            <div className="game-area croc-game">
              <>
                <div className="game-area-title">{crocodileFamilyTitle(room.gameType)}</div>
                <GameRulesDisclosure>
                  <GameRulesBulletList items={getStaticHelp(room.gameType).bullets} />
                </GameRulesDisclosure>
              </>
              <div className="croc-explainer-strip">
                <span className="croc-explainer-label">Объясняет</span>
                <strong className="croc-explainer-name">{crocTurn?.explainerName || '—'}</strong>
                {crocTurn?.maxRounds > 0 && (
                  <span className="croc-round-badge">Ход {crocTurn.round} / {crocTurn.maxRounds}</span>
                )}
                <span className={`croc-timer${crocTimer > 0 && crocTimer <= 10 ? ' croc-timer--urgent' : ''}`}>
                  ⏱ {crocTimer}s
                </span>
              </div>
              {crocTimeoutWord && (
                <div className="croc-timeout-reveal" role="status" aria-live="polite">
                  <span className="croc-timeout-reveal__icon">⏰</span>
                  <span className="croc-timeout-reveal__label">Время вышло! Слово было:</span>
                  <span className="croc-timeout-reveal__word">{crocTimeoutWord}</span>
                </div>
              )}
              {crocTransition ? (
                <div className="croc-transition">
                  <div className="croc-transition-label">Следующий ход</div>
                  <div className="croc-transition-name">{crocTransition.name}</div>
                </div>
              ) : crocWordChoices?.choices?.length > 0 ? (
                <div className="croc-word-choices">
                  <p className="croc-word-choices-label">
                    Выберите слово для рисования
                    {crocSelectionDeadline > 0 && (
                      <CrocSelectionCountdown deadline={crocSelectionDeadline} />
                    )}
                  </p>
                  <div className="croc-word-choices-buttons">
                    {crocWordChoices.choices.map((word, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="croc-word-choice"
                        onClick={() => {
                          socket.emit('crocodile:select-word', idx, (res) => {
                            if (res?.success) setCrocWordChoices(null);
                            else toast.error(res?.error || 'Не удалось выбрать слово');
                          });
                        }}
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="croc-canvas-wrapper">
                  <CrocodileCanvas
                    isExplainer={crocTurn?.explainerId === socket.id}
                    className={isCrocodileLuxeMode ? 'croc-luxe-canvas' : ''}
                    strokes={crocStrokes}
                    onDraw={(stroke) => {
                      setCrocStrokes((prev) => [...prev, stroke]);
                      socket.emit('crocodile:draw', stroke);
                    }}
                    onClear={() => {
                      setCrocStrokes([]);
                      socket.emit('crocodile:clear');
                    }}
                    onUndo={() => {
                      setCrocStrokes((prev) => prev.slice(0, -1));
                      socket.emit('crocodile:undo');
                    }}
                  />
                </div>
              )}
              {crocMyWord ? (
                <div className="croc-word-section">
                  <div className="croc-word-label">Ваше слово</div>
                  <div className="croc-word">{crocMyWord}</div>
                  {crocTurn?.explainerId === socket.id && (
                    <div className="croc-confirm-section">
                      <div className="croc-confirm-hint">Кто угадал? Нажмите имя игрока:</div>
                      <div className="croc-confirm-buttons">
                        {players.filter((p) => p.id !== socket.id && !p.isSpectator).map((p) => {
                          const already = crocGuessedIds.has(p.id);
                          const inFlight = crocConfirmingIds.has(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className="croc-confirm-chip"
                              disabled={already || inFlight}
                              onClick={() => {
                                setCrocConfirmingIds((prev) => new Set(prev).add(p.id));
                                socket.emit('crocodile:manual-confirm', { guesserId: p.id }, (res) => {
                                  setCrocConfirmingIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(p.id);
                                    return next;
                                  });
                                  if (!res?.success) toast.error(res?.error || 'Не удалось засчитать');
                                });
                              }}
                            >
                              {already ? '✓✓' : '✓'} {p.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="croc-hint">
                  Называйте слово вслух — рисующий подтвердит правильный ответ.
                  {crocTurn?.word && (
                    <span className="croc-hint__letters">
                      {' '}
                      {crocTurn.word.split('').map((ch, i) =>
                        ch === ' ' ? <span key={i} className="croc-hint__space" /> : <span key={i} className="croc-hint__dash">_</span>
                      )}
                      {' '}({crocTurn.word.replace(/ /g, '').length} букв)
                    </span>
                  )}
                </div>
              )}
              {!isCrocodileLuxeMode && (
                <GameScoreboardBlock rows={crocScoreRows} legend={getStaticHelp(room.gameType).scoreLegend} />
              )}
            </div>
          </GameLayoutWrapper>
          )
        )}

        {/* Alias — объясни слово без однокоренных */}
        {room.gameType === 'alias' && room.status !== 'waiting' && (
          <GameLayoutWrapper
            gameType="alias"
            room={room}
            socket={socket}
            players={players}
           
          >
            <div className="game-area alias-game">
              <div className="alias-header">
                <div className="game-area-title">Элиас</div>
                {crocTurn?.round != null && crocTurn?.maxRounds != null && (
                  <div className="alias-round-badge">Раунд {crocTurn.round} / {crocTurn.maxRounds}</div>
                )}
              </div>
              <GameRulesDisclosure>
                <GameRulesBulletList items={getStaticHelp('alias').bullets} />
              </GameRulesDisclosure>

              <div className="alias-explainer-strip">
                <span className="alias-explainer-label">Объясняет</span>
                <strong className="alias-explainer-name">{crocTurn?.explainerName || '—'}</strong>
                <span className={`alias-timer${crocTimer > 0 && crocTimer <= 10 ? ' alias-timer--urgent' : ''}`}>
                  ⏱ {crocTimer}s
                </span>
              </div>

              {aliasTransition ? (
                <div className="alias-transition">
                  <div className="alias-transition-label">Следующий ход</div>
                  <div className="alias-transition-name">{aliasTransition.name}</div>
                </div>
              ) : crocMyWord ? (
                <>
                  <div className="alias-word-card">
                    <div className="alias-word-label">Ваше слово</div>
                    <div className="alias-word-text">{crocMyWord}</div>
                    <div className="alias-word-hint">Объясняйте без однокоренных слов</div>
                  </div>
                  <div className="alias-confirm-block">
                    <p className="alias-confirm-hint">Кто угадал? Нажмите имя игрока:</p>
                    <div className="alias-guess-candidates">
                      {players.filter((p) => p.id !== socket.id && !p.isSpectator).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="alias-guess-chip"
                          disabled={aliasGuessSending}
                          onClick={() => {
                            setAliasGuessSending(true);
                            socket.emit('game:action', { type: 'confirm-guess', guesserId: p.id }, (res) => {
                              if (res && !res.success) {
                                setAliasGuessSending(false);
                                toast.error(res.error || 'Не удалось засчитать');
                              }
                            });
                          }}
                        >
                          ✓ {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="alias-guesser-hint">
                  <span className="alias-guesser-icon">💬</span>
                  <span>Назовите слово вслух — объясняющий подтвердит угадывание.</span>
                </div>
              )}

              <GameScoreboardBlock rows={crocScoreRows} legend={getStaticHelp('alias').scoreLegend} />
            </div>
          </GameLayoutWrapper>
        )}

        {/* WordBomb — угадай слово, не задев мины */}
        {room.gameType === 'wordbomb' && room.status !== 'waiting' && (
          <GameLayoutWrapper
            gameType="wordbomb"
            room={room}
            socket={socket}
            players={players}
           
          >
            <div className="game-area wordbomb-game">
              <div className="wordbomb-header">
                <div className="game-area-title">💣 Слова-мины</div>
                {crocTurn?.round != null && crocTurn?.maxRounds != null && (
                  <div className="wordbomb-round-badge">Раунд {crocTurn.round} / {crocTurn.maxRounds}</div>
                )}
              </div>
              <GameRulesDisclosure>
                <GameRulesBulletList items={getStaticHelp('wordbomb').bullets} />
              </GameRulesDisclosure>

              <div className="wordbomb-status-strip">
                <span className="wordbomb-explainer-label">Объясняет</span>
                <strong className="wordbomb-explainer-name">{crocTurn?.explainerName || '—'}</strong>
                <span className={`wordbomb-timer${crocTimer > 0 && crocTimer <= 10 ? ' wordbomb-timer--urgent' : ''}`}>
                  💥 {crocTimer}s
                </span>
              </div>

              {crocMyWord ? (
                <div className="wordbomb-word-card">
                  <div className="wordbomb-word-label">⚡ Ваше задание</div>
                  <div className="wordbomb-word-main">{crocMyWord.split(' | Мины: ')[0]}</div>
                  {crocMyWord.includes('Мины:') && (
                    <div className="wordbomb-mines">
                      <span className="wordbomb-mines-label">💣 Запрещено:</span>
                      <span className="wordbomb-mines-list">{crocMyWord.split('Мины: ')[1]}</span>
                    </div>
                  )}
                  <div className="wordbomb-word-hint">Объясняйте — но не называйте мины!</div>
                  <p className="wordbomb-confirm-hint">Кто угадал? Нажмите имя игрока:</p>
                  <div className="wordbomb-guess-candidates">
                    {players.filter((p) => p.id !== socket.id && !p.isSpectator).map((p) => {
                      const already = crocGuessedIds.has(p.id);
                      const inFlight = crocConfirmingIds.has(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className="wordbomb-guess-chip"
                          disabled={already || inFlight}
                          onClick={() => {
                            setCrocConfirmingIds((prev) => new Set(prev).add(p.id));
                            socket.emit('game:action', { type: 'confirm-guess', guesserId: p.id }, (res) => {
                              setCrocConfirmingIds((prev) => {
                                const next = new Set(prev);
                                next.delete(p.id);
                                return next;
                              });
                              if (res && !res.success) toast.error(res.error || 'Не удалось засчитать');
                            });
                          }}
                        >
                          {already ? '✓✓' : '✓'} {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="wordbomb-guesser-hint">
                  <span>💬 Назовите слово вслух — объясняющий подтвердит угадывание.</span>
                </div>
              )}

              <GameScoreboardBlock rows={crocScoreRows} legend={getStaticHelp('wordbomb').scoreLegend} />
            </div>
          </GameLayoutWrapper>
        )}

        {/* Spy */}
        {room.gameType === 'spy' && room.status !== 'waiting' && (
          <GameLayoutWrapper
            gameType="spy"
            room={room}
            socket={socket}
            players={players}
           
          >
            <div className="game-area spy-game">
              <div className="game-area-title">Шпион</div>
              <GameRulesDisclosure>
                <GameRulesBulletList items={getStaticHelp('spy').bullets} />
              </GameRulesDisclosure>
              {spyRole && (
                <div className={`spy-role ${spyRole.isSpy ? 'spy-role--spy' : 'spy-role--location'}`}>
                  {spyRole.isSpy
                    ? '🕶️ Вы — Шпион! Слушайте вопросы и пытайтесь не выдать себя.'
                    : `📍 Локация: ${spyRole.location}`}
                </div>
              )}
              {spyTimer > 0 && !debateVotingOpen && !spyGuessOptions && !spyResult && (
                <div className="spy-timer">⏱ Обсуждение: {spyTimer}s</div>
              )}
              {spyGuessOptions && spyRole?.isSpy && (
                <div className="spy-guess-block">
                  <p className="spy-guess-label">🕶️ Вас не вычислили! Угадайте локацию{spyTimer > 0 ? ` · ${spyTimer}s` : ''}:</p>
                  <div className="spy-guess-grid">
                    {spyGuessOptions.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        className="spy-guess-option"
                        onClick={() => { socket.emit('game:action', { type: 'spy-guess', location: loc }); setSpyGuessOptions(null); }}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {spyResult && (
                <div className={`spy-result ${spyResult.spyCaught ? 'spy-result--caught' : 'spy-result--escaped'}`}>
                  {spyResult.phase === 'voted' && (
                    <>
                      <div className="spy-result-title">{spyResult.spyCaught ? '✅ Шпион пойман!' : '🕶️ Шпион ушёл от подозрений'}</div>
                      <div className="spy-result-detail">Шпион: <strong>{spyResult.spyName}</strong></div>
                      {spyResult.location && <div className="spy-result-detail">Локация: <strong>{spyResult.location}</strong></div>}
                    </>
                  )}
                  {spyResult.phase === 'guessed' && (
                    <div className="spy-result-title">
                      {spyResult.guessCorrect
                        ? `🎯 Шпион угадал локацию: ${spyResult.actualLocation}`
                        : `❌ Шпион не угадал (было: ${spyResult.actualLocation})`}
                    </div>
                  )}
                </div>
              )}
              {debateVotingOpen && (
                <div className="spy-voting">
                  <p className="spy-voting-label">Голосуйте, кто шпион:</p>
                  <div className="spy-players-grid">
                    {room.players.filter((p) => p.id !== socket.id).map((p) => (
                      <Button key={p.id} variant="secondary" size="sm" onClick={() => socket.emit('game:action', { type: 'vote', targetId: p.id })}>
                        {p.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {isHost && !debateVotingOpen && (
                <div className="spy-host-actions">
                  <Button variant="primary" size="sm" onClick={() => socket.emit('game:action', { type: 'start-voting' })}>
                    Начать голосование
                  </Button>
                </div>
              )}
            </div>
          </GameLayoutWrapper>
        )}

        {/* Острослов (Quiplash) */}
        {room.gameType === 'quiplash' && room.status !== 'waiting' && (
          <div className="game-area quiplash-game">
            <div className="game-area-title">😂 Острослов</div>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('quiplash').bullets} /></GameRulesDisclosure>

            {quiplashPhase === 'answering' && (
              <div className="quiplash-answering">
                <div className="quiplash-phase-banner">
                  ✍️ Придумайте смешные ответы!
                  {quiplashTimer > 0 && <span className="quiplash-timer"> {quiplashTimer}s</span>}
                </div>
                {quiplashPrompts.map((p) => {
                  const done = quiplashSubmitted.has(p.promptId);
                  const text = quiplashAnswers[p.promptId] || '';
                  return (
                    <div key={p.promptId} className="quiplash-prompt-card">
                      <div className="quiplash-prompt-text">{p.text}</div>
                      {done ? (
                        <div className="quiplash-answer-done">✓ Ответ отправлен</div>
                      ) : (
                        <div className="quiplash-answer-row">
                          <input
                            className="quiplash-input"
                            maxLength={140}
                            value={text}
                            placeholder="Ваш смешной ответ…"
                            onChange={(e) => setQuiplashAnswers((prev) => ({ ...prev, [p.promptId]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && text.trim()) {
                                socket.emit('game:action', { type: 'quiplash-answer', promptId: p.promptId, text: text.trim() });
                                setQuiplashSubmitted((prev) => new Set(prev).add(p.promptId));
                              }
                            }}
                          />
                          <Button variant="primary" size="sm" disabled={!text.trim()}
                            onClick={() => {
                              if (!text.trim()) return;
                              socket.emit('game:action', { type: 'quiplash-answer', promptId: p.promptId, text: text.trim() });
                              setQuiplashSubmitted((prev) => new Set(prev).add(p.promptId));
                            }}
                          >Отправить</Button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {quiplashPrompts.length > 0 && quiplashPrompts.every((p) => quiplashSubmitted.has(p.promptId)) && (
                  <div className="quiplash-waiting">Ответы отправлены — ждём остальных игроков…</div>
                )}
                {quiplashPrompts.length === 0 && <div className="quiplash-waiting">Загружаем ваши задания…</div>}
              </div>
            )}

            {(quiplashPhase === 'voting' || quiplashPhase === 'reveal') && (quiplashMatchup || quiplashResult) && (
              <div className="quiplash-duel">
                <div className="quiplash-duel-meta">
                  Дуэль {((quiplashResult?.index ?? quiplashMatchup?.index ?? 0) + 1)} / {quiplashMatchup?.total || quiplashTotal || '—'}
                  {quiplashPhase === 'voting' && quiplashTimer > 0 && <span className="quiplash-timer"> · {quiplashTimer}s</span>}
                </div>
                <div className="quiplash-duel-prompt">{quiplashResult?.prompt || quiplashMatchup?.prompt}</div>

                {quiplashPhase === 'reveal' && quiplashResult ? (
                  <div className="quiplash-reveal">
                    {quiplashResult.results.map((r, i) => (
                      <div key={i} className={`quiplash-reveal-row${r.sweep ? ' quiplash-reveal-row--sweep' : ''}`}>
                        <div className="quiplash-reveal-answer">{r.text}</div>
                        <div className="quiplash-reveal-meta">
                          <span className="quiplash-reveal-author">{r.authorName}</span>
                          <span className="quiplash-reveal-votes">{r.votes} 🗳 +{r.points}{r.sweep ? ' 🔥' : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {quiplashMyPromptIds.has(quiplashMatchup?.promptId) ? (
                      <div className="quiplash-waiting">🙈 Это ваша дуэль — голосуют другие ({quiplashVoteCount.voted}/{quiplashVoteCount.total})</div>
                    ) : (
                      <div className="quiplash-vote-cards">
                        {(quiplashMatchup?.answers || []).map((a) => (
                          <button key={a.answerId} type="button" className="quiplash-vote-card" disabled={quiplashVoted}
                            onClick={() => {
                              if (quiplashVoted) return;
                              setQuiplashVoted(true);
                              socket.emit('game:action', { type: 'quiplash-vote', answerId: a.answerId });
                            }}
                          >{a.text}</button>
                        ))}
                      </div>
                    )}
                    {quiplashVoted && <div className="quiplash-waiting">Голос учтён ({quiplashVoteCount.voted}/{quiplashVoteCount.total})</div>}
                  </>
                )}
              </div>
            )}

            {quiplashScoreRows.length > 0 && (
              <GameScoreboardBlock rows={quiplashScoreRows} legend="Очки за смешные ответы" />
            )}
          </div>
        )}

        {/* Узнай друга */}
        {room.gameType === 'knowfriend' && room.status !== 'waiting' && (
          <div className="game-area knowfriend-game">
            <div className="game-area-title">🫂 Узнай друга</div>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('knowfriend').bullets} /></GameRulesDisclosure>

            {knowfriendRound && !knowfriendResult && (() => {
              const isSubject = knowfriendRound.subjectId === socket.id;
              return (
                <div className="knowfriend-round">
                  <div className="knowfriend-meta">
                    Раунд {knowfriendRound.round} / {knowfriendRound.total}
                    {knowfriendTimer > 0 && <span className="knowfriend-timer"> · {knowfriendTimer}s</span>}
                  </div>
                  <div className={`knowfriend-subject-banner${isSubject ? ' knowfriend-subject-banner--you' : ''}`}>
                    {isSubject ? '🎯 Этот раунд — про ТЕБЯ' : <>🎯 Раунд про <strong>{knowfriendRound.subjectName}</strong></>}
                  </div>
                  <div className="knowfriend-question">{knowfriendRound.question}</div>
                  <div className="knowfriend-prompt-hint">
                    {isSubject ? 'Ответь честно — остальные угадывают твой выбор:' : `Что выберет ${knowfriendRound.subjectName}?`}
                  </div>
                  <div className="knowfriend-options">
                    {(knowfriendRound.options || []).map((opt, i) => (
                      <button key={i} type="button" className="knowfriend-option-btn" disabled={knowfriendAnswered}
                        onClick={() => {
                          if (knowfriendAnswered) return;
                          setKnowfriendAnswered(true);
                          socket.emit('game:action', { type: 'answer', value: i });
                        }}
                      >{opt}</button>
                    ))}
                  </div>
                  {knowfriendAnswered && (
                    <div className="knowfriend-waiting">Ответ принят ({knowfriendProgress.answered}/{knowfriendProgress.total})…</div>
                  )}
                </div>
              );
            })()}

            {knowfriendResult && (
              <div className="knowfriend-reveal">
                <div className="knowfriend-reveal-truth">
                  <strong>{knowfriendResult.subjectName}</strong> выбрал:{' '}
                  <span className="knowfriend-truth-answer">{knowfriendResult.subjectAnswer || '— (не ответил)'}</span>
                </div>
                <div className="knowfriend-reveal-list">
                  {knowfriendResult.results.map((r) => (
                    <div key={r.id} className={`knowfriend-reveal-row${r.correct ? ' knowfriend-reveal-row--correct' : ''}`}>
                      <span className="knowfriend-reveal-name">{r.correct ? '✓' : '✗'} {r.name}</span>
                      <span className="knowfriend-reveal-guess">{r.guess}{r.correct ? ' +100' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {knowfriendScoreRows.length > 0 && (
              <GameScoreboardBlock rows={knowfriendScoreRows} legend="Очки за угадывание" />
            )}
          </div>
        )}

        {/* Предательский квиз (Fibbage) */}
        {room.gameType === 'fibbage' && room.status !== 'waiting' && (
          <div className="game-area fibbage-game">
            <div className="game-area-title">🤥 Предательский квиз</div>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('fibbage').bullets} /></GameRulesDisclosure>

            {fibbageRound && (
              <div className="fibbage-meta">
                Раунд {fibbageRound.round} / {fibbageRound.total}
                {fibbageTimer > 0 && <span className="fibbage-timer"> · {fibbageTimer}s</span>}
              </div>
            )}

            {fibbagePhase === 'lies' && fibbageRound && (
              <div className="fibbage-lies">
                <div className="fibbage-question">{fibbageRound.question}</div>
                {fibbageLieSubmitted ? (
                  <div className="fibbage-waiting">Ложь принята — ждём остальных ({fibbageProgress.n}/{fibbageProgress.total})…</div>
                ) : (
                  <div className="fibbage-lie-form">
                    <p className="fibbage-hint">Придумайте правдоподобную ложь, чтобы запутать других:</p>
                    <div className="fibbage-input-row">
                      <input className="fibbage-input" maxLength={60} value={fibbageLie}
                        placeholder="Ваш фейковый ответ…"
                        onChange={(e) => setFibbageLie(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') submitFibbageLie(); }}
                      />
                      <Button variant="primary" size="sm" disabled={!fibbageLie.trim()} onClick={submitFibbageLie}>Отправить</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {fibbagePhase === 'choosing' && (
              <div className="fibbage-choosing">
                <div className="fibbage-question">{fibbageRound?.question}</div>
                <p className="fibbage-hint">{fibbageChosen ? `Голос учтён (${fibbageProgress.n}/${fibbageProgress.total})` : 'Где правда? Выберите верный ответ:'}</p>
                <div className="fibbage-options">
                  {fibbageOptions.map((o) => {
                    const mine = !!fibbageLie && normalizeLie(o.text) === normalizeLie(fibbageLie);
                    return (
                      <button key={o.id} type="button" className="fibbage-option-btn"
                        disabled={!!fibbageChosen || mine}
                        title={mine ? 'Это ваша ложь' : undefined}
                        onClick={() => {
                          if (fibbageChosen || mine) return;
                          setFibbageChosen(o.id);
                          socket.emit('game:action', { type: 'fib-choose', optionId: o.id });
                        }}
                      >{o.text}{mine ? ' 🫵' : ''}</button>
                    );
                  })}
                </div>
              </div>
            )}

            {fibbagePhase === 'reveal' && fibbageResult && (
              <div className="fibbage-reveal">
                <div className="fibbage-question">{fibbageResult.question}</div>
                <div className="fibbage-reveal-list">
                  {fibbageResult.options.map((o, i) => (
                    <div key={i} className={`fibbage-reveal-row${o.isTruth ? ' fibbage-reveal-row--truth' : ''}`}>
                      <div className="fibbage-reveal-text">
                        {o.text} {o.isTruth ? '✅ ПРАВДА' : <span className="fibbage-reveal-author">🤥 {o.authorName}</span>}
                      </div>
                      {o.pickedBy.length > 0 && <div className="fibbage-reveal-picked">Купились: {o.pickedBy.join(', ')}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fibbageScoreRows.length > 0 && (
              <GameScoreboardBlock rows={fibbageScoreRows} legend="+500 за правду, +100 за обман" />
            )}
          </div>
        )}

        {/* Quiz */}
        {room.gameType === 'quiz' &&
          (room.status !== 'waiting' || (phase === 'gameOver' && quizScoreRows.length > 0)) && (
          <div className={`game-area quiz-game${phase === 'gameOver' ? ' quiz-game--postgame' : ''}${genericTimer <= 5 && phase !== 'gameOver' && !quizOptionsLocked ? ' quiz-game--urgent' : ''}`}>
            <div className="game-area-title">
              {phase === 'gameOver'
                ? 'Квиз · итоги'
                : `Квиз · вопрос ${quizQuestion?.questionNumber ?? '—'}${quizTotalQuestions != null ? ` / ${quizTotalQuestions}` : ''} · ⏱ ${genericTimer}s`}
            </div>
            {phase !== 'gameOver' && (
              <GameRulesDisclosure className="quiz-game-rules">
                <GameRulesBulletList items={getStaticHelp('quiz').bullets} />
              </GameRulesDisclosure>
            )}
            {phase !== 'gameOver' && quizQuestion && (
              <>
                <div className="quiz-question">{quizQuestion.question}</div>
                <div className="quiz-options">
                  {(quizQuestion.options || []).map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={quizOptionsLocked}
                      className={[
                        'quiz-option',
                        quizSelectedAnswer === i ? 'selected' : '',
                        quizOptionsLocked && quizCorrectAnswer === i ? 'correct' : '',
                        quizOptionsLocked && quizSelectedAnswer === i && quizSelectedAnswer !== quizCorrectAnswer ? 'wrong' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => {
                        if (quizOptionsLocked) return;
                        setQuizSelectedAnswer(i);
                        socket.emit('game:action', { type: 'answer', answerIndex: i });
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </>
            )}
            {quizScoreRows.length > 0 && (
              <div className="quiz-scoreboard">
                <div className="quiz-scoreboard-header">
                  <span className="quiz-scoreboard-title">Таблица очков</span>
                  <span className="quiz-scoreboard-legend">
                    Один ответ на вопрос; после показа правильного смена невозможна. +10 за верный ответ и до {quizSpeedBonusMax} за скорость
                  </span>
                </div>
                <ul className="quiz-scoreboard-list" aria-label="Очки игроков">
                  {quizScoreRows.map((p) => (
                    <li
                      key={p.id}
                      className={`quiz-scoreboard-row ${p.isSelf ? 'quiz-scoreboard-row--self' : ''} ${
                        p.rank === 1 ? 'quiz-scoreboard-row--first' : ''
                      }`}
                    >
                      <span className="quiz-scoreboard-rank" aria-hidden>
                        {p.medal || p.rank}
                      </span>
                      <span className="quiz-scoreboard-name">{p.name}</span>
                      <span className="quiz-scoreboard-points">{Number(p.score) || 0}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Выбор / Would you rather */}
        {room.gameType === 'wouldyourather' &&
          (room.status !== 'waiting' || (phase === 'gameOver' && wyrScoreRows.length > 0)) && (
          <div className={`game-area wyr-game ${phase === 'gameOver' ? 'wyr-game--postgame' : ''}`}>
            <div className="game-area-title">
              {phase === 'gameOver'
                ? 'Выбор · итоги'
                : `Выбор · раунд ${wyrRound?.round ?? '—'} / ${wyrRound?.maxRounds ?? room.settings?.maxRounds ?? '—'} · ⏱ ${genericTimer}s`}
            </div>
            {phase !== 'gameOver' && (
              <GameRulesDisclosure>
                <GameRulesBulletList items={getStaticHelp('wouldyourather').bullets} />
                <p className="wyr-rules-scoring">
                  После таймера считаются голоса: кто попал в <strong>большинство</strong>, получает <strong>+{wyrPtsMaj}</strong> очк.; кто в
                  меньшинство — <strong>+{wyrPtsMin}</strong>. Если голоса <strong>поровну</strong>, все ответившие получают по{' '}
                  <strong>+{wyrPtsTie}</strong>. Не нажали — <strong>0</strong> за раунд.
                </p>
              </GameRulesDisclosure>
            )}
            {phase !== 'gameOver' && wyrRound?.optionA && wyrRound?.optionB && (
              <div className="wyr-dilemma">
                <div className="wyr-options">
                  <button
                    type="button"
                    className={`wyr-option wyr-option--a ${wyrMyPick === 'A' ? 'wyr-option--picked' : ''}`}
                    disabled={!!wyrMyPick}
                    onClick={() => {
                      if (wyrMyPick) return;
                      setWyrMyPick('A');
                      socket.emit('game:action', { type: 'choice', choice: 'A' });
                    }}
                  >
                    <span className="wyr-option-label">A</span>
                    <span className="wyr-option-text">{wyrRound.optionA}</span>
                  </button>
                  <button
                    type="button"
                    className={`wyr-option wyr-option--b ${wyrMyPick === 'B' ? 'wyr-option--picked' : ''}`}
                    disabled={!!wyrMyPick}
                    onClick={() => {
                      if (wyrMyPick) return;
                      setWyrMyPick('B');
                      socket.emit('game:action', { type: 'choice', choice: 'B' });
                    }}
                  >
                    <span className="wyr-option-label">Б</span>
                    <span className="wyr-option-text">{wyrRound.optionB}</span>
                  </button>
                </div>
                {wyrMyPick && <p className="wyr-picked-note">Вы выбрали вариант {wyrMyPick === 'A' ? 'A' : 'Б'} — ждём остальных или таймер.</p>}
              </div>
            )}
            {wyrBreakSummary && phase !== 'gameOver' && <div className="wyr-break-summary">{wyrBreakSummary}</div>}
            {wyrScoreRows.length > 0 && (
              <div className="quiz-scoreboard wyr-scoreboard">
                <div className="quiz-scoreboard-header">
                  <span className="quiz-scoreboard-title">Таблица очков</span>
                  <span className="quiz-scoreboard-legend">
                    Большинство +{wyrPtsMaj}, меньшинство +{wyrPtsMin}, ничья +{wyrPtsTie} всем ответившим
                  </span>
                </div>
                <ul className="quiz-scoreboard-list" aria-label="Очки игроков">
                  {wyrScoreRows.map((p) => (
                    <li
                      key={p.id}
                      className={`quiz-scoreboard-row ${p.isSelf ? 'quiz-scoreboard-row--self' : ''} ${
                        p.rank === 1 ? 'quiz-scoreboard-row--first' : ''
                      }`}
                    >
                      <span className="quiz-scoreboard-rank" aria-hidden>
                        {p.medal || p.rank}
                      </span>
                      <span className="quiz-scoreboard-name">{p.name}</span>
                      <span className="quiz-scoreboard-points">{Number(p.score) || 0}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Доверие — дилемма заключённого для всех */}
        {room.gameType === 'trust' &&
          (room.status !== 'waiting' || (phase === 'gameOver' && trustScoreRows.length > 0)) && (
          <div className={`game-area trust-game ${phase === 'gameOver' ? 'trust-game--postgame' : ''}`}>
            <div className="game-area-title">
              {phase === 'gameOver'
                ? 'Доверие · итоги'
                : `Доверие · раунд ${trustRound?.round ?? '—'} / ${trustRound?.maxRounds ?? room.settings?.maxRounds ?? '—'} · ⏱ ${genericTimer}s`}
            </div>
            {phase !== 'gameOver' && (
              <GameRulesDisclosure>
                <GameRulesBulletList items={getStaticHelp('trust').bullets} />
                <ul className="trust-rules-list">
                  <li>
                    Если <strong>все</strong> выберут доверие — каждому <strong>+{trustPtsBothTrust}</strong> очк.
                  </li>
                  <li>
                    Если <strong>все</strong> выберут предательство — каждому <strong>+{trustPtsBothBetray}</strong> очк.
                  </li>
                  <li>
                    Если мнения <strong>разошлись</strong>: доверие даёт <strong>+{trustPtsTrust}</strong>, предательство — <strong>+{trustPtsBetray}</strong> (как в классической игре: «предать» выгоднее при смеси, но общий максимум — когда все доверяют).
                  </li>
                  <li>
                    Не успели нажать — <strong>0</strong> за раунд.
                  </li>
                </ul>
              </GameRulesDisclosure>
            )}
            {phase !== 'gameOver' && trustRound && (
              <div className="trust-actions">
                <div className="trust-buttons">
                  <button
                    type="button"
                    className={`trust-btn trust-btn--trust ${trustMyChoice === 'trust' ? 'trust-btn--picked' : ''}`}
                    disabled={!!trustMyChoice}
                    onClick={() => {
                      if (trustMyChoice) return;
                      setTrustMyChoice('trust');
                      socket.emit('game:action', { type: 'choice', choice: 'trust' });
                    }}
                  >
                    <span className="trust-btn-title">Доверие</span>
                    <span className="trust-btn-hint">+{trustPtsBothTrust} если все так же</span>
                  </button>
                  <button
                    type="button"
                    className={`trust-btn trust-btn--betray ${trustMyChoice === 'betray' ? 'trust-btn--picked' : ''}`}
                    disabled={!!trustMyChoice}
                    onClick={() => {
                      if (trustMyChoice) return;
                      setTrustMyChoice('betray');
                      socket.emit('game:action', { type: 'choice', choice: 'betray' });
                    }}
                  >
                    <span className="trust-btn-title">Предательство</span>
                    <span className="trust-btn-hint">+{trustPtsBetray} при смеси</span>
                  </button>
                </div>
                {trustMyChoice && (
                  <p className="trust-picked-note">
                    Вы выбрали: <strong>{trustMyChoice === 'trust' ? 'доверие' : 'предательство'}</strong>. Ждём остальных или конец таймера.
                  </p>
                )}
              </div>
            )}
            {trustBreakSummary && phase !== 'gameOver' && <div className="trust-break-summary">{trustBreakSummary}</div>}
            {trustScoreRows.length > 0 && (
              <div className="quiz-scoreboard trust-scoreboard">
                <div className="quiz-scoreboard-header">
                  <span className="quiz-scoreboard-title">Таблица очков</span>
                  <span className="quiz-scoreboard-legend">
                    Все доверяют +{trustPtsBothTrust} каждому; все предают +{trustPtsBothBetray}; смесь +{trustPtsTrust} / +{trustPtsBetray}
                  </span>
                </div>
                <ul className="quiz-scoreboard-list" aria-label="Очки игроков">
                  {trustScoreRows.map((p) => (
                    <li
                      key={p.id}
                      className={`quiz-scoreboard-row ${p.isSelf ? 'quiz-scoreboard-row--self' : ''} ${
                        p.rank === 1 ? 'quiz-scoreboard-row--first' : ''
                      }`}
                    >
                      <span className="quiz-scoreboard-rank" aria-hidden>
                        {p.medal || p.rank}
                      </span>
                      <span className="quiz-scoreboard-name">{p.name}</span>
                      <span className="quiz-scoreboard-points">{Number(p.score) || 0}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Meme Battle / Смех без правил */}
        {room.gameType === 'meme' && room.status !== 'waiting' && (
          <div className={`game-area meme-game ${memeVotingData ? 'meme-disco' : ''}`}>
            <div className="game-area-title">Смех без правил | ⏱ {genericTimer}s</div>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('meme').bullets} />
            </GameRulesDisclosure>
            {memeWinner && (
              <div className="meme-winner">
                <div className="meme-winner-crown">👑</div>
                <div className="meme-winner-text">{memeWinner.text}</div>
                <div className="meme-winner-author">— {memeWinner.authorName}</div>
              </div>
            )}
            {memePrompt && !memeVotingData && !memeWinner && (
              <>
                <div className="meme-prompt-container">
                  <button
                    type="button"
                    className="meme-rofl-btn"
                    title="Случайный рофл"
                    onClick={() => {
                      const rofls = [
                        'Объясни квантовую физику как Баба Яга',
                        'Опиши поход в магазин как эпический квест',
                        'Что бы сказал кот-философ о смысле жизни',
                        'Инструкция по приготовлению борща от робота',
                        'Резюме динозавра на должность менеджера',
                        'Что думает холодильник в 3 часа ночи',
                        'Письмо инопланетянину о земной любви',
                        'Рецепт счастья от злой мачехи',
                      ];
                      setMemeRoflTooltip(rofls[Math.floor(Math.random() * rofls.length)]);
                      setTimeout(() => setMemeRoflTooltip(null), 4000);
                    }}
                  >
                    🎲
                  </button>
                  {memeRoflTooltip && (
                    <div className="meme-rofl-tooltip">Попробуй: {memeRoflTooltip}</div>
                  )}
                  <div className="meme-prompt">
                    {memePrompt.prompt}
                  </div>
                </div>
                <div className="meme-input-row">
                  <input 
                    className="meme-input" 
                    value={memeAnswerInput} 
                    onChange={(e) => setMemeAnswerInput(e.target.value)} 
                    placeholder="Ваш ответ..." 
                  />
                  <Button variant="primary" size="sm" onClick={() => { socket.emit('game:action', { type: 'answer', text: memeAnswerInput }); setMemeAnswerInput(''); }}>
                    Отправить
                  </Button>
                </div>
              </>
            )}
            {memeVotingData && !memeWinner && (
              <div className="meme-voting">
                <p className="meme-voting-label">Голосуй за лучший ответ:</p>
                <div className="meme-vote-options">
                  {(memeVotingData.answers || []).map((a, i) => (
                    <button key={i} className="meme-vote-option" onClick={() => socket.emit('game:action', { type: 'vote', answerId: i })}>
                      {['😂', '🤣', '😆', '🥳', '😹'][i % 5]} {a.text || a}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('meme').scoreLegend} />
          </div>
        )}

        {/* Debate */}
        {room.gameType === 'debate' && room.status !== 'waiting' && (
          <div className="game-area debate-game">
            <div className="game-area-title">Дебаты | ⏱ {genericTimer}s</div>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('debate').bullets} />
            </GameRulesDisclosure>
            {debateRound && (
              <>
                <div className="debate-topic">{debateRound.topic}</div>
                <div className="debate-players">
                  <div className="debate-player">
                    <div className="debate-player-name">{debateRound.player1Name}</div>
                    <div className="debate-player-side">— ЗА</div>
                  </div>
                  <div className="debate-player">
                    <div className="debate-player-name">{debateRound.player2Name}</div>
                    <div className="debate-player-side">— ПРОТИВ</div>
                  </div>
                </div>
              </>
            )}
            {debateVotingOpen && debateRound && (
              <div className="debate-voting">
                <Button variant="secondary" size="sm" onClick={() => socket.emit('game:action', { type: 'vote', targetId: debateRound.player1Id })}>
                  {debateRound.player1Name}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => socket.emit('game:action', { type: 'vote', targetId: debateRound.player2Id })}>
                  {debateRound.player2Name}
                </Button>
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('debate').scoreLegend} />
          </div>
        )}

        {/* Two Truths */}
        {room.gameType === 'truths' && room.status !== 'waiting' && (
          <div className="game-area truths-game">
            <div className="game-area-title">Две правды, одна ложь</div>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('truths').bullets} />
            </GameRulesDisclosure>
            {truthsPhase === 'collecting' && (
              <div className="truths-collecting">
                <p className="truths-instruction">Напишите 2 правды и 1 ложь о себе:</p>
                <div className="truths-facts-list">
                  {[0, 1, 2].map((i) => (
                    <input 
                      key={i} 
                      className="truths-fact-input"
                      value={truthsFacts[i]} 
                      onChange={(e) => { const n = [...truthsFacts]; n[i] = e.target.value; setTruthsFacts(n); }}
                      placeholder={`Факт ${i + 1}`} 
                    />
                  ))}
                </div>
                <div className="truths-lie-selector">
                  <label>Какой факт — ложь?</label>
                  <select value={truthsLieIndex} onChange={(e) => setTruthsLieIndex(Number(e.target.value))}>
                    <option value={0}>Факт 1</option>
                    <option value={1}>Факт 2</option>
                    <option value={2}>Факт 3</option>
                  </select>
                </div>
                <Button variant="primary" size="sm" onClick={() => socket.emit('game:action', { type: 'submit-facts', facts: truthsFacts, lieIndex: truthsLieIndex })}>
                  Отправить
                </Button>
              </div>
            )}
            {truthsPhase === 'guessing' && truthsGuessing && (
              <div className="truths-guessing">
                <p className="truths-guessing-title">Факты о <strong>{truthsGuessing.aboutPlayerName}</strong>:</p>
                {(truthsGuessing.facts || []).map((f, i) => (
                  <Button key={i} variant="secondary" className="truths-fact-option" onClick={() => socket.emit('game:action', { type: 'guess', guessIndex: i })}>
                    {i + 1}. {f}
                  </Button>
                ))}
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('truths').scoreLegend} />
          </div>
        )}

        {/* Story */}
        {room.gameType === 'story' && room.status !== 'waiting' && (
          <div className="game-area story-game">
            <div className="game-area-title">Цепная история · Раунд {storyRound.round}/{storyRound.max}{storyNoTimeLimit ? ' | Без времени' : ` | ⏱ ${genericTimer}s`}</div>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('story').bullets} />
            </GameRulesDisclosure>
            <div className="story-display">
              {storyFullText || (storyTurn ? `Сейчас пишет: ${storyTurn.player?.name}` : 'История пишется...')}
            </div>
            {storyTurn?.player?.id === socket.id && (
              <div className="story-input-row">
                <input 
                  className="story-input"
                  value={storySentenceInput} 
                  onChange={(e) => setStorySentenceInput(e.target.value)} 
                  placeholder="Продолжите историю (2–300 символов)..." 
                  maxLength={300} 
                />
                <Button variant="primary" size="sm" disabled={storySentenceInput.trim().length < 2} onClick={() => { socket.emit('game:action', { type: 'submit-sentence', text: storySentenceInput }); setStorySentenceInput(''); }}>
                  Добавить
                </Button>
              </div>
            )}
            {storyTurn && storyTurn.player?.id !== socket.id && (
              <div className="story-current-writer">Сейчас пишет: {storyTurn.player?.name}</div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('story').scoreLegend} />
          </div>
        )}

        {/* Коллаж — общий текст по очереди + голосование за фрагменты */}
        {room.gameType === 'collage' &&
          (room.status !== 'waiting' || (phase === 'gameOver' && collageScoreRows.length > 0)) && (
            <div className={`game-area collage-game ${phase === 'gameOver' ? 'collage-game--postgame' : ''}`}>
              <div className="game-area-title">
                {phase === 'gameOver'
                  ? 'Коллаж · итоги'
                  : collageVoting
                    ? `Коллаж · голосование · раунд ${collageRoundMeta?.round ?? '—'} / ${collageRoundMeta?.maxRounds ?? room.settings?.maxRounds ?? '—'} · ⏱ ${genericTimer}s`
                    : `Коллаж · сбор коллажа · раунд ${collageRoundMeta?.round ?? '—'} / ${collageRoundMeta?.maxRounds ?? room.settings?.maxRounds ?? '—'} · ⏱ ${genericTimer}s`}
              </div>
              {phase !== 'gameOver' && (
                <GameRulesDisclosure>
                  <GameRulesBulletList items={getStaticHelp('collage').bullets} />
                  <p className="collage-rules-lead">
                    Каждый раунд появляется <strong>общая зацепка</strong> (первое предложение). Игроки <strong>по очереди</strong> дописывают по одному короткому фрагменту — получается общий «коллаж»-история.
                  </p>
                  <ul className="collage-rules-list">
                    <li>
                      Когда все добавили фрагмент, открывается <strong>голосование</strong>: выберите <strong>чужой</strong> фрагмент, который больше всего зашёл (за свой голосовать нельзя).
                    </li>
                    <li>
                      За каждый полученный голос автор получает <strong>+{collagePtsVote}</strong> очк.; у кого больше всего голосов в раунде — ещё <strong>+{collageBonusWinner}</strong> (при ничьей бонус получают все лидеры).
                    </li>
                    <li>
                      Не успели с ходом — подставится «…». Раундов несколько, в конце побеждает набравший больше всего очков.
                    </li>
                  </ul>
                </GameRulesDisclosure>
              )}
              {phase !== 'gameOver' && (
                <div className="collage-display" aria-live="polite">
                  {collageDisplay || 'Ждём начала раунда…'}
                </div>
              )}
              {phase !== 'gameOver' && collageTurn?.player?.id === socket.id && !collageVoting && (
                <div className="collage-input-row">
                  <input
                    className="collage-input"
                    value={collagePieceInput}
                    onChange={(e) => setCollagePieceInput(e.target.value)}
                    placeholder={`Ваш фрагмент (${collagePieceMin}–${collagePieceMax} символов)…`}
                    maxLength={collagePieceMax}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={collagePieceInput.trim().length < collagePieceMin}
                    onClick={() => {
                      socket.emit('game:action', { type: 'submit-sentence', text: collagePieceInput });
                      setCollagePieceInput('');
                    }}
                  >
                    Добавить
                  </Button>
                </div>
              )}
              {phase !== 'gameOver' && collageTurn && collageTurn.player?.id !== socket.id && !collageVoting && (
                <div className="collage-current-writer">Сейчас дописывает: {collageTurn.player?.name}</div>
              )}
              {phase !== 'gameOver' && collageVoting && Array.isArray(collageVoting.pieces) && (
                <div className="collage-vote-block">
                  <p className="collage-vote-lead">Выберите чужой фрагмент (один голос за раунд):</p>
                  <div className="collage-vote-grid">
                    {collageVoting.pieces.map((piece) => {
                      const isOwn = piece.authorId === socket.id;
                      const disabled = isOwn || collageMyVote !== null;
                      return (
                        <button
                          key={piece.index}
                          type="button"
                          className={`collage-vote-btn ${collageMyVote === piece.index ? 'collage-vote-btn--picked' : ''}`}
                          disabled={disabled}
                          onClick={() => {
                            if (collageMyVote != null || isOwn) return;
                            setCollageMyVote(piece.index);
                            socket.emit('game:action', { type: 'vote', pieceIndex: piece.index });
                          }}
                        >
                          <span className="collage-vote-author">{piece.authorName}</span>
                          <span className="collage-vote-text">{piece.text || '…'}</span>
                          {piece.skipped && <span className="collage-vote-skip">пропуск</span>}
                        </button>
                      );
                    })}
                  </div>
                  {collageMyVote !== null && (
                    <p className="collage-vote-note">Голос отправлен. Ждём остальных или конец таймера.</p>
                  )}
                </div>
              )}
              {collageBreakSummary && phase !== 'gameOver' && (
                <div className="collage-break-summary">{collageBreakSummary}</div>
              )}
              {collageScoreRows.length > 0 && (
                <div className="quiz-scoreboard collage-scoreboard">
                  <div className="quiz-scoreboard-header">
                    <span className="quiz-scoreboard-title">Таблица очков</span>
                    <span className="quiz-scoreboard-legend">
                      Голос за фрагмент +{collagePtsVote} автору; лидер(ы) раунда +{collageBonusWinner}
                    </span>
                  </div>
                  <ul className="quiz-scoreboard-list" aria-label="Очки игроков">
                    {collageScoreRows.map((p) => (
                      <li
                        key={p.id}
                        className={`quiz-scoreboard-row ${p.isSelf ? 'quiz-scoreboard-row--self' : ''} ${
                          p.rank === 1 ? 'quiz-scoreboard-row--first' : ''
                        }`}
                      >
                        <span className="quiz-scoreboard-rank" aria-hidden>
                          {p.medal || p.rank}
                        </span>
                        <span className="quiz-scoreboard-name">{p.name}</span>
                        <span className="quiz-scoreboard-points">{Number(p.score) || 0}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

        {/* Эмодзи-арт */}
        {room.gameType === 'emojiart' &&
          (room.status !== 'waiting' || (phase === 'gameOver' && emojiartScoreRows.length > 0)) && (
            <div className={`game-area emojiart-game ${phase === 'gameOver' ? 'emojiart-game--postgame' : ''}`}>
              <div className="game-area-title">
                {phase === 'gameOver'
                  ? 'Эмодзи-арт · итоги'
                  : `Эмодзи-арт · раунд ${emojiartRound?.round ?? '—'} / ${emojiartRound?.maxRounds ?? room.settings?.maxRounds ?? '—'} · ⏱ ${genericTimer}s`}
              </div>
              {phase !== 'gameOver' && (
                <GameRulesDisclosure>
                  <GameRulesBulletList items={getStaticHelp('emojiart').bullets} />
                  <p className="emojiart-rules-lead">
                    В каждом раунде один <strong>художник</strong>. Он видит секретное слово и должен передать его смысл <strong>только эмодзи</strong> — вводит в поле ниже (букв и слов от художника быть не должно).
                  </p>
                  <ul className="emojiart-rules-list">
                    <li>
                      Остальные <strong>угадывают</strong> — вводят <strong>точное слово</strong> в поле ниже.
                    </li>
                    <li>
                      За <strong>верную отгадку</strong> — <strong>+{emojiartPtsGuess}</strong> очк. угадавшему; художник получает <strong>+{emojiartPtsDrawer}</strong> за каждого угадавшего.
                    </li>
                    <li>
                      Художнику <strong>нельзя</strong> вводить текстовые подсказки; угадывающим — не спойлерьте слово вслух до своей попытки.
                    </li>
                  </ul>
                </GameRulesDisclosure>
              )}
              {phase !== 'gameOver' && emojiartRound?.drawerId && (
                <div className="emojiart-role-strip">
                  {emojiartRound.drawerId === socket.id ? (
                    <span>Вы <strong>художник</strong> этого раунда. Слово ниже — только для вас. Введите эмодзи в поле ниже.</span>
                  ) : (
                    <span>Художник: <strong>{emojiartRound.drawerName || '—'}</strong>. Ждите эмодзи и введите отгадку в поле ниже.</span>
                  )}
                </div>
              )}
              {phase !== 'gameOver' && emojiartRound?.drawerId && (
                <form className="emojiart-input-form" onSubmit={(e) => { e.preventDefault(); if (!newGameInput.trim()) return; socket.emit('game:action', { type: 'answer', text: newGameInput.trim() }); setNewGameInput(''); }}>
                  <input
                    className="emojiart-input"
                    value={newGameInput}
                    onChange={(e) => setNewGameInput(e.target.value)}
                    placeholder={emojiartRound.drawerId === socket.id ? 'Введите эмодзи…' : 'Введите слово-отгадку…'}
                    maxLength={200}
                    autoComplete="off"
                  />
                  <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>Отправить</Button>
                </form>
              )}
              {phase !== 'gameOver' && emojiartRound?.drawerId === socket.id && emojiartSecretWord && (
                <div className="emojiart-secret" aria-label="Секретное слово для художника">
                  <span className="emojiart-secret-label">Нарисуйте эмодзи:</span>
                  <span className="emojiart-secret-word">{emojiartSecretWord}</span>
                </div>
              )}
              {phase !== 'gameOver' && emojiartRound?.drawerId === socket.id && !emojiartSecretWord && (
                <p className="emojiart-secret-wait">Загружаем слово…</p>
              )}
              {emojiartBreakSummary && phase !== 'gameOver' && (
                <div className="emojiart-break-summary">{emojiartBreakSummary}</div>
              )}
              {emojiartScoreRows.length > 0 && (
                <div className="quiz-scoreboard emojiart-scoreboard">
                  <div className="quiz-scoreboard-header">
                    <span className="quiz-scoreboard-title">Таблица очков</span>
                    <span className="quiz-scoreboard-legend">
                      Угадавший +{emojiartPtsGuess}, художник +{emojiartPtsDrawer} за каждого угадавшего
                    </span>
                  </div>
                  <ul className="quiz-scoreboard-list" aria-label="Очки игроков">
                    {emojiartScoreRows.map((p) => (
                      <li
                        key={p.id}
                        className={`quiz-scoreboard-row ${p.isSelf ? 'quiz-scoreboard-row--self' : ''} ${
                          p.rank === 1 ? 'quiz-scoreboard-row--first' : ''
                        }`}
                      >
                        <span className="quiz-scoreboard-rank" aria-hidden>
                          {p.medal || p.rank}
                        </span>
                        <span className="quiz-scoreboard-name">{p.name}</span>
                        <span className="quiz-scoreboard-points">{Number(p.score) || 0}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

        {/* Emoji */}
        {room.gameType === 'emoji' && room.status !== 'waiting' && (
          <div className="game-area emoji-game">
            <div className="game-area-title">Эмодзи | ⏱ {genericTimer}s</div>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('emoji').bullets} />
            </GameRulesDisclosure>
            {emojiRound && (
              <>
                <div className="emoji-display">{emojiRound.emojis}</div>
                <div className="emoji-category">Категория: {emojiRound.category}</div>
                <form className="emoji-input-form" onSubmit={(e) => { e.preventDefault(); if (!newGameInput.trim()) return; socket.emit('game:action', { type: 'answer', text: newGameInput.trim() }); setNewGameInput(''); }}>
                  <input className="emoji-input" value={newGameInput} onChange={(e) => setNewGameInput(e.target.value)} placeholder="Ваша отгадка…" maxLength={100} autoComplete="off" />
                  <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>Ответить</Button>
                </form>
              </>
            )}
            <div className="emoji-hint">
              За раунд засчитывается только <strong>первая</strong> верная отгадка; остальным правильный ответ не показывается, чтобы не портить игру.
            </div>
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('emoji').scoreLegend} />
          </div>
        )}

        {/* WhoAmI */}
        {room.gameType === 'whoami' && room.status !== 'waiting' && (
          <div className="game-area whoami-game">
            <div className="game-area-title">Кто я?</div>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('whoami').bullets} />
            </GameRulesDisclosure>
            {whoamiAssignment && (
              <div className="whoami-characters">
                <p>Вы видите персонажей других игроков:</p>
                {(whoamiAssignment.othersCharacters || []).map((oc, i) => (
                  <div key={i} className="whoami-character-item">
                    <strong>{oc.playerName}</strong>: {oc.character}
                  </div>
                ))}
              </div>
            )}
            <div className="whoami-input-row">
              <input 
                className="whoami-input"
                value={whoamiQuestionInput} 
                onChange={(e) => setWhoamiQuestionInput(e.target.value)} 
                placeholder="Задайте вопрос да/нет..." 
              />
              <Button variant="secondary" size="sm" onClick={() => { socket.emit('game:action', { type: 'ask', question: whoamiQuestionInput }); setWhoamiQuestionInput(''); }}>
                Спросить
              </Button>
            </div>
            <div className="whoami-input-row">
              <input 
                className="whoami-input"
                value={whoamiGuessInput} 
                onChange={(e) => setWhoamiGuessInput(e.target.value)} 
                placeholder="Угадать персонажа..." 
              />
              <Button variant="primary" size="sm" onClick={() => { socket.emit('game:action', { type: 'guess', guess: whoamiGuessInput }); setWhoamiGuessInput(''); }}>
                Угадать!
              </Button>
            </div>
          </div>
        )}

        {/* FakeArtist */}
        {room.gameType === 'fakeartist' && room.status !== 'waiting' && (
          <div className="game-area fakeartist-game">
            <div className="game-area-title">Фейк-художник | ⏱ {genericTimer}s</div>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('fakeartist').bullets} />
            </GameRulesDisclosure>
            {fakeartistRole && (
              <div className={`fakeartist-role ${fakeartistRole.isFakeArtist ? 'fakeartist-role--fake' : ''}`}>
                {fakeartistRole.isFakeArtist ? '🎨 Вы — Фейк! Не знаете слово. Дайте общую подсказку.' : `Категория: ${fakeartistRole.category}. Слово: ${fakeartistRole.word || '—'}`}
              </div>
            )}
            {fakeartistHintPrompt && fakeartistHintPrompt.playerId === socket.id && (
              <div className="fakeartist-hint-section">
                <p className="fakeartist-hint-label">Ваша подсказка (одно слово):</p>
                <div className="fakeartist-hint-row">
                  <input 
                    className="fakeartist-hint-input"
                    value={fakeartistHintInput} 
                    onChange={(e) => setFakeartistHintInput(e.target.value)} 
                    placeholder="Слово..." 
                  />
                  <Button variant="secondary" size="sm" onClick={() => { socket.emit('game:action', { type: 'submit-hint', hint: fakeartistHintInput }); setFakeartistHintInput(''); }}>
                    Отправить
                  </Button>
                </div>
              </div>
            )}
            {fakeartistVoting && (
              <div className="fakeartist-voting">
                <p className="fakeartist-voting-label">Голосуйте, кто фейк:</p>
                <div className="fakeartist-players-grid">
                  {fakeartistVoting.players?.filter((p) => p.id !== socket.id).map((p) => (
                    <Button key={p.id} variant="secondary" size="sm" onClick={() => socket.emit('game:action', { type: 'vote', targetId: p.id })}>
                      {p.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {fakeartistGuessPhase && fakeartistRole?.isFakeArtist && (
              <div className="fakeartist-guess-section">
                <p className="fakeartist-guess-label">Угадайте слово:</p>
                <div className="fakeartist-guess-row">
                  <input 
                    className="fakeartist-guess-input"
                    value={fakeartistGuessInput} 
                    onChange={(e) => setFakeartistGuessInput(e.target.value)} 
                    placeholder="Слово..." 
                  />
                  <Button variant="primary" size="sm" onClick={() => { socket.emit('game:action', { type: 'fakeartist-guess', word: fakeartistGuessInput }); setFakeartistGuessInput(''); }}>
                    Угадать
                  </Button>
                </div>
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('fakeartist').scoreLegend} />
          </div>
        )}

        {/* Chameleon */}
        {room.gameType === 'chameleon' && room.status !== 'waiting' && (
          <div className="game-area chameleon-game">
            <div className="game-area-title">Хамелеон | ⏱ {genericTimer}s</div>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('chameleon').bullets} />
            </GameRulesDisclosure>
            {Array.isArray(genericRound?.grid) && (
              <div className="chameleon-grid">
                {genericRound.grid.map((w, i) => (
                  <div key={i} className={`chameleon-word-cell ${chameleonRole?.secretWord === w ? 'chameleon-word-cell--secret' : ''}`}>
                    {w}
                  </div>
                ))}
              </div>
            )}
            {chameleonRole && (
              <div className={`chameleon-role ${chameleonRole.isChameleon ? 'chameleon-role--chameleon' : ''}`}>
                {chameleonRole.isChameleon ? '🦎 Вы — Хамелеон! Не знаете слово. Дайте общую подсказку.' : `Слово: ${chameleonRole.secretWord || '—'}`}
              </div>
            )}
            {chameleonCluePrompt && chameleonCluePrompt.playerId === socket.id && (
              <div className="chameleon-clue-section">
                <p className="chameleon-clue-label">Ваша подсказка (одно слово):</p>
                <div className="chameleon-clue-row">
                  <input 
                    className="chameleon-clue-input"
                    value={chameleonClueInput} 
                    onChange={(e) => setChameleonClueInput(e.target.value)} 
                    placeholder="Подсказка..." 
                  />
                  <Button variant="secondary" size="sm" onClick={() => { socket.emit('game:action', { type: 'clue', clue: chameleonClueInput }); setChameleonClueInput(''); }}>
                    Отправить
                  </Button>
                </div>
              </div>
            )}
            {chameleonVoting && (
              <div className="chameleon-voting">
                <p className="chameleon-voting-label">Голосуйте, кто хамелеон:</p>
                <div className="chameleon-players-grid">
                  {chameleonVoting.players?.filter((p) => p.id !== socket.id).map((p) => (
                    <Button key={p.id} variant="secondary" size="sm" onClick={() => socket.emit('game:action', { type: 'vote', targetId: p.id })}>
                      {p.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {chameleonGuessPhase && chameleonRole?.isChameleon && chameleonGuessPhase.grid && (
              <div className="chameleon-guess-section">
                <p className="chameleon-guess-label">Угадайте слово из сетки:</p>
                <div className="chameleon-guess-grid">
                  {chameleonGuessPhase.grid.map((w, i) => (
                    <Button key={i} variant="secondary" size="sm" onClick={() => socket.emit('game:action', { type: 'chameleon-guess', word: w })}>
                      {w}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {chameleonReveal && (
              <div className={`chameleon-reveal${chameleonReveal.correct ? ' chameleon-reveal--correct' : ' chameleon-reveal--wrong'}`}>
                <div className="chameleon-reveal-icon">{chameleonReveal.correct ? '🦎✅' : '🦎❌'}</div>
                <div className="chameleon-reveal-text">
                  {chameleonReveal.correct ? 'Хамелеон угадал!' : 'Хамелеон не угадал!'}
                </div>
                <div className="chameleon-reveal-word">Слово было: <strong>{chameleonReveal.actualWord}</strong></div>
                {!chameleonReveal.correct && <div className="chameleon-reveal-guess">Хамелеон назвал: «{chameleonReveal.guess}»</div>}
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('chameleon').scoreLegend} />
          </div>
        )}

        {/* Generic fallback для остальных игр */}
        {/* Timeline — dedicated design */}
        {room.gameType === 'timeline' && room.status !== 'waiting' && (
          <div className="game-area timeline-game">
            <div className="timeline-header">
              <span className="timeline-icon">📅</span>
              <h2 className="timeline-title">Хронология</h2>
              <div className="timeline-meta">
                Раунд {genericRound?.round ?? 0}/{genericRound?.maxRounds ?? 12} · ⏱ {genericTimer}с
              </div>
            </div>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('timeline').bullets} />
            </GameRulesDisclosure>
            {timelineRoundResult ? (
              <div className="timeline-result-card">
                <div className="timeline-result-event">{timelineRoundResult.event}</div>
                <div className="timeline-result-answer">
                  <span className="timeline-result-label">Правильный год:</span>
                  <span className="timeline-result-year">{timelineRoundResult.correctYear}</span>
                </div>
                <div className="timeline-result-list">
                  {(timelineRoundResult.results || []).map((r) => (
                    <div key={r.id} className="timeline-result-row">
                      <span>{r.name}</span>
                      <span className={r.guess != null && r.guess === timelineRoundResult.correctYear ? 'timeline-exact' : ''}>
                        {r.guess != null ? r.guess : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : genericRound?.__event === 'round-started' && genericRound?.event ? (
              <>
                <div className="timeline-event-card">
                  <p className="timeline-event-label">Событие</p>
                  <p className="timeline-event-text">{genericRound.event}</p>
                </div>
                <form
                  className="timeline-input-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newGameInput.trim()) return;
                    socket.emit('game:action', { type: 'answer', value: newGameInput.trim() });
                    setNewGameInput('');
                  }}
                >
                  <input
                    className="timeline-input"
                    type="number"
                    value={newGameInput}
                    onChange={(e) => setNewGameInput(e.target.value)}
                    placeholder="Введите год..."
                    autoFocus
                  />
                  <Button type="submit" variant="primary" size="md" disabled={!newGameInput.trim()}>
                    Отправить
                  </Button>
                </form>
              </>
            ) : (
              <div className="timeline-waiting">Ожидание раунда...</div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('timeline').scoreLegend} />
          </div>
        )}

        {room.gameType === 'categories' &&
          (room.status !== 'waiting' || (phase === 'gameOver' && categoriesScoreRows.length > 0)) && (
          <div className={`game-area categories-game ${phase === 'gameOver' ? 'categories-game--postgame' : ''}`}>
            <div className="game-area-title">
              {phase === 'gameOver'
                ? 'Категории · итоги'
                : `Категории · раунд ${categoriesRound?.round ?? '—'} / ${categoriesRound?.maxRounds ?? room.settings?.maxRounds ?? '—'} · ⏱ ${genericTimer}s`}
            </div>
            {phase !== 'gameOver' && (
              <GameRulesDisclosure>
                <GameRulesBulletList items={getStaticHelp('categories').bullets} />
                <p className="categories-rules-lead">
                  Каждый раунд — одна <strong>буква</strong> и ровно <strong>5 категорий</strong>. Нужно придумать по одному слову в каждой категории так, чтобы слово{' '}
                  <strong>начиналось на эту букву</strong> (Ё можно как Е). Раунд идёт до таймера или пока все не сдадут ответы.
                </p>
                <p className="categories-rules-chat">
                  Вводите ответы в поле ниже по шаблону:
                </p>
                <code className="categories-rules-example">Категория:слово</code>
                <p className="categories-rules-note">Название категории — как в списке ниже, двоеточие без пробелов перед словом.</p>
              </GameRulesDisclosure>
            )}
            {phase !== 'gameOver' && categoriesRound?.letter && (
              <div className="categories-round-panel">
                <div className="categories-letter-badge" aria-label="Буква раунда">
                  {categoriesRound.letter}
                </div>
                <div className="categories-categories-block">
                  <div className="categories-categories-title">Категории этого раунда</div>
                  <ul className="categories-categories-list">
                    {(categoriesRound.categories || []).map((c) => {
                      const answer = categoriesMyProgress?.cats?.[c];
                      return (
                        <li key={c} className={answer ? 'categories-cat--done' : ''}>
                          <span className="categories-cat-status">{answer ? '✓' : '○'}</span>
                          <span className="categories-cat-name">{c}</span>
                          {answer && <span className="categories-cat-answer">{answer}</span>}
                        </li>
                      );
                    })}
                  </ul>
                  <form className="categories-input-form" onSubmit={(e) => { e.preventDefault(); if (!newGameInput.trim()) return; socket.emit('game:action', { type: 'answer', text: newGameInput.trim() }); setNewGameInput(''); }}>
                    <input className="categories-input" value={newGameInput} onChange={(e) => setNewGameInput(e.target.value)} placeholder="Категория:слово" maxLength={80} autoComplete="off" />
                    <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>Отправить</Button>
                  </form>
                </div>
              </div>
            )}
            {categoriesScoreRows.length > 0 && (
              <div className="quiz-scoreboard categories-scoreboard">
                <div className="quiz-scoreboard-header">
                  <span className="quiz-scoreboard-title">Таблица очков</span>
                  <span className="quiz-scoreboard-legend">
                    За каждую клетку +{categoriesPts}; если никто больше не написал то же слово — ещё +{categoriesUnique}; самый быстрый полный ряд — +{categoriesSpeed} в конце раунда
                  </span>
                </div>
                <ul className="quiz-scoreboard-list" aria-label="Очки игроков">
                  {categoriesScoreRows.map((p) => (
                    <li
                      key={p.id}
                      className={`quiz-scoreboard-row ${p.isSelf ? 'quiz-scoreboard-row--self' : ''} ${
                        p.rank === 1 ? 'quiz-scoreboard-row--first' : ''
                      }`}
                    >
                      <span className="quiz-scoreboard-rank" aria-hidden>
                        {p.medal || p.rank}
                      </span>
                      <span className="quiz-scoreboard-name">{p.name}</span>
                      <span className="quiz-scoreboard-points">{Number(p.score) || 0}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Последнее слово — категория + таймер + счёт */}
        {room.gameType === 'lastword' && room.status !== 'waiting' && (
          <GameLayoutWrapper gameType="lastword" room={room} socket={socket} players={players}>
            <div className="game-area lastword-game">
              <div className="lastword-header">
                <div className="game-area-title">Последнее слово</div>
                {genericRound?.round != null && (
                  <div className="lastword-round-badge">
                    Раунд {genericRound.round} / {genericRound.maxRounds ?? '—'}
                  </div>
                )}
              </div>
              <GameRulesDisclosure>
                <GameRulesBulletList items={getStaticHelp('lastword').bullets} />
              </GameRulesDisclosure>
              <div className="lastword-category-card">
                <div className="lastword-category-label">Категория</div>
                <div className="lastword-category-name">{genericRound?.category || '—'}</div>
                <form className="lastword-input-form" onSubmit={(e) => { e.preventDefault(); if (!newGameInput.trim()) return; socket.emit('game:action', { type: 'answer', text: newGameInput.trim() }); setNewGameInput(''); }}>
                  <input className="lastword-input" value={newGameInput} onChange={(e) => setNewGameInput(e.target.value)} placeholder="Слово из категории…" maxLength={60} autoComplete="off" />
                  <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>Назвать</Button>
                </form>
              </div>
              <div className="lastword-status-strip">
                <div className="lastword-words-count">
                  <span className="lastword-words-icon">💬</span>
                  <span>{genericRound?.wordsCount ?? 0} слов</span>
                </div>
                <div className={`lastword-timer${genericTimer > 0 && genericTimer <= 10 ? ' lastword-timer--urgent' : ''}`}>
                  ⏱ {genericTimer}s
                </div>
              </div>
              <div className="lastword-bonus-tip">
                Последний, кто назовёт слово до истечения времени — получает <strong>бонусные очки!</strong>
              </div>
              <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('lastword').scoreLegend} />
            </div>
          </GameLayoutWrapper>
        )}

        {/* Аукцион — угадай число ближе всех */}
        {room.gameType === 'auction' && room.status !== 'waiting' && (
          <GameLayoutWrapper gameType="auction" room={room} socket={socket} players={players}>
            <div className="game-area auction-game">
              <div className="auction-header">
                <div className="game-area-title">🔨 Аукцион</div>
                {genericRound?.round != null && (
                  <div className="auction-round-badge">
                    Раунд {genericRound.round} / {genericRound.maxRounds ?? '—'}
                  </div>
                )}
              </div>
              <GameRulesDisclosure>
                <GameRulesBulletList items={getStaticHelp('auction').bullets} />
              </GameRulesDisclosure>
              {genericRound?.__event === 'round-started' && genericRound?.question && (
                <div className="auction-question-card">
                  <div className="auction-question-label">Вопрос</div>
                  <div className="auction-question-text">{genericRound.question}</div>
                  <div className={`auction-timer${genericTimer > 0 && genericTimer <= 10 ? ' auction-timer--urgent' : ''}`}>
                    ⏱ {genericTimer}s
                  </div>
                </div>
              )}
              {genericRound?.__event === 'round-started' && (
                <form
                  className="auction-input-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newGameInput.trim()) return;
                    socket.emit('game:action', { type: 'answer', value: newGameInput.trim() });
                    setNewGameInput('');
                  }}
                >
                  <input
                    className="auction-input"
                    type="number"
                    value={newGameInput}
                    onChange={(e) => setNewGameInput(e.target.value)}
                    placeholder="Ваш ответ (число)..."
                  />
                  <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>
                    Сделать ставку
                  </Button>
                </form>
              )}
              {numericRoundReveal?.__game === 'auction' && (
                <div className="auction-reveal" aria-live="polite">
                  <div className="auction-reveal-title">Итог раунда {numericRoundReveal.round ?? '—'}</div>
                  {numericRoundReveal.question && (
                    <p className="auction-reveal-question">{numericRoundReveal.question}</p>
                  )}
                  <p className="auction-reveal-answer">
                    Правильный ответ: <strong className="auction-reveal-correct">{numericRoundReveal.correct}</strong>
                  </p>
                  <ul className="auction-reveal-list">
                    {(numericRoundReveal.results || []).map((r, i) => {
                      const noGuess = r.guess == null || r.diff === Number.MAX_SAFE_INTEGER;
                      return (
                        <li key={r.id} className={`auction-reveal-row${i === 0 && !noGuess ? ' auction-reveal-row--winner' : ''}${noGuess ? ' auction-reveal-row--miss' : ''}`}>
                          <span className="auction-reveal-pos">{i + 1}</span>
                          <span className="auction-reveal-name">{r.name}</span>
                          <span className="auction-reveal-guess">
                            {noGuess ? '—' : r.guess}
                            {!noGuess && r.diff != null && Number.isFinite(r.diff) && (
                              <span className="auction-reveal-delta"> Δ{r.diff}</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('auction').scoreLegend} />
            </div>
          </GameLayoutWrapper>
        )}

        {/* Волна — шкала с двумя полюсами, ясновидящий даёт подсказку */}
        {room.gameType === 'wavelength' && room.status !== 'waiting' && (
          <GameLayoutWrapper gameType="wavelength" room={room} socket={socket} players={players}>
            <div className="game-area wavelength-game">
              <div className="wavelength-header">
                <div className="game-area-title">〰️ Волна</div>
                {genericRound?.round != null && (
                  <div className="wavelength-round-badge">
                    Раунд {genericRound.round} / {genericRound.maxRounds ?? '—'}
                  </div>
                )}
              </div>
              <GameRulesDisclosure>
                <GameRulesBulletList items={getStaticHelp('wavelength').bullets} />
              </GameRulesDisclosure>

              {/* Шкала — всегда видна когда есть данные */}
              {(genericRound?.left || genericRound?.right) && (
                <div className="wavelength-scale-wrap">
                  <div className="wavelength-pole wavelength-pole--left">{genericRound.left}</div>
                  <div className="wavelength-scale-bar">
                    <div className="wavelength-scale-gradient" />
                    {/* Показываем цель ясновидящему */}
                    {typeof wavelengthTarget === 'number' && genericRound?.__event === 'round-started' && (
                      <div className="wavelength-target-marker" style={{ left: `${wavelengthTarget}%` }}>
                        <div className="wavelength-target-pin" />
                        <div className="wavelength-target-label">{wavelengthTarget}</div>
                      </div>
                    )}
                    {/* Показываем цель всем после раунда */}
                    {wavelengthRoundResult?.target != null && (
                      <div className="wavelength-result-marker" style={{ left: `${wavelengthRoundResult.target}%` }}>
                        <div className="wavelength-result-pin" />
                        <div className="wavelength-result-label">🎯 {wavelengthRoundResult.target}</div>
                      </div>
                    )}
                  </div>
                  <div className="wavelength-pole wavelength-pole--right">{genericRound.right}</div>
                </div>
              )}

              {/* Фаза подсказки: ясновидящий придумывает слово */}
              {genericRound?.__event === 'round-started' && (
                <div className="wavelength-phase-strip">
                  {genericRound.psychicId === socket.id ? (
                    <div className="wavelength-psychic-prompt">
                      <span className="wavelength-psychic-icon">🔮</span>
                      <span>Вы — ясновидящий! Придумайте подсказку для позиции <strong>{wavelengthTarget}</strong></span>
                    </div>
                  ) : (
                    <div className="wavelength-waiting">
                      <span>🔮 <strong>{genericRound.psychicName || 'Ясновидящий'}</strong> придумывает подсказку…</span>
                    </div>
                  )}
                  <div className={`wavelength-timer${genericTimer > 0 && genericTimer <= 10 ? ' wavelength-timer--urgent' : ''}`}>
                    ⏱ {genericTimer}s
                  </div>
                </div>
              )}

              {/* Ясновидящий вводит подсказку */}
              {genericRound?.__event === 'round-started' && genericRound?.psychicId === socket.id && (
                <form
                  className="wavelength-input-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newGameInput.trim()) return;
                    socket.emit('game:action', { type: 'clue', text: newGameInput.trim() });
                    setNewGameInput('');
                  }}
                >
                  <input
                    className="wavelength-input"
                    value={newGameInput}
                    onChange={(e) => setNewGameInput(e.target.value)}
                    placeholder="Одно слово-подсказка..."
                    maxLength={200}
                    autoFocus
                  />
                  <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>
                    Дать подсказку
                  </Button>
                </form>
              )}

              {/* Фаза угадывания: подсказка показана, угадывают все кроме ясновидящего */}
              {genericRound?.__event === 'guess-started' && (
                <>
                  <div className="wavelength-clue-card">
                    <div className="wavelength-clue-label">Подсказка</div>
                    <div className="wavelength-clue-text">{genericRound.clue}</div>
                  </div>
                  <div className="wavelength-phase-strip">
                    <span className="wavelength-guessing-hint">Поставьте ползунок 0–100 на шкале</span>
                    <div className={`wavelength-timer${genericTimer > 0 && genericTimer <= 10 ? ' wavelength-timer--urgent' : ''}`}>
                      ⏱ {genericTimer}s
                    </div>
                  </div>
                  {genericRound.psychicId !== socket.id && (
                    <form
                      className="wavelength-input-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newGameInput.trim()) return;
                        socket.emit('game:action', { type: 'guess', value: newGameInput.trim() });
                        setNewGameInput('');
                      }}
                    >
                      <input
                        className="wavelength-input"
                        type="number"
                        min="0"
                        max="100"
                        value={newGameInput}
                        onChange={(e) => setNewGameInput(e.target.value)}
                        placeholder="0 – 100"
                      />
                      <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>
                        Угадать
                      </Button>
                    </form>
                  )}
                </>
              )}

              {/* Итог раунда */}
              {wavelengthRoundResult && (
                <div className="wavelength-reveal" aria-live="polite">
                  <div className="wavelength-reveal-title">
                    Цель была: <strong className="wavelength-reveal-target">{wavelengthRoundResult.target}</strong>
                    {wavelengthRoundResult.clue && <span className="wavelength-reveal-clue"> · «{wavelengthRoundResult.clue}»</span>}
                  </div>
                  <ul className="wavelength-reveal-list">
                    {(wavelengthRoundResult.results || []).filter(r => r.guess != null).map((r) => (
                      <li key={r.id} className={`wavelength-reveal-row${r.diff <= 5 ? ' wavelength-reveal-row--exact' : r.diff <= 20 ? ' wavelength-reveal-row--close' : ''}`}>
                        <span className="wavelength-reveal-name">{r.name}</span>
                        <span className="wavelength-reveal-guess">{r.guess}</span>
                        <span className="wavelength-reveal-earned">+{r.earned}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('wavelength').scoreLegend} />
            </div>
          </GameLayoutWrapper>
        )}

        {/* Рейтинг — расставь элементы по критерию */}
        {room.gameType === 'ranking' && room.status !== 'waiting' && (
          <GameLayoutWrapper gameType="ranking" room={room} socket={socket} players={players}>
            <div className="game-area ranking-game">
              <div className="ranking-header">
                <div className="game-area-title">📊 Рейтинг</div>
                {genericRound?.round != null && (
                  <div className="ranking-round-badge">
                    Раунд {genericRound.round} / {genericRound.maxRounds ?? '—'}
                  </div>
                )}
              </div>
              <GameRulesDisclosure>
                <GameRulesBulletList items={getStaticHelp('ranking').bullets} />
              </GameRulesDisclosure>
              {genericRound?.criterion && (
                <div className="ranking-criterion-card">
                  <div className="ranking-criterion-label">Расставьте по критерию</div>
                  <div className="ranking-criterion-text">{genericRound.criterion}</div>
                  <div className={`ranking-timer${genericTimer > 0 && genericTimer <= 15 ? ' ranking-timer--urgent' : ''}`}>
                    ⏱ {genericTimer}s
                  </div>
                </div>
              )}
              {genericRound?.__event === 'round-started' && Array.isArray(genericRound?.items) && (() => {
                const n = genericRound.items.length;
                const usedPositions = new Set(rankingDraft.filter(p => typeof p === 'number'));
                const isReady = rankingDraft.length === n && rankingDraft.every(p => typeof p === 'number') && usedPositions.size === n;
                return (
                  <div className="ranking-items-wrap">
                    <div className="ranking-items">
                      {genericRound.items.map((item, i) => (
                        <div key={i} className={`ranking-item-row${typeof rankingDraft[i] === 'number' ? ' ranking-item-row--filled' : ''}`}>
                          <span className="ranking-item-name">{item}</span>
                          <select
                            className="ranking-pos-select"
                            value={rankingDraft[i] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : Number(e.target.value);
                              setRankingDraft(prev => {
                                const next = [...prev];
                                next[i] = val;
                                return next;
                              });
                            }}
                          >
                            <option value="">—</option>
                            {Array.from({ length: n }, (_, j) => (
                              <option
                                key={j + 1}
                                value={j + 1}
                                disabled={usedPositions.has(j + 1) && rankingDraft[i] !== j + 1}
                              >
                                {j + 1}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!isReady}
                      onClick={() => {
                        if (!isReady) return;
                        const ranking = rankingDraft.map(pos => (pos ?? 1) - 1);
                        socket.emit('game:action', { type: 'submit-ranking', ranking });
                      }}
                    >
                      Подтвердить порядок
                    </Button>
                  </div>
                );
              })()}
              {rankingRoundResult && (
                <div className="ranking-reveal" aria-live="polite">
                  <div className="ranking-reveal-title">Правильный порядок</div>
                  <div className="ranking-reveal-criterion">{rankingRoundResult.criterion}</div>
                  <ol className="ranking-reveal-list">
                    {(rankingRoundResult.correctRanking || []).map((originalIdx, pos) => (
                      <li key={pos} className="ranking-reveal-row">
                        <span className="ranking-reveal-pos">{pos + 1}</span>
                        <span className="ranking-reveal-item">{rankingRoundResult.items?.[originalIdx] ?? '—'}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="ranking-reveal-scores">
                    {(rankingRoundResult.results || []).map(r => (
                      <span key={r.id} className="ranking-reveal-score-chip">
                        {r.name}: +{r.earned}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('ranking').scoreLegend} />
            </div>
          </GameLayoutWrapper>
        )}

        {/* Рифмоплёт — придумай рифму и проголосуй */}
        {room.gameType === 'rhyme' && room.status !== 'waiting' && (
          <GameLayoutWrapper gameType="rhyme" room={room} socket={socket} players={players}>
            <div className="game-area rhyme-game">
              <div className="rhyme-header">
                <div className="game-area-title">🎭 Рифмоплёт</div>
                {genericRound?.round != null && (
                  <div className="rhyme-round-badge">
                    Раунд {genericRound.round} / {genericRound.maxRounds ?? '—'}
                  </div>
                )}
              </div>
              <GameRulesDisclosure>
                <GameRulesBulletList items={getStaticHelp('rhyme').bullets} />
              </GameRulesDisclosure>

              {/* Слово для рифмы */}
              {(genericRound?.word || (genericRound?.__event === 'voting-started' && genericRound?.word)) && (
                <div className="rhyme-word-card">
                  <div className="rhyme-word-label">Слово для рифмы</div>
                  <div className="rhyme-word-text">{genericRound.word}</div>
                </div>
              )}

              {/* Фаза написания */}
              {genericRound?.__event === 'round-started' && (
                <>
                  <div className="rhyme-phase-strip">
                    <span className="rhyme-phase-label">✍️ Придумайте рифму!</span>
                    <div className={`rhyme-timer${genericTimer > 0 && genericTimer <= 10 ? ' rhyme-timer--urgent' : ''}`}>
                      ⏱ {genericTimer}s
                    </div>
                  </div>
                  <form
                    className="rhyme-input-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newGameInput.trim()) return;
                      socket.emit('game:action', { type: 'answer', text: newGameInput.trim() });
                      setNewGameInput('');
                    }}
                  >
                    <input
                      className="rhyme-input"
                      value={newGameInput}
                      onChange={(e) => setNewGameInput(e.target.value)}
                      placeholder={`Рифма к «${genericRound.word || '...'}»`}
                      maxLength={200}
                      autoFocus
                    />
                    <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>
                      Отправить
                    </Button>
                  </form>
                </>
              )}

              {/* Фаза голосования */}
              {genericRound?.__event === 'voting-started' && Array.isArray(genericRound?.anonymousAnswers) && (
                <>
                  <div className="rhyme-phase-strip">
                    <span className="rhyme-phase-label">🗳️ Выберите лучшую рифму!</span>
                    <div className={`rhyme-timer${genericTimer > 0 && genericTimer <= 10 ? ' rhyme-timer--urgent' : ''}`}>
                      ⏱ {genericTimer}s
                    </div>
                  </div>
                  <div className="rhyme-vote-grid">
                    {genericRound.anonymousAnswers.map((opt) => (
                      <button
                        key={opt.index}
                        className="rhyme-vote-card"
                        onClick={() => {
                          socket.emit('game:action', { type: 'vote', answerIdx: opt.index });
                          setNewGameSelected(String(opt.index));
                        }}
                        disabled={newGameSelected !== ''}
                        data-selected={newGameSelected === String(opt.index) ? 'true' : undefined}
                      >
                        <span className="rhyme-vote-num">{opt.index + 1}</span>
                        <span className="rhyme-vote-text">{opt.text}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Итог раунда */}
              {rhymeRoundResult && (
                <div className="rhyme-reveal" aria-live="polite">
                  <div className="rhyme-reveal-title">Победила рифма!</div>
                  {rhymeRoundResult.winnerName && (
                    <div className="rhyme-reveal-winner">🏆 {rhymeRoundResult.winnerName}</div>
                  )}
                  <div className="rhyme-reveal-list">
                    {(rhymeRoundResult.results || []).sort((a, b) => b.votes - a.votes).map((r) => (
                      <div key={r.index} className={`rhyme-reveal-row${r.isWinner ? ' rhyme-reveal-row--winner' : ''}`}>
                        <span className="rhyme-reveal-text">{r.text}</span>
                        <span className="rhyme-reveal-author">{r.playerName}</span>
                        <span className="rhyme-reveal-votes">{r.votes} 🗳️</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('rhyme').scoreLegend} />
            </div>
          </GameLayoutWrapper>
        )}

        {/* Угадай цену — назови цену товара, не превысив её */}
        {room.gameType === 'priceisright' && room.status !== 'waiting' && (
          <GameLayoutWrapper gameType="priceisright" room={room} socket={socket} players={players}>
            <div className="game-area price-game">
              <div className="price-header">
                <div className="game-area-title">🏷️ Угадай цену</div>
                {genericRound?.round != null && (
                  <div className="price-round-badge">
                    Раунд {genericRound.round} / {genericRound.maxRounds ?? '—'}
                  </div>
                )}
              </div>
              <GameRulesDisclosure>
                <GameRulesBulletList items={getStaticHelp('priceisright').bullets} />
              </GameRulesDisclosure>
              {genericRound?.__event === 'round-started' && genericRound?.product && (
                <div className="price-product-card">
                  <div className="price-product-label">Товар</div>
                  <div className="price-product-name">{genericRound.product}</div>
                  <div className="price-product-hint">Не превышайте реальную цену!</div>
                  <div className={`price-timer${genericTimer > 0 && genericTimer <= 10 ? ' price-timer--urgent' : ''}`}>
                    ⏱ {genericTimer}s
                  </div>
                </div>
              )}
              {genericRound?.__event === 'round-started' && (
                <form
                  className="price-input-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newGameInput.trim()) return;
                    socket.emit('game:action', { type: 'guess', value: newGameInput.trim() });
                    setNewGameInput('');
                  }}
                >
                  <div className="price-input-wrap">
                    <span className="price-currency">₽</span>
                    <input
                      className="price-input"
                      type="number"
                      min="0"
                      value={newGameInput}
                      onChange={(e) => setNewGameInput(e.target.value)}
                      placeholder="Ваша цена..."
                    />
                  </div>
                  <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>
                    Назвать цену
                  </Button>
                </form>
              )}
              {numericRoundReveal?.__game === 'priceisright' && (
                <div className="price-reveal" aria-live="polite">
                  <div className="price-reveal-title">Итог раунда {numericRoundReveal.round ?? '—'}</div>
                  {numericRoundReveal.product && (
                    <p className="price-reveal-product">{numericRoundReveal.product}</p>
                  )}
                  <p className="price-reveal-actual">
                    Реальная цена: <strong className="price-reveal-correct">{numericRoundReveal.actualPrice?.toLocaleString('ru-RU')} ₽</strong>
                  </p>
                  <ul className="price-reveal-list">
                    {(numericRoundReveal.results || []).map((r) => {
                      const noGuess = r.guess == null;
                      const won = Number(r.earned) > 0;
                      return (
                        <li key={r.id} className={`price-reveal-row${won ? ' price-reveal-row--winner' : ''}${r.over ? ' price-reveal-row--over' : ''}${noGuess ? ' price-reveal-row--miss' : ''}`}>
                          <span className="price-reveal-name">{r.name}</span>
                          <span className="price-reveal-guess">
                            {noGuess ? '—' : `${r.guess?.toLocaleString('ru-RU')} ₽`}
                            {r.over && <span className="price-reveal-over-tag"> превысил</span>}
                          </span>
                          {won && <span className="price-reveal-earned">+{r.earned}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('priceisright').scoreLegend} />
            </div>
          </GameLayoutWrapper>
        )}

        {/* Блеф-клуб — придумай правдоподобное определение редкого слова */}
        {room.gameType === 'bluff' && room.status !== 'waiting' && (
          <GameLayoutWrapper gameType="bluff" room={room} socket={socket} players={players}>
            <div className="game-area bluff-game">
              <div className="bluff-header">
                <div className="game-area-title">🎭 Блеф-клуб</div>
                {genericRound?.round != null && (
                  <div className="bluff-round-badge">
                    Раунд {genericRound.round} / {genericRound.maxRounds ?? '—'}
                  </div>
                )}
              </div>
              <GameRulesDisclosure>
                <GameRulesBulletList items={getStaticHelp('bluff').bullets} />
              </GameRulesDisclosure>

              {/* Слово */}
              {genericRound?.word && (
                <div className="bluff-word-card">
                  <div className="bluff-word-label">Слово</div>
                  <div className="bluff-word-text">{genericRound.word}</div>
                </div>
              )}

              {/* Фаза написания определения */}
              {genericRound?.__event === 'round-started' && (
                <>
                  <div className="bluff-phase-strip">
                    <span className="bluff-phase-label">✍️ Придумайте правдоподобное определение</span>
                    <div className="bluff-phase-meta">
                      {bluffDefCount > 0 && <span className="bluff-def-count">Сдали: {bluffDefCount}/{players.length}</span>}
                      <div className={`bluff-timer${genericTimer > 0 && genericTimer <= 15 ? ' bluff-timer--urgent' : ''}`}>⏱ {genericTimer}s</div>
                    </div>
                  </div>
                  <form
                    className="bluff-def-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newGameInput.trim()) return;
                      socket.emit('game:action', { type: 'submit-definition', text: newGameInput.trim() });
                      setNewGameInput('');
                    }}
                  >
                    <textarea
                      className="bluff-def-textarea"
                      value={newGameInput}
                      onChange={(e) => setNewGameInput(e.target.value)}
                      placeholder={`Определение слова «${genericRound.word || '...'}»`}
                      maxLength={300}
                      rows={3}
                    />
                    <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>
                      Отправить
                    </Button>
                  </form>
                </>
              )}

              {/* Фаза голосования */}
              {genericRound?.__event === 'voting-started' && Array.isArray(genericRound?.definitions) && (
                <>
                  <div className="bluff-phase-strip">
                    <span className="bluff-phase-label">🔍 Найдите настоящее определение!</span>
                    <div className={`bluff-timer${genericTimer > 0 && genericTimer <= 10 ? ' bluff-timer--urgent' : ''}`}>
                      ⏱ {genericTimer}s
                    </div>
                  </div>
                  <div className="bluff-vote-grid">
                    {genericRound.definitions.map((opt) => (
                      <button
                        key={opt.idx}
                        className="bluff-vote-card"
                        onClick={() => {
                          socket.emit('game:action', { type: 'vote', defIdx: opt.idx });
                          setNewGameSelected(String(opt.idx));
                        }}
                        disabled={newGameSelected !== ''}
                        data-selected={newGameSelected === String(opt.idx) ? 'true' : undefined}
                      >
                        <span className="bluff-vote-num">{opt.idx + 1}</span>
                        <span className="bluff-vote-text">{opt.text}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Итог раунда */}
              {bluffRoundResult && (
                <div className="bluff-reveal" aria-live="polite">
                  <div className="bluff-reveal-title">
                    Настоящее определение «{bluffRoundResult.word}»:
                  </div>
                  <div className="bluff-reveal-real">{bluffRoundResult.realDefinition}</div>
                  <div className="bluff-reveal-scores">
                    {(bluffRoundResult.results || []).map((r) => (
                      <div key={r.id} className={`bluff-reveal-row${r.votedCorrectly ? ' bluff-reveal-row--correct' : ''}${r.fooledCount > 0 ? ' bluff-reveal-row--fooled' : ''}`}>
                        <span className="bluff-reveal-name">{r.name}</span>
                        <span className="bluff-reveal-detail">
                          {r.votedCorrectly && '✓ угадал'}
                          {r.fooledCount > 0 && `😈 обманул ${r.fooledCount}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('bluff').scoreLegend} />
            </div>
          </GameLayoutWrapper>
        )}

        {/* Переигрывай! — по очереди называй что-то подходящее, последний выживший побеждает */}
        {room.gameType === 'escalation' && room.status !== 'waiting' && (
          <GameLayoutWrapper gameType="escalation" room={room} socket={socket} players={players}>
            <div className="game-area escalation-game">
              <div className="escalation-header">
                <div className="game-area-title">🔥 Переигрывай!</div>
                {genericRound?.round != null && (
                  <div className="escalation-round-badge">
                    Раунд {genericRound.round} / {genericRound.maxRounds ?? '—'}
                  </div>
                )}
              </div>
              <GameRulesDisclosure>
                <GameRulesBulletList items={getStaticHelp('escalation').bullets} />
              </GameRulesDisclosure>

              {/* Задание раунда */}
              {genericRound?.prompt && (
                <div className="escalation-prompt-card">
                  <div className="escalation-prompt-label">Задание</div>
                  <div className="escalation-prompt-text">{genericRound.prompt}</div>
                </div>
              )}

              {/* Фаза ответа */}
              {genericRound?.__event === 'turn-started' && (
                <>
                  <div className="escalation-turn-strip">
                    {genericRound.lastAnswer && (
                      <div className="escalation-last-answer">
                        <span className="escalation-last-label">Предыдущий ответ:</span>
                        <span className="escalation-last-text">«{genericRound.lastAnswer}»</span>
                      </div>
                    )}
                    <div className="escalation-active-player">
                      <span className={genericRound.playerId === socket.id ? 'escalation-you-label' : 'escalation-player-label'}>
                        {genericRound.playerId === socket.id ? '👤 Ваш ход!' : `⏳ ${genericRound.playerName} отвечает…`}
                      </span>
                      <div className={`escalation-timer${genericTimer > 0 && genericTimer <= 5 ? ' escalation-timer--urgent' : ''}`}>
                        ⏱ {genericTimer}s
                      </div>
                    </div>
                  </div>
                  {genericRound.playerId === socket.id && (
                    <form
                      className="escalation-input-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newGameInput.trim()) return;
                        socket.emit('game:action', { type: 'answer', text: newGameInput.trim() });
                        setNewGameInput('');
                      }}
                    >
                      <input
                        className="escalation-input"
                        value={newGameInput}
                        onChange={(e) => setNewGameInput(e.target.value)}
                        placeholder="Ваш ответ..."
                        maxLength={200}
                        autoFocus
                      />
                      <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>
                        Назвать
                      </Button>
                    </form>
                  )}
                </>
              )}

              {/* Фаза голосования */}
              {genericRound?.__event === 'voting-started' && (
                <>
                  <div className="escalation-vote-context">
                    {genericRound.lastAnswer && (
                      <div className="escalation-compare-row escalation-compare-row--prev">
                        <span className="escalation-compare-label">Было:</span>
                        <span className="escalation-compare-value">«{genericRound.lastAnswer}»</span>
                      </div>
                    )}
                    <div className="escalation-compare-row escalation-compare-row--new">
                      <span className="escalation-compare-label">Теперь:</span>
                      <span className="escalation-compare-value">«{genericRound.answer}»</span>
                    </div>
                    <div className={`escalation-timer escalation-timer--vote${genericTimer > 0 && genericTimer <= 5 ? ' escalation-timer--urgent' : ''}`}>
                      ⏱ {genericTimer}s
                    </div>
                  </div>
                  {escalationCurrentPlayerId !== socket.id && (
                    <div className="escalation-vote-btns">
                      <button
                        className="escalation-vote-btn escalation-vote-btn--accept"
                        onClick={() => socket.emit('game:action', { type: 'vote', accept: true })}
                      >
                        ✓ Принять
                      </button>
                      <button
                        className="escalation-vote-btn escalation-vote-btn--reject"
                        onClick={() => socket.emit('game:action', { type: 'vote', accept: false })}
                      >
                        ✗ Отклонить
                      </button>
                    </div>
                  )}
                  {escalationCurrentPlayerId === socket.id && (
                    <div className="escalation-waiting">Ждём голосов других игроков…</div>
                  )}
                </>
              )}

              <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('escalation').scoreLegend} />
            </div>
          </GameLayoutWrapper>
        )}

        {room.gameType === 'memory' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="memory-game" title={`🧠 Память | ⏱ ${genericTimer}s`}>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('memory').bullets} />
            </GameRulesDisclosure>

            {genericRound?.__event === 'round-started' && (
              <div className="memory-waiting">
                <div className="memory-round-info">Раунд {genericRound.round} из {genericRound.maxRounds}</div>
                <div className="memory-round-hint">Длина последовательности: <strong>{genericRound.sequenceLength}</strong></div>
                <div className="memory-round-hint secondary">Ожидайте показа…</div>
              </div>
            )}

            {genericRound?.__event === 'sequence-shown' && Array.isArray(genericRound?.items) && (
              <div className="memory-sequence-phase">
                <div className="memory-phase-label memory-phase-label--show">👁 Запомните последовательность!</div>
                <div className="memory-tiles">
                  {genericRound.items.map((emoji, i) => (
                    <span key={i} className="memory-tile memory-tile--visible">{emoji}</span>
                  ))}
                </div>
              </div>
            )}

            {genericRound?.__event === 'sequence-hidden' && (() => {
              const seqLen = genericRound?.sequenceLength || 3;
              const SYMBOLS = ['🔴', '🟢', '🔵', '🟡', '🟣', '🟠', '⚪', '🟤'];
              const done = memorySelected.length >= seqLen;
              return (
                <>
                  <div className="memory-sequence-phase">
                    <div className="memory-phase-label memory-phase-label--hide">✏️ Воспроизведите последовательность!</div>
                    <div className="memory-tiles">
                      {Array.from({ length: seqLen }).map((_, i) => (
                        <span key={i} className={`memory-tile${memorySelected[i] ? ' memory-tile--selected' : ' memory-tile--hidden'}`}>
                          {memorySelected[i] || '❓'}
                        </span>
                      ))}
                    </div>
                  </div>
                  {!done && (
                    <div className="memory-symbol-grid">
                      {SYMBOLS.map((sym) => (
                        <button
                          key={sym}
                          className="memory-symbol-btn"
                          onClick={() => setMemorySelected((prev) => prev.length < seqLen ? [...prev, sym] : prev)}
                        >{sym}</button>
                      ))}
                    </div>
                  )}
                  <div className="memory-actions">
                    <Button variant="secondary" size="sm" disabled={memorySelected.length === 0} onClick={() => setMemorySelected((prev) => prev.slice(0, -1))}>
                      ← Отменить
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={memorySelected.length === 0}
                      onClick={() => { socket.emit('game:action', { type: 'answer', value: memorySelected }); setMemorySelected([]); }}
                    >
                      {done ? 'Подтвердить ✓' : `Отправить (${memorySelected.length}/${seqLen})`}
                    </Button>
                  </div>
                </>
              );
            })()}

            {memoryRoundResult && (
              <div className="memory-result">
                <div className="memory-result-label">Правильная последовательность:</div>
                <div className="memory-tiles">
                  {(memoryRoundResult.correctSequence || []).map((emoji, i) => (
                    <span key={i} className="memory-tile memory-tile--reveal">{emoji}</span>
                  ))}
                </div>
                <div className="memory-result-stats">
                  <span className="memory-stat memory-stat--survived">✅ {memoryRoundResult.survivedCount ?? 0} выжили</span>
                  <span className="memory-stat memory-stat--eliminated">❌ {memoryRoundResult.eliminatedCount ?? 0} выбыли</span>
                </div>
              </div>
            )}

            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('memory').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {room.gameType === 'anagrams' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="anagrams-game" title={`🔤 Анаграммы | Раунд ${genericRound?.round ?? '—'}/${genericRound?.maxRounds ?? '—'} | ⏱ ${genericTimer}s`}>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('anagrams').bullets} />
            </GameRulesDisclosure>

            {Array.isArray(genericRound?.letters) && (
              <div className="anagrams-board">
                <div className="anagrams-board-label">Составляйте слова из букв:</div>
                <div className="anagrams-tiles">
                  {genericRound.letters.map((l, i) => (
                    <span key={i} className="anagrams-tile">{l}</span>
                  ))}
                </div>
                <div className="anagrams-tip">Слово ≥ 6 букв → ×2 очков</div>
                <form className="anagrams-input-form" onSubmit={(e) => { e.preventDefault(); if (!newGameInput.trim()) return; socket.emit('game:action', { type: 'answer', text: newGameInput.trim() }); setNewGameInput(''); }}>
                  <input className="anagrams-input" value={newGameInput} onChange={(e) => setNewGameInput(e.target.value)} placeholder="Введите слово…" maxLength={50} autoComplete="off" />
                  <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>Отправить</Button>
                </form>
              </div>
            )}

            {anagramsRoundResult && (
              <div className="anagrams-result">
                <div className="anagrams-result-header">
                  Найдено слов: <strong>{anagramsRoundResult.wordsCount}</strong>
                </div>
                {Array.isArray(anagramsRoundResult.words) && anagramsRoundResult.words.length > 0 ? (
                  <div className="anagrams-words-list">
                    {anagramsRoundResult.words.map((w, i) => (
                      <div key={i} className={`anagrams-word-row${(w.points || 0) >= 12 ? ' anagrams-word-row--big' : ''}`}>
                        <span className="anagrams-word-text">{w.word}</span>
                        <span className="anagrams-word-player">{w.playerName}</span>
                        <span className="anagrams-word-pts">+{w.points}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="anagrams-result-empty">Никто не нашёл слов в этом раунде</div>
                )}
              </div>
            )}

            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('anagrams').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {room.gameType === 'wordchain' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="wordchain-game" title={`🔗 Цепочка слов | ⏱ ${genericTimer}s`}>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('wordchain').bullets} />
            </GameRulesDisclosure>

            {genericRound?.__event === 'round-started' && (
              <div className="wordchain-header">
                <div className="wordchain-category-card">
                  <div className="wordchain-category-label">Категория</div>
                  <div className="wordchain-category-value">{genericRound.category}</div>
                </div>
                <div className="wordchain-start-letter">
                  <div className="wordchain-letter-label">Первая буква</div>
                  <div className="wordchain-letter-value">{genericRound.letter}</div>
                </div>
              </div>
            )}

            {wordchainChain.length > 0 && !wordchainRoundResult && (
              <div className="wordchain-chain">
                <div className="wordchain-chain-label">Цепочка ({wordchainChain.length}):</div>
                <div className="wordchain-chain-words">
                  {wordchainChain.slice(-6).map((w, i, arr) => (
                    <span key={i} className={`wordchain-word${i === arr.length - 1 ? ' wordchain-word--last' : ''}`}>
                      {w}
                      {i < arr.length - 1 && <span className="wordchain-arrow">→</span>}
                    </span>
                  ))}
                </div>
                {wordchainNextLetter && (
                  <div className="wordchain-next">
                    Следующее слово на букву: <span className="wordchain-next-letter">{wordchainNextLetter}</span>
                  </div>
                )}
              </div>
            )}

            {wordchainRoundResult && (
              <div className="wordchain-result">
                <div className="wordchain-result-header">
                  Цепочка раунда: <strong>{wordchainRoundResult.chainLength}</strong> слов
                </div>
                {Array.isArray(wordchainRoundResult.chain) && wordchainRoundResult.chain.length > 0 && (
                  <div className="wordchain-result-words">
                    {wordchainRoundResult.chain.map((w, i) => (
                      <span key={i} className="wordchain-result-word">
                        {w}{i < wordchainRoundResult.chain.length - 1 && <span className="wordchain-arrow">→</span>}
                      </span>
                    ))}
                  </div>
                )}
                {(!wordchainRoundResult.chain || wordchainRoundResult.chain.length === 0) && (
                  <div className="wordchain-result-empty">Цепочка не создана</div>
                )}
              </div>
            )}

            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('wordchain').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {room.gameType === 'facts' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="facts-game" title={`🧪 Факты | Раунд ${genericRound?.round ?? '—'}/${genericRound?.maxRounds ?? '—'} | ⏱ ${genericTimer}s`}>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('facts').bullets} />
            </GameRulesDisclosure>

            {genericRound?.fact && !factsRoundResult && (
              <div className="facts-card">
                <div className="facts-card-eyebrow">Факт или вымысел?</div>
                <div className="facts-card-text">{genericRound.fact}</div>
                {!factsMyChoice ? (
                  <div className="facts-vote-btns">
                    <button className="facts-vote-btn facts-vote-btn--yes" onClick={() => { socket.emit('game:action', { type: 'answer', text: 'да' }); setFactsMyChoice('yes'); }}>✅ Правда</button>
                    <button className="facts-vote-btn facts-vote-btn--no" onClick={() => { socket.emit('game:action', { type: 'answer', text: 'нет' }); setFactsMyChoice('no'); }}>❌ Ложь</button>
                  </div>
                ) : (
                  <div className={`facts-answered facts-answered--${factsMyChoice}`}>
                    {factsMyChoice === 'yes' ? '✅ Вы выбрали: Правда' : '❌ Вы выбрали: Ложь'}
                  </div>
                )}
                {factsAnswerCount > 0 && (
                  <div className="facts-answer-count">Ответили: {factsAnswerCount}</div>
                )}
              </div>
            )}

            {factsRoundResult && (
              <div className="facts-result">
                <div className="facts-result-fact">{factsRoundResult.fact}</div>
                <div className={`facts-verdict facts-verdict--${factsRoundResult.truth ? 'true' : 'false'}`}>
                  {factsRoundResult.truth ? '✅ Это правда!' : '❌ Это ложь!'}
                </div>
                {Array.isArray(factsRoundResult.results) && factsRoundResult.results.length > 0 && (
                  <div className="facts-player-results">
                    {factsRoundResult.results.map((r) => (
                      <div key={r.id} className={`facts-player-row facts-player-row--${r.correct ? 'correct' : 'wrong'}`}>
                        <span className="facts-player-icon">{r.correct ? '✓' : '✗'}</span>
                        <span className="facts-player-name">{r.name}</span>
                        <span className="facts-player-guess">{r.guess === undefined ? '—' : r.guess ? 'Да' : 'Нет'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('facts').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {room.gameType === 'sequence' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="sequence-game" title={`🔢 Последовательность | Раунд ${genericRound?.round ?? '—'}/${genericRound?.maxRounds ?? '—'} | ⏱ ${genericTimer}s`}>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('sequence').bullets} />
            </GameRulesDisclosure>

            {genericRound?.hint && !sequenceRoundResult && (
              <div className="sequence-card">
                <div className="sequence-card-eyebrow">Найдите следующее число</div>
                <div className="sequence-bubbles">
                  {genericRound.hint.split(',').map((part, i, arr) => {
                    const val = part.trim();
                    const isLast = i === arr.length - 1;
                    return (
                      <span key={i} className={`sequence-bubble${isLast ? ' sequence-bubble--q' : ''}`}>
                        {val}
                        {!isLast && <span className="sequence-comma">,</span>}
                      </span>
                    );
                  })}
                </div>
                <form className="sequence-input-form" onSubmit={(e) => { e.preventDefault(); if (!newGameInput.trim()) return; socket.emit('game:action', { type: 'answer', text: newGameInput.trim() }); setNewGameInput(''); }}>
                  <input className="sequence-input" value={newGameInput} onChange={(e) => setNewGameInput(e.target.value)} placeholder="Следующее число…" maxLength={20} autoComplete="off" />
                  <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>Ответить</Button>
                </form>
              </div>
            )}

            {sequenceRoundResult && (
              <div className="sequence-result">
                <div className="sequence-result-hint">{sequenceRoundResult.hint}</div>
                <div className="sequence-result-answer">= {sequenceRoundResult.answer}</div>
              </div>
            )}

            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('sequence').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {room.gameType === 'bombparty' && room.status !== 'waiting' && (
          <GameLayoutWrapper
            className={`bombparty-game${bombpartyExploded ? ' bombparty-game--exploded' : ''}${genericTimer <= 5 && !bombpartyExploded ? ' bombparty-game--urgent' : ''}`}
            title={`💣 Бомба | Раунд ${genericRound?.round ?? '—'}/${genericRound?.maxRounds ?? '—'} | ⏱ ${genericTimer}s`}
          >
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('bombparty').bullets} />
            </GameRulesDisclosure>

            {genericRound?.letter && (
              <div className="bombparty-panel">
                <div className="bombparty-icon">{bombpartyExploded ? '💥' : '💣'}</div>
                <div className="bombparty-requirements">
                  <div className="bombparty-req-block">
                    <div className="bombparty-req-label">Буква в слове</div>
                    <div className="bombparty-req-letter">{genericRound.letter}</div>
                  </div>
                  <div className="bombparty-req-sep">·</div>
                  <div className="bombparty-req-block">
                    <div className="bombparty-req-label">Категория</div>
                    <div className="bombparty-req-category">{genericRound.category}</div>
                  </div>
                </div>
                {bombpartyExploded ? (
                  <div className="bombparty-exploded-msg">Бомба взорвалась!</div>
                ) : (
                  <form className="bombparty-input-form" onSubmit={(e) => { e.preventDefault(); if (!newGameInput.trim()) return; socket.emit('game:action', { type: 'answer', text: newGameInput.trim() }); setNewGameInput(''); }}>
                    <input className="bombparty-input" value={newGameInput} onChange={(e) => setNewGameInput(e.target.value)} placeholder="Слово с этой буквой…" maxLength={60} autoComplete="off" />
                    <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>Взорвать</Button>
                  </form>
                )}
              </div>
            )}

            {bombpartyUsedWords.length > 0 && (
              <div className="bombparty-used-words">
                <div className="bombparty-used-label">Использованные слова:</div>
                <div className="bombparty-used-list">
                  {bombpartyUsedWords.slice(0, 12).map((w, i) => (
                    <span key={i} className="bombparty-used-chip">{w.word}</span>
                  ))}
                </div>
              </div>
            )}

            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('bombparty').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {/* ===== PSYCH ===== */}
        {room.gameType === 'psych' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="psych-game" title={`🔮 Психолог | Раунд ${genericRound?.round ?? '—'}/${genericRound?.maxRounds ?? '—'} | ⏱ ${genericTimer}s`}>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('psych').bullets} /></GameRulesDisclosure>
            {genericRound?.__event === 'round-started' && (
              <div className="psych-card">
                <div className={`psych-role-badge${genericRound.psychId === socket.id ? ' psych-role-badge--psych' : ''}`}>
                  {genericRound.psychId === socket.id ? '🔮 Вы — Психолог' : '✍️ Вы отвечаете'}
                </div>
                <div className="psych-question">{genericRound.question}</div>
                {genericRound.psychId === socket.id ? (
                  <div className="psych-hint">Ждите ответов других игроков…</div>
                ) : (
                  <form className="psych-input-form" onSubmit={(e) => { e.preventDefault(); if (!newGameInput.trim()) return; socket.emit('game:action', { type: 'answer', text: newGameInput.trim() }); setNewGameInput(''); }}>
                    <input className="psych-input" value={newGameInput} onChange={(e) => setNewGameInput(e.target.value)} placeholder="Ваш честный ответ…" maxLength={200} autoComplete="off" />
                    <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>Отправить</Button>
                  </form>
                )}
              </div>
            )}
            {genericRound?.__event === 'guessing-started' && genericRound?.psychId === socket.id && Array.isArray(genericRound?.answers) && (
              <div className="psych-guessing">
                <div className="psych-guessing-label">Угадайте, кто что написал:</div>
                {genericRound.answers.map((a) => (
                  <div key={a.index} className="psych-answer-row">
                    <div className="psych-answer-text">«{a.text}»</div>
                    <select className="psych-select" onChange={(e) => { if (e.target.value) socket.emit('game:action', { type: 'vote', answerIdx: a.index, targetId: e.target.value }); }}>
                      <option value="">— Кто это? —</option>
                      {(genericRound.candidates || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
            {genericRound?.__event === 'guessing-started' && genericRound?.psychId !== socket.id && (
              <div className="psych-waiting">🔮 Психолог угадывает ответы…</div>
            )}
            {psychRoundResult && (
              <div className="psych-result">
                <div className="psych-result-header">{psychRoundResult.correct}/{psychRoundResult.total} угадано</div>
                {(psychRoundResult.results || []).map((r, i) => (
                  <div key={i} className={`psych-result-row psych-result-row--${r.guessed ? 'correct' : 'wrong'}`}>
                    <span>{r.guessed ? '✓' : '✗'}</span><span>{r.playerName}</span>
                    <span className="psych-result-answer">«{r.answer}»</span>
                  </div>
                ))}
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('psych').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {/* ===== JUDGE ===== */}
        {room.gameType === 'judge' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="judge-game" title={`⚖️ Судья | Раунд ${genericRound?.round ?? '—'}/${genericRound?.maxRounds ?? '—'} | ⏱ ${genericTimer}s`}>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('judge').bullets} /></GameRulesDisclosure>
            {(genericRound?.__event === 'round-started' || genericRound?.__event === 'voting-started') && genericRound?.situation && (
              <div className="judge-card">
                <div className="judge-card-eyebrow">Ситуация</div>
                <div className="judge-situation">{genericRound.situation}</div>
                <div className="judge-sides">
                  <div className="judge-side judge-side--a">
                    <div className="judge-side-label">Сторона А</div>
                    <div className="judge-side-name">{genericRound.sideA}</div>
                  </div>
                  <div className="judge-vs">vs</div>
                  <div className="judge-side judge-side--b">
                    <div className="judge-side-label">Сторона Б</div>
                    <div className="judge-side-name">{genericRound.sideB}</div>
                  </div>
                </div>
                {genericRound.__event === 'round-started' && (
                  <div className="judge-hint">
                    {genericRound.judgeId === socket.id ? `⚖️ Вы — Судья. Слушайте аргументы в Discord.` : `Судья: ${genericRound.judgeName}. Убеждайте голосом в Discord!`}
                  </div>
                )}
                {genericRound.__event === 'voting-started' && genericRound.judgeId === socket.id && (
                  <div className="judge-vote-btns">
                    <button className="judge-vote-btn judge-vote-btn--a" onClick={() => socket.emit('game:action', { type: 'choice', choice: 'A' })}>{genericRound.sideA}</button>
                    <button className="judge-vote-btn judge-vote-btn--b" onClick={() => socket.emit('game:action', { type: 'choice', choice: 'B' })}>{genericRound.sideB}</button>
                  </div>
                )}
                {genericRound.__event === 'voting-started' && genericRound.judgeId !== socket.id && (
                  <div className="judge-hint">Судья выносит вердикт…</div>
                )}
              </div>
            )}
            {judgeRoundResult && (
              <div className="judge-result">
                <div className="judge-result-label">Вердикт: {judgeRoundResult.winner || '—'}</div>
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('judge').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {/* ===== IMPOSTOR ===== */}
        {room.gameType === 'impostor' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="impostor-game" title={`🕵️ Самозванец | Раунд ${genericRound?.round ?? '—'}/${genericRound?.maxRounds ?? '—'} | ⏱ ${genericTimer}s`}>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('impostor').bullets} /></GameRulesDisclosure>
            {genericRound?.__impostorRole && (
              <div className={`impostor-role-card${genericRound.__impostorRole.isImpostor ? ' impostor-role-card--impostor' : ''}`}>
                <div className="impostor-role-icon">{genericRound.__impostorRole.isImpostor ? '🕵️' : '💼'}</div>
                <div className="impostor-role-title">{genericRound.__impostorRole.isImpostor ? 'Вы — Самозванец!' : 'Ваша профессия'}</div>
                <div className="impostor-role-value">{genericRound.__impostorRole.profession}</div>
                {!genericRound.__impostorRole.isImpostor && <div className="impostor-hint">Обсуждайте в Discord. Найдите того, кто не знает профессию!</div>}
                {genericRound.__impostorRole.isImpostor && <div className="impostor-hint">Притворяйтесь профессионалом. Не попадитесь!</div>}
              </div>
            )}
            {genericRound?.__event === 'round-started' && (
              <div className="impostor-discussion-phase">
                <div className="impostor-discussion-icon">💬</div>
                <div className="impostor-discussion-label">Фаза обсуждения</div>
                <div className="impostor-discussion-hint">Общайтесь в Discord — кто говорит уклончиво?</div>
              </div>
            )}
            {genericRound?.__event === 'voting-started' && Array.isArray(genericRound?.candidates) && (
              <div className="impostor-vote">
                <div className="impostor-vote-label">Кто Самозванец?</div>
                <div className="impostor-vote-options">
                  {genericRound.candidates.map((p) => (
                    <button key={p.id} className="impostor-vote-btn" onClick={() => socket.emit('game:action', { type: 'vote', targetId: p.id })}>{p.name}</button>
                  ))}
                </div>
              </div>
            )}
            {impostorRoundResult && (
              <div className="impostor-result">
                <div className={`impostor-result-verdict${impostorRoundResult.caught ? ' impostor-result-verdict--caught' : ' impostor-result-verdict--escaped'}`}>
                  {impostorRoundResult.caught ? '🎉 Самозванец пойман!' : '🕵️ Самозванец скрылся!'}
                </div>
                <div className="impostor-result-info">Профессии: {impostorRoundResult.realProfession} / {impostorRoundResult.fakeProfession}</div>
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('impostor').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {/* ===== CAPTION ===== */}
        {room.gameType === 'caption' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="caption-game" title={`🎬 Подпись | Раунд ${genericRound?.round ?? '—'}/${genericRound?.maxRounds ?? '—'} | ⏱ ${genericTimer}s`}>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('caption').bullets} /></GameRulesDisclosure>
            {genericRound?.__event === 'round-started' && (
              <div className="caption-card">
                <div className="caption-card-eyebrow">Ситуация</div>
                <div className="caption-prompt">{genericRound.prompt}</div>
                {genericRound.judgeId === socket.id ? (
                  <div className="caption-hint caption-hint--judge">⚖️ Вы — Судья. Ждите подписей от других игроков.</div>
                ) : (
                  <>
                    <form className="caption-input-form" onSubmit={(e) => { e.preventDefault(); if (!newGameInput.trim()) return; socket.emit('game:action', { type: 'answer', text: newGameInput.trim() }); setNewGameInput(''); }}>
                      <input className="caption-input" value={newGameInput} onChange={(e) => setNewGameInput(e.target.value)} placeholder="Смешная подпись…" maxLength={300} autoComplete="off" />
                      <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>Отправить</Button>
                    </form>
                    {captionAnswerCount > 0 && <div className="caption-count">Отправили: {captionAnswerCount}</div>}
                  </>
                )}
              </div>
            )}
            {genericRound?.__event === 'voting-started' && genericRound?.judgeId === socket.id && Array.isArray(genericRound?.submissions) && (
              <div className="caption-vote">
                <div className="caption-vote-label">Выберите лучшую подпись:</div>
                {genericRound.submissions.map((s, i) => (
                  <button key={i} className="caption-vote-card" onClick={() => socket.emit('game:action', { type: 'vote', answerIdx: i })}>
                    <span className="caption-vote-text">{s.text}</span>
                    <span className="caption-vote-author">{s.playerName}</span>
                  </button>
                ))}
              </div>
            )}
            {genericRound?.__event === 'voting-started' && genericRound?.judgeId !== socket.id && (
              <div className="caption-waiting">Судья выбирает лучшую подпись…</div>
            )}
            {captionRoundResult && (
              <div className="caption-result">
                <div className="caption-result-label">🏆 Победитель: {captionRoundResult.winnerName || '—'}</div>
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('caption').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {/* ===== FLAGS ===== */}
        {room.gameType === 'flags' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="flags-game" title="🌍 Флаги мира">
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('flags').bullets} /></GameRulesDisclosure>
            <div className="flags-meta-row">
              <span className="flags-round-badge">Раунд {genericRound?.round ?? '—'} / {genericRound?.maxRounds ?? '—'}</span>
              <span className={`flags-timer-badge${genericTimer <= 5 ? ' flags-timer--urgent' : ''}`}>⏱ {genericTimer}с</span>
            </div>
            {genericRound?.emoji && !flagsRoundResult && (
              <div className="flags-card">
                <div className="flags-flag-display">{genericRound.emoji}</div>
                <div className="flags-question-text">Какая это страна?</div>
                <form className="flags-input-form" onSubmit={(e) => { e.preventDefault(); if (!newGameInput.trim()) return; socket.emit('game:action', { type: 'answer', text: newGameInput.trim() }); setNewGameInput(''); }}>
                  <input className="flags-input" value={newGameInput} onChange={(e) => setNewGameInput(e.target.value)} placeholder="Введите страну…" maxLength={100} autoComplete="off" />
                  <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>Ответить</Button>
                </form>
              </div>
            )}
            {flagsRoundResult && (
              <div className="flags-reveal">
                <div className="flags-reveal-flag">{flagsRoundResult.emoji ?? genericRound?.emoji}</div>
                <div className="flags-reveal-label">Правильный ответ</div>
                <div className="flags-reveal-country">{flagsRoundResult.answer ?? flagsRoundResult.country}</div>
                {flagsRoundResult.playerName
                  ? <div className="flags-reveal-winner">🏆 {flagsRoundResult.playerName} угадал(а)!</div>
                  : <div className="flags-reveal-nobody">Никто не угадал</div>}
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('flags').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {/* ===== LOGOS ===== */}
        {room.gameType === 'logos' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="logos-game" title={`🏷️ Логотипы | Раунд ${genericRound?.round ?? '—'}/${genericRound?.maxRounds ?? '—'} | ⏱ ${genericTimer}s`}>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('logos').bullets} /></GameRulesDisclosure>
            {genericRound?.hint && !logosRoundResult && (
              <div className="trivia-card logos-card">
                <div className="trivia-brand-icon">🏷️</div>
                <div className="trivia-prompt">{genericRound.hint}</div>
                <form className="trivia-input-form" onSubmit={(e) => { e.preventDefault(); if (!newGameInput.trim()) return; socket.emit('game:action', { type: 'answer', text: newGameInput.trim() }); setNewGameInput(''); }}>
                  <input className="trivia-input" value={newGameInput} onChange={(e) => setNewGameInput(e.target.value)} placeholder="Название бренда…" maxLength={100} autoComplete="off" />
                  <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>Ответить</Button>
                </form>
              </div>
            )}
            {logosRoundResult && (
              <div className="trivia-result logos-result">
                <div className="trivia-result-answer">{logosRoundResult.answer}</div>
                {logosRoundResult.playerName && <div className="trivia-result-winner">🏆 {logosRoundResult.playerName}</div>}
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('logos').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {/* ===== MAPS ===== */}
        {room.gameType === 'maps' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="maps-game" title={`🗺️ Карты | Раунд ${genericRound?.round ?? '—'}/${genericRound?.maxRounds ?? '—'} | ⏱ ${genericTimer}s`}>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('maps').bullets} /></GameRulesDisclosure>
            {genericRound?.hint && !mapsRoundResult && (
              <div className="trivia-card maps-card">
                <div className="trivia-emoji">🗺️</div>
                <div className="trivia-prompt">{genericRound.hint}</div>
                <form className="trivia-input-form" onSubmit={(e) => { e.preventDefault(); if (!newGameInput.trim()) return; socket.emit('game:action', { type: 'answer', text: newGameInput.trim() }); setNewGameInput(''); }}>
                  <input className="trivia-input" value={newGameInput} onChange={(e) => setNewGameInput(e.target.value)} placeholder="Город или страна…" maxLength={100} autoComplete="off" />
                  <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>Ответить</Button>
                </form>
              </div>
            )}
            {mapsRoundResult && (
              <div className="trivia-result maps-result">
                <div className="trivia-result-answer">{mapsRoundResult.answer}</div>
                {mapsRoundResult.playerName && <div className="trivia-result-winner">🏆 {mapsRoundResult.playerName}</div>}
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('maps').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {/* ===== QUOTES ===== */}
        {room.gameType === 'quotes' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="quotes-game" title={`💬 Цитаты | Раунд ${genericRound?.round ?? '—'}/${genericRound?.maxRounds ?? '—'} | ⏱ ${genericTimer}s`}>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('quotes').bullets} /></GameRulesDisclosure>
            {genericRound?.quote && !quotesRoundResult && (
              <div className="quotes-card">
                <div className="quotes-card-mark">"</div>
                <div className="quotes-text">{genericRound.quote}</div>
                <form className="quotes-input-form" onSubmit={(e) => { e.preventDefault(); if (!newGameInput.trim()) return; socket.emit('game:action', { type: 'answer', text: newGameInput.trim() }); setNewGameInput(''); }}>
                  <input className="quotes-input" value={newGameInput} onChange={(e) => setNewGameInput(e.target.value)} placeholder="Автор цитаты…" maxLength={100} autoComplete="off" />
                  <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>Ответить</Button>
                </form>
              </div>
            )}
            {quotesRoundResult && (
              <div className="quotes-result">
                <div className="quotes-result-quote">«{quotesRoundResult.quote || genericRound?.quote}»</div>
                <div className="quotes-result-author">— {quotesRoundResult.answer || quotesRoundResult.author}</div>
                {quotesRoundResult.playerName && <div className="quotes-result-winner">🏆 {quotesRoundResult.playerName}</div>}
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('quotes').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {/* ===== HOTPOTATO ===== */}
        {room.gameType === 'hotpotato' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="hotpotato-game" title={`🥔 Горячая картошка | ⏱ ${genericTimer}s`}>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('hotpotato').bullets} /></GameRulesDisclosure>
            {genericRound?.__event === 'potato-exploded' && (
              <div className={`hotpotato-panel${genericRound.playerId === socket.id ? ' hotpotato-panel--mine' : ''}`}>
                <div className="hotpotato-emoji">💥</div>
                <div className="hotpotato-player">{genericRound.playerName}</div>
                <div className="hotpotato-question">{genericRound.question}</div>
                {genericRound.playerId === socket.id && (
                  <>
                    <div className="hotpotato-urgent">Ответьте! ({genericTimer} сек)</div>
                    <form className="hotpotato-input-form" onSubmit={(e) => { e.preventDefault(); if (!newGameInput.trim()) return; socket.emit('game:action', { type: 'answer', text: newGameInput.trim() }); setNewGameInput(''); }}>
                      <input className="hotpotato-input" value={newGameInput} onChange={(e) => setNewGameInput(e.target.value)} placeholder="Ваш ответ…" maxLength={200} autoFocus autoComplete="off" />
                      <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>Ответить</Button>
                    </form>
                  </>
                )}
              </div>
            )}
            {genericRound?.__event === 'potato-passing' && (
              <div className={`hotpotato-passing${genericRound.currentPlayerId === socket.id ? ' hotpotato-passing--mine' : ''}`}>
                <div className="hotpotato-potato-emoji">🥔</div>
                <div className="hotpotato-holder">
                  {genericRound.currentPlayerId === socket.id
                    ? '🔥 У вас картошка!'
                    : `У ${genericRound.currentPlayerName} картошка`}
                </div>
                {genericRound.question && (
                  <div className="hotpotato-question-card">
                    <div className="hotpotato-question-label">Категория</div>
                    <div className="hotpotato-question-text">{genericRound.question}</div>
                  </div>
                )}
              </div>
            )}
            {(!genericRound || (genericRound.__event !== 'potato-exploded' && genericRound.__event !== 'potato-passing')) && (
              <div className="hotpotato-passing">
                <div className="hotpotato-potato-emoji">🥔</div>
                <div className="hotpotato-hint">Картошка передаётся по кругу…</div>
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('hotpotato').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {/* ===== FIBBING ===== */}
        {room.gameType === 'fibbing' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="fibbing-game" title={`🤥 Врун | Раунд ${genericRound?.round ?? '—'}/${genericRound?.maxRounds ?? '—'} | ⏱ ${genericTimer}s`}>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('fibbing').bullets} /></GameRulesDisclosure>
            {genericRound?.__event === 'round-started' && (
              <div className="fibbing-card">
                <div className={`fibbing-role${fibbingIsTruthTeller ? ' fibbing-role--truth' : ' fibbing-role--lie'}`}>
                  {fibbingIsTruthTeller ? '✅ Вы говорите правду' : '🤥 Вы врёте'}
                </div>
                <div className="fibbing-question">{genericRound.question}</div>
                <div className="fibbing-hint">{fibbingIsTruthTeller ? 'Напишите честный ответ ниже' : 'Придумайте правдоподобный ответ'}</div>
                <form className="fibbing-input-form" onSubmit={(e) => { e.preventDefault(); if (!newGameInput.trim()) return; socket.emit('game:action', { type: 'answer', text: newGameInput.trim() }); setNewGameInput(''); }}>
                  <input className="fibbing-input" value={newGameInput} onChange={(e) => setNewGameInput(e.target.value)} placeholder="Ваш ответ…" maxLength={300} />
                  <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>Отправить</Button>
                </form>
              </div>
            )}
            {genericRound?.__event === 'voting-started' && Array.isArray(genericRound?.answers) && (
              <div className="fibbing-vote">
                <div className="fibbing-vote-label">Какой ответ — правда?</div>
                {genericRound.answers.map((a) => (
                  <button key={a.idx} className="fibbing-vote-card" onClick={() => socket.emit('game:action', { type: 'vote', answerIdx: a.idx })}>
                    {a.text}
                  </button>
                ))}
              </div>
            )}
            {fibbingRoundResult && (
              <div className="fibbing-result">
                <div className="fibbing-result-label">Правда: {fibbingRoundResult.truthAnswer}</div>
                {(fibbingRoundResult.results || []).map((r, i) => (
                  <div key={i} className={`fibbing-result-row fibbing-result-row--${r.correct ? 'correct' : 'wrong'}`}>
                    <span>{r.correct ? '✓' : '✗'}</span><span>{r.playerName}</span>
                  </div>
                ))}
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('fibbing').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {/* ===== PREDICTION ===== */}
        {room.gameType === 'prediction' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="prediction-game" title={`🔮 Предсказание | Раунд ${genericRound?.round ?? '—'}/${genericRound?.maxRounds ?? '—'} | ⏱ ${genericTimer}s`}>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('prediction').bullets} /></GameRulesDisclosure>
            {genericRound?.question && (
              <div className="prediction-card">
                <div className="prediction-card-eyebrow">Вопрос</div>
                <div className="prediction-question">{genericRound.question}</div>
              </div>
            )}
            {Array.isArray(genericRound?.candidates) && !predictionRoundResult && (
              <div className="prediction-vote">
                <div className="prediction-vote-label">Кто ответит лучше всех?</div>
                <div className="prediction-vote-options">
                  {genericRound.candidates.filter((p) => p.id !== socket.id).map((p) => (
                    <button key={p.id} className="prediction-vote-btn" onClick={() => socket.emit('game:action', { type: 'vote', targetId: p.id })}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {predictionRoundResult && (
              <div className="prediction-result">
                <div className="prediction-result-label">{predictionRoundResult.winner ? `🏆 ${predictionRoundResult.winner.name} набрал(а) больше всего голосов` : 'Ничья'}</div>
                {Array.isArray(predictionRoundResult.results) && predictionRoundResult.results.length > 0 && (
                  <div className="prediction-result-rows">
                    {predictionRoundResult.results.map((r) => {
                      const votedFor = predictionRoundResult.results.find((x) => x.id === r.votedFor);
                      const isWinner = predictionRoundResult.winners?.includes(r.id);
                      const guessedRight = r.votedFor && predictionRoundResult.winners?.includes(r.votedFor);
                      return (
                        <div key={r.id} className={`prediction-result-row${isWinner ? ' prediction-result-row--winner' : ''}`}>
                          <span className="prediction-result-name">{r.name}</span>
                          <span className="prediction-result-voted">→ {votedFor?.name ?? '—'}</span>
                          <span className={`prediction-result-check${guessedRight ? ' prediction-result-check--right' : ' prediction-result-check--wrong'}`}>
                            {guessedRight ? '✓' : '✗'}
                          </span>
                          <span className="prediction-result-votes">{r.votesReceived} гол.</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('prediction').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {/* ===== CONNECT ===== */}
        {room.gameType === 'connect' && room.status !== 'waiting' && (
          <GameLayoutWrapper className="connect-game" title={`🔗 Связи | Раунд ${genericRound?.round ?? '—'}/${genericRound?.maxRounds ?? '—'} | ⏱ ${genericTimer}s`}>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('connect').bullets} /></GameRulesDisclosure>
            {genericRound?.word1 && genericRound?.word2 && (
              <div className="connect-card">
                <div className="connect-words">
                  <span className="connect-word">{genericRound.word1}</span>
                  <span className="connect-plus">+</span>
                  <span className="connect-word">{genericRound.word2}</span>
                </div>
                <div className="connect-hint">Что их объединяет?</div>
                {genericRound?.__event === 'round-started' && (
                  <form className="connect-input-form" onSubmit={(e) => { e.preventDefault(); if (!newGameInput.trim()) return; socket.emit('game:action', { type: 'submit-connection', text: newGameInput.trim() }); setNewGameInput(''); }}>
                    <input className="connect-input" value={newGameInput} onChange={(e) => setNewGameInput(e.target.value)} placeholder="Слово-связка…" maxLength={100} />
                    <Button type="submit" variant="primary" size="sm" disabled={!newGameInput.trim()}>Отправить</Button>
                  </form>
                )}
              </div>
            )}
            {genericRound?.__event === 'voting-started' && Array.isArray(genericRound?.answers) && (
              <div className="connect-vote">
                <div className="connect-vote-label">Голосуйте за лучшую связку:</div>
                {genericRound.answers.map((a) => (
                  <button key={a.idx} className="connect-vote-card" onClick={() => socket.emit('game:action', { type: 'vote', answerIdx: a.idx })}>
                    {a.text}
                  </button>
                ))}
              </div>
            )}
            {connectRoundResult && (
              <div className="connect-result">
                {connectRoundResult.winner ? (
                  <>
                    <div className="connect-result-word">🏆 «{connectRoundResult.winner.text}»</div>
                    <div className="connect-result-author">{connectRoundResult.winner.authorName}</div>
                  </>
                ) : <div className="connect-result-word">Нет победителя</div>}
              </div>
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp('connect').scoreLegend} />
          </GameLayoutWrapper>
        )}

        {/* ===== CROSSWORD only remains in generic ===== */}
        {['crossword'].includes(room.gameType) && room.status !== 'waiting' && (
          <div className="game-area generic-game">
            <div className="game-area-title">
              {GAME_LABELS[room.gameType]}
              {room.gameType === 'crossword' && genericRound?.mode
                ? ` · ${CROSSWORD_MODE_LABELS[genericRound.mode] || genericRound.mode}`
                : ''}
              {room.gameType === 'crossword' && genericRound?.timeLimited === false
                ? ''
                : ` | ⏱ ${genericTimer}s`}
            </div>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp(room.gameType).bullets} />
            </GameRulesDisclosure>
            {room.gameType === 'crossword' && Array.isArray(genericRound?.grid) && (
              <CrosswordPanel
                grid={genericRound.grid}
                clues={genericRound.clues}
                solvedNums={genericRound.solvedNums}
                wrongSignal={crosswordWrongSignal}
                mode={genericRound.mode}
                players={genericScore}
                myPlayerId={socket.id}
                timeLeft={genericTimer}
                timeLimited={genericRound.timeLimited !== false}
                onSubmitWord={(clueNum, word) =>
                  new Promise((resolve) => {
                    const done = (ok, errMsg) => {
                      clearTimeout(tid);
                      if (ok) toast.success('Верно!');
                      else if (errMsg) toast.error(errMsg);
                      resolve(ok);
                    };
                    const tid = setTimeout(() => done(false, 'Нет ответа сервера'), 12000);
                    socket.emit('crossword:submit-word', { clueNum, word }, (res) => {
                      if (res?.success) done(true);
                      else {
                        const silentWrong = res?.error === 'Не подходит или слово уже отгадано';
                        done(false, silentWrong ? undefined : res?.error || 'Не подходит');
                      }
                    });
                  })
                }
              />
            )}
            <GameScoreboardBlock rows={genericScoreRows} legend={getStaticHelp(room.gameType).scoreLegend} />
          </div>
        )}

        {/* ===== REACTION ===== */}
        {room.gameType === 'reaction' && room.status !== 'waiting' && (
          <div className="game-area reaction-game">
            <div className="game-area-title">⚡ Реакция</div>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('reaction').bullets} /></GameRulesDisclosure>
            {reactionPhase === 'waiting' && (
              <div className="reaction-waiting">
                <div className="reaction-waiting-hint">Нажмите «Готов» когда все в сборе</div>
                <button className="reaction-ready-btn" onClick={() => socket.emit('game:action', { type: 'ready', ready: true })}>
                  {reactionReadyIds.has(socket.id) ? '✓ Вы готовы' : 'Готов'}
                </button>
                <div className="reaction-players">
                  {reactionPlayers.map((p) => (
                    <div key={p.id} className={`reaction-player${reactionReadyIds.has(p.id) ? ' reaction-player--ready' : ''}`}>
                      {reactionReadyIds.has(p.id) ? '✓' : '○'} {p.name}
                    </div>
                  ))}
                  {reactionPlayers.length === 0 && room.players.map((p) => (
                    <div key={p.id} className={`reaction-player${reactionReadyIds.has(p.id) ? ' reaction-player--ready' : ''}`}>
                      {reactionReadyIds.has(p.id) ? '✓' : '○'} {p.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {reactionPhase === 'countdown' && (
              <div className="reaction-countdown">
                <div className="reaction-countdown-num">{reactionCountdown || '…'}</div>
                <div className="reaction-countdown-hint">Приготовьтесь…</div>
              </div>
            )}
            {reactionPhase === 'signal' && !reactionMyReacted && (
              <button className="reaction-signal-btn" onClick={() => { socket.emit('game:action', { type: 'react' }); setReactionMyReacted(true); }}>
                ⚡ НАЖАТЬ!
              </button>
            )}
            {reactionPhase === 'signal' && reactionMyReacted && (
              <div className="reaction-reacted">Ждём результат…</div>
            )}
            {reactionPhase === 'finished' && reactionResult && (
              <div className="reaction-result">
                <div className="reaction-result-winner">🥇 {reactionResult.winnerName}</div>
                {reactionResult.reactionTime && <div className="reaction-result-time">{reactionResult.reactionTime} мс</div>}
                <div className="reaction-scores">
                  {(reactionResult.scores || reactionPlayers).map((p) => (
                    <div key={p.id} className="reaction-score-row">
                      <span className="reaction-score-name">{p.name}</span>
                      <span className="reaction-score-pts">{p.score} очков</span>
                    </div>
                  ))}
                </div>
                <button className="reaction-again-btn" onClick={() => { setReactionPhase('waiting'); setReactionReadyIds(new Set()); setReactionResult(null); }}>
                  Ещё раз
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===== COLORS ===== */}
        {room.gameType === 'colors' && room.status !== 'waiting' && (
          <div className="game-area colors-game">
            <div className="game-area-title">🎨 Цвета</div>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('colors').bullets} /></GameRulesDisclosure>
            {colorsPhase === 'waiting' && (
              <div className="colors-waiting">
                <div className="colors-waiting-hint">Нажмите «Готов» — игра начнётся когда все готовы</div>
                <button className="colors-ready-btn" onClick={() => socket.emit('game:action', { type: 'ready', ready: true })}>
                  {colorsReadyIds.has(socket.id) ? '✓ Вы готовы' : 'Готов'}
                </button>
                <div className="colors-ready-list">
                  {room.players.map((p) => (
                    <div key={p.id} className={`colors-ready-player${colorsReadyIds.has(p.id) ? ' colors-ready-player--ready' : ''}`}>
                      {colorsReadyIds.has(p.id) ? '✓' : '○'} {p.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(colorsPhase === 'showing' || colorsPhase === 'guessing') && colorsRound && (
              <div className="colors-round">
                <div className="colors-round-info">Раунд {colorsRound.round} / {colorsRound.maxRounds} · {colorsTimer}с</div>
                <div className="colors-display" style={{ backgroundColor: colorsRound.color?.value || '#7850ff' }}>
                  <span className="colors-display-text">{colorsRound.colorName}</span>
                </div>
                {colorsPhase === 'guessing' && (
                  <div className="colors-options">
                    {(colorsRound.options || []).map((opt, i) => (
                      <button
                        key={i}
                        className="colors-option-btn"
                        disabled={colorsAnswered}
                        onClick={() => { if (colorsAnswered) return; setColorsAnswered(true); socket.emit('game:action', { type: 'guess-color', index: i }); }}
                      >{opt}</button>
                    ))}
                  </div>
                )}
                {colorsPhase === 'showing' && (
                  <div className="colors-showing-hint">Запомните цвет…</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== TEAMWORDS ===== */}
        {room.gameType === 'teamwords' && room.status !== 'waiting' && (
          <div className="game-area teamwords-game">
            <div className="game-area-title">🏆 Слова команды</div>
            <GameRulesDisclosure><GameRulesBulletList items={getStaticHelp('teamwords').bullets} /></GameRulesDisclosure>
            {teamwordsPhase === 'waiting' && (
              <div className="teamwords-waiting">
                {teamwordsTeams && (
                  <div className="teamwords-teams">
                    {['red', 'blue'].map((team) => (
                      <div key={team} className={`teamwords-team teamwords-team--${team}`}>
                        <div className="teamwords-team-name">{teamwordsTeams[team]?.name}</div>
                        <div className="teamwords-team-score">{teamwordsTeams[team]?.score ?? 0} очков</div>
                        <div className="teamwords-team-players">
                          {(teamwordsTeams[team]?.players || []).map((p) => (
                            <div key={p.id || p} className={`teamwords-team-player${teamwordsReadyIds.has(p.id || p) ? ' teamwords-team-player--ready' : ''}`}>
                              {teamwordsReadyIds.has(p.id || p) ? '✓' : '○'} {p.name || p}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button className="teamwords-ready-btn" onClick={() => socket.emit('game:action', { type: 'ready', ready: true })}>
                  {teamwordsReadyIds.has(socket.id) ? '✓ Готов' : 'Готов'}
                </button>
              </div>
            )}
            {(teamwordsPhase === 'explaining' || teamwordsPhase === 'guessing') && (
              <div className="teamwords-game-area">
                {teamwordsTeams && (
                  <div className="teamwords-score-bar">
                    <span className="teamwords-score teamwords-score--red">🔴 {teamwordsTeams.red?.score ?? 0}</span>
                    <span className="teamwords-score-sep">vs</span>
                    <span className="teamwords-score teamwords-score--blue">🔵 {teamwordsTeams.blue?.score ?? 0}</span>
                  </div>
                )}
                {teamwordsMyWord && (
                  <div className="teamwords-word-card">
                    <div className="teamwords-word-label">Ваше слово (объясняйте!)</div>
                    <div className="teamwords-word">{teamwordsMyWord}</div>
                  </div>
                )}
                {!teamwordsMyWord && (
                  <div className="teamwords-guess-hint">Угадывайте слово по подсказкам объясняющего!</div>
                )}
                {teamwordsPhase === 'guessing' && !teamwordsMyWord && (
                  <form className="teamwords-guess-form" onSubmit={(e) => { e.preventDefault(); if (!teamwordsGuessInput.trim()) return; socket.emit('game:action', { type: 'guess-word', guess: teamwordsGuessInput.trim() }); setTeamwordsGuessInput(''); }}>
                    <input className="teamwords-guess-input" value={teamwordsGuessInput} onChange={(e) => setTeamwordsGuessInput(e.target.value)} placeholder="Ваш ответ…" maxLength={100} autoFocus />
                    <Button type="submit" variant="primary" size="sm" disabled={!teamwordsGuessInput.trim()}>Угадать</Button>
                  </form>
                )}
              </div>
            )}
            {teamwordsPhase === 'roundEnd' && teamwordsTeams && (
              <div className="teamwords-round-result">
                <div className="teamwords-round-scores">
                  <div className="teamwords-round-score teamwords-round-score--red">🔴 {teamwordsTeams.red?.name}: {teamwordsTeams.red?.score ?? 0}</div>
                  <div className="teamwords-round-score teamwords-round-score--blue">🔵 {teamwordsTeams.blue?.name}: {teamwordsTeams.blue?.score ?? 0}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {room.gameType === 'monopoly' && room.status !== 'waiting' && (
          <div className="game-area monopoly-container" style={{ marginTop: 18 }}>
            <div className="phase">Монополия</div>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('monopoly').bullets} />
            </GameRulesDisclosure>
            <div className="monopoly-game">
              <div className="monopoly-board-wrap">
                <div className="monopoly-board">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((row) =>
                    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((col) => {
                      const idx = row * 10 + col;
                      const isCorner = (row === 0 && col === 0) || (row === 0 && col === 9) || (row === 9 && col === 0) || (row === 9 && col === 9);
                      const isJail = (row === 9 && col === 0);
                      const groups = ['group-blue', 'group-red', 'group-green', 'group-yellow', 'group-purple', 'group-orange'];
                      const group = !isCorner && !isJail ? groups[idx % 6] : '';
                      return (
                        <div
                          key={idx}
                          className={`monopoly-cell ${isCorner ? 'corner' : ''} ${isJail ? 'jail' : ''} ${group}`}
                          data-preview={isJail ? 'В тюрьме' : isCorner ? 'Старт' : `Улица ${idx}`}
                          onDoubleClick={(e) => {
                            const el = e.currentTarget;
                            el.toggleAttribute('data-god-mode');
                            if (el.hasAttribute('data-god-mode')) setTimeout(() => el.removeAttribute('data-god-mode'), 2000);
                          }}
                        >
                          {isJail ? '🔒 Тюрьма' : isCorner ? '★' : `Клетка ${idx}`}
                          <span className="monopoly-cell-tokens">
                            {idx === 0 && <span className="monopoly-token">🚗</span>}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="monopoly-sidebar">
                <div className="monopoly-players">
                  <div className="monopoly-player current">Игрок 1</div>
                  <div className="monopoly-player">Игрок 2</div>
                </div>
                <div className="monopoly-dice">
                  <span className="monopoly-dice-roll">🎲</span>
                  <span className="monopoly-dice-result">6</span>
                </div>
                <div className="monopoly-log">
                  <div className="monopoly-log-item">Ход начат</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {room.gameType === 'kowall' && room.status !== 'waiting' && (
          <div className="game-area kowall-container" style={{ marginTop: 18 }}>
            <div className="phase">K.O.Wall</div>
            <GameRulesDisclosure>
              <GameRulesBulletList items={getStaticHelp('kowall').bullets} />
            </GameRulesDisclosure>
            <div className="kowall-hud">
              <span className="kowall-hud-current">Ход: Команда 1</span>
              <span className="kowall-hud-dice">🎲</span>
              <span className="kowall-dice-result">5</span>
            </div>
            <div className="kowall-board-wrap">
              <div className="kowall-board">
                <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%' }}>
                  <defs>
                    <linearGradient id="kowall-team1-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(0, 245, 212, 0.6)" />
                      <stop offset="100%" stopColor="rgba(0, 245, 212, 0.2)" />
                    </linearGradient>
                    <linearGradient id="kowall-team2-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255, 100, 100, 0.6)" />
                      <stop offset="100%" stopColor="rgba(255, 100, 100, 0.2)" />
                    </linearGradient>
                    <filter id="kowall-fog-filter">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
                      <feColorMatrix type="saturate" values="0.3" />
                    </filter>
                  </defs>
                  <path className="kowall-region captured team-1" d="M 50 50 L 150 50 L 150 150 L 50 150 Z" />
                  <path className="kowall-region fog" d="M 150 50 L 250 50 L 250 150 L 150 150 Z" />
                  <path className="kowall-region fog revealed" d="M 250 50 L 350 50 L 350 150 L 250 150 Z" />
                  <path className="kowall-region captured team-2" d="M 50 150 L 150 150 L 150 250 L 50 250 Z" />
                </svg>
                <div className="kowall-chips">
                  <div className="kowall-chip" style={{ left: '15%', top: '25%' }}>
                    <span className="kowall-chip-value">3</span>
                  </div>
                  <div className="kowall-chip" style={{ left: '45%', top: '25%' }}>
                    <span className="kowall-chip-value">2</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="kowall-dice-canvas-wrap">
              <span className="kowall-dice-result">5</span>
            </div>
            <div className="kowall-log">
              <div className="kowall-log-item">Раунд начат</div>
            </div>
          </div>
        )}

        {room.gameType === 'mafia' && room.status !== 'waiting' && !isMafiaNoirMode && (
          <div className="game-area mafia-control-panel">
            {/* Голосовая коммуникация — внешний сервис (Discord, Telegram и т.д.) */}

            {/* Action panel встроен в MafiaGameTable */}

            {isHost && room.settings?.options?.aiGameMaster && (
              <section className="mafia-control-section mafia-ai-host-card">
                <div className="mafia-ai-host-card__icon">🤖</div>
                <div className="mafia-ai-host-card__title">ИИ ведёт игру</div>
                <p className="mafia-ai-host-card__hint">
                  Вы играете как обычный участник.<br />
                  Чтобы взять управление — сбросьте партию.
                </p>
                <button
                  type="button"
                  className="btn btn-danger mafia-ai-host-card__btn"
                  data-testid="host-reset-mafia-btn"
                  onClick={resetMafiaParty}
                >
                  Взять управление
                </button>
              </section>
            )}

            {isHost && !room.settings?.options?.aiGameMaster && (
              <section className="mafia-control-section mafia-host-desk">
            <div className="phase mafia-host-desk__title">Панель ведущего</div>
            <div className="mafia-host-phase-row">
              <span>Фаза: {MAFIA_PHASE_LABELS[phase] || phase}</span>
              <span>Таймер: {phaseTimer > 0 ? `${phaseTimer}s` : 'ручной'}</span>
            </div>
            {phaseTimer > 0 && (
              <div className="mafia-host-phase-progress">
                <div className="mafia-host-phase-progress__bar" style={{ width: `${mafiaPhaseProgress}%` }} />
              </div>
            )}
            <p className="mafia-host-desk__lead">
              Вы без карты: роли и ход видите целиком. Управляйте фазами и при необходимости голосуйте за игрока ниже.
            </p>
            <div className="mafia-host-desk__actions">
              <button className="btn btn-sm" onClick={() => sendHostCommand('host:next-phase')}>Следующая фаза</button>
              <button className="btn btn-sm" onClick={() => sendHostCommand('host:set-phase', 'voting')}>Объявить голосование</button>
              <button className="btn btn-sm" onClick={() => sendHostCommand('host:set-phase', 'vote-result')}>Завершить голосование</button>
              <button className="btn btn-sm btn-danger" onClick={() => sendDangerHostCommand('Завершить текущую партию?', 'host:set-phase', 'gameOver')}>
                Завершить игру
              </button>
              <button
                type="button"
                className="btn btn-sm btn-warning"
                data-testid="host-reset-mafia-btn"
                onClick={resetMafiaParty}
              >
                Сбросить партию
              </button>
            </div>
            {!room.settings?.options?.aiGameMaster && (
              <div className="mafia-host-desk__impersonate" style={{ marginTop: 0, marginBottom: 12 }}>
                <div className="mafia-host-desk__impersonate-title">Приватный лог активных ролей (только ведущий)</div>
                {hostNightActions.length === 0 ? (
                  <div className="mafia-host-desk__muted">Пока нет подтверждённых ходов в текущей ночи.</div>
                ) : (
                  <div className="mafia-host-desk__grid">
                    {hostNightActions.map((a, idx) => (
                      <div key={`${a.actorId}-${a.targetId}-${a.type}-${idx}`} className="mafia-host-desk__row">
                        <strong>{a.actorName}</strong>
                        <span className="mafia-host-desk__role">{a.actorRoleLabel}</span>
                        <span className="mafia-host-desk__muted">→ {a.targetName}</span>
                        <span className="mafia-host-desk__muted">({a.typeLabel})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!room.settings?.options?.aiGameMaster && (
            <>
            <div className="mafia-host-desk__section-title">Живые за столом</div>
            <div className="mafia-host-desk__grid">
              {alivePlayers.map((p) => (
                <div key={`alive-${p.id}`} className="mafia-host-desk__row">
                  <strong>{p.name}</strong>
                  <span className="mafia-host-desk__role">{p.role}</span>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => sendDangerHostCommand(`Убить игрока ${p.name}?`, 'host:kill-player', p.id)}>Убить</button>
                  <select
                    className="mafia-host-desk__select"
                    value={selectedRoleMap[p.id] || p.role}
                    onChange={(e) => setSelectedRoleMap((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  >
                    {[
                      'civilian',
                      'mafia',
                      'don',
                      'sheriff',
                      'doctor',
                      'putana',
                      'poisoner',
                      'maniac',
                      'bodyguard',
                      'journalist',
                      'mayor',
                    ].map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => sendHostCommand('host:change-role', p.id, selectedRoleMap[p.id] || p.role)}
                  >
                    Сменить роль
                  </button>
                </div>
              ))}
            </div>
            <div className="mafia-host-desk__section-title mafia-host-desk__section-title--spaced">Мёртвые</div>
            <div className="mafia-host-desk__grid">
              {deadPlayers.length === 0 && <span className="mafia-host-desk__muted">Нет</span>}
              {deadPlayers.map((p) => (
                <div key={`dead-${p.id}`} className="mafia-host-desk__row">
                  <strong>{p.name}</strong>
                  <span className="mafia-host-desk__role">{p.role}</span>
                  <button type="button" className="btn btn-sm btn-info" onClick={() => sendDangerHostCommand(`Воскресить игрока ${p.name}?`, 'host:revive-player', p.id)}>Воскресить</button>
                </div>
              ))}
            </div>

            <div className="mafia-host-desk__impersonate">
              <div className="mafia-host-desk__impersonate-title">Играть за игрока</div>
              <div className="mafia-host-desk__impersonate-row">
                <select value={hostActAsPlayer} onChange={(e) => setHostActAsPlayer(e.target.value)} className="mafia-host-desk__select mafia-host-desk__select--grow">
                  <option value="">Выбрать игрока...</option>
                  {mafiaPlayers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} {p.id.startsWith('bot_') ? '(бот)' : ''}</option>
                  ))}
                </select>
                {actionPrompt && hostActAsPlayer && (
                  <select value={selectedTarget} onChange={(e) => setSelectedTarget(e.target.value)} className="mafia-host-desk__select mafia-host-desk__select--grow">
                    {(actionPrompt.validTargets || []).map((id) => (
                      <option key={id} value={id}>{playerById.get(id)?.name || id}</option>
                    ))}
                  </select>
                )}
                <button type="button" className="btn btn-sm" disabled={!hostActAsPlayer} onClick={() => {
                  if (!hostActAsPlayer) return;
                  const actionType = phase === 'voting' || phase === 'votingRevote'
                    ? 'vote'
                    : phase === 'don-election'
                      ? 'elect-don'
                      : (phase.startsWith('night-')
                          ? {
                              'night-mafia': 'kill',
                              'night-don': 'check-don',
                              'night-doctor': 'heal',
                              'night-sheriff': 'check-sheriff',
                              'night-bodyguard': 'guard',
                              'night-journalist': 'check-journalist',
                              'night-maniac': 'kill',
                              'night-poisoner': 'poison',
                              'night-putana': 'block',
                            }[phase] || 'kill'
                          : 'vote');
                  socket.emit('host:act-as', { playerId: hostActAsPlayer, action: { type: actionType, targetId: selectedTarget } }, (res) => {
                    if (res?.success) setActionStatus(`Ход за ${playerById.get(hostActAsPlayer)?.name} выполнен`);
                    else toast.error(res?.error || 'Действие отклонено');
                  });
                }}>Сделать ход</button>
              </div>
            </div>
            </>
            )}
              </section>
            )}

            {room.settings?.options?.aiGameMaster && (
              <section className="mafia-control-section mafia-ai-narrator-panel">
                <div className="mafia-ai-narrator-panel__header">
                  <span className="mafia-ai-narrator-panel__mic">🎙</span>
                  <span className="mafia-ai-narrator-panel__title">ИИ Ведущий</span>
                  {aiMessages.length > 0 && <span className="mafia-ai-narrator-panel__dot" aria-hidden="true" />}
                </div>
                {aiMessages.length === 0 ? (
                  <p className="mafia-ai-narrator-panel__empty">Ведущий молчит...</p>
                ) : (
                  <>
                    <div
                      className="mafia-ai-narrator-panel__latest"
                      key={aiMessages[aiMessages.length - 1]?.time}
                    >
                      {aiMessages[aiMessages.length - 1]?.text}
                    </div>
                    {aiMessages.length > 1 && (
                      <div className="mafia-ai-narrator-panel__log">
                        {aiMessages.slice(-8, -1).reverse().map((m) => (
                          <div key={m.time} className="mafia-ai-narrator-panel__log-entry">{m.text}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {showMafiaDebugPanels && gameHistory.length > 0 && (
              <section className="mafia-control-section mafia-history-panel">
                <div className="phase">История партии</div>
                <div className="mafia-history-list">
                  {gameHistory.slice(-20).reverse().map((item, idx) => (
                    <div key={`${item.t}-${idx}`} className="mafia-history-item">{item.text}</div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {actionStatus && room.gameType !== 'mafia' && (
          <div className="phase" style={{ marginTop: 16 }}>
            {actionStatus}
          </div>
        )}
        </div>

        {isMafiaNoirMode && (
          <>
            <nav className="mafia-noir-bottom-nav">
              <button
                type="button"
                onClick={() => {
                  socket.emit('game:finish-speaking-turn', (res) => {
                    if (res?.success) return;
                    if (res?.error) setActionStatus(res.error);
                  });
                }}
                disabled={!speakingTurn || speakingTurn.playerId !== socket.id || (phase !== 'discussion' && phase !== 'intro')}
              >
                ⏭
                <span>Готов</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (phase !== 'voting' && phase !== 'votingRevote') {
                    setActionStatus('Сейчас голосование недоступно.');
                    return;
                  }
                  if (!selectedTarget) {
                    setActionStatus('Выберите игрока на столе для голосования.');
                    return;
                  }
                  socket.emit('game:action', { type: 'vote', targetId: selectedTarget });
                  setActionStatus('Голос отправлен');
                }}
              >
                🗳
                <span>Голос</span>
              </button>
              <button type="button" onClick={leaveRoomAndGoHome}>
                ☰
                <span>Меню</span>
              </button>
            </nav>
          </>
        )}
        {isCrocodileLuxeMode && (
          <CrocodileLuxeBottomNav
            onFocusChat={() => crocGuessInputRef.current?.focus()}
            onClearCanvas={() => {
              setCrocStrokes([]);
              socket.emit('crocodile:clear');
            }}
            onLeave={leaveRoomAndGoHome}
            canClear={crocTurn?.explainerId === socket.id}
            toast={toast}
          />
        )}
        {!isMafiaNoirMode && !isCrocodileLuxeMode && (
          <div className="room-exit-bar">
            <button className="btn gray" onClick={leaveRoomAndGoHome}>Выйти в меню</button>
          </div>
        )}
      </div>
    </>
  );
}

export default RoomPage;
