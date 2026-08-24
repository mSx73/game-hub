import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function ActionPanel({ prompt, selectedTarget, validTargets, playerById, onConfirm, onSelectTarget }) {
  if (!prompt) return null;

  const targets = validTargets || prompt.validTargets || [];
  const effectiveTarget = selectedTarget || targets[0] || '';
  const description = prompt.description || 'Выберите цель для действия';

  return (
    <AnimatePresence>
      <motion.div
        className="mafia-action-panel"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 28 }}
      >
        <div className="mafia-action-header">
          <span style={{ fontSize: '1.2rem' }}>🎯</span>
          <h4>Ваше ночное действие</h4>
        </div>

        <p className="mafia-action-desc">{description}</p>

        <div className="mafia-action-targets">
          {targets.map((id) => {
            const p = playerById?.get?.(id);
            const name = p?.name || id;
            const isSelected = effectiveTarget === id;
            const initial = (name || '?')[0].toUpperCase();

            return (
              <button
                key={id}
                type="button"
                className={`mafia-action-target${isSelected ? ' selected' : ''}`}
                onClick={() => onSelectTarget?.(id)}
                aria-pressed={isSelected}
                aria-label={`Выбрать ${name}`}
              >
                <div className="mafia-action-target-avatar">
                  {p?.avatar
                    ? <img src={p.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : initial}
                </div>
                <span className="mafia-action-target-name">{name}</span>
              </button>
            );
          })}
        </div>

        <button
          className="mafia-action-confirm"
          onClick={() => onConfirm?.(effectiveTarget)}
          disabled={!effectiveTarget}
        >
          Подтвердить выбор
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
