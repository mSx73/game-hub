import React from 'react';
import { getGameSkin } from '../../data/gameSkinTokens';
import './game-experiences.css';
import './game-experiences-games.css';

/**
 * Immersive ambient layer — orbs, particles, mood per game theme.
 */
export function GameExperienceAtmosphere({ gameType, playing = false, skin: skinProp }) {
  const skin = skinProp || getGameSkin(gameType);
  if (!playing || !skin) return null;

  const { theme, mood, emoji, id } = skin;

  return (
    <div
      className={`gx-atmosphere gx-atmosphere--${theme} gx-atmosphere--${mood.pattern}`}
      data-game={id}
      aria-hidden
    >
      <div className="gx-atmosphere__orb gx-atmosphere__orb--1" />
      <div className="gx-atmosphere__orb gx-atmosphere__orb--2" />
      <div className="gx-atmosphere__orb gx-atmosphere__orb--3" />
      <div className="gx-atmosphere__grid" />
      <div className="gx-atmosphere__particles">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="gx-atmosphere__particle" style={{ '--i': i }} />
        ))}
      </div>
      <div className="gx-atmosphere__watermark">{emoji}</div>
      <div className="gx-atmosphere__vignette" />
    </div>
  );
}

/**
 * Cinematic game hero — drop-in for lobby or round headers.
 */
export function GameExperienceHero({ gameType, isHost, phase, timer, skin: skinProp }) {
  const skin = skinProp || getGameSkin(gameType);

  return (
    <header className="gx-hero" data-game={skin.id}>
      <div className="gx-hero__glow" aria-hidden />
      <div className="gx-hero__main">
        <span className="gx-hero__emoji" aria-hidden>{skin.emoji}</span>
        <div className="gx-hero__text">
          <h2 className="gx-hero__title">{skin.label}</h2>
          <p className="gx-hero__tagline">{skin.tagline}</p>
        </div>
      </div>
      <div className="gx-hero__meta">
        {isHost && <span className="gx-hero__badge gx-hero__badge--host">👑 Ведущий</span>}
        {phase && <span className="gx-hero__badge gx-hero__badge--phase">{phase}</span>}
        {timer > 0 && (
          <span className={`gx-hero__timer${timer <= 10 ? ' gx-hero__timer--urgent' : ''}`}>
            {timer}s
          </span>
        )}
      </div>
    </header>
  );
}

export default GameExperienceAtmosphere;
