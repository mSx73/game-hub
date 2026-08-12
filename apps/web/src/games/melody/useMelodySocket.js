import { useEffect, useRef, useState } from 'react';
import { socket } from '../../services/socketService';

/** Собирает state для <MelodyRoom> из событий движка «Угадай мелодию». */
export function useMelodySocket(active) {
  const [snapshot, setSnapshot] = useState(null);
  const [timer, setTimer] = useState(null);
  const [snippet, setSnippet] = useState(null);      // { notes, bpm, attempt, points, ... }
  const [hostLine, setHostLine] = useState(null);    // { name, text, ts }
  const [feed, setFeed] = useState([]);              // неверные ответы и события
  const [reveal, setReveal] = useState(null);
  const [ended, setEnded] = useState(null);
  const timerRef = useRef(null);
  const feedId = useRef(0);

  useEffect(() => {
    if (!active) return undefined;

    const pushFeed = (kind, text) => setFeed((f) => [...f.slice(-5), { id: ++feedId.current, kind, text, ts: Date.now() }]);
    const startTimer = (d) => {
      clearInterval(timerRef.current);
      if (!(d > 0)) { setTimer(null); return; }
      let t = Math.round(d);
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
      if (d?.phase === 'guessing') setReveal(null);
    };
    const onSnippet = (d) => { setSnippet({ ...d, ts: Date.now() }); setReveal(null); };
    const onHost = (d) => setHostLine({ ...d, ts: Date.now() });
    const onWrong = (d) => pushFeed('wrong', `✗ ${d.playerName}: «${d.guess}»`);
    const onGuessed = (d) => pushFeed('right', `✓ ${d.playerName} +${d.points}!`);
    const onReveal = (d) => setReveal({ ...d, ts: Date.now() });
    const onEnded = (d) => setEnded(d);

    socket.on('melody:state', onState);
    socket.on('melody:phase', onPhase);
    socket.on('melody:snippet', onSnippet);
    socket.on('melody:host', onHost);
    socket.on('melody:guess-wrong', onWrong);
    socket.on('melody:guessed', onGuessed);
    socket.on('melody:reveal', onReveal);
    socket.on('melody:ended', onEnded);
    return () => {
      socket.off('melody:state', onState);
      socket.off('melody:phase', onPhase);
      socket.off('melody:snippet', onSnippet);
      socket.off('melody:host', onHost);
      socket.off('melody:guess-wrong', onWrong);
      socket.off('melody:guessed', onGuessed);
      socket.off('melody:reveal', onReveal);
      socket.off('melody:ended', onEnded);
      clearInterval(timerRef.current);
    };
  }, [active]);

  const state = snapshot ? { ...snapshot, timer, snippet, hostLine, feed, reveal, ended } : null;
  const sendAction = (a, cb) => socket.emit('game:action', a, cb);
  return { state, sendAction };
}
