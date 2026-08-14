import React, { useEffect, useState } from 'react';
import './HomeMenu.css';

const NAV = [
  { id: 'catalog', href: '#catalog', label: 'Каталог', icon: '🎮' },
  { id: 'how', href: '#how-it-works', label: 'Как играть', icon: '❓' },
  { id: 'support', href: '#support', label: 'Поддержка', icon: '💜' },
];

export function HomeMenu({
  playerName,
  setPlayerName,
  joinCode,
  setJoinCode,
  onJoinSubmit,
  isConnected,
  isCreating,
  onCreateRoom,
  onRandomGame,
  onClearError,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [joinSheetOpen, setJoinSheetOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('home-menu-open', drawerOpen || joinSheetOpen);
    return () => document.body.classList.remove('home-menu-open');
  }, [drawerOpen, joinSheetOpen]);

  const scrollTo = (href) => {
    setDrawerOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <header className="hm-topbar">
        <div className="hm-topbar__inner">
          <div className="hm-brand">
            <a className="hm-logo" href="/" aria-label="PlayForFun — на главную">
              <span className="hm-logo__gem" aria-hidden>◆</span>
              <span className="hm-logo__text">PlayForFun</span>
            </a>
            <span className={`hm-status ${isConnected ? 'hm-status--ok' : 'hm-status--bad'}`}>
              {isConnected ? '● Online' : '● …'}
            </span>
          </div>

          <nav className="hm-nav" aria-label="Главное меню">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className={item.id === 'catalog' ? 'is-active' : ''}
                onClick={(e) => { e.preventDefault(); scrollTo(item.href); }}
              >
                <span className="hm-nav__icon" aria-hidden>{item.icon}</span>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hm-actions hm-actions--desktop">
            <form className="hm-join" onSubmit={onJoinSubmit}>
              <input
                type="text"
                value={playerName}
                onChange={(e) => { setPlayerName(e.target.value); onClearError?.(); }}
                placeholder="Имя"
                maxLength={20}
                aria-label="Ваше имя"
              />
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Код"
                maxLength={6}
                aria-label="Код комнаты"
                className="hm-join__code"
              />
              <button type="submit" disabled={!isConnected}>Войти</button>
            </form>
            <button
              type="button"
              className="hm-play-btn"
              disabled={isCreating || !isConnected}
              onClick={onCreateRoom}
            >
              {isCreating ? '…' : '🚀 Играть'}
            </button>
          </div>

          <button
            type="button"
            className="hm-burger"
            aria-label="Меню"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
        <div className="hm-topbar__glow" aria-hidden />
      </header>

      {/* Mobile drawer */}
      <div className={`hm-drawer ${drawerOpen ? 'is-open' : ''}`} aria-hidden={!drawerOpen}>
        <div className="hm-drawer__backdrop" onClick={() => setDrawerOpen(false)} />
        <aside className="hm-drawer__panel" role="dialog" aria-label="Навигация">
          <div className="hm-drawer__head">
            <strong>PlayForFun</strong>
            <button type="button" className="hm-drawer__close" onClick={() => setDrawerOpen(false)}>✕</button>
          </div>
          <nav className="hm-drawer__nav">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollTo(item.href)}
              >
                <span>{item.icon}</span> {item.label}
              </button>
            ))}
          </nav>
          <div className="hm-drawer__cta">
            <button
              type="button"
              className="hm-drawer__play"
              disabled={isCreating || !isConnected}
              onClick={() => { setDrawerOpen(false); onCreateRoom(); }}
            >
              🚀 Начать игру
            </button>
            <button
              type="button"
              className="hm-drawer__secondary"
              disabled={isCreating || !isConnected}
              onClick={() => { setDrawerOpen(false); onRandomGame(); }}
            >
              🎲 Случайная
            </button>
          </div>
        </aside>
      </div>

      {/* Mobile join sheet */}
      <div className={`hm-join-sheet ${joinSheetOpen ? 'is-open' : ''}`} aria-hidden={!joinSheetOpen}>
        <div className="hm-join-sheet__backdrop" onClick={() => setJoinSheetOpen(false)} />
        <div className="hm-join-sheet__panel" role="dialog" aria-label="Вход по коду">
          <h3>Войти по коду</h3>
          <form
            onSubmit={(e) => {
              onJoinSubmit(e);
              setJoinSheetOpen(false);
            }}
          >
            <input
              type="text"
              value={playerName}
              onChange={(e) => { setPlayerName(e.target.value); onClearError?.(); }}
              placeholder="Ваше имя"
              maxLength={20}
            />
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Код комнаты (6 символов)"
              maxLength={6}
            />
            <button type="submit" disabled={!isConnected}>Войти в комнату</button>
          </form>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <nav className="hm-bottom-bar" aria-label="Быстрые действия">
        <button type="button" onClick={() => scrollTo('#catalog')}>
          <span aria-hidden>🎮</span>
          <small>Каталог</small>
        </button>
        <button
          type="button"
          className="hm-bottom-bar__primary"
          disabled={isCreating || !isConnected}
          onClick={onCreateRoom}
        >
          <span aria-hidden>🚀</span>
          <small>Играть</small>
        </button>
        <button type="button" onClick={() => setJoinSheetOpen(true)}>
          <span aria-hidden>🔑</span>
          <small>Код</small>
        </button>
        <button
          type="button"
          disabled={isCreating || !isConnected}
          onClick={onRandomGame}
        >
          <span aria-hidden>🎲</span>
          <small>Random</small>
        </button>
      </nav>
    </>
  );
}

export default HomeMenu;
