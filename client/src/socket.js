import { io } from 'socket.io-client';

const storedServerUrl = typeof window !== 'undefined' ? localStorage.getItem('dnd_server_url') : null;

// Disable autoConnect by default on static hosts to prevent console error spam
export const socket = io(storedServerUrl || 'http://localhost:3000', {
  autoConnect: !!storedServerUrl,
  reconnection: false,
  transports: ['websocket', 'polling']
});

export function reconnectSocket(newUrl) {
  if (newUrl) {
    localStorage.setItem('dnd_server_url', newUrl);
  } else {
    localStorage.removeItem('dnd_server_url');
  }
  window.location.reload();
}
