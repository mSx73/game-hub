import { useEffect, useRef, useState } from 'react';
import { socket } from '../../services/socketService';

/** Собирает state для <BunkerRoom> из событий движка Бункера. */
export function useBunkerSocket(active) {
  const [snapshot, setSnapshot] = useState(null);
  const [timer, setTimer] = useState(null);
  const [speeches, setSpeeches] = useState({});
  const [feed, setFeed] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [ended, setEnded] = useState(null);
  const timerRef = useRef(null);
  const feedIdRef = useRef(0);

  useEffect(() => {
    if (!active) return undefined;

    const pushFeed = (kind, text) => setFeed((f) => [...f.slice(-5), { id: ++feedIdRef.current, kind, text, ts: Date.now() }]);
    const startTimer = (duration) => {
      clearInterval(timerRef.current);
      if (!(duration > 0)) { setTimer(null); return; }
      let t = Math.round(duration);
      setTimer(t);
      timerRef.current = setInterval(() => {
        t -= 1;
        setTimer(Math.max(0, t));
        if (t <= 0) clearInterval(timerRef.current);
      }, 1000);
    };

    const onState = (s) => setSnapshot(s);
    const onPhase = (d) => {
      startTimer(d?.duration);
      if (d?.phase === 'reveal') setLastResult(null);
    };
    const onSpeaking = (d) => { if (d?.duration) startTimer(d.duration); };
    const onSpeech = (d) => {
      if (!d?.playerId) return;
      setSpeeches((s) => ({ ...s, [d.playerId]: { text: d.text, ts: Date.now() } }));
    };
    const onReveal = (d) => pushFeed('info', `🔓 ${d.playerName}: ${d.label} — ${d.value}`);
    const onActionUsed = (d) => pushFeed('action', `⚡ «${d.cardName}»: ${d.detail}`);
    const onTie = (d) => pushFeed('info', `⚖️ Ничья! Переголосование: ${(d?.candidates || []).map((c) => c.name).join(' vs ')}`);
    const onResult = (d) => {
      setLastResult(d);
      if (d?.exiled) pushFeed('death', `🚪 ${d.exiled.name} изгнан из бункера`);
      else pushFeed('safe', '🤝 Никто не изгнан в этом раунде');
    };
    const onEnded = (d) => setEnded(d);

    socket.on('bunker:state', onState);
    socket.on('bunker:phase', onPhase);
    socket.on('bunker:speaking', onSpeaking);
    socket.on('bunker:speech', onSpeech);
    socket.on('bunker:reveal', onReveal);
    socket.on('bunker:action-used', onActionUsed);
    socket.on('bunker:tie', onTie);
    socket.on('bunker:round-result', onResult);
    socket.on('bunker:ended', onEnded);
    return () => {
      socket.off('bunker:state', onState);
      socket.off('bunker:phase', onPhase);
      socket.off('bunker:speaking', onSpeaking);
      socket.off('bunker:speech', onSpeech);
      socket.off('bunker:reveal', onReveal);
      socket.off('bunker:action-used', onActionUsed);
      socket.off('bunker:tie', onTie);
      socket.off('bunker:round-result', onResult);
      socket.off('bunker:ended', onEnded);
      clearInterval(timerRef.current);
    };
  }, [active]);

  const state = snapshot ? { ...snapshot, timer, speeches, feed, lastResult, ended } : null;
  const sendAction = (a) => socket.emit('game:action', a);
  return { state, sendAction };
}
