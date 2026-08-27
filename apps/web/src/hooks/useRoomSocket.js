import { useCallback, useEffect, useState } from 'react';
import {
  connectSocket,
  getSessionToken,
  setSessionToken,
  socket,
} from '../services/socketService';

/**
 * Room lifecycle socket hook — join, reconnect, room:updated (Sprint P).
 * RoomPage still owns game-specific listeners; this covers shared room flow.
 */
export function useRoomSocket(roomId, playerName, options = {}) {
  const { onJoinSuccess, onJoinError, onRoomUpdated } = options;
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [room, setRoom] = useState(null);
  const [joinError, setJoinError] = useState('');

  const attemptJoin = useCallback(
    (asSpectator = false) => {
      const code = String(roomId || '').toUpperCase();
      if (!code || !playerName?.trim()) return;
      const roomPassword = sessionStorage.getItem(`room_password_${code}`) || '';
      socket.emit(
        'room:join',
        {
          code,
          playerName: playerName.trim(),
          password: roomPassword,
          asSpectator,
          sessionToken: getSessionToken(code),
        },
        (response) => {
          if (response?.success) {
            setJoinError('');
            setRoom(response.room);
            if (response.sessionToken) setSessionToken(code, response.sessionToken);
            onJoinSuccess?.(response);
          } else if (!asSpectator && String(response?.error || '').startsWith('Игра уже началась')) {
            attemptJoin(true);
          } else {
            const err = response?.error || 'Не удалось войти в комнату';
            setJoinError(err);
            onJoinError?.(err);
          }
        },
      );
    },
    [roomId, playerName, onJoinSuccess, onJoinError],
  );

  useEffect(() => {
    connectSocket();

    const onConnect = () => {
      setIsConnected(true);
      attemptJoin(false);
    };
    const onDisconnect = () => setIsConnected(false);
    const onUpdated = (updatedRoom) => {
      setRoom(updatedRoom);
      onRoomUpdated?.(updatedRoom);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:updated', onUpdated);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:updated', onUpdated);
    };
  }, [attemptJoin, onRoomUpdated]);

  return {
    isConnected,
    room,
    setRoom,
    joinError,
    attemptJoin,
  };
}

export default useRoomSocket;
