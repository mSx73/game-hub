import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import '../components/GameLayout.css';

function AdminReleasePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState('');
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const token = searchParams.get('token');
  const adminToken = import.meta.env.VITE_ADMIN_TOKEN || 'dev-admin-token-123';

  // Проверка токена
  useEffect(() => {
    if (!token || token !== adminToken) {
      navigate('/');
      return;
    }
    
    fetchComingSoonGames();
  }, [token, adminToken, navigate]);

  const fetchComingSoonGames = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/coming-soon-games');
      const data = await response.json();
      
      if (data.success) {
        setGames(data.games);
        if (data.games.length > 0) {
          setSelectedGame(data.games[0].id);
        }
      } else {
        setError('Не удалось загрузить список игр');
      }
    } catch (err) {
      console.error('Error fetching games:', err);
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseGame = async () => {
    if (!selectedGame) {
      setError('Выберите игру для релиза');
      return;
    }

    const game = games.find(g => g.id === selectedGame);
    if (!game) {
      setError('Игра не найдена');
      return;
    }

    setReleasing(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/admin/release-game', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': token
        },
        body: JSON.stringify({
          gameId: selectedGame,
          releaseDate: new Date().toISOString()
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`Игра "${game.name}" успешно выпущена! Уведомления отправлены ${data.game.subscribersNotified} подписчикам.`);
        
        // Обновляем список игр
        fetchComingSoonGames();
        
        // Сбрасываем выбор через 5 секунд
        setTimeout(() => {
          setMessage('');
        }, 5000);
      } else {
        setError(data.error || 'Неизвестная ошибка');
      }
    } catch (err) {
      console.error('Error releasing game:', err);
      setError('Ошибка подключения к серверу');
    } finally {
      setReleasing(false);
    }
  };

  const handleLogout = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="game-layout">
        <div className="game-content">
          <div className="game-loading">
            <div className="loading-spinner"></div>
            <p>Загрузка админ-панели...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-layout">
      <header className="game-header">
        <div className="game-title">
          <span className="game-icon">🔧</span>
          <h1>Админ-панель: Релиз игр</h1>
        </div>
        <button className="leave-btn" onClick={handleLogout}>
          ← Выйти
        </button>
      </header>

      <div className="game-main-container">
        <main className="game-content">
          <div className="admin-panel">
            <div className="admin-header">
              <h2>Управление релизами игр</h2>
              <p className="admin-description">
                Выберите игру из списка "Скоро" и выпустите её. Все подписчики получат уведомления.
              </p>
            </div>

            {error && (
              <div className="admin-error">
                <div className="error-icon">❌</div>
                <div className="error-text">{error}</div>
                <button className="error-close" onClick={() => setError('')}>×</button>
              </div>
            )}

            {message && (
              <div className="admin-success">
                <div className="success-icon">✅</div>
                <div className="success-text">{message}</div>
                <button className="success-close" onClick={() => setMessage('')}>×</button>
              </div>
            )}

            <div className="game-selection">
              <h3>Выберите игру для релиза:</h3>
              
              {games.length === 0 ? (
                <div className="no-games">
                  <p>Нет игр в статусе "Скоро"</p>
                </div>
              ) : (
                <div className="games-list">
                  {games.map(game => (
                    <div 
                      key={game.id}
                      className={`game-card ${selectedGame === game.id ? 'selected' : ''}`}
                      onClick={() => setSelectedGame(game.id)}
                    >
                      <div className="game-card-icon">{game.icon}</div>
                      <div className="game-card-info">
                        <div className="game-card-name">{game.name}</div>
                        <div className="game-card-description">{game.description}</div>
                        <div className="game-card-meta">
                          <span className="game-card-players">👥 {game.players}</span>
                          <span className="game-card-subscribers">📧 {game.subscribers || 0} подписчиков</span>
                          <span className="game-card-eta">⏱️ {game.eta}</span>
                        </div>
                      </div>
                      {selectedGame === game.id && (
                        <div className="game-card-selected">✓</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedGame && games.length > 0 && (
              <div className="release-section">
                <div className="selected-game-info">
                  <h3>Информация о выбранной игре:</h3>
                  {(() => {
                    const game = games.find(g => g.id === selectedGame);
                    if (!game) return null;
                    
                    return (
                      <div className="game-details">
                        <div className="detail-row">
                          <span className="detail-label">Название:</span>
                          <span className="detail-value">{game.name} {game.icon}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Описание:</span>
                          <span className="detail-value">{game.description}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Игроков:</span>
                          <span className="detail-value">{game.players}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Подписчиков:</span>
                          <span className="detail-value">{game.subscribers || 0}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Категория:</span>
                          <span className="detail-value">{game.category}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Ожидаемый срок:</span>
                          <span className="detail-value">{game.eta}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="release-actions">
                  <button 
                    className="game-button release-btn"
                    onClick={handleReleaseGame}
                    disabled={releasing || games.length === 0}
                  >
                    {releasing ? (
                      <>
                        <div className="loading-spinner-small"></div>
                        Выпускаем...
                      </>
                    ) : (
                      '🚀 Выпустить игру'
                    )}
                  </button>
                  
                  <p className="release-warning">
                    ⚠️ После нажатия кнопки игра станет доступна всем пользователям, 
                    а подписчики получат уведомления. Действие нельзя отменить.
                  </p>
                </div>
              </div>
            )}

            <div className="admin-stats">
              <h3>Статистика:</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{games.length}</div>
                  <div className="stat-label">Игр в статусе "Скоро"</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">
                    {games.reduce((sum, game) => sum + (game.subscribers || 0), 0)}
                  </div>
                  <div className="stat-label">Всего подписчиков</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">
                    {new Date().toLocaleDateString('ru-RU')}
                  </div>
                  <div className="stat-label">Текущая дата</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <style jsx>{`
        .admin-panel {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem;
        }
        
        .admin-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        
        .admin-description {
          color: rgba(255, 255, 255, 0.7);
          font-size: 1.1rem;
          max-width: 600px;
          margin: 1rem auto;
          line-height: 1.6;
        }
        
        .admin-error, .admin-success {
          display: flex;
          align-items: center;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          margin: 1.5rem 0;
          animation: slideIn 0.3s ease;
        }
        
        .admin-error {
          background: rgba(220, 53, 69, 0.1);
          border: 2px solid #dc3545;
          color: #dc3545;
        }
        
        .admin-success {
          background: rgba(40, 167, 69, 0.1);
          border: 2px solid #28a745;
          color: #28a745;
        }
        
        .error-icon, .success-icon {
          font-size: 1.5rem;
          margin-right: 1rem;
        }
        
        .error-text, .success-text {
          flex: 1;
          font-weight: 500;
        }
        
        .error-close, .success-close {
          background: none;
          border: none;
          color: inherit;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        
        .error-close:hover, .success-close:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        
        .game-selection {
          margin: 2rem 0;
        }
        
        .games-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 1rem;
        }
        
        .game-card {
          display: flex;
          align-items: center;
          padding: 1.2rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }
        
        .game-card:hover {
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-2px);
        }
        
        .game-card.selected {
          border-color: #00dbde;
          background: rgba(0, 219, 222, 0.1);
        }
        
        .game-card-icon {
          font-size: 2.5rem;
          margin-right: 1.5rem;
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
        }
        
        .game-card-info {
          flex: 1;
        }
        
        .game-card-name {
          font-size: 1.3rem;
          font-weight: 700;
          margin-bottom: 0.3rem;
          color: #00dbde;
        }
        
        .game-card-description {
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 0.5rem;
          font-size: 0.95rem;
        }
        
        .game-card-meta {
          display: flex;
          gap: 1.5rem;
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.5);
        }
        
        .game-card-selected {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 24px;
          height: 24px;
          background: #00dbde;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }
        
        .no-games {
          text-align: center;
          padding: 3rem;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          border: 2px dashed rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.5);
        }
        
        .release-section {
          margin: 3rem 0;
          padding: 2rem;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .game-details {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
          padding: 1.5rem;
          margin: 1.5rem 0;
        }
        
        .detail-row {
          display: flex;
          margin-bottom: 0.8rem;
          padding-bottom: 0.8rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .detail-row:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }
        
        .detail-label {
          width: 150px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
        }
        
        .detail-value {
          flex: 1;
          color: white;
        }
        
        .release-actions {
          text-align: center;
          margin-top: 2rem;
        }
        
        .release-btn {
          background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
          box-shadow: 0 4px 15px rgba(255, 65, 108, 0.3);
          font-size: 1.2rem;
          padding: 1.2rem 3rem;
        }
        
        .release-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(255, 65, 108, 0.5);
        }
        
        .release-warning {
          color: #ffc107;
          font-size: 0.9rem;
          margin-top: 1rem;
          max-width: 500px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.5;
        }
        
        .admin-stats {
          margin-top: 3rem;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-top: 1.5rem;
        }
        
        .stat-card {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .stat-value {
          font-size: 2.5rem;
          font-weight: 900;
          color: #00dbde;
          margin-bottom: 0.5rem;
        }
        
        .stat-label {
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.6);
        }
        
        .loading-spinner-small {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          display: inline-block;
          margin-right: 10px;
          vertical-align: middle;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @media (max-width: 768px) {
          .admin-panel {
            padding: 1rem;
          }
          
          .game-card {
            flex-direction: column;
            text-align: center;
            padding: 1.5rem;
          }
          
          .game-card-icon {
            margin-right: 0;
            margin-bottom: 1rem;
          }
          
          .game-card-meta {
            flex-direction: column;
            gap: 0.5rem;
          }
          
          .detail-row {
            flex-direction: column;
          }
          
          .detail-label {
            width: 100%;
            margin-bottom: 0.3rem;
          }
          
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default AdminReleasePage;