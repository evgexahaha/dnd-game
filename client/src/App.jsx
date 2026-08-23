import React, { useState, useEffect, useRef } from 'react';
import { joinRoom } from './services/roomChannel';
import { fetchAiDmNarrative } from './services/aiDmClient';

import Header from './components/Header';
import LobbyModal from './components/LobbyModal';
import ProfileModal from './components/ProfileModal';
import GameTabletop from './components/GameTabletop';
import D20Dice from './components/D20Dice';
import ChatPanel from './components/ChatPanel';
import CharacterPanel from './components/CharacterPanel';

const LOCAL_ACCOUNT_KEY = 'dnd_user_account_profile_v1';

// Default initial account profile if user has none saved
const defaultAccount = {
  id: `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
  nickname: 'Искатель Приключений',
  avatar: 'preset_knight',
  characterClass: 'Паладин (Paladin)',
  hp: 12,
  maxHp: 12,
  ac: 15,
  stats: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 }
};

// Helper to load persistent account from localStorage
function loadSavedAccount() {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.nickname) return parsed;
    }
  } catch (e) {
    console.warn("Could not load account profile from localStorage:", e);
  }
  return defaultAccount;
}

// Helper to save persistent account to localStorage
function saveAccountToStorage(account) {
  try {
    localStorage.setItem(LOCAL_ACCOUNT_KEY, JSON.stringify(account));
  } catch (e) {
    console.warn("Could not save account profile to localStorage:", e);
  }
}



export default function App() {
  // Persistent User Account Profile
  const [accountProfile, setAccountProfile] = useState(loadSavedAccount());

  const [room, setRoom] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [lobbyError, setLobbyError] = useState('');

  // UI Modals State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCharacterPanel, setShowCharacterPanel] = useState(false);
  const [showDiceRoller, setShowDiceRoller] = useState(true);

  // Game Realtime States
  const [lastRoll, setLastRoll] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);

  const channelRef  = useRef(null);
  const heartbeatRef = useRef(null); // interval for sending own presence
  const currentPlayerRef = useRef(null); // mirror of currentPlayer for closures
  useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);

  // Save account changes both to state & localStorage
  const updateAccountProfile = (updatedData) => {
    const newProfile = { ...accountProfile, ...updatedData };
    setAccountProfile(newProfile);
    saveAccountToStorage(newProfile);

    // If currently in a room, update active player token in room
    if (room && currentPlayer) {
      const updatedPlayers = room.players.map((p) => {
        if (p.id === currentPlayer.id) {
          return { ...p, ...updatedData };
        }
        return p;
      });
      const updatedRoom = { ...room, players: updatedPlayers };
      setCurrentPlayer({ ...currentPlayer, ...updatedData });
      broadcastRoomUpdate(updatedRoom);
    }
  };

  // roomRef always mirrors the latest room state for use inside event closures
  const roomRef = useRef(null);
  useEffect(() => { roomRef.current = room; }, [room]);

  // Merge two player arrays: union by id, newer position/data wins
  const mergePlayers = (existing = [], incoming = []) => {
    const map = new Map();
    existing.forEach(p => map.set(p.id, p));
    incoming.forEach(p => {
      if (map.has(p.id)) {
        map.set(p.id, { ...map.get(p.id), ...p });
      } else {
        map.set(p.id, p);
      }
    });
    return Array.from(map.values());
  };

  // Broadcast the full room to all peers (sets local state too)
  const broadcastRoomUpdate = (updatedRoom) => {
    setRoom(updatedRoom);
    roomRef.current = updatedRoom;
    if (channelRef.current) {
      channelRef.current.send('room_updated', updatedRoom);
    }
  };

  // Start heartbeat — each player announces themselves every 4s
  // This way late-joiners discover all players without a dedicated sync
  const startHeartbeat = (player) => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      if (channelRef.current) {
        channelRef.current.send('heartbeat', currentPlayerRef.current || player);
      }
    }, 4000);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
  };

  // Broadcast dice roll to all peers
  const broadcastDiceRoll = (rollData) => {
    setLastRoll(rollData);
    setIsRolling(true);
    setTimeout(() => setIsRolling(false), 1800);
    if (channelRef.current) {
      channelRef.current.send('dice_rolled', rollData);
    }
  };

  // Connect to room channel and wire up all sync events
  const joinRealtimeRoom = (roomCode, player) => {
    if (channelRef.current) channelRef.current.destroy();
    stopHeartbeat();
    const ch = joinRoom(roomCode, player.id);

    // ── room_updated: smart-merge so no player is ever lost ─────────────────
    ch.on('room_updated', (payload) => {
      if (!payload) return;
      setRoom(prev => {
        if (!prev) return payload;
        const mergedPlayers = mergePlayers(prev.players, payload.players);
        const logMap = new Map();
        [...(prev.gameLog || []), ...(payload.gameLog || [])].forEach(l => logMap.set(l.id, l));
        const mergedLog = Array.from(logMap.values()).sort((a, b) => a.id.localeCompare(b.id));
        const merged = { ...prev, ...payload, players: mergedPlayers, gameLog: mergedLog };
        roomRef.current = merged;
        return merged;
      });
      setCurrentPlayer(prev => {
        const me = payload?.players?.find(p => p.id === player.id);
        return me ? { ...prev, ...me } : prev;
      });
    });

    // ── heartbeat: someone announced their presence ──────────────────────────
    // Merge them in + if we have more players they don't know about, send back room_updated
    ch.on('heartbeat', (remotePlayer) => {
      if (!remotePlayer || remotePlayer.id === player.id) return;
      setRoom(prev => {
        if (!prev) return null;
        const alreadyIn = prev.players.some(p => p.id === remotePlayer.id);
        const players = alreadyIn
          ? prev.players.map(p => p.id === remotePlayer.id ? { ...p, ...remotePlayer } : p)
          : [...prev.players, remotePlayer];
        const joinMsgs = alreadyIn ? [] : [{
          id: `sys-hb-${remotePlayer.id}`,
          sender: 'Система',
          isSystem: true,
          text: `${remotePlayer.nickname} в отряде!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }];
        const merged = { ...prev, players, gameLog: [...prev.gameLog, ...joinMsgs] };
        roomRef.current = merged;
        // If the remote player wasn't here yet, send them the full room so they see us
        if (!alreadyIn) {
          setTimeout(() => {
            if (channelRef.current) channelRef.current.send('room_updated', merged);
          }, 200);
        }
        return merged;
      });
    });

    // ── player_joined: explicit join announcement ────────────────────────────
    ch.on('player_joined', (newPlayer) => {
      if (!newPlayer || newPlayer.id === player.id) return;
      setRoom(prev => {
        if (!prev) return null;
        const alreadyIn = prev.players.some(p => p.id === newPlayer.id);
        const players = alreadyIn
          ? prev.players.map(p => p.id === newPlayer.id ? { ...p, ...newPlayer } : p)
          : [...prev.players, newPlayer];
        const joinMsg = alreadyIn ? [] : [{
          id: `sys-join-${newPlayer.id}`,
          sender: 'Система',
          isSystem: true,
          text: `${newPlayer.nickname} присоединился к отряду!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }];
        const merged = { ...prev, players, gameLog: [...prev.gameLog, ...joinMsg] };
        roomRef.current = merged;
        // Reply with full room so joiner sees all players
        setTimeout(() => {
          if (channelRef.current) channelRef.current.send('room_updated', merged);
        }, 150);
        return merged;
      });
    });

    // ── request_sync: joiner asking for state ────────────────────────────────
    ch.on('request_sync', () => {
      const cur = roomRef.current;
      if (cur && channelRef.current) {
        setTimeout(() => channelRef.current?.send('room_updated', cur), 200);
      }
    });

    ch.on('dice_rolled',  (p) => { setLastRoll(p); setIsRolling(true); setTimeout(() => setIsRolling(false), 1800); });
    ch.on('ai_thinking',  (p) => { setIsAiThinking(!!p); });

    channelRef.current = ch;
    startHeartbeat(player);
  };

  // Create Lobby Handler
  const handleCreateRoom = ({ nickname, characterClass }) => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const updatedAccount = { ...accountProfile, nickname, characterClass };
    updateAccountProfile(updatedAccount);

    const hostPlayer = {
      ...updatedAccount,
      id: updatedAccount.id || `usr_${Date.now()}`,
      position: { x: 220, y: 220 },
      isHost: true
    };

    const newRoom = {
      code,
      createdAt: new Date().toISOString(),
      scenario: "Подземелье Забытого Дракона: Ваша группа стоит у входа в древние руины.",
      players: [hostPlayer],
      gameLog: [
        {
          id: 'msg-init',
          sender: 'AI Dungeon Master',
          isAi: true,
          text: 'Приветствую вас, искатели приключений! Я ваш ИИ-Мастер Подземелий (Dungeon Master). Соберите свою группу, настройте персонажей и приготовьтесь к путешествию!',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedActions: ["Осмотреть вход в руины", "Приготовить оружие", "Зажечь факел"]
        }
      ]
    };

    setCurrentPlayer(hostPlayer);
    setRoom(newRoom);
    joinRealtimeRoom(code, hostPlayer);
  };

  // Join Lobby Handler
  const handleJoinRoom = ({ roomCode, nickname, characterClass }) => {
    const code = roomCode.toUpperCase().trim();
    const updatedAccount = { ...accountProfile, nickname, characterClass };
    updateAccountProfile(updatedAccount);

    const joiningPlayer = {
      ...updatedAccount,
      id: updatedAccount.id || `usr_${Date.now()}`,
      position: { x: 300 + Math.floor(Math.random() * 120), y: 180 + Math.floor(Math.random() * 120) },
      isHost: false
    };

    const placeholderRoom = {
      code,
      players: [joiningPlayer],
      gameLog: [{
        id: 'msg-join-init',
        sender: 'AI Dungeon Master',
        isAi: true,
        text: `Подключение к лобби ${code}...`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: []
      }]
    };

    setCurrentPlayer(joiningPlayer);
    currentPlayerRef.current = joiningPlayer;
    setRoom(placeholderRoom);
    roomRef.current = placeholderRoom;

    // Connect to channel
    joinRealtimeRoom(code, joiningPlayer);

    // Send join announcements with retries — PubNub subscription may take a moment
    const announce = () => {
      if (!channelRef.current) return;
      channelRef.current.send('player_joined', joiningPlayer);
      channelRef.current.send('request_sync', { from: joiningPlayer.id });
      // Also send own heartbeat immediately
      channelRef.current.send('heartbeat', joiningPlayer);
    };

    setTimeout(announce, 500);   // First try
    setTimeout(announce, 2000);  // Retry if PubNub was slow
    setTimeout(announce, 5000);  // Final safety retry
  };

  // Move Token
  const handleMoveToken = (pos) => {
    if (!room || !currentPlayer) return;
    const updatedPlayers = room.players.map((p) => {
      if (p.id === currentPlayer.id) {
        return { ...p, position: pos };
      }
      return p;
    });
    const updatedRoom = { ...room, players: updatedPlayers };
    setCurrentPlayer({ ...currentPlayer, position: pos });
    broadcastRoomUpdate(updatedRoom);
  };

  // Roll D20
  const handleRollDice = ({ modifier, statName }) => {
    if (!currentPlayer || !room) return;

    const rawRoll = Math.floor(Math.random() * 20) + 1;
    const totalRoll = rawRoll + modifier;

    const rollData = {
      id: `roll-${Date.now()}`,
      playerId: currentPlayer.id,
      playerNickname: currentPlayer.nickname,
      playerAvatar: currentPlayer.avatar,
      statName,
      rawRoll,
      modifier,
      totalRoll,
      isNat20: rawRoll === 20,
      isNat1: rawRoll === 1,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const logEntry = {
      id: `log-roll-${Date.now()}`,
      sender: 'Кубик D20',
      isRoll: true,
      rollData,
      text: `${currentPlayer.nickname} бросает D20 (${statName}): Выпало ${rawRoll} ${modifier >= 0 ? '+' : ''}${modifier} = ${totalRoll}${rawRoll === 20 ? ' (КРИТИЧЕСКИЙ УСПЕХ! 🎯)' : rawRoll === 1 ? ' (КРИТИЧЕСКИЙ ПРОВАЛ! 💀)' : ''}`,
      timestamp: rollData.timestamp
    };

    const updatedRoom = { ...room, gameLog: [...room.gameLog, logEntry] };
    broadcastDiceRoll(rollData);
    broadcastRoomUpdate(updatedRoom);
  };

  // Send Action / Message to AI DM
  const handleSendPlayerAction = async (actionText) => {
    if (!room || !currentPlayer) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: currentPlayer.nickname,
      avatar: currentPlayer.avatar,
      isPlayer: true,
      text: actionText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    let updatedRoom = { ...room, gameLog: [...room.gameLog, userMsg] };
    broadcastRoomUpdate(updatedRoom);

    setIsAiThinking(true);
    if (channelRef.current) {
      channelRef.current.send('ai_thinking', true);
    }

    try {
      const aiResponse = await fetchAiDmNarrative({
        prompt: `${currentPlayer.nickname}: "${actionText}"`,
        history: updatedRoom.gameLog.slice(-8),
        players: updatedRoom.players
      });

      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'AI Dungeon Master',
        isAi: true,
        text: aiResponse.narrative,
        checkRequired: aiResponse.checkRequired,
        suggestedActions: aiResponse.suggestedActions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      updatedRoom = { ...updatedRoom, gameLog: [...updatedRoom.gameLog, aiMsg] };
    } catch (e) {
      console.error("AI DM error:", e);
    } finally {
      setIsAiThinking(false);
      if (channelRef.current) {
        channelRef.current.send('ai_thinking', false);
      }
      broadcastRoomUpdate(updatedRoom);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <Header
        roomCode={room?.code}
        players={room?.players || []}
        currentPlayer={currentPlayer || accountProfile}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenCharacter={() => setShowCharacterPanel(true)}
        onToggleDice={() => setShowDiceRoller(!showDiceRoller)}
      />

      {/* Main Interface */}
      {!room ? (
        <LobbyModal
          accountProfile={accountProfile}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          error={lobbyError}
          onOpenProfile={() => setShowProfileModal(true)}
        />
      ) : (
        <main className="flex-1 p-4 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-4 my-2">
          {/* Left Column: Visual Tabletop & D20 Dice */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <GameTabletop
              players={room.players}
              currentPlayer={currentPlayer || accountProfile}
              onMoveToken={handleMoveToken}
            />

            {showDiceRoller && (
              <D20Dice
                onRoll={handleRollDice}
                lastRoll={lastRoll}
                isRolling={isRolling}
                stats={(currentPlayer || accountProfile)?.stats || {}}
              />
            )}
          </div>

          {/* Right Column: AI DM Chat Log */}
          <div className="lg:col-span-5 flex flex-col">
            <ChatPanel
              gameLog={room.gameLog || []}
              isAiThinking={isAiThinking}
              onSendAction={handleSendPlayerAction}
              onRollCheck={({ skill }) => handleRollDice({ modifier: 2, statName: skill || 'Проверка' })}
            />
          </div>
        </main>
      )}

      {/* Modals */}
      {showProfileModal && (
        <ProfileModal
          currentPlayer={currentPlayer || accountProfile}
          room={room}
          onSave={updateAccountProfile}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {showCharacterPanel && (
        <CharacterPanel
          player={currentPlayer || accountProfile}
          onUpdateHp={(newHp) => updateAccountProfile({ hp: newHp })}
          onClose={() => setShowCharacterPanel(false)}
        />
      )}
    </div>
  );
}
