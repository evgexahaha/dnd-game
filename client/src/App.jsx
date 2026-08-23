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

  const channelRef = useRef(null);

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
    const ch = joinRoom(roomCode, player.id);

    // Full room state received — smart-merge players so nobody gets erased
    ch.on('room_updated', (payload) => {
      if (!payload) return;
      setRoom(prev => {
        if (!prev) return payload;
        const mergedPlayers = mergePlayers(prev.players, payload.players);
        // Merge gameLogs — keep unique by id
        const logMap = new Map();
        [...(prev.gameLog || []), ...(payload.gameLog || [])].forEach(l => logMap.set(l.id, l));
        const mergedLog = Array.from(logMap.values()).sort((a, b) => a.id.localeCompare(b.id));
        return { ...prev, ...payload, players: mergedPlayers, gameLog: mergedLog };
      });
      // Update own currentPlayer data if it changed
      setCurrentPlayer(prev => {
        const me = payload?.players?.find(p => p.id === player.id);
        return me ? { ...prev, ...me } : prev;
      });
    });

    // Someone new joined — add them to our local room & re-broadcast for them
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
        const updated = { ...prev, players, gameLog: [...prev.gameLog, ...joinMsg] };
        // Only broadcast back if I was here first (avoid ping-pong — only if I have more players)
        if (prev.players.length >= 1) {
          setTimeout(() => {
            if (channelRef.current) channelRef.current.send('room_updated', updated);
          }, 100);
        }
        return updated;
      });
    });

    // Someone is asking for current state (new joiner requesting sync)
    ch.on('request_sync', () => {
      const current = roomRef.current;
      if (current && channelRef.current) {
        setTimeout(() => {
          channelRef.current.send('room_updated', current);
        }, 150);
      }
    });

    ch.on('dice_rolled', (payload) => {
      setLastRoll(payload);
      setIsRolling(true);
      setTimeout(() => setIsRolling(false), 1800);
    });

    ch.on('ai_thinking', (payload) => {
      setIsAiThinking(!!payload);
    });

    channelRef.current = ch;
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

    // Set a local placeholder room while we wait for sync from host
    const placeholderRoom = {
      code,
      players: [joiningPlayer],
      gameLog: [{
        id: 'msg-join-init',
        sender: 'AI Dungeon Master',
        isAi: true,
        text: `Подключение к лобби ${code}... Запрашиваем состояние у отряда.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: []
      }]
    };

    setCurrentPlayer(joiningPlayer);
    setRoom(placeholderRoom);
    roomRef.current = placeholderRoom;

    // 1. Connect to channel
    joinRealtimeRoom(code, joiningPlayer);

    // 2. Announce ourselves so existing players add us
    setTimeout(() => {
      if (channelRef.current) {
        channelRef.current.send('player_joined', joiningPlayer);
        // 3. Request full current state from host
        channelRef.current.send('request_sync', { requesterId: joiningPlayer.id });
      }
    }, 400);
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
