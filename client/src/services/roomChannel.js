/**
 * Multiplayer via PubNub — free public demo keys, zero registration required.
 * Works on Vercel (pure client-side), no backend needed.
 * Demo keys allow ~100 connections simultaneously — perfect for a friend group.
 */

import PubNub from 'pubnub';

// PubNub public demo sandbox keys — documented at pubnub.com/docs, no account needed
const PUBNUB_PUBLISH_KEY  = 'demo';
const PUBNUB_SUBSCRIBE_KEY = 'demo';

let _pn = null;
let _activeChannel = null;
let _handlers = {};
let _myUuid = null;

function getPubNub(uuid) {
  if (_pn) return _pn;
  _pn = new PubNub({
    publishKey: PUBNUB_PUBLISH_KEY,
    subscribeKey: PUBNUB_SUBSCRIBE_KEY,
    uuid: uuid,
    ssl: true,
    restore: true,
    heartbeatInterval: 20,
    suppressLeaveEvents: false,
  });
  return _pn;
}

export function joinRoom(roomCode, playerId) {
  _myUuid = playerId;
  _activeChannel = `dnd_realm_${roomCode}`;
  _handlers = {};

  const pn = getPubNub(playerId);

  // Remove any existing listeners
  pn.removeAllListeners?.();

  pn.addListener({
    message: ({ channel, message }) => {
      if (channel !== _activeChannel) return;
      const { event, payload, senderId } = message || {};
      // Don't echo to self
      if (senderId === playerId) return;
      if (event && _handlers[event]) {
        _handlers[event](payload);
      }
    },
    presence: ({ action, uuid }) => {
      if (_handlers['presence']) {
        _handlers['presence']({ action, uuid });
      }
    },
    status: ({ category }) => {
      if (category === 'PNConnectedCategory') {
        console.log(`[Multiplayer] PubNub connected to room ${roomCode} ✓`);
      }
    }
  });

  pn.subscribe({
    channels: [_activeChannel],
    withPresence: true
  });

  // BroadcastChannel for same-browser tabs (instant sync)
  let bc = null;
  try {
    bc = new BroadcastChannel(`dnd_room_${roomCode}`);
    bc.onmessage = (e) => {
      const { event, payload } = e.data || {};
      if (event && _handlers[event]) _handlers[event](payload);
    };
  } catch (_) {}

  return {
    on(event, handler) {
      _handlers[event] = handler;
      return this;
    },
    send(event, payload) {
      // PubNub publish
      pn.publish({
        channel: _activeChannel,
        message: { event, payload, senderId: playerId },
      }).catch(e => console.warn('[PubNub publish error]', e));

      // BroadcastChannel (same browser instant)
      if (bc) {
        try { bc.postMessage({ event, payload }); } catch (_) {}
      }
    },
    destroy() {
      pn.unsubscribe({ channels: [_activeChannel] });
      if (bc) { try { bc.close(); } catch (_) {} }
      _handlers = {};
      _activeChannel = null;
    }
  };
}

export function leaveRoom() {
  if (_pn && _activeChannel) {
    _pn.unsubscribe({ channels: [_activeChannel] });
  }
  _activeChannel = null;
  _handlers = {};
}

// Kept for compatibility — no Supabase needed
export function saveSupabaseCredentials() {}
export function getIsSupabaseConfigured() { return true; }
