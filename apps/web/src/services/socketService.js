import { io } from 'socket.io-client';

// Production: same origin as the page (nginx proxies /socket.io → ws). Override with VITE_WS_URL when the static app is on another host.
const URL = import.meta.env.DEV
  ? import.meta.env.VITE_WS_URL || 'http://localhost:3002'
  : import.meta.env.VITE_WS_URL || (typeof window !== 'undefined' ? window.location.origin : undefined);

export const socket = io(URL, {
  path: '/socket.io/',
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 30,
  timeout: 20000,
  autoConnect: false,
});

socket.on('connect', () => {
  sessionStorage.setItem('pff_sid', socket.id);
});

export function connectSocket() {
  socket.connect();
}

export function disconnectSocket() {
  socket.disconnect();
}

export function getSessionRoom() {
  return sessionStorage.getItem('pff_active_room') || null;
}

export function setSessionRoom(code) {
  if (code) sessionStorage.setItem('pff_active_room', code);
  else sessionStorage.removeItem('pff_active_room');
}

export function getSessionName() {
  return localStorage.getItem('playerName') || sessionStorage.getItem('pff_name') || '';
}

export function setSessionName(name) {
  localStorage.setItem('playerName', name);
  sessionStorage.setItem('pff_name', name);
}
