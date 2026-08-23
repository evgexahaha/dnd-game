const { generateDmResponse } = require('../services/aiDmService');

// In-memory room store (can be connected to SQLite/Supabase)
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function initializeRoom(code, hostPlayer) {
  const room = {
    code,
    hostId: hostPlayer.id,
    createdAt: new Date().toISOString(),
    scenario: "Подземелье Забытого Дракона: Ваша группа искателей приключений стоит у входа в древние руины.",
    players: [hostPlayer],
    gameLog: [
      {
        id: 'msg-init',
        sender: 'AI Dungeon Master',
        isAi: true,
        text: 'Приветствую вас, искатели приключений! Я ваш ИИ-Мастер Подземелий (Dungeon Master). Соберите свою группу, настройте персонажей и приготовьтесь к путешествию! Нажмите "Начать приключение", когда будете готовы.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: ["Осмотреть вход в руины", "Приготовить оружие", "Зажечь факел"]
      }
    ],
    turnIndex: 0,
    inCombat: false,
    aiSettings: {
      provider: 'pollinations',
      apiKey: '',
      model: 'meta-llama/llama-3.3-70b-instruct:free'
    }
  };
  rooms.set(code, room);
  return room;
}

function registerSocketEvents(io, socket) {
  // CREATE LOBBY
  socket.on('create_room', (playerData, callback) => {
    let code = generateRoomCode();
    while (rooms.has(code)) {
      code = generateRoomCode();
    }

    const player = {
      id: socket.id,
      nickname: playerData?.nickname || 'Игрок 1',
      avatar: playerData?.avatar || 'preset_knight',
      characterClass: playerData?.characterClass || 'Воин (Warrior)',
      hp: playerData?.hp || 12,
      maxHp: playerData?.maxHp || 12,
      ac: playerData?.ac || 15,
      stats: playerData?.stats || { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
      position: { x: 200 + rooms.size * 20, y: 200 },
      isHost: true,
      ready: true
    };

    socket.join(code);
    socket.roomCode = code;
    const room = initializeRoom(code, player);

    if (typeof callback === 'function') {
      callback({ success: true, roomCode: code, player, room });
    }
    io.to(code).emit('room_updated', room);
  });

  // JOIN LOBBY BY CODE / LINK
  socket.on('join_room', ({ roomCode, playerData }, callback) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Лобби с таким кодом не найдено!' });
      }
      return;
    }

    // Check if player already in room
    let player = room.players.find(p => p.id === socket.id);
    if (!player) {
      const defaultPositions = [
        { x: 180, y: 220 },
        { x: 320, y: 220 },
        { x: 460, y: 220 },
        { x: 600, y: 220 }
      ];
      const pos = defaultPositions[room.players.length % defaultPositions.length];

      player = {
        id: socket.id,
        nickname: playerData?.nickname || `Герой ${room.players.length + 1}`,
        avatar: playerData?.avatar || 'preset_wizard',
        characterClass: playerData?.characterClass || 'Маг (Wizard)',
        hp: playerData?.hp || 8,
        maxHp: playerData?.maxHp || 8,
        ac: playerData?.ac || 12,
        stats: playerData?.stats || { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
        position: pos,
        isHost: false,
        ready: false
      };
      room.players.push(player);
    }

    socket.join(code);
    socket.roomCode = code;

    // Add system message to chat log
    room.gameLog.push({
      id: `sys-${Date.now()}`,
      sender: 'Система',
      isSystem: true,
      text: `${player.nickname} присоединился к отряду!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    if (typeof callback === 'function') {
      callback({ success: true, roomCode: code, player, room });
    }

    io.to(code).emit('room_updated', room);
    io.to(code).emit('player_joined', player);
  });

  // UPDATE PROFILE / CHARACTER SHEET
  socket.on('update_profile', (updatedData) => {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      room.players[playerIndex] = {
        ...room.players[playerIndex],
        ...updatedData
      };
      io.to(code).emit('room_updated', room);
    }
  });

  // UPDATE PLAYER POSITION ON TABLETOP
  socket.on('move_token', ({ x, y }) => {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.position = { x, y };
      socket.to(code).emit('token_moved', { playerId: socket.id, position: { x, y } });
    }
  });

  // ROLL D20 DICE
  socket.on('roll_d20', ({ modifier = 0, statName = 'Проверка', isCritical = false }, callback) => {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    const rawRoll = Math.floor(Math.random() * 20) + 1;
    const totalRoll = rawRoll + modifier;

    const rollResult = {
      id: `roll-${Date.now()}`,
      playerId: socket.id,
      playerNickname: player ? player.nickname : 'Неизвестный',
      playerAvatar: player ? player.avatar : 'preset_knight',
      statName,
      rawRoll,
      modifier,
      totalRoll,
      isNat20: rawRoll === 20,
      isNat1: rawRoll === 1,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Log in room history
    const logEntry = {
      id: `log-roll-${Date.now()}`,
      sender: 'Кубик D20',
      isRoll: true,
      rollData: rollResult,
      text: `${rollResult.playerNickname} бросает D20 (${statName}): Выпало ${rawRoll} ${modifier >= 0 ? '+' : ''}${modifier} = ${totalRoll}${rawRoll === 20 ? ' (КРИТИЧЕСКИЙ УСПЕХ! 🎯)' : rawRoll === 1 ? ' (КРИТИЧЕСКИЙ ПРОВАЛ! 💀)' : ''}`,
      timestamp: rollResult.timestamp
    };

    room.gameLog.push(logEntry);

    if (typeof callback === 'function') {
      callback(rollResult);
    }

    // Broadcast roll animation and event to everyone in the lobby
    io.to(code).emit('dice_rolled', rollResult);
    io.to(code).emit('room_updated', room);
  });

  // PLAYER ACTION / CHAT TO AI DM
  socket.on('send_player_action', async ({ text, actionType }) => {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    const nickname = player ? player.nickname : 'Игрок';

    // 1. Log player input
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: nickname,
      avatar: player?.avatar,
      isPlayer: true,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    room.gameLog.push(userMsg);
    io.to(code).emit('room_updated', room);

    // 2. Trigger AI DM thinking status
    io.to(code).emit('ai_thinking', true);

    try {
      // 3. Generate AI response
      const aiResponse = await generateDmResponse({
        prompt: `${nickname}: "${text}"`,
        gameContext: {
          scenario: room.scenario,
          players: room.players.map(p => ({ name: p.nickname, class: p.characterClass, hp: `${p.hp}/${p.maxHp}` })),
          history: room.gameLog.slice(-8)
        },
        apiKey: room.aiSettings?.apiKey,
        provider: room.aiSettings?.provider,
        model: room.aiSettings?.model
      });

      // 4. Append AI response to game log
      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'AI Dungeon Master',
        isAi: true,
        text: aiResponse.narrative,
        checkRequired: aiResponse.checkRequired,
        suggestedActions: aiResponse.suggestedActions,
        soundEffect: aiResponse.soundEffect,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      room.gameLog.push(aiMsg);
    } catch (err) {
      console.error('Error generating AI DM message:', err);
    } finally {
      io.to(code).emit('ai_thinking', false);
      io.to(code).emit('room_updated', room);
    }
  });

  // DISCONNECT HANDLER
  socket.on('disconnect', () => {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      room.gameLog.push({
        id: `sys-${Date.now()}`,
        sender: 'Система',
        isSystem: true,
        text: `${player.nickname} покинул игру.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      room.players = room.players.filter(p => p.id !== socket.id);

      if (room.players.length === 0) {
        // Clean up empty room after 5 minutes
        setTimeout(() => {
          if (rooms.get(code)?.players.length === 0) {
            rooms.delete(code);
          }
        }, 5 * 60 * 1000);
      } else {
        // Assign new host if host left
        if (player.isHost && room.players.length > 0) {
          room.players[0].isHost = true;
        }
        io.to(code).emit('room_updated', room);
      }
    }
  });
}

module.exports = {
  registerSocketEvents,
  rooms
};
