import React, { createContext, useContext, useState, useCallback } from 'react';
import './Toast.css';

// Toast Context
const ToastContext = createContext(null);

/**
 * Toast Provider - оборачивает приложение для показа уведомлений
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, options = {}) => {
    const id = Date.now() + Math.random();
    const {
      type = 'info',
      duration = 3000,
      position = 'top-center',
    } = options;

    const toast = {
      id,
      message,
      type,
      duration,
      position,
    };

    setToasts(prev => [...prev, toast]);

    // Auto remove
    setTimeout(() => {
      removeToast(id);
    }, duration);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Helper methods
  const success = useCallback((message, options) => 
    addToast(message, { ...options, type: 'success' }), [addToast]);
  
  const error = useCallback((message, options) => 
    addToast(message, { ...options, type: 'error' }), [addToast]);
  
  const warning = useCallback((message, options) => 
    addToast(message, { ...options, type: 'warning' }), [addToast]);
  
  const info = useCallback((message, options) => 
    addToast(message, { ...options, type: 'info' }), [addToast]);

  const value = {
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

/**
 * Hook для использования Toast
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

/**
 * Toast Container - рендерит все активные тосты
 */
function ToastContainer({ toasts, onRemove }) {
  const positions = ['top-center', 'top-right', 'top-left', 'bottom-center', 'bottom-right', 'bottom-left'];
  
  return (
    <>
      {positions.map(position => {
        const positionToasts = toasts.filter(t => t.position === position);
        if (positionToasts.length === 0) return null;
        
        return (
          <div 
            key={position} 
            className={`toast-container toast-container--${position}`}
            role="region"
            aria-live="polite"
            aria-label="Уведомления"
          >
            {positionToasts.map(toast => (
              <ToastItem 
                key={toast.id} 
                toast={toast} 
                onRemove={() => onRemove(toast.id)} 
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

/**
 * Individual Toast Item
 */
function ToastItem({ toast, onRemove }) {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div 
      className={`toast toast--${toast.type}`}
      role="alert"
    >
      <span className="toast__icon" aria-hidden="true">{icons[toast.type]}</span>
      <span className="toast__message">{toast.message}</span>
      <button 
        className="toast__close"
        onClick={onRemove}
        aria-label="Закрыть уведомление"
      >
        ×
      </button>
    </div>
  );
}

/**
 * Простой Toast для inline использования (без провайдера)
 */
export function InlineToast({ type = 'info', message, onClose }) {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div className={`toast toast--${type} toast--inline`} role="alert">
      <span className="toast__icon" aria-hidden="true">{icons[type]}</span>
      <span className="toast__message">{message}</span>
      {onClose && (
        <button 
          className="toast__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default ToastProvider;
