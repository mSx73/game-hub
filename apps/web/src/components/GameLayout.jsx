import React from 'react';
import { useNavigate } from 'react-router-dom';
import './GameLayout.css';

function GameLayout({
  gameName = 'Игра',
  gameIcon = '🎮',
  children,
  playerCount = 0,
  players = [],
  onLeaveRoom,
}) {
  const navigate = useNavigate();

  const handleLeave = () => {
    if (onLeaveRoom) {
      onLeaveRoom();
    } else {
      navigate('/');
    }
  };

  return (
    <div className="game-layout">
      <header className="game-header">
        <div className="game-title">
          <span className="game-icon">{gameIcon}</span>
          <h1>{gameName}</h1>
          <div className="game-meta">
            <span className="player-count">
              👥 {playerCount} {playerCount === 1 ? 'игрок' : playerCount < 5 ? 'игрока' : 'игроков'}
            </span>
            {players.length > 0 && (
              <div className="players-list">
                {players.map(p => (
                  <span key={p.id} className="player-tag" title={p.name}>
                    {p.name.charAt(0)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button className="leave-btn" onClick={handleLeave}>
          ← Покинуть комнату
        </button>
      </header>

      <div className="game-main-container">
        <main className="game-content">
          {children}
        </main>
      </div>

      <div className="mobile-controls">
        <button className="mobile-btn leave-btn" onClick={handleLeave}>
          ← Выйти
        </button>
        <div className="mobile-player-count">
          👥 {playerCount}
        </div>
      </div>
    </div>
  );
}

export default GameLayout;
