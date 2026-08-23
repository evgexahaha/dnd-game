/**
 * Multiplayer via PubNub — free public demo keys, zero registration required.
 * All messages delivered to ALL subscribers including sender (PubNub behavior).
 * We filter our own messages by senderId.
 */

import PubNub from 'pubnub';

const PUBNUB_PUBLISH_KEY   = 'demo';
const PUBNUB_SUBSCRIBE_KEY = 'demo';

let _pn       = null;
let _channel  = null;
let _myId     = null;
let _handlers = {};
let _bc       = null;

function getPubNub(uuid) {
  if (_pn) return _pn;
  _pn = new PubNub({
    publishKey:        PUBNUB_PUBLISH_KEY,
    subscribeKey:      PUBNUB_SUBSCRIBE_KEY,
    uuid:              uuid,
    ssl:               true,
    restore:           true,
    heartbeatInterval: 20,
  });
  return _pn;
}

// Public channel object returned to App.jsx
let _channelObj = null;

export function joinRoom(roomCode, playerId) {
  _myId    = playerId;
  _channel = `dnd_realm_v2_${roomCode}`;
  _handlers = {};

  // Teardown previous
  if (_pn) {
    try { _pn.removeAllListeners(); _pn.unsubscribeAll(); } catch (_) {}
    _pn = null;
  }
  if (_bc) { try { _bc.close(); } catch (_) {} _bc = null; }

  const pn = getPubNub(playerId);

  pn.addListener({
    message: ({ channel, message }) => {
      if (channel !== _channel) return;
      const { event, payload, from } = message || {};
      // Ignore our own PubNub echo (PubNub sends to all including sender)
      if (from === playerId) return;
      const h = _handlers[event];
      if (h) h(payload);
    },
    status: ({ category }) => {
      if (category === 'PNConnectedCategory') {
        console.log(`[MP] PubNub connected ✓ room=${roomCode} me=${playerId}`);
      }
    }
  });

  pn.subscribe({ channels: [_channel], withPresence: false });

  // BroadcastChannel for same-browser cross-tab (instant, no network)
  try {
    _bc = new BroadcastChannel(`dnd_v2_${roomCode}`);
    _bc.onmessage = ({ data }) => {
      if (!data || data.from === playerId) return; // ignore own BC echo
      const h = _handlers[data.event];
      if (h) h(data.payload);
    };
  } catch (_) {}

  _channelObj = {
    on(event, handler) {
      _handlers[event] = handler;
      return this;
    },
    send(event, payload) {
      const msg = { event, payload, from: playerId };
      // PubNub (cross-device)
      pn.publish({ channel: _channel, message: msg })
        .catch(e => console.warn('[PubNub]', e.message || e));
      // BroadcastChannel (same browser, instant)
      if (_bc) {
        try { _bc.postMessage(msg); } catch (_) {}
      }
    },
    destroy() {
      try { pn.removeAllListeners(); pn.unsubscribeAll(); } catch (_) {}
      if (_bc) { try { _bc.close(); } catch (_) {} _bc = null; }
      _handlers = {};
      _channel  = null;
      _myId     = null;
      _pn       = null;
      _channelObj = null;
    }
  };

  return _channelObj;
}

export function leaveRoom() {
  if (_channelObj) _channelObj.destroy();
}

// Stubs — no Supabase needed
export function saveSupabaseCredentials() {}
export function getIsSupabaseConfigured() { return true; }
