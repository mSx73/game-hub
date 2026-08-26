import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ROLE_NAMES = {
  civilian:  'Мирный житель',
  citizen:   'Мирный житель',
  mafia:     'Мафия',
  don:       'Дон',
  sheriff:   'Шериф',
  doctor:    'Доктор',
  putana:    'Путана',
  poisoner:  'Отравитель',
  maniac:    'Маньяк',
  bodyguard: 'Телохранитель',
  journalist:'Журналист',
  mayor:     'Мэр',
};

export function DeathReveal({ player, role, cause, onComplete }) {
  const [showRole, setShowRole] = useState(false);
  const [exit, setExit] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowRole(true), 900);
    const t2 = setTimeout(() => setExit(true), 2800);
    const t3 = setTimeout(() => onComplete?.(), 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  const roleName = role ? (ROLE_NAMES[role.toLowerCase()] || role) : null;
  const initial = (player?.name || '?')[0].toUpperCase();

  return (
    <AnimatePresence>
      {!exit && (
        <motion.div
          className="death-reveal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="death-bg" aria-hidden />

          <div className="death-card-wrap">
            <motion.div
              className="death-player-card"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={showRole
                ? { scale: 0.7, opacity: 0, y: 60, rotateX: 40 }
                : { scale: 1, opacity: 1, y: 0, rotateX: 0 }
              }
              transition={showRole
                ? { duration: 0.7, ease: [0.55, 0.085, 0.68, 0.53] }
                : { duration: 0.5, type: 'spring', stiffness: 260, damping: 20 }
              }
            >
              <div className="death-player-avatar">{initial}</div>
              <div className="death-player-name">{player?.name || 'Игрок'}</div>
              <div className="death-skull">💀</div>
            </motion.div>

            <AnimatePresence>
              {showRole && (
                <motion.div
                  className="death-role-reveal"
                  initial={{ opacity: 0, scale: 0.5, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.5, type: 'spring', stiffness: 320, damping: 22 }}
                >
                  <span className="death-role-label">Роль раскрыта</span>
                  {roleName && <span className="death-role-value">{roleName}</span>}
                  {cause && <span className="death-role-cause">{cause}</span>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
