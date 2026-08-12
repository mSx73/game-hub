import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import './ThemeToggle.css';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isModern = theme === 'modern';
  const location = useLocation();
  const isRoomPage = location.pathname.startsWith('/room/');

  return (
    <button
      type="button"
      className={`theme-toggle ${isRoomPage ? 'theme-toggle--room' : ''}`}
      aria-label="Переключить тему"
      title={isModern ? 'Включить неон-тему' : 'Включить modern-тему'}
      onClick={toggleTheme}
    >
      <span className="theme-toggle__icon" aria-hidden>{isModern ? '◐' : '◑'}</span>
      <span className="theme-toggle__label">{isModern ? 'Modern' : 'Neon'}</span>
    </button>
  );
}
