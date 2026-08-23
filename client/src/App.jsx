import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './services/supabaseClient';
import { fetchAiDmNarrative } from './services/aiDmClient';

import Header from './components/Header';
import LobbyModal from './components/LobbyModal';
import ProfileModal from './components/ProfileModal';
import GameTabletop from './components/GameTabletop';
import D20Dice from './components/D20Dice';
import ChatPanel from './components/ChatPanel';
import CharacterPanel from './components/CharacterPanel';

// Local BroadcastChannel fallback for multi-tab/same-network client sync
const localBroadcast = typeof window !== 'undefined' && window.BroadcastChannel ? new BroadcastChannel('dnd_realm_channel') : null;

export default function App() {
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

  const activeChannelRef = useRef(null);

  // Helper to sync room update to all connected peers
  const broadcastRoomUpdate = (updatedRoom) => {
    setRoom(updatedRoom);
    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'room_updated',
        payload: updatedRoom
      });
    }
    if (localBroadcast) {
      localBroadcast.postMessage({ type: 'room_updated', payload: updatedRoom });
    }
  };

  // Helper to sync dice roll to all peers
  const broadcastDiceRoll = (rollResult) => {
    setLastRoll(rollResult);
    setIsRolling(true);
    setTimeout(() => setIsRolling(false), 1500);

    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'dice_rolled',
        payload: rollResult
      });
    }
    if (localBroadcast) {
      localBroadcast.postMessage({ type: 'dice_rolled', payload: rollResult });
    }
  };

  // Setup Realtime Sync Channel when joining a room
  const joinRealtimeRoom = (roomCode, player) => {
    const channelName = `dnd_room_${roomCode}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true }, presence: { key: player.id } }
    });

    channel
      .on('broadcast', { event: 'room_updated' }, ({ payload }) => {
        setRoom(payload);
        const me = payload.players.find(p => p.id === player.id);
        if (me) setCurrentPlayer(me);
      })
      .on('broadcast', { event: 'dice_rolled' }, ({ payload }) => {
        setLastRoll(payload);
        setIsRolling(true);
        setTimeout(() => setIsRolling(false), 1500);
      })
      .on('broadcast', { event: 'ai_thinking' }, ({ payload }) => {
        setIsAiThinking(payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({
            id: player.id,
            nickname: player.nickname,
            avatar: player.avatar,
            onlineAt: new Date().toISOString()
          });
        }
      });

    activeChannelRef.current = channel;

    // Listen to local browser multi-tab fallback
    if (localBroadcast) {
      localBroadcast.onmessage = (msg) => {
        if (msg.data.type === 'room_updated') {
          setRoom(msg.data.payload);
        } else if (msg.data.type === 'dice_rolled') {
          setLastRoll(msg.data.payload);
          setIsRolling(true);
          setTimeout(() => setIsRolling(false), 1500);
        }
      };
    }
  };

  // Create Lobby Handler
  const handleCreateRoom = ({ nickname, characterClass }) => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const playerId = `player_${Date.now()}_${Math.floor(Math.random()*1000)}`;

    const hostPlayer = {
      id: playerId,
      nickname: nickname || 'Герой 1',
      avatar: 'preset_knight',
      characterClass: characterClass || 'Паладин (Paladin)',
      hp: 12,
      maxHp: 12,
      ac: 15,
      stats: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
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
    const playerId = `player_${Date.now()}_${Math.floor(Math.random()*1000)}`;

    const newPlayer = {
      id: playerId,
      nickname: nickname || 'Присоединившийся Герой',
      avatar: 'preset_wizard',
      characterClass: characterClass || 'Маг (Wizard)',
      hp: 8,
      maxHp: 8,
      ac: 12,
      stats: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
      position: { x: 380, y: 220 },
      isHost: false
    };

    let existingRoom = room;
    if (!existingRoom) {
      existingRoom = {
        code,
        players: [],
        gameLog: [
          {
            id: 'msg-init',
            sender: 'AI Dungeon Master',
            isAi: true,
            text: `Добро пожаловать в лобби ${code}! Отряд собирается в подземелье.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestedActions: ["Приготовиться к приключению", "Осмотреться"]
          }
        ]
      };
    }

    const updatedPlayers = [...existingRoom.players.filter(p => p.id !== playerId), newPlayer];
    const updatedRoom = {
      ...existingRoom,
      code,
      players: updatedPlayers,
      gameLog: [
        ...existingRoom.gameLog,
        {
          id: `sys-${Date.now()}`,
          sender: 'Система',
          isSystem: true,
          text: `${newPlayer.nickname} присоединился к отряду!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    };

    setCurrentPlayer(newPlayer);
    setRoom(updatedRoom);
    joinRealtimeRoom(code, newPlayer);
    broadcastRoomUpdate(updatedRoom);
  };

  // Profile Update
  const handleSaveProfile = (updatedProfile) => {
    if (!room || !currentPlayer) return;

    const updatedPlayers = room.players.map((p) => {
      if (p.id === currentPlayer.id) {
        return { ...p, ...updatedProfile };
      }
      return p;
    });

    const updatedRoom = { ...room, players: updatedPlayers };
    setCurrentPlayer({ ...currentPlayer, ...updatedProfile });
    broadcastRoomUpdate(updatedRoom);
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

    // AI Thinking status
    setIsAiThinking(true);
    if (activeChannelRef.current) {
      activeChannelRef.current.send({ type: 'broadcast', event: 'ai_thinking', payload: true });
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
      if (activeChannelRef.current) {
        activeChannelRef.current.send({ type: 'broadcast', event: 'ai_thinking', payload: false });
      }
      broadcastRoomUpdate(updatedRoom);
    }
  };

  // Update HP
  const handleUpdateHp = (newHp) => {
    handleSaveProfile({ hp: newHp });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <Header
        roomCode={room?.code}
        players={room?.players || []}
        currentPlayer={currentPlayer}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenCharacter={() => setShowCharacterPanel(true)}
        onToggleDice={() => setShowDiceRoller(!showDiceRoller)}
      />

      {/* Main Interface */}
      {!room ? (
        <LobbyModal
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          error={lobbyError}
        />
      ) : (
        <main className="flex-1 p-4 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-4 my-2">
          {/* Left Column: Visual Tabletop & D20 Dice */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <GameTabletop
              players={room.players}
              currentPlayer={currentPlayer}
              onMoveToken={handleMoveToken}
            />

            {showDiceRoller && (
              <D20Dice
                onRoll={handleRollDice}
                lastRoll={lastRoll}
                isRolling={isRolling}
                stats={currentPlayer?.stats || {}}
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

      {/* Modals & Drawers */}
      {showProfileModal && (
        <ProfileModal
          currentPlayer={currentPlayer}
          room={room}
          onSave={handleSaveProfile}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {showCharacterPanel && (
        <CharacterPanel
          player={currentPlayer}
          onUpdateHp={handleUpdateHp}
          onClose={() => setShowCharacterPanel(false)}
        />
      )}
    </div>
  );
}
