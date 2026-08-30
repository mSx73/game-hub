import React, { useState, useEffect, useRef } from 'react';
import GameLayout from '../components/GameLayout';
import './GameStyles.css';

function TeamWordsGame({ room, socket, players }) {
  const [gameState, setGameState] = useState({
    state: 'waiting',
    round: 0,
    maxRounds: 3,
    currentTeam: 'red',
    currentWord: '',
    currentCategory: '',
    currentExplainer: null,
    timeLeft: 60,
    teams: {
      red: { name: 'Красные', score: 0, players: [] },
      blue: { name: 'Синие', score: 0, players: [] }
    },
    guessedWords: [],
    skippedWords: [],
    wordSet: []
  });
  
  const [isReady, setIsReady] = useState(false);
  const [guessInput, setGuessInput] = useState('');
  const [isExplainer, setIsExplainer] = useState(false);
  const [explainerWord, setExplainerWord] = useState('');
  const inputRef = useRef(null);

  // Подписка на события игры
  useEffect(() => {
    if (!socket) return;

    const handleGameState = (data) => {
      setGameState(prev => ({ ...prev, ...data }));
      setIsExplainer(data.currentExplainer === socket.id);
    };

    const handleTeamsUpdated = (teams) => {
      setGameState(prev => ({ ...prev, teams }));
    };

    const handleGameStarted = (data) => {
      setGameState(prev => ({ 
        ...prev, 
        ...data,
        state: 'explaining'
      }));
      setIsExplainer(data.explainer === socket.id);
    };

    const handleWordChanged = (data) => {
      setGameState(prev => ({ 
        ...prev, 
        currentWord: data.word,
        currentCategory: data.category,
        wordSet: data.remaining,
        guessedWords: data.guessed,
        skippedWords: data.skipped
      }));
    };

    const handleExplainerWord = (data) => {
      if (data.playerId === socket.id) {
        setExplainerWord(data.word);
      }
    };

    const handleTimer = (data) => {
      setGameState(prev => ({ ...prev, timeLeft: data.timeLeft }));
    };

    const handleWordGuessed = (data) => {
      if (data.playerId === socket.id) {
        setGuessInput('');
      }
    };

    const handleRoundEnded = (data) => {
      setGameState(prev => ({ 
        ...prev, 
        ...data,
        state: 'roundEnd'
      }));
    };

    const handleGameEnded = (data) => {
      setGameState(prev => ({ 
        ...prev, 
        ...data,
        state: 'gameEnd'
      }));
    };

    socket.on('teamwords:game-state', handleGameState);
    socket.on('teamwords:teams-updated', handleTeamsUpdated);
    socket.on('teamwords:game-started', handleGameStarted);
    socket.on('teamwords:game-word-changed', handleWordChanged);
    socket.on('teamwords:explainer-word', handleExplainerWord);
    socket.on('teamwords:game-timer', handleTimer);
    socket.on('teamwords:word-guessed', handleWordGuessed);
    socket.on('teamwords:game-round-ended', handleRoundEnded);
    socket.on('teamwords:game-ended', handleGameEnded);

    return () => {
      socket.off('teamwords:game-state', handleGameState);
      socket.off('teamwords:teams-updated', handleTeamsUpdated);
      socket.off('teamwords:game-started', handleGameStarted);
      socket.off('teamwords:game-word-changed', handleWordChanged);
      socket.off('teamwords:explainer-word', handleExplainerWord);
      socket.off('teamwords:game-timer', handleTimer);
      socket.off('teamwords:word-guessed', handleWordGuessed);
      socket.off('teamwords:game-round-ended', handleRoundEnded);
      socket.off('teamwords:game-ended', handleGameEnded);
    };
  }, [socket]);

  useEffect(() => {
    if (inputRef.current && gameState.state === 'explaining' && !isExplainer) {
      inputRef.current.focus();
    }
  }, [gameState.state, isExplainer]);

  const handleReady = () => {
    if (!socket) return;
    setIsReady(true);
    socket.emit('game:action', { type: 'ready', ready: true });
  };

  const handleGuess = (e) => {
    e.preventDefault();
    if (!guessInput.trim() || !socket || isExplainer) return;
    
    socket.emit('game:action', { type: 'guess-word', guess: guessInput.trim() });
    setGuessInput('');
  };

  const handleSkip = () => {
    if (!socket || !isExplainer) return;
    socket.emit('game:action', { type: 'skip-word' });
  };

  const getPlayerTeam = (playerId) => {
    if (gameState.teams.red.players.some(p => p.id === playerId)) return 'red';
    if (gameState.teams.blue.players.some(p => p.id === playerId)) return 'blue';
    return null;
  };

  const getCurrentTeamName = () => {
    return gameState.teams[gameState.currentTeam]?.name || 'Неизвестно';
  };

  const getExplainerName = () => {
    if (!gameState.currentExplainer) return 'Неизвестно';
    const player = players.find(p => p.id === gameState.currentExplainer);
    return player?.name || 'Неизвестно';
  };

  const renderTeamDisplay = () => {
    return (
      <div className="teams-display">
        <div className={`team-card ${gameState.currentTeam === 'red' ? 'active' : ''}`}>
          <div className="team-header red">
            <h3>{gameState.teams.red.name}</h3>
            <div className="team-score">{gameState.teams.red.score}</div>
          </div>
          <div className="team-players">
            {gameState.teams.red.players.map(player => (
              <div key={player.id} className="team-player">
                <span className="player-name">{player.name}</span>
                <span className="player-score">{player.score}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="vs-separator">VS</div>
        
        <div className={`team-card ${gameState.currentTeam === 'blue' ? 'active' : ''}`}>
          <div className="team-header blue">
            <h3>{gameState.teams.blue.name}</h3>
            <div className="team-score">{gameState.teams.blue.score}</div>
          </div>
          <div className="team-players">
            {gameState.teams.blue.players.map(player => (
              <div key={player.id} className="team-player">
                <span className="player-name">{player.name}</span>
                <span className="player-score">{player.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderGameContent = () => {
    switch (gameState.state) {
      case 'waiting':
        return (
          <div className="game-waiting">
            <h2>📝 Командные слова</h2>
            <p className="game-description">
              Объясняйте слова своей команде без использования однокоренных слов!
              Объясняющий видит слово, команда угадывает.
            </p>
            
            {renderTeamDisplay()}
            
            <div className="players-ready-list">
              <h3>Готовы к игре ({players.filter(p => p.ready).length}/{players.length})</h3>
              <div className="players-grid">
                {players.map(player => {
                  const team = getPlayerTeam(player.id);
                  return (
                    <div key={player.id} className={`player-card ${player.ready ? 'ready' : 'not-ready'}`}>
                      <div 
                        className="player-avatar"
                        style={{ 
                          background: team === 'red' 
                            ? 'linear-gradient(135deg, #ff4757 0%, #ff6b81 100%)' 
                            : 'linear-gradient(135deg, #3742fa 0%, #4b7bec 100%)'
                        }}
                      >
                        {player.name.charAt(0)}
                      </div>
                      <div className="player-info">
                        <div className="player-name">{player.name}</div>
                        <div className="player-status">
                          {player.ready ? '✅ Готов' : '⏳ Ожидание'}
                          <div className="player-team">
                            {team === 'red' ? '🔴 Красные' : '🔵 Синие'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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

      case 'explaining':
        return (
          <div className="game-explaining">
            <div className="round-info">
              Раунд {gameState.round} из {gameState.maxRounds} • {getCurrentTeamName()} • Объясняет: {getExplainerName()}
            </div>
            
            <div className="category-display">
              <h3>Категория: {gameState.currentCategory}</h3>
            </div>

            {isExplainer ? (
              <div className="explainer-view">
                <div className="word-display">
                  <h2>Ваше слово:</h2>
                  <div className="word-text">{explainerWord}</div>
                  <p className="explainer-instruction">
                    Объясните это слово команде без использования однокоренных слов!
                  </p>
                </div>
                
                <div className="game-stats">
                  <div className="stat-card">
                    <div className="stat-label">Угадано</div>
                    <div className="stat-value">{gameState.guessedWords.length}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Пропущено</div>
                    <div className="stat-value">{gameState.skippedWords.length}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Осталось</div>
                    <div className="stat-value">{gameState.wordSet}</div>
                  </div>
                </div>

                <button className="game-button skip-btn" onClick={handleSkip}>
                  ⏭️ Пропустить слово
                </button>
              </div>
            ) : (
              <div className="guesser-view">
                <div className="word-progress">
                  <h2>Угадывайте слова!</h2>
                  <p>Объясняющий: {getExplainerName()}</p>
                </div>
                
                <form className="guess-form" onSubmit={handleGuess}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={guessInput}
                    onChange={(e) => setGuessInput(e.target.value)}
                    placeholder="Введите слово..."
                    className="guess-input"
                    autoFocus
                  />
                  <button type="submit" className="guess-btn" disabled={!guessInput.trim()}>
                    Отправить
                  </button>
                </form>

                <div className="recent-words">
                  <h3>Недавно угаданные:</h3>
                  <div className="words-list">
                    {gameState.guessedWords.slice(-5).map((word, index) => (
                      <span key={index} className="word-tag">
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="timer-display">
              <div className="timer-bar">
                <div 
                  className="timer-progress" 
                  style={{ width: `${(60 - gameState.timeLeft) / 60 * 100}%` }}
                ></div>
              </div>
              <div className="timer-text">{gameState.timeLeft} сек</div>
            </div>

            {renderTeamDisplay()}
          </div>
        );

      case 'roundEnd':
        return (
          <div className="game-round-end">
            <h2>Раунд {gameState.round} завершён!</h2>
            
            <div className="round-results">
              <h3>Результаты раунда:</h3>
              <div className="results-grid">
                <div className="result-card">
                  <div className="result-label">Команда</div>
                  <div className="result-value">{getCurrentTeamName()}</div>
                </div>
                <div className="result-card">
                  <div className="result-label">Угадано слов</div>
                  <div className="result-value">{gameState.guessedWords.length}</div>
                </div>
                <div className="result-card">
                  <div className="result-label">Очков за раунд</div>
                  <div className="result-value">{gameState.guessedWords.length * 10}</div>
                </div>
              </div>
            </div>

            <div className="guessed-words">
              <h4>Угаданные слова:</h4>
              <div className="words-grid">
                {gameState.guessedWords.map((word, index) => (
                  <div key={index} className="word-item">
                    {word}
                  </div>
                ))}
              </div>
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

      case 'gameEnd':
        return (
          <div className="game-finished">
            <h2>🏆 Игра завершена!</h2>
            
            <div className="winner-announcement">
              <div className="winner-icon">🏆</div>
              <h3>
                Победили: {gameState.teams.red.score > gameState.teams.blue.score 
                  ? gameState.teams.red.name 
                  : gameState.teams.blue.score > gameState.teams.red.score 
                    ? gameState.teams.blue.name 
                    : 'Ничья!'}
              </h3>
              <div className="final-scores">
                <div className="final-score red">
                  {gameState.teams.red.name}: {gameState.teams.red.score} очков
                </div>
                <div className="final-score blue">
                  {gameState.teams.blue.name}: {gameState.teams.blue.score} очков
                </div>
              </div>
            </div>

            <div className="final-results">
              <h3>Итоговые результаты</h3>
              <div className="teams-final">
                {renderTeamDisplay()}
              </div>
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
      gameName="Командные слова"
      gameIcon="📝"
      playerCount={players.length}
      players={players}
      onLeaveRoom={() => window.location.href = '/'}
      showChat={true}
    >
      <div className="teamwords-game">
        {renderGameContent()}
      </div>
    </GameLayout>
  );
}

export default TeamWordsGame;