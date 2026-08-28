import React, { useState } from 'react';
import './BunkerRoom.css';

/* ============================================================================
 * BunkerRoom — фронт «Бункера». State-driven, голос — в Discord.
 * ==========================================================================*/

const LABELS = {
  bio: 'Биология', profession: 'Профессия', health: 'Здоровье',
  hobby: 'Хобби', baggage: 'Багаж', fact: 'Факт', phobia: 'Фобия',
};
const KEY_ICONS = {
  bio: '🧬', profession: '🛠️', health: '❤️', hobby: '🎯', baggage: '🎒', fact: '💡', phobia: '😱',
};
const PHASE_LABEL = {
  intro: 'Знакомство с катастрофой',
  reveal: 'Вскрытие карт',
  discussion: 'Обсуждение',
  voting: 'Голосование',
  revote: 'Переголосование',
  results: 'Итоги раунда',
  gameOver: 'Игра окончена',
};

const fmt = (s) => (s == null ? '' : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);

export function BunkerRoom({ state = {}, onAction = () => {} }) {
  const {
    phase = 'intro', round = 0, scenario, bunker = null, capacity = 0, aliveCount = 0,
    players = [], you = null, activeSpeaker = null, timer = null,
    speeches = {}, feed = [], lastResult = null, ended = null,
  } = state;
  const [selected, setSelected] = useState(null);
  const [actionMode, setActionMode] = useState(false); // выбор цели для карты действия
  const isVoting = phase === 'voting' || phase === 'revote';
  const canReveal = phase === 'reveal' && you?.alive && !you?.revealedThisRound;
  const mySpeech = phase === 'discussion' && activeSpeaker === you?.id;
  const card = you?.actionCard;
  const canUseCard = card && !card.used && you?.alive && ['reveal', 'discussion', 'voting'].includes(phase);

  const pick = (id) => {
    if (actionMode && id !== you?.id) {
      onAction({ type: 'use-action', target: id });
      setActionMode(false);
      return;
    }
    if (isVoting && id !== you?.id) setSelected((c) => (c === id ? null : id));
  };
  const confirmVote = () => { if (selected) { onAction({ type: 'vote', target: selected }); setSelected(null); } };
  const playCard = () => {
    if (!canUseCard) return;
    if (card.needsTarget) setActionMode((v) => !v);
    else onAction({ type: 'use-action' });
  };

  const recentFeed = feed.filter((f) => Date.now() - f.ts < 8000).slice(-4);

  return (
    <div className={`bunker-room bunker-room--${phase}`}>
      {/* Шапка */}
      <header className="bunker-top">
        <div className="bunker-brand">☢ БУНКЕР</div>
        <div className="bunker-phase">
          {PHASE_LABEL[phase] || phase}{round > 0 && phase !== 'gameOver' ? ` · Раунд ${round}` : ''}
        </div>
        <div className="bunker-meta">
          <span title="Мест в бункере">🚪 {capacity}</span>
          <span title="Живых">👥 {aliveCount}</span>
          <span className="bunker-timer">{fmt(timer)}</span>
        </div>
      </header>

      {/* Сценарий */}
      {scenario && (
        <div className="bunker-scenario">
          <b>☢ {scenario.title}.</b> {scenario.desc}{' '}
          <span className="bunker-scenario-cap">Мест в бункере: {capacity} из {players.length}.</span>
        </div>
      )}

      {/* Карта бункера */}
      {bunker && (
        <div className="bunker-shelter">
          🚪 <b>Убежище:</b> {bunker.size} м² · срок укрытия {bunker.stay} · еда {bunker.food} ·
          внутри: {bunker.items.join(', ')}
        </div>
      )}

      {/* Лента */}
      <div className="bunker-feed" aria-live="polite">
        {recentFeed.map((f) => <div key={f.id} className={`bunker-toast bunker-toast--${f.kind}`}>{f.text}</div>)}
      </div>

      {/* Игроки */}
      <div className="bunker-grid">
        {players.map((p) => {
          const speech = speeches[p.id];
          const showBubble = speech && Date.now() - speech.ts < 5500 && p.alive;
          return (
            <div
              key={p.id}
              className={[
                'bunker-player',
                !p.alive ? 'is-dead' : '',
                activeSpeaker === p.id && p.alive ? 'is-speaking' : '',
                (isVoting || actionMode) && p.alive && p.id !== you?.id ? 'is-votable' : '',
                actionMode && p.alive && p.id !== you?.id ? 'is-action-target' : '',
                selected === p.id ? 'is-selected' : '',
                you?.id === p.id ? 'is-self' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => p.alive && pick(p.id)}
            >
              {showBubble && <div className="bunker-bubble">{speech.text}</div>}
              <div className="bunker-player-head">
                <span className="bunker-player-name">
                  {p.name}{you?.id === p.id ? ' (вы)' : ''}
                  {p.actionUsed && <span className="bunker-action-badge" title="Карта действия разыграна">⚡</span>}
                </span>
                {!p.alive && <span className="bunker-exiled-tag">изгнан</span>}
              </div>
              <div className="bunker-chips">
                {Object.entries(p.revealed || {}).map(([k, v]) => (
                  <span key={k} className={`bunker-chip bunker-chip--${k}`} title={LABELS[k]}>
                    {KEY_ICONS[k]} {v}
                  </span>
                ))}
                {Object.keys(p.revealed || {}).length === 0 && <span className="bunker-chip bunker-chip--empty">карты закрыты</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Моя карта */}
      {you && (
        <div className="bunker-mycard">
          {card && (
            <div className={`bunker-action-card ${card.used ? 'is-used' : ''} ${actionMode ? 'is-arming' : ''}`}>
              <div className="bunker-action-card-info">
                <span className="bunker-action-card-name">⚡ {card.name}</span>
                <span className="bunker-action-card-desc">{card.desc}</span>
              </div>
              <button
                type="button"
                className="bunker-btn bunker-btn--card"
                disabled={!canUseCard}
                onClick={playCard}
              >
                {card.used ? 'Разыграна' : actionMode ? 'Отмена — или кликни цель' : 'Разыграть'}
              </button>
            </div>
          )}
          <div className="bunker-mycard-title">
            🗂 Ваш персонаж {canReveal && <em>— выберите, что вскрыть</em>}
          </div>
          <div className="bunker-mycard-grid">
            {Object.entries(you.card || {}).map(([k, v]) => {
              const open = (you.revealed || []).includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  className={`bunker-mychip ${open ? 'is-open' : ''} ${canReveal && !open ? 'is-clickable' : ''}`}
                  disabled={!canReveal || open}
                  onClick={() => canReveal && !open && onAction({ type: 'reveal', key: k })}
                  title={open ? 'Уже открыто всем' : canReveal ? 'Вскрыть эту карту' : LABELS[k]}
                >
                  <span className="bunker-mychip-label">{KEY_ICONS[k]} {LABELS[k]}</span>
                  <span className="bunker-mychip-value">{v}</span>
                  <span className="bunker-mychip-state">{open ? 'открыто' : 'скрыто'}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Док действий */}
      <div className="bunker-dock">
        {phase === 'intro' && <span className="bunker-dock-hint">☢ Изучите свою карту. Скоро начнётся борьба за место…</span>}
        {phase === 'reveal' && (you?.alive
          ? (you.revealedThisRound
            ? <span className="bunker-dock-hint">✓ Карта вскрыта — ждём остальных</span>
            : <span className="bunker-dock-hint">🔓 Вскройте одну характеристику (клик по своей карте)</span>)
          : <span className="bunker-dock-hint">👁 Вы изгнаны — наблюдаете</span>)}
        {phase === 'discussion' && (mySpeech
          ? (<><span className="bunker-dock-hint">🎤 Ваше слово — убедите всех в Discord!</span>
              <button className="bunker-btn" onClick={() => onAction({ type: 'finish-speaking' })}>Завершить речь ⏭</button></>)
          : <span className="bunker-dock-hint">🎧 Слово у {players.find((p) => p.id === activeSpeaker)?.name || '…'}</span>)}
        {isVoting && (you?.alive
          ? (<><span className="bunker-dock-hint">🗳 Кого изгоняем{phase === 'revote' ? ' (переголосование)' : ''}?</span>
              <button className="bunker-btn bunker-btn--danger" disabled={!selected} onClick={confirmVote}>
                {selected ? `Изгнать: ${players.find((p) => p.id === selected)?.name}` : 'Выберите игрока'}
              </button></>)
          : <span className="bunker-dock-hint">👁 Изгнанные не голосуют</span>)}
        {phase === 'results' && lastResult && (
          <span className="bunker-dock-hint">
            {lastResult.exiled ? `🚪 ${lastResult.exiled.name} покидает убежище…` : '🤝 Раунд без изгнания'}
          </span>
        )}
      </div>

      {/* Финал */}
      {phase === 'gameOver' && ended && (
        <div className="bunker-final">
          <div className="bunker-final-card">
            <div className="bunker-final-title">🚪 Двери бункера закрыты</div>
            <div className="bunker-final-sub">Выжили и продолжат человечество:</div>
            <div className="bunker-final-list">
              {(ended.survivors || []).map((s) => (
                <div key={s.id} className="bunker-final-row">
                  <b>{s.name}</b>
                  <span>{s.card?.profession} · {s.card?.bio}</span>
                </div>
              ))}
            </div>
            <div className="bunker-final-hint">Комната вернулась в лобби — можно сыграть ещё раз.</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BunkerRoom;
