import React, { useState, useEffect } from 'react';
import GameLayout from '../components/GameLayout';
import './GameStyles.css';

const COLORS = [
  { name: 'Красный', value: '#ff4757', hex: 'ff4757' },
  { name: 'Синий', value: '#3742fa', hex: '3742fa' },
  { name: 'Зеленый', value: '#2ed573', hex: '2ed573' },
  { name: 'Желтый', value: '#ffa502', hex: 'ffa502' },
  { name: 'Фиолетовый', value: '#9b59b6', hex: '9b59b6' },
  { name: 'Оранжевый', value: '#ff7f50', hex: 'ff7f50' },
  { name: 'Розовый', value: '#ff6b81', hex: 'ff6b81' },
  { name: 'Бирюзовый', value: '#1dd1a1', hex: '1dd1a1' },
];

function ColorsGame({ room, socket, players }) {
  const [gameState, setGameState] = useState({
    state: 'waiting',
    round: 0,
    maxRounds: 5,
    currentColor: null,
    currentColorName: '',
    options: [],
    correctAnswer: null,
    timeLeft: 10,
    scores: [],
    lives: {}
  });
  
  const [isReady, setIsReady] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);

  // Подписка на события игры
  useEffect(() => {
    if (!socket) return;

    const handleGameState = (data) => {
      setGameState(prev => ({ ...prev, ...data }));
      setSelectedAnswer(null);
      setShowResult(false);
    };

    const handleRoundStarted = (data) => {
      setGameState(prev => ({ 
        ...prev, 
        ...data,
        state: 'showing'
      }));
      setSelectedAnswer(null);
      setShowResult(false);
    };

    const handleGuessingStarted = (data) => {
      setGameState(prev => ({ 
        ...prev, 
        ...data,
        state: 'guessing'
      }));
    };

    const handleTimer = (data) => {
      setGameState(prev => ({ ...prev, timeLeft: data.timeLeft }));
    };

    const handlePlayerCorrect = (data) => {
      if (data.playerId === socket.id) {
        setShowResult(true);
      }
    };

    const handlePlayerWrong = (data) => {
      if (data.playerId === socket.id) {
        setShowResult(true);
      }
    };

    const handleRoundEnded = (data) => {
      setGameState(prev => ({ 
        ...prev, 
        ...data,
        state: 'roundEnd'
      }));
      setShowResult(true);
    };

    socket.on('colors:game-state', handleGameState);
    socket.on('colors:game-round-started', handleRoundStarted);
    socket.on('colors:game-guessing-started', handleGuessingStarted);
    socket.on('colors:game-timer', handleTimer);
    socket.on('colors:player-correct', handlePlayerCorrect);
    socket.on('colors:player-wrong', handlePlayerWrong);
    socket.on('colors:game-round-ended', handleRoundEnded);

    return () => {
      socket.off('colors:game-state', handleGameState);
      socket.off('colors:game-round-started', handleRoundStarted);
      socket.off('colors:game-guessing-started', handleGuessingStarted);
      socket.off('colors:game-timer', handleTimer);
      socket.off('colors:player-correct', handlePlayerCorrect);
      socket.off('colors:player-wrong', handlePlayerWrong);
      socket.off('colors:game-round-ended', handleRoundEnded);
    };
  }, [socket]);

  const handleReady = () => {
    if (!socket) return;
    setIsReady(true);
    socket.emit('game:action', { type: 'ready', ready: true });
  };

  const handleGuess = (index) => {
    if (gameState.state !== 'guessing' || selectedAnswer !== null || !socket) return;
    
    setSelectedAnswer(index);
    socket.emit('game:action', { type: 'guess-color', index });
  };

  const getPlayerScore = (playerId) => {
    const player = gameState.scores?.find(p => p.id === playerId);
    return player?.score || 0;
  };

  const getPlayerLives = (playerId) => {
    return gameState.lives?.[playerId] || 3;
  };

  const renderColorDisplay = () => {
    if (!gameState.currentColor) return null;

    return (
      <div className="color-display">
        <div 
          className="color-square"
          style={{ 
            backgroundColor: gameState.currentColor.value,
            boxShadow: `0 0 30px ${gameState.currentColor.value}80`
          }}
        ></div>
        <div className="color-info">
          <h3>Запомните цвет</h3>
          <p className="color-name">{gameState.currentColor.name}</p>
          <p className="color-hex">#{gameState.currentColor.hex}</p>
        </div>
      </div>
    );
  };

  const renderOptions = () => {
    return (
      <div className="color-options">
        <h3>Какой это был цвет?</h3>
        <div className="options-grid">
          {gameState.options.map((option, index) => {
            const color = COLORS.find(c => c.name === option);
            if (!color) return null;

            const isSelected = selectedAnswer === index;
            const isCorrect = index === gameState.correctAnswer;
            const showCorrect = showResult && isCorrect;
            
            let className = 'color-option';
            if (isSelected) className += ' selected';
            if (showCorrect) className += ' correct';
            if (isSelected && !isCorrect) className += ' wrong';

            return (
              <button
                key={index}
                className={className}
                onClick={() => handleGuess(index)}
                disabled={selectedAnswer !== null || gameState.state !== 'guessing'}
                style={{ 
                  backgroundColor: color.value,
                  borderColor: showCorrect ? '#28a745' : isSelected ? '#ff4757' : 'transparent'
                }}
              >
                <span className="option-text">{option}</span>
                {isSelected && (
                  <span className="option-status">
                    {isCorrect ? '✅' : '❌'}
                  </span>
                )}
                {showCorrect && !isSelected && (
                  <span className="option-status correct">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderGameContent = () => {
    switch (gameState.state) {
      case 'waiting':
        return (
          <div className="game-waiting">
            <h2>🌈 Игра "Цвета"</h2>
            <p className="game-description">
              Запомните показанный цвет и выберите правильное название из вариантов!
              У каждого игрока 3 жизни.
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
                        <div className="player-lives">
                          {'❤️'.repeat(getPlayerLives(player.id))}
                        </div>
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

      case 'showing':
        return (
          <div className="game-showing">
            <h2>Запоминайте цвет!</h2>
            <div className="round-info">
              Раунд {gameState.round} из {gameState.maxRounds}
            </div>
            
            {renderColorDisplay()}
            
            <div className="timer-display">
              <div className="timer-bar">
                <div 
                  className="timer-progress" 
                  style={{ width: `${(10 - gameState.timeLeft) / 10 * 100}%` }}
                ></div>
              </div>
              <div className="timer-text">{gameState.timeLeft} сек</div>
            </div>
          </div>
        );

      case 'guessing':
        return (
          <div className="game-guessing">
            <h2>Выберите правильный цвет!</h2>
            <div className="round-info">
              Раунд {gameState.round} из {gameState.maxRounds}
            </div>
            
            {renderOptions()}
            
            <div className="timer-display">
              <div className="timer-bar">
                <div 
                  className="timer-progress" 
                  style={{ width: `${(10 - gameState.timeLeft) / 10 * 100}%` }}
                ></div>
              </div>
              <div className="timer-text">{gameState.timeLeft} сек</div>
            </div>

            {selectedAnswer !== null && (
              <div className="selection-result">
                {selectedAnswer === gameState.correctAnswer ? (
                  <div className="result-correct">
                    ✅ Правильно! +10 очков
                  </div>
                ) : (
                  <div className="result-wrong">
                    ❌ Неправильно! -1 жизнь
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'roundEnd':
        return (
          <div className="game-round-end">
            <h2>Раунд {gameState.round} завершён!</h2>
            
            <div className="correct-answer">
              <h3>Правильный ответ:</h3>
              <div className="answer-display">
                <div 
                  className="color-square"
                  style={{ 
                    backgroundColor: gameState.currentColor?.value,
                    boxShadow: `0 0 30px ${gameState.currentColor?.value}80`
                  }}
                ></div>
                <div className="answer-text">
                  <h4>{gameState.currentColorName}</h4>
                  <p>#{gameState.currentColor?.hex}</p>
                </div>
              </div>
            </div>

            <div className="scoreboard">
              <h3>Текущие результаты</h3>
              <table className="scores-table">
                <thead>
                  <tr>
                    <th>Игрок</th>
                    <th>Счёт</th>
                    <th>Жизни</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map(player => (
                    <tr key={player.id}>
                      <td>{player.name}</td>
                      <td>{getPlayerScore(player.id)}</td>
                      <td>
                        <span className="lives-display">
                          {'❤️'.repeat(getPlayerLives(player.id))}
                          {'💔'.repeat(3 - getPlayerLives(player.id))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="next-round-info">
              {gameState.round < gameState.maxRounds ? (
                <p>Следующий раунд через 5 секунд...</p>
              ) : (
                <p>Игра завершена!</p>
              )}
            </div>
          </div>
        );

      case 'finished':
        return (
          <div className="game-finished">
            <h2>🎮 Игра завершена!</h2>
            
            <div className="final-results">
              <h3>Финальные результаты</h3>
              <table className="scores-table">
                <thead>
                  <tr>
                    <th>Место</th>
                    <th>Игрок</th>
                    <th>Счёт</th>
                    <th>Жизни</th>
                  </tr>
                </thead>
                <tbody>
                  {players
                    .map(player => ({
                      ...player,
                      score: getPlayerScore(player.id),
                      lives: getPlayerLives(player.id)
                    }))
                    .sort((a, b) => b.score - a.score)
                    .map((player, index) => (
                      <tr key={player.id} className={index === 0 ? 'winner-row' : ''}>
                        <td>
                          {index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                        </td>
                        <td>{player.name}</td>
                        <td>{player.score}</td>
                        <td>
                          <span className="lives-display">
                            {'❤️'.repeat(player.lives)}
                          </span>
                        </td>
                      </tr>
                    ))
                  }
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
      gameName="Цвета"
      gameIcon="🌈"
      playerCount={players.length}
      players={players}
      onLeaveRoom={() => window.location.href = '/'}
      showChat={true}
    >
      <div className="colors-game">
        {renderGameContent()}
      </div>
    </GameLayout>
  );
}

export default ColorsGame;