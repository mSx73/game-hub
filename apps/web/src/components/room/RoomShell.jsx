import React from 'react';

/**
 * Unified room chrome: reconnect overlay + container shell (Sprint P).
 */
export function RoomShell({
  isConnected,
  room,
  className = '',
  style,
  children,
  showReconnect = true,
}) {
  return (
    <>
      {showReconnect && !isConnected && (
        <div className="reconnect-overlay" role="status" aria-live="polite">
          <div className="reconnect-card">
            <div className="reconnect-spinner" aria-hidden />
            <p className="reconnect-title">Переподключение...</p>
            <p className="reconnect-hint">Не закрывайте вкладку — восстанавливаем соединение</p>
          </div>
        </div>
      )}
      <div className={className} style={style} data-room-code={room?.code || undefined}>
        {children}
      </div>
    </>
  );
}

export default RoomShell;
