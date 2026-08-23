/**
 * Multiplayer Sync Layer
 * 
 * Priority 1: Supabase Realtime (if credentials configured in settings)
 * Priority 2: BroadcastChannel (same browser, multi-tab)
 */

import { createClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'dnd_sb_url';
const STORAGE_KEY_KEY = 'dnd_sb_key';

function getSupabaseCredentials() {
  try {
    return {
      url: localStorage.getItem(STORAGE_URL_KEY) || import.meta.env.VITE_SUPABASE_URL || '',
      key: localStorage.getItem(STORAGE_KEY_KEY) || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    };
  } catch {
    return { url: '', key: '' };
  }
}

export function saveSupabaseCredentials(url, key) {
  localStorage.setItem(STORAGE_URL_KEY, url);
  localStorage.setItem(STORAGE_KEY_KEY, key);
  window.location.reload();
}

export function getIsSupabaseConfigured() {
  const { url, key } = getSupabaseCredentials();
  return !!(url && key && url.includes('supabase.co') && key.length > 20);
}

let _supabase = null;

function getSupabase() {
  if (_supabase) return _supabase;
  const { url, key } = getSupabaseCredentials();
  if (url && key && url.includes('supabase.co')) {
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// ─── Room Channel ─────────────────────────────────────────────────────────────

export class RoomChannel {
  constructor(roomCode, playerId) {
    this.roomCode = roomCode;
    this.playerId = playerId;
    this._handlers = {};
    this._sbChannel = null;
    this._bc = null;
    this._setup();
  }

  _setup() {
    const sb = getSupabase();

    if (sb) {
      // Supabase Realtime channel
      this._sbChannel = sb.channel(`room_${this.roomCode}`, {
        config: { broadcast: { self: false }, presence: { key: this.playerId } }
      });

      this._sbChannel
        .on('broadcast', { event: '*' }, ({ event, payload }) => {
          if (this._handlers[event]) this._handlers[event](payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Room ${this.roomCode}] Supabase Realtime connected ✓`);
            this._sbChannel.track({ id: this.playerId, onlineAt: new Date().toISOString() });
          }
        });
    } else {
      // BroadcastChannel fallback (same browser multi-tab)
      try {
        this._bc = new BroadcastChannel(`dnd_room_${this.roomCode}`);
        this._bc.onmessage = (e) => {
          const { event, payload } = e.data || {};
          if (event && this._handlers[event]) this._handlers[event](payload);
        };
        console.warn(`[Room ${this.roomCode}] Using BroadcastChannel (same browser only). Configure Supabase for real multiplayer!`);
      } catch (e) {
        console.warn('[Room] BroadcastChannel not available');
      }
    }
  }

  on(event, handler) {
    this._handlers[event] = handler;
    return this;
  }

  send(event, payload) {
    // Supabase
    if (this._sbChannel) {
      this._sbChannel.send({ type: 'broadcast', event, payload }).catch(() => {});
    }
    // BroadcastChannel
    if (this._bc) {
      try { this._bc.postMessage({ event, payload }); } catch (_) {}
    }
  }

  destroy() {
    const sb = getSupabase();
    if (this._sbChannel && sb) {
      sb.removeChannel(this._sbChannel);
      this._sbChannel = null;
    }
    if (this._bc) {
      this._bc.close();
      this._bc = null;
    }
    this._handlers = {};
  }
}

let _activeChannel = null;

export function joinRoom(roomCode, playerId) {
  if (_activeChannel) _activeChannel.destroy();
  _activeChannel = new RoomChannel(roomCode, playerId);
  return _activeChannel;
}

export function leaveRoom() {
  if (_activeChannel) {
    _activeChannel.destroy();
    _activeChannel = null;
  }
}
