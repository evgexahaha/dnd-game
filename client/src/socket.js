import { io } from 'socket.io-client';

// Get custom server URL from localStorage if set (e.g. for static hosting on Cloudflare/GitHub Pages)
const storedServerUrl = typeof window !== 'undefined' ? localStorage.getItem('dnd_server_url') : null;
const defaultUrl = process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:3000';
const targetUrl = storedServerUrl || defaultUrl;

export const socket = io(targetUrl, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  timeout: 10000
});

export function reconnectSocket(newUrl) {
  if (newUrl) {
    localStorage.setItem('dnd_server_url', newUrl);
  } else {
    localStorage.removeItem('dnd_server_url');
  }
  window.location.reload();
}
