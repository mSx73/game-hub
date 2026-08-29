import React from 'react';
import { getGameIcon } from '../data/gameIcons';
import { getAccent } from '../data/gameAccents';
import './GameIconBadge.css';

/* Заменяет сырое эмодзи как «арт» игры на цветной бейдж с иконкой Lucide
   (см. peaceful-knitting-platypus.md, пункт A). Один компонент — четыре
   заготовленных размера под разные места использования на сайте. */
const SIZES = { hero: 'gib--hero', bento: 'gib--bento', lane: 'gib--lane', room: 'gib--room', sm: 'gib--sm' };

export function GameIconBadge({ game, gameId, size = 'lane', className = '' }) {
  const id = gameId || game?.id || game;
  const Icon = getGameIcon(id);
  const [a, b] = getAccent(game || id);
  return (
    <span
      className={`game-icon-badge ${SIZES[size] || SIZES.lane} ${className}`}
      style={{ '--gib-a': a, '--gib-b': b }}
      aria-hidden="true"
    >
      <Icon strokeWidth={2} />
    </span>
  );
}

export default GameIconBadge;
