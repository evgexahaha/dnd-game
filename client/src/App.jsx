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

const defaultAccount = {
  id: `usr_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
  nickname: 'Искатель Приключений',
  avatar: 'preset_knight',
  characterClass: 'Паладин (Paladin)',
  hp: 12, maxHp: 12, ac: 15,
  stats: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 }
};

function loadSavedAccount() {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNT_KEY);
    if (raw) { const p = JSON.parse(raw); if (p?.nickname) return p; }
  } catch (_) {}
  return defaultAccount;
}
function saveAccountToStorage(a) {
  try { localStorage.setItem(LOCAL_ACCOUNT_KEY, JSON.stringify(a)); } catch (_) {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mergePlayers(existing = [], incoming = []) {
  const map = new Map();
  existing.forEach(p => map.set(p.id, p));
  incoming.forEach(p => {
    map.set(p.id, map.has(p.id) ? { ...map.get(p.id), ...p } : p);
  });
  return Array.from(map.values());
}

function mergeLog(a = [], b = []) {
  const map = new Map();
  [...a, ...b].forEach(l => map.set(l.id, l));
  return Array.from(map.values()).sort((x, y) => x.id.localeCompare(y.id));
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [accountProfile, setAccountProfile] = useState(loadSavedAccount());
  const [room, setRoom]           = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [lastRoll, setLastRoll]   = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [showProfileModal, setShowProfileModal]     = useState(false);
  const [showCharacterPanel, setShowCharacterPanel] = useState(false);
  const [showDiceRoller, setShowDiceRoller]         = useState(true);

  const chRef  = useRef(null);   // PubNub channel handle
  const roomRef = useRef(null);  // latest room state for closures
  const meRef   = useRef(null);  // latest currentPlayer for heartbeat closure
  const hbRef   = useRef(null);  // heartbeat interval

  useEffect(() => { roomRef.current = room; },          [room]);
  useEffect(() => { meRef.current   = currentPlayer; }, [currentPlayer]);

  // ── account profile ────────────────────────────────────────────────────────
  const updateAccountProfile = (data) => {
    const next = { ...accountProfile, ...data };
    setAccountProfile(next);
    saveAccountToStorage(next);
    if (room && currentPlayer) {
      const players = room.players.map(p => p.id === currentPlayer.id ? { ...p, ...data } : p);
      const updated = { ...room, players };
      setCurrentPlayer(c => ({ ...c, ...data }));
      applyRoom(updated);
      chRef.current?.send('players_sync', players);
    }
  };

  // ── room state helpers ─────────────────────────────────────────────────────
  // Apply room locally without broadcasting
  const applyRoom = (r) => { setRoom(r); roomRef.current = r; };

  // Send light players-only sync (tiny payload ~1-2KB)
  const sendPlayers = (players) => chRef.current?.send('players_sync', players);

  // Send a single chat message event (no full gameLog)
  const sendChatMsg = (msg) => chRef.current?.send('chat_msg', msg);

  // Send dice roll event
  const sendDiceRoll = (data) => chRef.current?.send('dice_rolled', data);

  // ── heartbeat ──────────────────────────────────────────────────────────────
  const startHeartbeat = () => {
    if (hbRef.current) clearInterval(hbRef.current);
    hbRef.current = setInterval(() => {
      const me = meRef.current;
      if (me && chRef.current) chRef.current.send('heartbeat', me);
    }, 2000);
  };

  // ── wire up channel events ─────────────────────────────────────────────────
  const wireChannel = (ch, myId) => {
    // ① players_sync — lightweight array of all players (no gameLog)
    ch.on('players_sync', (players) => {
      if (!Array.isArray(players)) return;
      setRoom(prev => {
        if (!prev) return null;
        const merged = mergePlayers(prev.players, players);
        const next = { ...prev, players: merged };
        roomRef.current = next;
        return next;
      });
    });

    // ② heartbeat — single player presence ping
    ch.on('heartbeat', (remotePlayer) => {
      if (!remotePlayer || remotePlayer.id === myId) return;
      setRoom(prev => {
        if (!prev) return null;
        const alreadyIn = prev.players.some(p => p.id === remotePlayer.id);
        const players = alreadyIn
          ? prev.players.map(p => p.id === remotePlayer.id ? { ...p, ...remotePlayer } : p)
          : [...prev.players, remotePlayer];

        const joinMsgs = alreadyIn ? [] : [{
          id: `sys-hb-${remotePlayer.id}`,
          sender: 'Система', isSystem: true,
          text: `${remotePlayer.nickname} в отряде!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }];

        const next = { ...prev, players, gameLog: [...prev.gameLog, ...joinMsgs] };
        roomRef.current = next;

        // If this is a new player — respond with our players list immediately
        if (!alreadyIn) {
          setTimeout(() => chRef.current?.send('players_sync', next.players), 100);
        }
        return next;
      });
    });

    // ③ request_sync — joiner asks for players list (not full room)
    ch.on('request_sync', () => {
      const cur = roomRef.current;
      if (cur) setTimeout(() => chRef.current?.send('players_sync', cur.players), 100);
    });

    // ④ chat_msg — single new message
    ch.on('chat_msg', (msg) => {
      if (!msg) return;
      setRoom(prev => {
        if (!prev) return null;
        const next = { ...prev, gameLog: mergeLog(prev.gameLog, [msg]) };
        roomRef.current = next;
        return next;
      });
    });

    // ⑤ dice_rolled
    ch.on('dice_rolled', (p) => {
      setLastRoll(p);
      setIsRolling(true);
      setTimeout(() => setIsRolling(false), 1800);
    });

    // ⑥ ai_thinking
    ch.on('ai_thinking', (v) => setIsAiThinking(!!v));
  };

  // ── create room ────────────────────────────────────────────────────────────
  const handleCreateRoom = ({ nickname, characterClass }) => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const account = { ...accountProfile, nickname, characterClass };
    setAccountProfile(account);
    saveAccountToStorage(account);

    const host = { ...account, id: account.id, position: { x: 220, y: 220 }, isHost: true };

    const newRoom = {
      code,
      players: [host],
      gameLog: [{
        id: 'msg-init', sender: 'AI Dungeon Master', isAi: true,
        text: 'Приветствую искателей приключений! Соберите отряд и приготовьтесь к путешествию!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: ['Осмотреть вход в руины', 'Приготовить оружие', 'Зажечь факел']
      }]
    };

    setCurrentPlayer(host);
    applyRoom(newRoom);

    if (hbRef.current) clearInterval(hbRef.current);
    if (chRef.current) chRef.current.destroy();
    const ch = joinRoom(code, host.id);
    wireChannel(ch, host.id);
    chRef.current = ch;
    startHeartbeat();
  };

  // ── join room ──────────────────────────────────────────────────────────────
  const handleJoinRoom = ({ roomCode, nickname, characterClass }) => {
    const code = roomCode.toUpperCase().trim();
    const account = { ...accountProfile, nickname, characterClass };
    setAccountProfile(account);
    saveAccountToStorage(account);

    const me = {
      ...account, id: account.id,
      position: { x: 280 + Math.floor(Math.random() * 140), y: 180 + Math.floor(Math.random() * 140) },
      isHost: false
    };

    const placeholder = {
      code,
      players: [me],
      gameLog: [{
        id: 'msg-join-init', sender: 'Система', isSystem: true,
        text: `Подключение к лобби ${code}...`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]
    };

    setCurrentPlayer(me);
    applyRoom(placeholder);

    if (hbRef.current) clearInterval(hbRef.current);
    if (chRef.current) chRef.current.destroy();
    const ch = joinRoom(code, me.id);
    wireChannel(ch, me.id);
    chRef.current = ch;
    startHeartbeat();

    // Announce presence with retries at 300ms, 1s, 3s
    const announce = () => {
      ch.send('heartbeat',    me);
      ch.send('request_sync', { from: me.id });
    };
    setTimeout(announce, 300);
    setTimeout(announce, 1000);
    setTimeout(announce, 3000);
  };

  // ── move token ─────────────────────────────────────────────────────────────
  const handleMoveToken = (pos) => {
    if (!room || !currentPlayer) return;
    const players = room.players.map(p => p.id === currentPlayer.id ? { ...p, position: pos } : p);
    setCurrentPlayer(c => ({ ...c, position: pos }));
    applyRoom({ ...room, players });
    sendPlayers(players);
  };

  // ── roll D20 ───────────────────────────────────────────────────────────────
  const handleRollDice = ({ modifier, statName }) => {
    if (!currentPlayer || !room) return;
    const rawRoll  = Math.floor(Math.random() * 20) + 1;
    const totalRoll = rawRoll + modifier;

    const rollData = {
      id: `roll-${Date.now()}`,
      playerId: currentPlayer.id, playerNickname: currentPlayer.nickname,
      playerAvatar: currentPlayer.avatar, statName, rawRoll, modifier, totalRoll,
      isNat20: rawRoll === 20, isNat1: rawRoll === 1,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const logEntry = {
      id: `log-roll-${Date.now()}`, sender: 'Кубик D20', isRoll: true, rollData,
      text: `${currentPlayer.nickname} бросает D20 (${statName}): ${rawRoll} ${modifier >= 0 ? '+' : ''}${modifier} = ${totalRoll}${rawRoll === 20 ? ' 🎯 КРИТИЧЕСКИЙ УСПЕХ!' : rawRoll === 1 ? ' 💀 ПРОВАЛ!' : ''}`,
      timestamp: rollData.timestamp
    };

    setLastRoll(rollData);
    setIsRolling(true);
    setTimeout(() => setIsRolling(false), 1800);

    const next = { ...room, gameLog: [...room.gameLog, logEntry] };
    applyRoom(next);
    sendDiceRoll(rollData);
    sendChatMsg(logEntry);
  };

  // ── send player action ─────────────────────────────────────────────────────
  const handleSendPlayerAction = async (actionText) => {
    if (!room || !currentPlayer) return;

    const userMsg = {
      id: `user-${Date.now()}`, sender: currentPlayer.nickname,
      avatar: currentPlayer.avatar, isPlayer: true, text: actionText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    applyRoom({ ...room, gameLog: [...room.gameLog, userMsg] });
    sendChatMsg(userMsg);

    setIsAiThinking(true);
    chRef.current?.send('ai_thinking', true);

    try {
      const aiResponse = await fetchAiDmNarrative({
        prompt: `${currentPlayer.nickname}: "${actionText}"`,
        history: roomRef.current.gameLog.slice(-8),
        players: roomRef.current.players
      });

      const aiMsg = {
        id: `ai-${Date.now()}`, sender: 'AI Dungeon Master', isAi: true,
        text: aiResponse.narrative, checkRequired: aiResponse.checkRequired,
        suggestedActions: aiResponse.suggestedActions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const next = { ...roomRef.current, gameLog: [...roomRef.current.gameLog, aiMsg] };
      applyRoom(next);
      sendChatMsg(aiMsg);
    } catch (e) {
      console.error('AI DM error:', e);
    } finally {
      setIsAiThinking(false);
      chRef.current?.send('ai_thinking', false);
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        roomCode={room?.code}
        players={room?.players || []}
        currentPlayer={currentPlayer || accountProfile}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenCharacter={() => setShowCharacterPanel(true)}
        onToggleDice={() => setShowDiceRoller(!showDiceRoller)}
      />

      {!room ? (
        <LobbyModal
          accountProfile={accountProfile}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          error=""
          onOpenProfile={() => setShowProfileModal(true)}
        />
      ) : (
        <main className="flex-1 p-4 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-4 my-2">
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
          onUpdateHp={(hp) => updateAccountProfile({ hp })}
          onClose={() => setShowCharacterPanel(false)}
        />
      )}
    </div>
  );
}
