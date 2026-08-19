import React from 'react';

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function TimerRing({ time, maxTime }) {
  const progress = maxTime > 0 ? Math.max(0, Math.min(1, time / maxTime)) : 0;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const isUrgent = time > 0 && time <= 10;
  const isWarning = time > 10 && time <= 20;

  const strokeColor = isUrgent
    ? '#EF2D56'
    : isWarning
      ? '#F59E0B'
      : '#7C5CFC';

  return (
    <svg
      className={`timer-ring${isUrgent ? ' urgent' : ''}`}
      viewBox="0 0 100 100"
      aria-label={`Осталось ${Math.max(0, Math.floor(time))} секунд`}
      aria-live="polite"
    >
      <circle className="timer-track" cx="50" cy="50" r={RADIUS} />
      <circle
        className="timer-progress"
        cx="50"
        cy="50"
        r={RADIUS}
        stroke={strokeColor}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={strokeDashoffset}
        style={{
          filter: isUrgent
            ? `drop-shadow(0 0 8px ${strokeColor})`
            : undefined,
        }}
      />
      <text x="50" y="57" textAnchor="middle" className="timer-text">
        {Math.max(0, Math.floor(time))}
      </text>
    </svg>
  );
}
