import React, { useEffect, useRef, useState } from 'react';
import './MelodyRoom.css';

/* ============================================================================
 * MelodyRoom — «Угадай мелодию»: студия с ИИ-диджеем.
 * Сервер шлёт ноты — играем их WebAudio-синтезатором (8-бит вайб).
 * ==========================================================================*/

function useSynth() {
  const ctxRef = useRef(null);
  const nodesRef = useRef([]);
  const [playing, setPlaying] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const ensureCtx = () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    setUnlocked(true);
    return ctxRef.current;
  };

  const stop = () => {
    for (const n of nodesRef.current) { try { n.stop(); } catch { /* уже остановлен */ } }
    nodesRef.current = [];
    setPlaying(false);
  };

  /** notes: [{f: Гц (0 = пауза), d: доли}], bpm — темп. */
  const play = (notes, bpm = 120) => {
    const ctx = ensureCtx();
    if (!ctx || !notes?.length) return;
    stop();
    setPlaying(true);
    const beat = 60 / bpm;
    let t = ctx.currentTime + 0.06;
    let total = 0;
    for (const n of notes) {
      const dur = Math.max(0.08, n.d * beat);
      if (n.f > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = n.f;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.015);
        gain.gain.setValueAtTime(0.22, t + dur * 0.72);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
        nodesRef.current.push(osc);
      }
      t += dur;
      total += dur;
    }
    setTimeout(() => setPlaying(false), Math.ceil(total * 1000) + 150);
  };

  useEffect(() => () => stop(), []);
  return { play, stop, playing, unlocked, ensureCtx };
}

/** Плеер 30-сек превью iTunes (режим «Чарт»): играем ровно N секунд. */
function usePreviewPlayer() {
  const audioRef = useRef(null);
  const stopTRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const stop = () => {
    clearTimeout(stopTRef.current);
    if (audioRef.current) audioRef.current.pause();
    setPlaying(false);
  };

  const play = (url, seconds) => {
    if (!url) return;
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    stop();
    if (a.src !== url) a.src = url;
    a.currentTime = 0;
    a.volume = 0.9;
    a.play().then(() => {
      setUnlocked(true);
      setPlaying(true);
      if (seconds > 0) {
        stopTRef.current = setTimeout(() => { a.pause(); setPlaying(false); }, seconds * 1000);
      } else {
        a.onended = () => setPlaying(false);
      }
    }).catch(() => { /* нужен жест пользователя — кнопка есть */ });
  };

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps
  return { play, stop, playing, unlocked };
}

const fmt = (s) => (s == null ? '' : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);
const ATTEMPT_LABEL = { 1: '4 ноты', 2: '8 нот', 3: 'вся мелодия' };

export function MelodyRoom({ state = {}, onAction = () => {} }) {
  const {
    phase = 'intro', round = 0, maxRounds = 0, attempt = 0, points = 0, hintsEnabled = true,
    timer = null, snippet = null, hostLine = null, feed = [], reveal = null, ended = null,
    scoreboard = [],
  } = state;
  const synth = useSynth();
  const preview = usePreviewPlayer();
  const [guess, setGuess] = useState('');
  const [guessError, setGuessError] = useState(null);
  const lastPlayedRef = useRef(0);

  // Универсальный проигрыватель: чарт → превью iTunes, ноты → синтезатор
  const playItem = (item) => {
    if (!item) return;
    if (item.previewUrl) preview.play(item.previewUrl, item.playSeconds || 0);
    else if (item.notes) synth.play(item.notes, item.bpm);
  };
  const playing = synth.playing || preview.playing;
  const unlocked = synth.unlocked || preview.unlocked;

  // авто-плей нового сниппета (если аудио уже разблокировано жестом)
  useEffect(() => {
    if (snippet?.ts && snippet.ts !== lastPlayedRef.current && unlocked) {
      lastPlayedRef.current = snippet.ts;
      playItem(snippet);
    }
  }, [snippet?.ts, unlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  // авто-плей на reveal (полная мелодия / длинный кусок трека)
  const lastRevealRef = useRef(0);
  useEffect(() => {
    if (reveal?.ts && reveal.ts !== lastRevealRef.current && unlocked) {
      lastRevealRef.current = reveal.ts;
      playItem(reveal);
    }
  }, [reveal?.ts, unlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    const text = guess.trim();
    if (text.length < 2) return;
    setGuessError(null);
    onAction({ type: 'melody-guess', text }, (res) => {
      // Отказ сервера (кулдаун / не та фаза) — показываем, ввод не теряем.
      if (res && res.success === false) setGuessError(res.error || 'Не принято, попробуйте ещё раз');
      else setGuess('');
    });
  };

  const current = reveal || snippet;
  const recentFeed = feed.filter((f) => Date.now() - f.ts < 8000).slice(-4);

  return (
    <div className={`melody-room melody-room--${phase}`}>
      <header className="melody-top">
        <div className="melody-brand">🎧 УГАДАЙ МЕЛОДИЮ</div>
        <div className="melody-phase">
          {phase === 'gameOver' ? 'Финал' : round > 0 ? `Раунд ${round}/${maxRounds}` : 'Эфир начинается'}
          {phase === 'guessing' && attempt > 0 && (
            <span className="melody-attempt">
              {' '}· {snippet?.playSeconds ? `${snippet.playSeconds} сек трека` : ATTEMPT_LABEL[attempt]} · {points} очк.
            </span>
          )}
          {phase === 'guessing' && snippet?.category && <span className="melody-cat"> · 🏷 {snippet.category}</span>}
        </div>
        <div className="melody-timer">{fmt(timer)}</div>
      </header>

      {/* ИИ-ведущий */}
      <div className="melody-dj">
        <div className={`melody-dj-avatar ${playing ? 'is-playing' : ''}`}>🤖</div>
        <div className="melody-dj-bubble">
          <div className="melody-dj-name">{hostLine?.name || 'DJ Нейрон'}</div>
          <div className="melody-dj-text">{hostLine?.text || 'Подключаюсь к пульту…'}</div>
        </div>
      </div>

      {/* Проигрыватель */}
      <div className="melody-player">
        <div className={`melody-eq ${playing ? 'is-on' : ''}`} aria-hidden>
          {Array.from({ length: 14 }, (_, i) => <span key={i} style={{ '--i': i }} />)}
        </div>
        <div className="melody-player-controls">
          <button
            className="melody-btn melody-btn--play"
            disabled={!current || (!current.notes?.length && !current.previewUrl)}
            onClick={() => playItem(current)}
          >
            {unlocked ? (playing ? '🔊 Играет…' : '▶ Слушать ещё раз') : '▶ Включить звук'}
          </button>
          {phase === 'guessing' && hintsEnabled && (
            <button className="melody-btn melody-btn--ghost" onClick={() => onAction({ type: 'melody-hint' })}>
              💡 Подсказка у DJ
            </button>
          )}
        </div>
        {reveal && (
          <div className="melody-reveal">
            {reveal.artwork && <img className="melody-reveal-art" src={reveal.artwork} alt="" />}
            <span>
              🎼 Это — <b>{reveal.artist ? `${reveal.artist} — ` : ''}«{reveal.title}»</b>
              {reveal.winner ? <span> · угадал(а) <b>{reveal.winner.name}</b> (+{reveal.winner.points})</span> : <span> · никто не угадал</span>}
            </span>
          </div>
        )}
      </div>

      {/* Ввод ответа — виден всегда, активен только в фазе угадывания */}
      {phase !== 'gameOver' && (
        <div className="melody-guess-wrap">
          <div className="melody-guess">
            <input
              value={guess}
              onChange={(e) => { setGuess(e.target.value); setGuessError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={phase === 'guessing' ? 'Что за мелодия? Пишите название…' : 'Ждём следующие ноты…'}
              disabled={phase !== 'guessing'}
              maxLength={100}
            />
            <button className="melody-btn" disabled={phase !== 'guessing' || guess.trim().length < 2} onClick={submit}>
              Ответить!
            </button>
          </div>
          {guessError && <div className="melody-guess-error">⚠ {guessError}</div>}
        </div>
      )}

      {/* Лента ответов */}
      <div className="melody-feed" aria-live="polite">
        {recentFeed.map((f) => (
          <div key={f.id} className={`melody-toast melody-toast--${f.kind}`}>{f.text}</div>
        ))}
      </div>

      {/* Табло */}
      <div className="melody-board">
        <div className="melody-board-title">🏆 Очки</div>
        {scoreboard.map((p, i) => (
          <div key={p.id} className={`melody-board-row ${i === 0 && p.score > 0 ? 'is-top' : ''}`}>
            <span>{i + 1}. {p.name}</span><b>{p.score}</b>
          </div>
        ))}
      </div>

      {/* Финал */}
      {phase === 'gameOver' && ended && (
        <div className="melody-final">
          <div className="melody-final-card">
            <div className="melody-final-title">🎤 Эфир окончен!</div>
            {ended.winner && ended.winner.score > 0
              ? <div className="melody-final-winner">Лучшее ухо: <b>{ended.winner.name}</b> — {ended.winner.score} очков</div>
              : <div className="melody-final-winner">Сегодня без чемпионов 🤷</div>}
            <div className="melody-final-list">
              {(ended.scoreboard || []).map((p, i) => (
                <div key={p.id} className="melody-final-row"><span>{i + 1}. {p.name}</span><b>{p.score}</b></div>
              ))}
            </div>
            <div className="melody-final-hint">Комната вернулась в лобби — сыграем ещё?</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MelodyRoom;
