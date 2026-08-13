import React from 'react';
import { createPortal } from 'react-dom';
import './croc-luxe.css';

function CrocodileGuessList({ players, socketId, crocGuessedIds, crocConfirmingIds, onConfirmGuess }) {
  const candidates = players.filter((p) => p.id !== socketId && !p.isSpectator);
  if (!candidates.length) {
    return <p className="croc-luxe-empty">Нет других игроков в комнате</p>;
  }
  return candidates.map((p) => {
    const already = crocGuessedIds.has(p.id);
    const inFlight = crocConfirmingIds.has(p.id);
    return (
      <button
        key={p.id}
        type="button"
        className="croc-luxe-guess-btn"
        disabled={already || inFlight}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!already && !inFlight) onConfirmGuess(p.id);
        }}
      >
        {already ? '✓✓' : '✓'} {p.name}
      </button>
    );
  });
}

/**
 * Выбор «кто угадал» — всегда через portal на document.body.
 * Так game-layout / atmosphere / z-index больше не перекрывают клики (PC + mobile).
 */
export function CrocodileGuessSheet({
  open,
  players,
  socketId,
  crocGuessedIds,
  crocConfirmingIds,
  onConfirmGuess,
}) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="croc-guess-sheet" role="dialog" aria-modal="false" aria-label="Кто угадал слово">
      <div className="croc-guess-sheet__inner">
        <div className="croc-guess-sheet__head">
          <strong>Кто угадал?</strong>
          <span>Нажмите имя игрока</span>
        </div>
        <div className="croc-guess-sheet__list">
          <CrocodileGuessList
            players={players}
            socketId={socketId}
            crocGuessedIds={crocGuessedIds}
            crocConfirmingIds={crocConfirmingIds}
            onConfirmGuess={onConfirmGuess}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Crocodile luxe chrome — topbar + leaderboard (desktop) + guess sheet portal.
 */
export function CrocodileLuxeChrome({
  roomCode,
  crocTimer,
  crocScoreRows,
  crocTurn,
  players,
  socketId,
  crocGuessedIds,
  crocConfirmingIds,
  onConfirmGuess,
  guessActive = false,
}) {
  const timerMin = String(Math.floor(Math.max(0, crocTimer) / 60)).padStart(2, '0');
  const timerSec = String(Math.max(0, crocTimer) % 60).padStart(2, '0');
  const isExplainer = crocTurn?.explainerId === socketId;

  return (
    <>
      <header className="croc-luxe-topbar">
        <div className="croc-luxe-topbar__left">
          <strong>Крокодил</strong>
          <div>
            <span>Код комнаты</span>
            <b>{roomCode}</b>
          </div>
        </div>
        <div className="croc-luxe-topbar__right">
          <div className="croc-luxe-timer">
            ⏱ {timerMin}:{timerSec}
          </div>
        </div>
      </header>

      <aside className="croc-luxe-col croc-luxe-col--left">
        <section className="croc-luxe-card">
          <div className="croc-luxe-card__head">
            <h3>Таблица лидеров</h3>
          </div>
          <div className="croc-luxe-list">
            {crocScoreRows.length ? (
              crocScoreRows.map((row) => (
                <div key={row.id || row.name} className={`croc-luxe-rank ${row.isSelf ? 'self' : ''}`}>
                  <div>
                    <strong>{row.name}</strong>
                    <span>{row.rank ? `#${row.rank}` : '-'}</span>
                  </div>
                  <b>{row.score ?? 0} очк.</b>
                </div>
              ))
            ) : (
              <p className="croc-luxe-empty">Очки появятся после первой отгадки.</p>
            )}
          </div>
        </section>
      </aside>

      {/* Правая колонка скрыта, пока открыт portal «Кто угадал?» — иначе дубль/перекрытие */}
      {!guessActive && (
        <aside className="croc-luxe-col croc-luxe-col--right">
          <section className="croc-luxe-card">
            <div className="croc-luxe-card__head">
              <h3>{isExplainer ? 'Слово' : 'Угадывание'}</h3>
            </div>
            <p className="croc-luxe-hint">
              {isExplainer
                ? 'Выберите слово для рисования.'
                : 'Называйте слово вслух — рисующий подтвердит правильный ответ.'}
            </p>
          </section>
        </aside>
      )}

      {/* PC + mobile: одна и та же кликабельная панель поверх всего */}
      <CrocodileGuessSheet
        open={guessActive}
        players={players}
        socketId={socketId}
        crocGuessedIds={crocGuessedIds}
        crocConfirmingIds={crocConfirmingIds}
        onConfirmGuess={onConfirmGuess}
      />
    </>
  );
}

export function CrocodileLuxeBottomNav({ onFocusChat, onClearCanvas, onLeave, canClear, toast }) {
  return (
    <nav className="croc-luxe-bottom-nav">
      <button type="button" onClick={onFocusChat}>
        <span>💬</span>
        <b>Чат</b>
      </button>
      <button
        type="button"
        onClick={() => {
          if (!canClear) {
            toast?.error?.('Очистка доступна только рисующему.');
            return;
          }
          onClearCanvas();
        }}
      >
        <span>🧽</span>
        <b>Очистить</b>
      </button>
      <button type="button" className="danger" onClick={onLeave}>
        <span>⎋</span>
        <b>Выйти</b>
      </button>
    </nav>
  );
}

export default CrocodileLuxeChrome;
