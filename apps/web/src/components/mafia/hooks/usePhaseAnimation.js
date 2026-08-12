import { useRef, useEffect } from 'react';

/**
 * Хук для анимаций при смене фазы.
 * Возвращает класс/вариант для анимации и триггерит callback при смене фазы.
 */
export function usePhaseAnimation(phase, options = {}) {
  const prevPhaseRef = useRef(phase);
  const { onPhaseChange } = options;

  useEffect(() => {
    if (prevPhaseRef.current !== phase) {
      onPhaseChange?.(phase, prevPhaseRef.current);
      prevPhaseRef.current = phase;
    }
  }, [phase, onPhaseChange]);

  const isNight = String(phase || '').startsWith('night-');
  const isVoting = phase === 'voting' || phase === 'votingRevote' || phase === 'votingTieDiscussion' || phase === 'vote-result';
  const isDay = !isNight && (phase === 'morning' || phase === 'discussion' || phase === 'intro');

  return {
    phase,
    isNight,
    isVoting,
    isDay,
    animationClass: isNight ? 'phase-night' : isVoting ? 'phase-voting' : isDay ? 'phase-day' : '',
  };
}
