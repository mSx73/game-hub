import React from 'react';
import { motion } from 'framer-motion';

export function calculateSeatPosition(index, total) {
  if (total <= 0) return { x: 50, y: 50, angle: 0 };
  const angleStep = 360 / total;
  const angle = 180 + index * angleStep;
  const angleRad = (angle * Math.PI) / 180;
  const radius = 38;
  const x = 50 + radius * Math.cos(angleRad);
  const y = 50 + radius * Math.sin(angleRad);
  return { x, y, angle };
}

export function PlayerSeat({
  player,
  position,
  isSelf,
  isTargetable,
  isTargeted,
  isVoteBlocked,
  isSpeaking,
  seatNumber,
  onClick,
}) {
  const status = player.status || 'alive';
  const isDead = status === 'dead';
  const isPoisoned = status === 'poisoned';
  const isDisconnected = !player.isOnline;
  const voteBlocked = isVoteBlocked || player.cannotVoteNextDay;

  const classNames = [
    'player-seat',
    status,
    isTargetable && 'targetable',
    isTargeted && 'targeted',
    voteBlocked && 'vote-blocked',
    isSelf && 'is-self',
    isDisconnected && 'disconnected',
  ].filter(Boolean).join(' ');

  const handleClick = () => {
    if (isTargetable && onClick) onClick(player.id);
  };

  const initial = (player.name || '?')[0].toUpperCase();

  return (
    <motion.div
      className={classNames}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: `translate(-50%, -100%) rotate(${position.angle - 180}deg)`,
      }}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.05, type: 'spring', stiffness: 260, damping: 22 }}
      onClick={handleClick}
      role={isTargetable ? 'button' : undefined}
      tabIndex={isTargetable ? 0 : undefined}
      aria-label={isTargetable ? `Выбрать ${player.name}` : undefined}
      onKeyDown={(e) => isTargetable && (e.key === 'Enter' || e.key === ' ') && handleClick()}
    >
      <div className="player-avatar-wrap">
        <div className="player-avatar">
          {player.avatar
            ? <img src={player.avatar} alt="" />
            : initial}
        </div>

        {seatNumber != null && (
          <div className="player-seat-number">{seatNumber}</div>
        )}

        {isSpeaking && !isDead && (
          <div className="player-speaking-ring" aria-hidden />
        )}
      </div>

      <span className="player-name">{player.name || 'Игрок'}</span>

      {isDead && <span className="player-status-badge player-status-badge--dead">✝</span>}
      {isPoisoned && !isDead && <span className="player-status-badge player-status-badge--poison">☠ отравлен</span>}
      {voteBlocked && !isDead && <span className="player-status-badge player-status-badge--blocked" title="Голос заблокирован путаной">💋</span>}
      {isSelf && !isDead && <span className="player-status-badge player-status-badge--self">вы</span>}
    </motion.div>
  );
}
