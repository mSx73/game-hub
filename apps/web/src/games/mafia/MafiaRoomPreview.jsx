import React, { useMemo, useState } from 'react';
import { MafiaRoom } from './MafiaRoom';

/* Внутренний превью-стенд (роут /_mafia2). Моки + переключатель фаз. */
const NAMES = ['Дон', 'Алиса', 'Боб', 'Вика', 'Гриша', 'Дина', 'Егор', 'Жанна'];
const PHASES = ['roleReveal', 'night', 'day', 'voting', 'votingTieDiscussion', 'votingRevote', 'gameOver'];

export default function MafiaRoomPreview() {
  const params = new URLSearchParams(window.location.search);
  const [phase, setPhase] = useState(params.get('phase') || 'day');
  const [dead, setDead] = useState(() => new Set(['p5']));
  const role = params.get('role') || 'don';

  const players = useMemo(
    () => NAMES.map((name, i) => ({ id: 'p' + i, name, alive: !dead.has('p' + i) })),
    [dead]
  );

  const state = {
    phase,
    day: 1,
    players,
    activeSpeaker: (phase === 'day' || phase === 'votingTieDiscussion') ? 'p2' : null,
    you: { id: 'p0', role, alive: true, cannotVote: false },
    timer: 42,
    candidates: phase === 'votingRevote' ? ['p3', 'p4'] : null,
    winner: 'mafia',
  };

  return (
    <>
      <div style={{ position: 'fixed', top: 6, left: 6, zIndex: 999, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {PHASES.map((ph) => (
          <button key={ph} onClick={() => setPhase(ph)}
            style={{ padding: '4px 8px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
              background: ph === phase ? '#7c6cff' : '#222', color: '#fff', border: 'none' }}>
            {ph}
          </button>
        ))}
        <button onClick={() => setDead((s) => new Set(s).add('p4'))}
          style={{ padding: '4px 8px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: '#e23b4e', color: '#fff', border: 'none' }}>
          kill Гриша
        </button>
      </div>
      <MafiaRoom state={state} onAction={(a) => console.log('[action]', a)} />
    </>
  );
}
