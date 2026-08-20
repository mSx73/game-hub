import React, { useState, useEffect } from 'react';
import './DictionaryStatus.css';

/**
 * Component to display dictionary loading status
 * Shows "Подключаю словарь..." or "Словарь подключен!" for 3 seconds
 */
function DictionaryStatus({ socket }) {
  const [status, setStatus] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleStatus = (data) => {
      if (data === null) {
        // Hide immediately when null is received
        setVisible(false);
        setTimeout(() => setStatus(null), 300);
      } else {
        setStatus(data);
        setVisible(true);
        
        // Auto-hide after 3 seconds if status is 'loaded'
        if (data.status === 'loaded') {
          setTimeout(() => {
            setVisible(false);
            setTimeout(() => setStatus(null), 300);
          }, 3000);
        }
      }
    };

    socket.on('dictionary:status', handleStatus);

    return () => {
      socket.off('dictionary:status', handleStatus);
    };
  }, [socket]);

  if (!status) return null;

  return (
    <div className={`dictionary-status ${status.status} ${visible ? 'visible' : 'hidden'}`}>
      <div className="dictionary-status-content">
        {status.status === 'loading' && (
          <span className="dictionary-spinner">⏳</span>
        )}
        {status.status === 'loaded' && (
          <span className="dictionary-check">✅</span>
        )}
        <span className="dictionary-message">{status.message}</span>
      </div>
    </div>
  );
}

export default DictionaryStatus;
