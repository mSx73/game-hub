import React, { useEffect, useState, useRef } from 'react';
import './Timer.css';

/**
 * Унифицированный Timer компонент для всех игр PlayFoFun
 * 
 * @param {number} duration - Общая длительность в секундах
 * @param {number} timeLeft - Оставшееся время (если управляется извне)
 * @param {string} size - Размер: 'sm' | 'md' | 'lg'
 * @param {boolean} showProgress - Показывать ли прогресс-бар
 * @param {boolean} pulseOnUrgent - Пульсация при < 10s
 * @param {function} onComplete - Callback при окончании
 * @param {function} onTick - Callback каждую секунду
 * @param {boolean} isPaused - Пауза
 */
export function Timer({
  duration = 60,
  timeLeft: controlledTimeLeft,
  size = 'md',
  showProgress = true,
  pulseOnUrgent = true,
  onComplete,
  onTick,
  isPaused = false,
  className = '',
}) {
  const [internalTimeLeft, setInternalTimeLeft] = useState(duration);
  const timeLeft = controlledTimeLeft !== undefined ? controlledTimeLeft : internalTimeLeft;
  const prevTimeLeft = useRef(timeLeft);
  
  // Internal timer management (only if not controlled externally)
  useEffect(() => {
    if (controlledTimeLeft !== undefined || isPaused) return;
    
    const interval = setInterval(() => {
      setInternalTimeLeft(prev => {
        const newTime = Math.max(0, prev - 1);
        onTick?.(newTime);
        return newTime;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [controlledTimeLeft, isPaused, onTick]);
  
  // Completion callback
  useEffect(() => {
    if (timeLeft === 0 && prevTimeLeft.current > 0) {
      onComplete?.();
    }
    prevTimeLeft.current = timeLeft;
  }, [timeLeft, onComplete]);
  
  // Calculate state
  const progress = duration > 0 ? (timeLeft / duration) * 100 : 0;
  const isUrgent = timeLeft <= 10;
  const isWarning = timeLeft <= 30 && timeLeft > 10;
  
  const getColor = () => {
    if (isUrgent) return 'var(--color-error-500)';
    if (isWarning) return 'var(--color-warning-500)';
    return 'var(--color-primary-500)';
  };
  
  const sizeClasses = {
    sm: 'timer--sm',
    md: 'timer--md',
    lg: 'timer--lg',
  };
  
  const radius = size === 'sm' ? 22 : size === 'md' ? 30 : 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  return (
    <div 
      className={`timer ${sizeClasses[size]} ${isUrgent && pulseOnUrgent ? 'timer--urgent' : ''} ${isPaused ? 'timer--paused' : ''} ${className}`}
      role="timer"
      aria-live={isUrgent ? 'assertive' : 'polite'}
      aria-label={`Осталось ${timeLeft} секунд`}
    >
      <div className="timer__ring">
        <svg viewBox={`0 0 ${radius * 2 + 8} ${radius * 2 + 8}`} className="timer__svg">
          {/* Background circle */}
          <circle
            cx={radius + 4}
            cy={radius + 4}
            r={radius}
            fill="none"
            stroke="var(--color-surface-300)"
            strokeWidth="4"
          />
          {/* Progress circle */}
          <circle
            cx={radius + 4}
            cy={radius + 4}
            r={radius}
            fill="none"
            stroke={getColor()}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ 
              transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease',
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
            }}
          />
        </svg>
        <div className="timer__content">
          <span className="timer__value">{timeLeft}</span>
          <span className="timer__unit">s</span>
        </div>
      </div>
      
      {showProgress && (
        <div className="timer__bar">
          <div 
            className="timer__bar-fill"
            style={{ 
              width: `${progress}%`,
              backgroundColor: getColor(),
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Мини-таймер для embed в другие компоненты
 */
export function MiniTimer({ timeLeft, className = '' }) {
  const isUrgent = timeLeft <= 10;
  
  return (
    <span 
      className={`mini-timer ${isUrgent ? 'mini-timer--urgent' : ''} ${className}`}
      role="timer"
      aria-label={`${timeLeft} секунд`}
    >
      ⏱ {timeLeft}s
    </span>
  );
}

export default Timer;
