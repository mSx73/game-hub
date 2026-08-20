import React from 'react';
import GameLayout from './GameLayout';

const GAME_CONFIG = {
  mafia: {
    name: 'Мафия',
    icon: '🕵️',
    minPlayers: 4,
  },
  hat: {
    name: 'Шляпа',
    icon: '🎩',
    minPlayers: 3,
  },
  crocodile: {
    name: 'Крокодил',
    icon: '🐊',
    minPlayers: 2,
  },
  'crocodile-verbs': {
    name: 'Крокодил · действия',
    icon: '🐊',
    minPlayers: 2,
  },
  'crocodile-nouns': {
    name: 'Крокодил · предметы',
    icon: '🐊',
    minPlayers: 2,
  },
  alias: {
    name: 'Элиас',
    icon: '🗣️',
    minPlayers: 2,
  },
  spy: {
    name: 'Шпион',
    icon: '🕵️‍♂️',
    minPlayers: 3,
  },
};

/**
 * Обёртка для существующих игр, применяющая GameLayout для единообразного вида
 */
function GameLayoutWrapper({
  gameType,
  room,
  socket,
  players,
  children,
  customGameName,
  customIcon
}) {
  const config = GAME_CONFIG[gameType] || { 
    name: customGameName || gameType, 
    icon: customIcon || '🎮',
    minPlayers: 2 
  };

  const handleLeaveRoom = () => {
    if (socket && room?.code) {
      socket.emit('room:leave');
    }
    window.location.href = '/';
  };

  return (
    <GameLayout
      gameName={config.name}
      gameIcon={config.icon}
      playerCount={players?.length || 0}
      players={players || []}
      onLeaveRoom={handleLeaveRoom}
      roomCode={room?.code}
      gameStatus={room?.status}
    >
      {children}
    </GameLayout>
  );
}

export default GameLayoutWrapper;