import React from 'react';
import { getAccent } from '../data/gameAccents';
import { getGameCover } from '../data/gameCovers';
import './GameCover.css';

function CoverScene({ theme }) {
  switch (theme) {
    case 'detective':
      return (
        <svg viewBox="0 0 240 140" className="gc-scene" aria-hidden>
          <circle cx="180" cy="38" r="28" fill="rgba(255,255,255,0.06)" />
          <path d="M30 110 L70 70 L110 90 L150 50 L210 80" stroke="rgba(255,255,255,0.12)" strokeWidth="2" fill="none" />
          <rect x="18" y="92" width="44" height="36" rx="6" fill="rgba(0,0,0,0.25)" />
          <circle cx="160" cy="88" r="22" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="4" />
          <line x1="176" y1="104" x2="196" y2="124" stroke="rgba(255,255,255,0.35)" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    case 'bunker':
      return (
        <svg viewBox="0 0 240 140" className="gc-scene" aria-hidden>
          <rect x="0" y="78" width="240" height="62" fill="rgba(0,0,0,0.35)" />
          <path d="M40 78 L120 28 L200 78 Z" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" />
          <circle cx="120" cy="72" r="18" fill="rgba(255,200,0,0.25)" />
          <path d="M120 54 L120 90 M102 72 L138 72" stroke="rgba(255,220,80,0.8)" strokeWidth="3" />
          <rect x="96" y="92" width="48" height="36" rx="4" fill="rgba(30,30,30,0.8)" stroke="rgba(255,255,255,0.12)" />
        </svg>
      );
    case 'draw':
      return (
        <svg viewBox="0 0 240 140" className="gc-scene" aria-hidden>
          <rect x="28" y="24" width="140" height="96" rx="10" fill="rgba(255,255,255,0.92)" opacity="0.15" />
          <path d="M48 88 Q80 40 110 70 T168 52" stroke="rgba(255,255,255,0.55)" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M170 100 L210 60 L220 72 L180 112 Z" fill="rgba(255,255,255,0.35)" />
          <circle cx="72" cy="48" r="8" fill="rgba(255,100,100,0.7)" />
          <circle cx="98" cy="42" r="8" fill="rgba(100,200,255,0.7)" />
        </svg>
      );
    case 'words':
      return (
        <svg viewBox="0 0 240 140" className="gc-scene" aria-hidden>
          <ellipse cx="70" cy="58" rx="52" ry="34" fill="rgba(255,255,255,0.1)" />
          <ellipse cx="150" cy="78" rx="60" ry="38" fill="rgba(255,255,255,0.08)" />
          <text x="44" y="66" fill="rgba(255,255,255,0.45)" fontSize="22" fontWeight="800">АБВ</text>
          <text x="128" y="88" fill="rgba(255,255,255,0.35)" fontSize="18" fontWeight="800">XYZ</text>
        </svg>
      );
    case 'trivia':
      return (
        <svg viewBox="0 0 240 140" className="gc-scene" aria-hidden>
          <circle cx="120" cy="62" r="40" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
          <text x="108" y="74" fill="rgba(255,255,255,0.7)" fontSize="36" fontWeight="900">?</text>
          <circle cx="42" cy="38" r="6" fill="rgba(255,255,255,0.2)" />
          <circle cx="198" cy="44" r="8" fill="rgba(255,255,255,0.15)" />
          <rect x="30" y="104" width="180" height="8" rx="4" fill="rgba(255,255,255,0.08)" />
        </svg>
      );
    case 'party':
      return (
        <svg viewBox="0 0 240 140" className="gc-scene" aria-hidden>
          <path d="M30 30 L36 48 L54 48 L40 58 L46 76 L30 66 L14 76 L20 58 L6 48 L24 48 Z" fill="rgba(255,220,80,0.35)" />
          <path d="M190 20 L194 32 L206 32 L196 40 L200 52 L190 44 L180 52 L184 40 L174 32 L186 32 Z" fill="rgba(255,120,200,0.4)" />
          <circle cx="120" cy="72" r="34" fill="rgba(255,255,255,0.06)" />
          <path d="M60 100 Q120 60 180 100" stroke="rgba(255,255,255,0.2)" strokeWidth="3" fill="none" />
        </svg>
      );
    case 'music':
      return (
        <svg viewBox="0 0 240 140" className="gc-scene" aria-hidden>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect
              key={i}
              x={48 + i * 22}
              y={90 - (i % 3) * 18 - (i % 2) * 12}
              width="10"
              height={30 + (i % 4) * 14}
              rx="4"
              fill="rgba(255,255,255,0.25)"
            />
          ))}
          <circle cx="190" cy="48" r="16" fill="rgba(255,255,255,0.12)" />
          <path d="M190 32 L190 64 M178 48 L202 48" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
        </svg>
      );
    case 'action':
      return (
        <svg viewBox="0 0 240 140" className="gc-scene" aria-hidden>
          <polygon points="120,20 135,70 190,70 145,100 160,150 120,120 80,150 95,100 50,70 105,70" fill="rgba(255,255,255,0.12)" />
          <circle cx="120" cy="72" r="28" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" strokeDasharray="8 6" />
        </svg>
      );
    case 'social':
      return (
        <svg viewBox="0 0 240 140" className="gc-scene" aria-hidden>
          <circle cx="88" cy="58" r="22" fill="rgba(255,255,255,0.15)" />
          <circle cx="152" cy="58" r="22" fill="rgba(255,255,255,0.12)" />
          <circle cx="120" cy="88" r="22" fill="rgba(255,255,255,0.1)" />
          <path d="M88 80 Q120 68 152 80" stroke="rgba(255,255,255,0.2)" strokeWidth="2" fill="none" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 240 140" className="gc-scene" aria-hidden>
          <circle cx="120" cy="70" r="50" fill="rgba(255,255,255,0.08)" />
        </svg>
      );
  }
}

export function GameCover({ game, className = '', compact = false }) {
  const { theme, emoji } = getGameCover(game);
  const [a, b] = getAccent(game);

  return (
    <div
      className={`game-cover game-cover--${theme} ${compact ? 'game-cover--compact' : ''} ${className}`}
      style={{ '--gc-a': a, '--gc-b': b }}
      aria-hidden="true"
    >
      <CoverScene theme={theme} />
      <span className="game-cover__emoji">{emoji}</span>
      <div className="game-cover__shine" />
    </div>
  );
}

export default GameCover;
