import { useEffect, useRef, useState } from 'react';
import { socket } from '../../services/socketService';

/**
 * useMafiaSocket — собирает state для <MafiaRoom> из событий нового движка.
 * Базовое состояние приходит персональными снапшотами `mafia:state`
 * (getPlayerState), а таймер/кандидаты/победитель — из событий фаз.
 */
export function useMafiaSocket(active) {
  const [snapshot, setSnapshot] = useState(null);
  const [extra, setExtra] = useState({ timer: null, candidates: null, winner: null });
  const [speeches, setSpeeches] = useState({});
  const [feed, setFeed] = useState([]);
  const [nightReport, setNightReport] = useState(null);
  const timerRef = useRef(null);
  const playersRef = useRef([]);
  const feedIdRef = useRef(0);

  useEffect(() => {
    if (!active) return undefined;

    const nameOf = (id) => playersRef.current.find((p) => p.id === id)?.name || '???';
    const names = (ids) => (ids || []).map(nameOf).join(', ');
    const pushFeed = (kind, text) => setFeed((f) => [...f.slice(-5), { id: ++feedIdRef.current, kind, text, ts: Date.now() }]);

    const onState = (s) => { playersRef.current = s.players || []; setSnapshot(s); };
    const onPhase = ({ phase, duration }) => {
      clearInterval(timerRef.current);
      setExtra((e) => ({
        ...e,
        candidates: (phase === 'voting' || phase === 'votingTieDiscussion') ? null : e.candidates,
        timer: duration > 0 ? duration : null,
      }));
      if (duration > 0) {
        let t = duration;
        timerRef.current = setInterval(() => {
          t -= 1;
          setExtra((e) => ({ ...e, timer: Math.max(0, t) }));
          if (t <= 0) clearInterval(timerRef.current);
        }, 1000);
      }
    };
    const onVoting = (d) => setExtra((e) => ({ ...e, candidates: d?.candidates || null }));
    const onTie = (d) => setExtra((e) => ({ ...e, candidates: d?.candidates || null }));
    const onEnded = (d) => setExtra((e) => ({ ...e, winner: d?.winner || null }));
    const onSpeech = (d) => {
      if (!d?.playerId) return;
      setSpeeches((s) => ({ ...s, [d.playerId]: { text: d.text, ts: Date.now() } }));
    };
    const onNight = (d) => {
      const killed = (d?.kills || []).map(nameOf);
      setNightReport({ killed, ts: Date.now() });
      if (killed.length) pushFeed('death', `🔪 Ночью убит: ${killed.join(', ')}`);
      else pushFeed('safe', '🌅 Этой ночью все выжили');
    };
    const onCheck = (d) => pushFeed(d?.isMafia ? 'death' : 'safe', `🔎 ${nameOf(d?.targetId)} — ${d?.isMafia ? 'МАФИЯ!' : 'не мафия'}`);
    const onLynched = (d) => pushFeed('death', `⚖️ Город изгнал: ${nameOf(d?.playerId)}`);
    const onMidDeath = (d) => pushFeed('death', `☠️ ${d?.name || nameOf(d?.playerId)} умер от яда прямо на речи!`);
    const onNoExec = () => pushFeed('safe', '🤷 Город никого не казнил');
    const onTieFeed = () => pushFeed('info', '⚖️ Ничья — переголосование');
    const onVampire = (d) => pushFeed('info', `🧛 ${nameOf(d?.playerId)} обращён в вампира`);

    socket.on('mafia:state', onState);
    socket.on('mafia:phase', onPhase);
    socket.on('mafia:voting', onVoting);
    socket.on('mafia:tie', onTie);
    socket.on('mafia:tie', onTieFeed);
    socket.on('mafia:ended', onEnded);
    socket.on('mafia:speech', onSpeech);
    socket.on('mafia:night-resolved', onNight);
    socket.on('mafia:check', onCheck);
    socket.on('mafia:lynched', onLynched);
    socket.on('mafia:mid-speech-death', onMidDeath);
    socket.on('mafia:no-execution', onNoExec);
    socket.on('mafia:vampire-turn', onVampire);
    return () => {
      socket.off('mafia:state', onState);
      socket.off('mafia:phase', onPhase);
      socket.off('mafia:voting', onVoting);
      socket.off('mafia:tie', onTie);
      socket.off('mafia:tie', onTieFeed);
      socket.off('mafia:ended', onEnded);
      socket.off('mafia:speech', onSpeech);
      socket.off('mafia:night-resolved', onNight);
      socket.off('mafia:check', onCheck);
      socket.off('mafia:lynched', onLynched);
      socket.off('mafia:mid-speech-death', onMidDeath);
      socket.off('mafia:no-execution', onNoExec);
      socket.off('mafia:vampire-turn', onVampire);
      clearInterval(timerRef.current);
    };
  }, [active]);

  const state = snapshot ? {
    phase: snapshot.phase,
    day: snapshot.day,
    players: snapshot.players || [],
    activeSpeaker: snapshot.activeSpeaker,
    you: snapshot.you || null,
    timer: extra.timer,
    candidates: extra.candidates,
    winner: snapshot.winner || extra.winner,
    speeches,
    feed,
    nightReport,
  } : null;

  const sendAction = (a) => socket.emit('game:action', a);
  return { state, sendAction };
}
