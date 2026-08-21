import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ComingSoon.css';

const COMING_SOON_GAMES = [
  { id: 'reaction', name: 'Реакция', icon: '⚡', description: 'Нажми быстрее соперника!', eta: 'Май 2026' },
  { id: 'colors', name: 'Цвета', icon: '🌈', description: 'Нажми правильный цвет', eta: 'Май 2026' },
  { id: 'bombparty', name: 'Бомба', icon: '💣', description: 'Назови слово на букву', eta: 'Июнь 2026' },
  { id: 'sequence', name: 'Последовательность', icon: '🔢', description: 'Продолжи числовой ряд', eta: 'Июнь 2026' },
  { id: 'coopquiz', name: 'Командный квиз', icon: '🤝', description: 'Вместе против времени', eta: 'Июль 2026' },
  { id: 'teamwords', name: 'Командные слова', icon: '📝', description: 'Угадай без подготовки', eta: 'Июль 2026' },
  { id: 'relay', name: 'Эстафета', icon: '🏃', description: 'Передай эстафету дальше', eta: 'Июль 2026' },
  { id: 'sync', name: 'Синхро', icon: '⏱️', description: 'Нажмите одновременно', eta: 'Август 2026' },
  { id: 'password', name: 'Пароль', icon: '🔐', description: 'Зашифруй слово для друзей', eta: 'Август 2026' },
  { id: 'psych', name: 'Психолог', icon: '🧠', description: 'Угадай мысли других', eta: 'Август 2026' },
  { id: 'werewolf', name: 'Оборотни', icon: '🐺', description: 'Новая версия Мафии', eta: 'Сентябрь 2026' },
  { id: 'judge', name: 'Судья', icon: '⚖️', description: 'Ты решаешь, кто прав', eta: 'Сентябрь 2026' },
  { id: 'trust', name: 'Доверие', icon: '🤝', description: 'Доверишься или рискнёшь?', eta: 'Сентябрь 2026' },
  { id: 'impostor', name: 'Самозванец', icon: '👤', description: 'Найди самозванца в группе', eta: 'Октябрь 2026' },
  { id: 'sketch', name: 'Скетч', icon: '✏️', description: 'Рисуй и угадывай', eta: 'Октябрь 2026' },
  { id: 'caption', name: 'Подпись', icon: '💬', description: 'Придумай смешную подпись', eta: 'Октябрь 2026' },
  { id: 'collage', name: 'Коллаж', icon: '🖼️', description: 'Создай историю из слов', eta: 'Ноябрь 2026' },
  { id: 'emojiart', name: 'Эмодзи-арт', icon: '🎨', description: 'Рисуй эмодзи', eta: 'Ноябрь 2026' },
  { id: 'anagrams', name: 'Анаграммы', icon: '🔄', description: 'Составь слова из букв', eta: 'Ноябрь 2026' },
  { id: 'wordchain', name: 'Цепочка слов', icon: '⛓️', description: 'Слово на последнюю букву', eta: 'Декабрь 2026' },
  { id: 'crossword', name: 'Сканворд', icon: '📰', description: 'Пересечения букв', eta: 'Декабрь 2026' },
  { id: 'facts', name: 'Факты', icon: '📚', description: 'Правда или ложь?', eta: 'Декабрь 2026' },
  { id: 'flags', name: 'Флаги', icon: '🌍', description: 'Узнай страну по флагу', eta: 'Январь 2027' },
  { id: 'logos', name: 'Логотипы', icon: '🎯', description: 'Узнай бренд', eta: 'Январь 2027' },
  { id: 'maps', name: 'Карты', icon: '🗺️', description: 'Угадай место на карте', eta: 'Январь 2027' },
  { id: 'quotes', name: 'Цитаты', icon: '💬', description: 'Угадай автора цитаты', eta: 'Февраль 2027' },
];

function ComingSoon() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [selectedGames, setSelectedGames] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleGame = (gameId) => {
    setSelectedGames((prev) =>
      prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email && !telegram) {
      setError('Укажите email или Telegram для уведомлений');
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Введите корректный email');
      return;
    }

    if (selectedGames.length === 0) {
      setError('Выберите хотя бы одну игру');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email || null,
          telegram: telegram || null,
          games: selectedGames,
          visitorId: localStorage.getItem('pff_visitor_id_v1'),
        }),
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        setError('Ошибка при отправке. Попробуйте позже.');
      }
    } catch {
      setError('Ошибка сети. Проверьте соединение.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="cs-shell">
        <header className="cs-header">
          <button type="button" className="cs-back" onClick={() => navigate('/')}>
            ← На главную
          </button>
          <span className="cs-logo">PlayForFun</span>
        </header>
        <main className="cs-main">
          <div className="cs-success">
            <div className="cs-success-icon">🎉</div>
            <h1>Вы подписались!</h1>
            <p>
              Мы отправим уведомление, как только выбранная игра будет готова.
              <br />
              Следите за обновлениями!
            </p>
            <button type="button" className="cs-btn-primary" onClick={() => navigate('/')}>
              Вернуться к играм
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="cs-shell">
      <header className="cs-header">
        <button type="button" className="cs-back" onClick={() => navigate('/')}>
          ← На главную
        </button>
        <span className="cs-logo">PlayForFun</span>
      </header>

      <main className="cs-main">
        <section className="cs-hero">
          <h1>Скоро появятся</h1>
          <p>Мы работаем над новыми играми. Подпишитесь, чтобы узнать о запуске первым!</p>
        </section>

        <section className="cs-games-grid">
          {COMING_SOON_GAMES.map((game) => (
            <article
              key={game.id}
              className={`cs-game-card ${selectedGames.includes(game.id) ? 'selected' : ''}`}
              onClick={() => toggleGame(game.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleGame(game.id);
                }
              }}
            >
              <div className="cs-game-icon">{game.icon}</div>
              <h3>{game.name}</h3>
              <p>{game.description}</p>
              <span className="cs-game-eta">{game.eta}</span>
              {selectedGames.includes(game.id) && <div className="cs-check">✓</div>}
            </article>
          ))}
        </section>

        <section className="cs-subscribe-form">
          <h2>Подписаться на уведомления</h2>
          <p>Выберите интересные игры выше, затем укажите контакт для уведомлений.</p>

          <form onSubmit={handleSubmit}>
            <div className="cs-form-group">
              <label htmlFor="cs-email">Email</label>
              <input
                id="cs-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="email"
              />
            </div>

            <div className="cs-form-divider">
              <span>или</span>
            </div>

            <div className="cs-form-group">
              <label htmlFor="cs-telegram">Telegram</label>
              <input
                id="cs-telegram"
                type="text"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="@username"
                autoComplete="off"
              />
            </div>

            {error && <p className="cs-error">{error}</p>}

            <button type="submit" className="cs-btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Отправка...' : 'Подписаться'}
            </button>
          </form>
        </section>

        <section className="cs-info">
          <h2>Почему игры ещё не готовы?</h2>
          <div className="cs-info-grid">
            <article>
              <div>🎯</div>
              <h4>Качество</h4>
              <p>Мы тестируем каждую игру, чтобы она работала без багов.</p>
            </article>
            <article>
              <div>⚡</div>
              <h4>Скорость</h4>
              <p>Оптимизируем для слабых устройств и медленного интернета.</p>
            </article>
            <article>
              <div>🎨</div>
              <h4>Дизайн</h4>
              <p>Создаём удобный интерфейс для каждой игры.</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="cs-footer">
        <p>© 2026 PlayForFun. Мы вернёмся с новыми играми!</p>
      </footer>
    </div>
  );
}

export default ComingSoon;
