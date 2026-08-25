import React from 'react';
import './Button.css';

/**
 * Унифицированные кнопки для всех игр PlayFoFun
 * 
 * @param {string} variant - 'primary' | 'secondary' | 'ghost' | 'danger'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} isLoading - Показать спиннер
 * @param {boolean} isDisabled - Неактивное состояние
 * @param {React.ReactNode} leftIcon - Иконка слева
 * @param {React.ReactNode} rightIcon - Иконка справа
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isDisabled = false,
  leftIcon,
  rightIcon,
  className = '',
  type = 'button',
  ...props
}) {
  const baseClass = 'btn';
  const variantClass = `btn--${variant}`;
  const sizeClass = `btn--${size}`;
  const loadingClass = isLoading ? 'btn--loading' : '';
  const disabledClass = isDisabled ? 'btn--disabled' : '';
  
  return (
    <button
      type={type}
      className={`${baseClass} ${variantClass} ${sizeClass} ${loadingClass} ${disabledClass} ${className}`}
      disabled={isDisabled || isLoading}
      {...props}
    >
      {isLoading && <span className="btn__spinner" aria-hidden="true" />}
      {!isLoading && leftIcon && <span className="btn__icon btn__icon--left">{leftIcon}</span>}
      <span className="btn__text">{children}</span>
      {!isLoading && rightIcon && <span className="btn__icon btn__icon--right">{rightIcon}</span>}
    </button>
  );
}

/**
 * Primary Button - основное действие
 */
export function PrimaryButton(props) {
  return <Button variant="primary" {...props} />;
}

/**
 * Secondary Button - альтернативное действие
 */
export function SecondaryButton(props) {
  return <Button variant="secondary" {...props} />;
}

/**
 * Ghost Button - третичное действие
 */
export function GhostButton(props) {
  return <Button variant="ghost" {...props} />;
}

/**
 * Danger Button - деструктивное действие
 */
export function DangerButton(props) {
  return <Button variant="danger" {...props} />;
}

/**
 * Icon Button - только иконка
 */
export function IconButton({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  className = '',
  ...props
}) {
  const sizeClass = `btn--${size}`;
  const variantClass = `btn--${variant}`;
  
  return (
    <button
      type="button"
      className={`btn btn--icon ${variantClass} ${sizeClass} ${className}`}
      aria-label={label}
      {...props}
    >
      <span className="btn__icon">{icon}</span>
    </button>
  );
}

/**
 * Game Button - большая кнопка для игровых действий
 */
export function GameButton({ children, isActive = false, ...props }) {
  return (
    <Button
      variant="primary"
      size="lg"
      className={`btn--game ${isActive ? 'btn--active' : ''}`}
      {...props}
    >
      {children}
    </Button>
  );
}

export default Button;
