import { useEffect, useRef } from 'react';

/**
 * Хук для подписки на mafia-события сокета.
 * Вызывает переданные колбэки при соответствующих событиях.
 * Управление состоянием остаётся у родителя.
 */
export function useMafiaSocket(socket, roomCode, callbacks = {}) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!socket || !roomCode) return;

    const cb = (name) => (...args) => callbacksRef.current[name]?.(...args);

    socket.on('game:started', cb('onGameStarted'));
    socket.on('game:phase-changed', cb('onPhaseChanged'));
    socket.on('game:action-required', cb('onActionRequired'));
    socket.on('game:action-result', cb('onActionResult'));
    socket.on('game:night-resolved', cb('onNightResolved'));
    socket.on('game:player-killed', cb('onPlayerKilled'));
    socket.on('game:player-revived', cb('onPlayerRevived'));
    socket.on('game:role-changed', cb('onRoleChanged'));
    socket.on('game:vote-tie', cb('onVoteTie'));
    socket.on('game:multiple-lynched', cb('onMultipleLynched'));
    socket.on('game:ended', cb('onGameEnded'));

    return () => {
      socket.off('game:started');
      socket.off('game:phase-changed');
      socket.off('game:action-required');
      socket.off('game:action-result');
      socket.off('game:night-resolved');
      socket.off('game:player-killed');
      socket.off('game:player-revived');
      socket.off('game:role-changed');
      socket.off('game:vote-tie');
      socket.off('game:multiple-lynched');
      socket.off('game:ended');
    };
  }, [socket, roomCode]);
}
