import React from 'react';
import { motion } from 'framer-motion';

const ROLE_ICONS = {
  civilian: '🏘️',
  citizen:  '🏘️',
  mafia:    '🔫',
  don:      '🎩',
  sheriff:  '⭐',
  doctor:   '💊',
  putana:   '💋',
  poisoner: '☠️',
  maniac:   '🪓',
  bodyguard:'🛡️',
  journalist:'📰',
  mayor:    '🏛️',
};

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

const ROLE_TEAMS = {
  civilian:  'Город',
  citizen:   'Город',
  mafia:     'Мафия',
  don:       'Мафия',
  sheriff:   'Город',
  doctor:    'Город',
  putana:    'Город',
  poisoner:  'Мафия',
  maniac:    'Соло',
  bodyguard: 'Город',
  journalist:'Город',
  mayor:     'Город',
};

const ROLE_COLORS = {
  civilian:  '#6366f1',
  citizen:   '#6366f1',
  mafia:     '#C0392B',
  don:       '#7c3aed',
  sheriff:   '#F59E0B',
  doctor:    '#10B981',
  putana:    '#ec4899',
  poisoner:  '#8b5cf6',
  maniac:    '#EF4444',
  bodyguard: '#0ea5e9',
  journalist:'#d97706',
  mayor:     '#b45309',
};

export function RoleCard({ role, isRevealed, onDismiss, description, mafiaMates = [] }) {
  const roleKey = (role || 'civilian').toLowerCase();
  const color = ROLE_COLORS[roleKey] || ROLE_COLORS.civilian;

  return (
    <motion.div
      className="role-card-scene"
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, type: 'spring', stiffness: 220, damping: 20 }}
    >
      <div
        className={`role-card-3d${isRevealed ? ' flipped' : ''}`}
        style={{ '--role-color': color, '--role-glow': `${color}40` }}
      >
        {/* Front: face-down card */}
        <div className="role-card-face role-card-front">
          <div className="card-back-pattern" aria-hidden />
          <span className="card-logo-emoji">🎭</span>
        </div>

        {/* Back: revealed role */}
        <div className="role-card-face role-card-back">
          <div className="role-card-bg" aria-hidden />
          <div className="role-card-content">
            <div className="role-icon-large">{ROLE_ICONS[roleKey] || '🎭'}</div>
            <div className="role-name-large">{ROLE_NAMES[roleKey] || role || '—'}</div>
            <div className="role-team-badge">{ROLE_TEAMS[roleKey] || '—'}</div>
            {description && <div className="role-desc-text">{description}</div>}
            {mafiaMates?.length > 0 && (
              <div className="role-mates-section">
                <div className="role-mates-label">Ваша банда</div>
                <div className="role-mates-list">
                  {mafiaMates.map((p) => `${p.name}${p.role ? ` · ${ROLE_NAMES[p.role?.toLowerCase()] || p.role}` : ''}`).join('\n')}
                </div>
              </div>
            )}
          </div>
          <div className="holographic-shine" aria-hidden />
        </div>
      </div>

      {isRevealed && onDismiss && (
        <motion.button
          className="btn btn-sm"
          onClick={onDismiss}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          style={{ marginTop: 4 }}
        >
          Понятно
        </motion.button>
      )}
    </motion.div>
  );
}
