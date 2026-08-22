import React, { useState, useId } from 'react';
import './GameRulesDisclosure.css';

/**
 * Сворачиваемая подсказка «Как играть» — единый паттерн для мини-игр (кроме Мафии).
 */
export function GameRulesDisclosure({
  className = '',
  label = 'Как играть',
  defaultOpen = false,
  summary,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={`game-rules-disclosure ${className}`.trim()}>
      <button
        type="button"
        className="game-rules-disclosure__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`game-rules-disclosure__chevron ${open ? 'game-rules-disclosure__chevron--open' : ''}`} aria-hidden>
          ›
        </span>
        {label}
      </button>
      {open && (
        <div id={panelId} className="game-rules-disclosure__panel" role="region">
          {summary ? <p className="game-rules-disclosure__summary">{summary}</p> : null}
          {children}
        </div>
      )}
    </div>
  );
}

/** Список правил из массива строк (маркированный) */
export function GameRulesBulletList({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <ul className="game-rules-disclosure__list">
      {items.map((text, i) => (
        <li key={i}>{text}</li>
      ))}
    </ul>
  );
}

/** Единая таблица очков (как в квизе) */
export function GameScoreboardBlock({ rows, title = 'Таблица очков', legend, className = '' }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return (
    <div className={`quiz-scoreboard game-unified-scoreboard ${className}`.trim()}>
      <div className="quiz-scoreboard-header">
        <span className="quiz-scoreboard-title">{title}</span>
        {legend ? <span className="quiz-scoreboard-legend">{legend}</span> : null}
      </div>
      <ul className="quiz-scoreboard-list" aria-label="Очки игроков">
        {rows.map((p) => (
          <li
            key={p.id}
            className={`quiz-scoreboard-row ${p.isSelf ? 'quiz-scoreboard-row--self' : ''} ${
              p.rank === 1 ? 'quiz-scoreboard-row--first' : ''
            }`}
          >
            <span className="quiz-scoreboard-rank" aria-hidden>
              {p.medal || p.rank}
            </span>
            <span className="quiz-scoreboard-name">{p.name}</span>
            <span className="quiz-scoreboard-points">{Number(p.score) || 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
