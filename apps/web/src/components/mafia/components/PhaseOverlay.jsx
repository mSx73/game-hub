import React, { useMemo } from 'react';

const NIGHT_PHASES = new Set([
  'night-start', 'night-waiting', 'night-mafia', 'night-don',
  'night-doctor', 'night-sheriff', 'night-bodyguard', 'night-journalist',
  'night-maniac', 'night-poisoner', 'night-putana', 'night-end',
]);

const VOTING_PHASES = new Set(['voting', 'votingRevote', 'vote-result', 'votingTieDiscussion']);

function getOverlayType(phase) {
  if (NIGHT_PHASES.has(phase)) return 'night';
  if (VOTING_PHASES.has(phase)) return 'voting';
  return 'day';
}

const STARS = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: `${Math.round(3 + (i * 4.3) % 93)}%`,
  top: `${Math.round(2 + (i * 7.7) % 85)}%`,
  size: i % 3 === 0 ? 3 : i % 3 === 1 ? 2 : 1.5,
  dur: `${2.5 + (i % 5) * 0.7}s`,
  delay: `${(i * 0.3) % 3}s`,
}));

export function PhaseOverlay({ phase }) {
  const overlayType = getOverlayType(phase);
  const isNight = overlayType === 'night';

  return (
    <>
      <div
        className={`mafia-phase-overlay mafia-phase-overlay--${overlayType}`}
        aria-hidden
      />
      <div className={`mafia-stars${isNight ? ' mafia-stars--visible' : ''}`} aria-hidden>
        {STARS.map((s) => (
          <div
            key={s.id}
            className="mafia-star"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              '--dur': s.dur,
              '--delay': s.delay,
            }}
          />
        ))}
      </div>
    </>
  );
}
