import React, { useState, useEffect } from 'react';
import { socket } from './socket';

import Header from './components/Header';
import LobbyModal from './components/LobbyModal';
import ProfileModal from './components/ProfileModal';
import GameTabletop from './components/GameTabletop';
import D20Dice from './components/D20Dice';
import ChatPanel from './components/ChatPanel';
import CharacterPanel from './components/CharacterPanel';

export default function App() {
  const [room, setRoom] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [lobbyError, setLobbyError] = useState('');

  // UI Modals & Drawers State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCharacterPanel, setShowCharacterPanel] = useState(false);
  const [showDiceRoller, setShowDiceRoller] = useState(true);

  // Game States
  const [lastRoll, setLastRoll] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);

  useEffect(() => {
    // Socket Event Handlers
    socket.on('room_updated', (updatedRoom) => {
      setRoom(updatedRoom);
      if (socket.id) {
        const me = updatedRoom.players.find((p) => p.id === socket.id);
        if (me) setCurrentPlayer(me);
      }
    });

    socket.on('dice_rolled', (rollResult) => {
      setLastRoll(rollResult);
      setIsRolling(true);
      setTimeout(() => setIsRolling(false), 1500);
    });

    socket.on('ai_thinking', (thinkingState) => {
      setIsAiThinking(thinkingState);
    });

    return () => {
      socket.off('room_updated');
      socket.off('dice_rolled');
      socket.off('ai_thinking');
    };
  }, []);

  // Create Lobby Handler
  const handleCreateRoom = ({ nickname, characterClass }) => {
    setLobbyError('');
    socket.emit('create_room', { nickname, characterClass }, (response) => {
      if (response.success) {
        setRoom(response.room);
        setCurrentPlayer(response.player);
      } else {
        setLobbyError(response.error || 'Ошибка при создании лобби');
      }
    });
  };

  // Join Lobby Handler
  const handleJoinRoom = ({ roomCode, nickname, characterClass }) => {
    setLobbyError('');
    socket.emit('join_room', { roomCode, playerData: { nickname, characterClass } }, (response) => {
      if (response.success) {
        setRoom(response.room);
        setCurrentPlayer(response.player);
      } else {
        setLobbyError(response.error || 'Ошибка при входе в лобби');
      }
    });
  };

  // Update Profile & Custom Avatar
  const handleSaveProfile = (updatedProfile) => {
    socket.emit('update_profile', updatedProfile);
  };

  // Move Token on Tabletop
  const handleMoveToken = (pos) => {
    socket.emit('move_token', pos);
  };

  // Roll D20 Dice Handler
  const handleRollDice = ({ modifier, statName }) => {
    socket.emit('roll_d20', { modifier, statName });
  };

  // Roll Check from AI prompt
  const handleRollCheckFromAi = (checkInfo) => {
    const statName = checkInfo.skill || checkInfo.description || 'Проверка';
    handleRollDice({ modifier: 2, statName });
  };

  // Send Player Action / Message to AI DM
  const handleSendPlayerAction = (actionText) => {
    socket.emit('send_player_action', { text: actionText });
  };

  // Update HP
  const handleUpdateHp = (newHp) => {
    if (!currentPlayer) return;
    socket.emit('update_profile', { hp: newHp });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <Header
        roomCode={room?.code}
        players={room?.players || []}
        currentPlayer={currentPlayer}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenCharacter={() => setShowCharacterPanel(true)}
        onToggleDice={() => setShowDiceRoller(!showDiceRoller)}
      />

      {/* Main Game Interface */}
      {!room ? (
        <LobbyModal
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          error={lobbyError}
        />
      ) : (
        <main className="flex-1 p-4 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-4 my-2">
          {/* Left Column: Visual Tabletop & D20 Dice Roller */}
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

          {/* Right Column: AI DM Narrative & Interactive Log */}
          <div className="lg:col-span-5 flex flex-col">
            <ChatPanel
              gameLog={room.gameLog || []}
              isAiThinking={isAiThinking}
              onSendAction={handleSendPlayerAction}
              onRollCheck={handleRollCheckFromAi}
            />
          </div>
        </main>
      )}

      {/* Profile & Avatar Settings Modal */}
      {showProfileModal && (
        <ProfileModal
          currentPlayer={currentPlayer}
          room={room}
          onSave={handleSaveProfile}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {/* Character Sheet Side Drawer */}
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
