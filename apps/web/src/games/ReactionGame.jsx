import React, { useState, useEffect, useRef } from 'react';
import GameLayout from '../components/GameLayout';
import './GameStyles.css';

function ReactionGame({ room, socket, players }) {
  const [gameState, setGameState] = useState({
    state: 'waiting',
    countdown: 3,
    players: [],
    winner: null,
    scores: [],
    reactionTime: null
  });
  
  const [isReady, setIsReady] = useState(false);
  const [reactionStartTime, setReactionStartTime] = useState(null);
  const [myReactionTime, setMyReactionTime] = useState(null);
  const buttonRef = useRef(null);

  // Подписка на события игры
  useEffect(() => {
    if (!socket) return;

    const handleGameState = (data) => {
      setGameState(prev => ({ ...prev, ...data }));
    };

    const handleCountdown = (data) => {
      setGameState(prev => ({ ...prev, countdown: data.countdown, state: 'countdown' }));
    };

    const handleSignal = () => {
      setGameState(prev => ({ ...prev, state: 'active' }));
      setReactionStartTime(Date.now());
      setMyReactionTime(null);
    };

    const handleWinner = (data) => {
      setGameState(prev => ({ 
        ...prev, 
        winner: data.winnerId,
        scores: data.scores || prev.scores,
        state: 'finished'
      }));
    };

    const handlePlayerReacted = (data) => {
      if (data.playerId === socket.id) {
        setMyReactionTime(data.reactionTime);
      }
    };

    socket.on('reaction:game-state', handleGameState);
    socket.on('reaction:game-countdown', handleCountdown);
    socket.on('reaction:game-signal', handleSignal);
    socket.on('reaction:game-winner', handleWinner);
    socket.on('reaction:player-reacted', handlePlayerReacted);

    return () => {
      socket.off('reaction:game-state', handleGameState);
      socket.off('reaction:game-countdown', handleCountdown);
      socket.off('reaction:game-signal', handleSignal);
      socket.off('reaction:game-winner', handleWinner);
      socket.off('reaction:player-reacted', handlePlayerReacted);
    };
  }, [socket]);

  const handleReady = () => {
    if (!socket) return;
    setIsReady(true);
    socket.emit('game:action', { type: 'ready', ready: true });
  };

  const handleReact = () => {
    if (gameState.state !== 'active' || !socket) return;
    
    const reactionTime = Date.now() - reactionStartTime;
    setMyReactionTime(reactionTime);
    
    socket.emit('game:action', { type: 'react' });
  };

  const getPlayerScore = (playerId) => {
    const player = gameState.scores?.find(p => p.id === playerId);
    return player?.score || 0;
  };

  const getPlayerReactionTime = (playerId) => {
    const player = gameState.scores?.find(p => p.id === playerId);
    return player?.reactionTime || null;
  };

  const renderGameContent = () => {
    switch (gameState.state) {
      case 'waiting':
        return (
          <div className="game-waiting">
            <h2>⚡ Игра на реакцию</h2>
            <p className="game-description">
              Нажмите кнопку как можно быстрее после сигнала!
            </p>
            
            <div className="players-ready-list">
              <h3>Готовы к игре ({players.filter(p => p.ready).length}/{players.length})</h3>
              <div className="players-grid">
                {players.map(player => (
                  <div key={player.id} className={`player-card ${player.ready ? 'ready' : 'not-ready'}`}>
                    <div className="player-avatar">{player.name.charAt(0)}</div>
                    <div className="player-info">
                      <div className="player-name">{player.name}</div>
                      <div className="player-status">
                        {player.ready ? '✅ Готов' : '⏳ Ожидание'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {!isReady && (
              <button className="game-button ready-btn" onClick={handleReady}>
                ✅ Я готов!
              </button>
            )}

            {isReady && (
              <div className="waiting-message">
                <div className="loading-spinner"></div>
                <p>Ожидаем других игроков...</p>
              </div>
            )}
          </div>
        );

      case 'countdown':
        return (
          <div className="game-countdown">
            <div className="countdown-number">{gameState.countdown}</div>
            <p>Приготовьтесь!</p>
            <div className="countdown-bar">
              <div 
                className="countdown-progress" 
                style={{ width: `${(3 - gameState.countdown) / 3 * 100}%` }}
              ></div>
            </div>
          </div>
        );

      case 'active':
        return (
          <div className="game-active">
            <h2>ЖДИТЕ СИГНАЛА...</h2>
            <div className="signal-indicator">
              <div className="signal-pulse"></div>
              <div className="signal-pulse delay-1"></div>
              <div className="signal-pulse delay-2"></div>
            </div>
            
            <button 
              ref={buttonRef}
              className="reaction-button" 
              onClick={handleReact}
              disabled={myReactionTime !== null}
            >
              {myReactionTime ? '✅ Вы нажали!' : 'НАЖМИТЕ!'}
            </button>

            {myReactionTime && (
              <div className="reaction-result">
                <p>Ваша реакция: <strong>{myReactionTime}ms</strong></p>
              </div>
            )}

            <div className="players-reacting">
              {players.map(player => {
                const reactionTime = getPlayerReactionTime(player.id);
                return (
                  <div key={player.id} className="player-reaction">
                    <span className="player-name">{player.name}</span>
                    <span className="player-status">
                      {reactionTime ? `✅ ${reactionTime}ms` : '⏳ Ожидание'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'finished':
        return (
          <div className="game-finished">
            <h2>🏆 Раунд завершён!</h2>
            
            {gameState.winner && (
              <div className="winner-announcement">
                <div className="winner-icon">👑</div>
                <h3>
                  Победитель: {players.find(p => p.id === gameState.winner)?.name || 'Неизвестно'}
                </h3>
                <p>Время реакции: {getPlayerReactionTime(gameState.winner)}ms</p>
              </div>
            )}

            <div className="scoreboard">
              <h3>Результаты</h3>
              <table className="scores-table">
                <thead>
                  <tr>
                    <th>Игрок</th>
                    <th>Счёт</th>
                    <th>Реакция</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map(player => (
                    <tr key={player.id} className={player.id === gameState.winner ? 'winner-row' : ''}>
                      <td>{player.name}</td>
                      <td>{getPlayerScore(player.id)}</td>
                      <td>
                        {getPlayerReactionTime(player.id) 
                          ? `${getPlayerReactionTime(player.id)}ms` 
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="game-controls">
              <button className="game-button" onClick={handleReady}>
                🔄 Сыграть ещё
              </button>
            </div>
          </div>
        );

      default:
        return (
          <div className="game-loading">
            <div className="loading-spinner"></div>
            <p>Загрузка игры...</p>
          </div>
        );
    }
  };

  return (
    <GameLayout
      gameName="Реакция"
      gameIcon="⚡"
      playerCount={players.length}
      players={players}
      onLeaveRoom={() => window.location.href = '/'}
      showChat={true}
    >
      <div className="reaction-game">
        {renderGameContent()}
      </div>
    </GameLayout>
  );
}

export default ReactionGame;