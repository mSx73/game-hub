import React from 'react';
import './FeedbackModal.css';

const FEEDBACK_EMAIL =
  typeof import.meta.env.VITE_FEEDBACK_EMAIL === 'string' && import.meta.env.VITE_FEEDBACK_EMAIL.trim()
    ? import.meta.env.VITE_FEEDBACK_EMAIL.trim()
    : 'support@playfofun.ru';

const DEFAULT_GOOGLE_FORM_URL = 'https://forms.gle/j5LVcvfhGyxBNiVr6';

const GOOGLE_FORM_URL = (() => {
  const raw = import.meta.env.VITE_FEEDBACK_GOOGLE_FORM_URL;
  if (typeof raw !== 'string') return DEFAULT_GOOGLE_FORM_URL;
  const t = raw.trim();
  if (!t) return DEFAULT_GOOGLE_FORM_URL;
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  return `https://${t}`;
})();

/**
 * Обратная связь через Google Forms: задайте VITE_FEEDBACK_GOOGLE_FORM_URL (ссылка «Отправить ответ» из редактора формы).
 * Без ссылки — в модалке показан запасной mailto на VITE_FEEDBACK_EMAIL.
 */
export function FeedbackModal({ open, onClose }) {
  if (!open) return null;

  const openForm = () => {
    if (!GOOGLE_FORM_URL) return;
    window.open(GOOGLE_FORM_URL, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="feedback-modal-root" role="dialog" aria-modal="true" aria-labelledby="feedback-modal-title">
      <div className="feedback-modal-backdrop" onClick={onClose} />
      <div className="feedback-modal-panel">
        <div className="feedback-modal-header">
          <h2 id="feedback-modal-title">Обратная связь</h2>
          <button type="button" className="feedback-modal-close" onClick={onClose} aria-label="Закрыть">
            &times;
          </button>
        </div>
        <div className="feedback-modal-body">
          {GOOGLE_FORM_URL ? (
            <>
              <p className="feedback-modal-hint">
                Короткая форма в Google: идеи, баги, пожелания — ответы попадают в таблицу, вам на почту приходит уведомление
                (если включено в настройках формы).
              </p>
              <div className="feedback-modal-actions feedback-modal-actions--stack">
                <a
                  className="btn btn-primary-action feedback-modal-open-form"
                  href={GOOGLE_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onClose()}
                >
                  Открыть форму
                </a>
                <button type="button" className="btn btn-sm" onClick={onClose}>
                  Закрыть
                </button>
              </div>
            </>
          ) : (
            <>
              {import.meta.env.DEV && (
                <p className="feedback-modal-hint">
                  Для разработки: в <code className="feedback-modal-code">apps/web/.env</code> задайте{' '}
                  <code className="feedback-modal-code">VITE_FEEDBACK_GOOGLE_FORM_URL</code> — ссылку на опубликованную
                  форму (меню «Отправить» → ссылка).
                </p>
              )}
              <p className="feedback-modal-hint">
                {import.meta.env.DEV
                  ? 'Пока можно написать на почту:'
                  : 'Напишите нам на почту:'}{' '}
                <a className="feedback-modal-mailto" href={`mailto:${FEEDBACK_EMAIL}`}>
                  {FEEDBACK_EMAIL}
                </a>
              </p>
              <div className="feedback-modal-actions">
                <button type="button" className="btn btn-sm" onClick={onClose}>
                  Закрыть
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
