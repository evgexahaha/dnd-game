import React, { useState, useEffect } from 'react';
import { Shield, Plus, LogIn, Sparkles, Sword, Crown, Server, AlertCircle } from 'lucide-react';
import { socket, reconnectSocket } from '../socket';

export default function LobbyModal({ onCreateRoom, onJoinRoom, error }) {
  const [roomInput, setRoomInput] = useState('');
  const [nickname, setNickname] = useState('Искатель Приключений');
  const [characterClass, setCharacterClass] = useState('Паладин (Paladin)');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(localStorage.getItem('dnd_server_url') || '');

  useEffect(() => {
    function onConnect() { setIsConnected(true); }
    function onDisconnect() { setIsConnected(false); }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Read URL query parameters for direct invite link support (?room=XXXXXX)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomInput(roomParam.toUpperCase());
    }
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    onCreateRoom({ nickname, characterClass });
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomInput.trim()) return;
    onJoinRoom({ roomCode: roomInput.trim().toUpperCase(), nickname, characterClass });
  };

  const handleSaveServerUrl = (e) => {
    e.preventDefault();
    reconnectSocket(customServerUrl.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="w-full max-w-lg glass-panel-gold rounded-2xl p-6 sm:p-8 border border-amber-500/40 shadow-2xl relative overflow-hidden">
        {/* Background Decorative Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-600/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Modal Title */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-300 p-0.5 shadow-xl shadow-amber-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Sword className="w-8 h-8 text-amber-400" />
            </div>
          </div>
          <h2 className="font-cinzel text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500">
            D&D AI REALM
          </h2>
          <p className="text-xs text-slate-400 mt-1">Мультиплеерная D&D игра с Ведущим ИИ</p>
        </div>

        {/* Server Connection Disconnect Banner */}
        {!isConnected && (
          <div className="mb-4 p-3 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>Подключение к бэкенд-серверу...</span>
              </div>
              <button
                type="button"
                onClick={() => setShowServerConfig(!showServerConfig)}
                className="text-[10px] text-amber-400 underline font-semibold"
              >
                {showServerConfig ? 'Скрыть' : 'Указать адрес бэкенда'}
              </button>
            </div>
            <p className="text-[11px] text-amber-300/80">
              Если фронтенд размещен на статической платформе, укажите адрес вашего запущеного бэкенд-сервера.
            </p>

            {showServerConfig && (
              <form onSubmit={handleSaveServerUrl} className="mt-2.5 flex gap-2">
                <input
                  type="text"
                  value={customServerUrl}
                  onChange={(e) => setCustomServerUrl(e.target.value)}
                  placeholder="http://localhost:3000 или URL бэкенда"
                  className="flex-1 bg-slate-950 border border-amber-500/40 rounded-lg px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1 bg-amber-500 text-slate-950 rounded-lg font-bold text-xs"
                >
                  Переподключить
                </button>
              </form>
            )}
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/80 border border-red-500/50 text-red-300 text-xs text-center font-medium">
            {error}
          </div>
        )}

        {/* Character Setup Inputs */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1.5">
              Ваш Никнейм
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Введите ваше имя"
              className="w-full bg-slate-900/90 border border-amber-500/30 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1.5">
              Класс Персонажа
            </label>
            <select
              value={characterClass}
              onChange={(e) => setCharacterClass(e.target.value)}
              className="w-full bg-slate-900/90 border border-amber-500/30 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400 transition-all"
            >
              <option value="Паладин (Paladin)">🛡️ Паладин (Paladin) — Танк и Защитник</option>
              <option value="Воин (Warrior)">⚔️ Воин (Warrior) — Мастер Ближнего Боя</option>
              <option value="Волшебник (Wizard)">🔮 Волшебник (Wizard) — Повелитель Магии</option>
              <option value="Плут (Rogue)">🗡️ Плут (Rogue) — Мастер Скрытности и Критов</option>
              <option value="Жрец (Cleric)">✨ Жрец (Cleric) — Лекарь и Святой Воин</option>
              <option value="Бард (Bard)">🪕 Бард (Bard) — Вдохновитель и Чародей</option>
              <option value="Следопыт (Ranger)">🏹 Следопыт (Ranger) — Меткий Лучник</option>
            </select>
          </div>
        </div>

        {/* Action Choice Tabs: Create or Join */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Create Lobby Card */}
          <div className="bg-slate-900/60 p-4 rounded-xl border border-amber-500/30 flex flex-col justify-between hover:border-amber-500/60 transition-all">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="font-cinzel text-sm font-bold text-slate-100">Создать Новое Лобби</h3>
              </div>
              <p className="text-[11px] text-slate-400 mb-4">
                Станьте организатором партии и получите код и ссылку для друзей.
              </p>
            </div>
            <button
              onClick={handleCreate}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 rounded-xl font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Создать Лобби</span>
            </button>
          </div>

          {/* Join Lobby Card */}
          <div className="bg-slate-900/60 p-4 rounded-xl border border-amber-500/30 flex flex-col justify-between hover:border-amber-500/60 transition-all">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <LogIn className="w-5 h-5 text-amber-400" />
                <h3 className="font-cinzel text-sm font-bold text-slate-100">Войти по Коду</h3>
              </div>
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                placeholder="Код лобби (напр. K9X2P1)"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-amber-300 placeholder-slate-600 uppercase font-mono tracking-wider mb-3 focus:outline-none focus:border-amber-400"
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={!roomInput.trim()}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-300 rounded-xl font-bold text-xs border border-amber-500/40 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>Войти в Игру</span>
            </button>
          </div>
        </div>

        {/* Footer tip */}
        <div className="mt-6 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Все игроки в лобби видят броски кубиков и чат с ИИ в реальном времени</span>
        </div>
      </div>
    </div>
  );
}
