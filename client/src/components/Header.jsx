import React, { useState } from 'react';
import { Shield, User, Copy, Check, Users, Settings, Scroll, Dice5 } from 'lucide-react';

export default function Header({ roomCode, players = [], currentPlayer, onOpenProfile, onOpenCharacter, onToggleDice }) {
  const [copied, setCopied] = useState(false);

  const copyInviteLink = () => {
    if (!roomCode) return;
    const url = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="h-16 bg-slate-900/90 border-b border-amber-500/30 px-4 flex items-center justify-between backdrop-blur-md sticky top-0 z-30 shadow-lg">
      {/* Brand Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-300 p-0.5 shadow-lg shadow-amber-500/20">
          <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
        </div>
        <div>
          <h1 className="font-cinzel text-lg font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500">
            D&D AI REALM
          </h1>
          <p className="text-[10px] text-slate-400 tracking-widest uppercase">Multiplayer & AI Dungeon Master</p>
        </div>
      </div>

      {/* Room Code & Invite Share */}
      {roomCode && (
        <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-1.5 rounded-full border border-amber-500/30">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Лобби:</span>
            <span className="font-mono text-sm font-bold text-amber-400 tracking-widest">{roomCode}</span>
          </div>

          <button
            onClick={copyInviteLink}
            className="flex items-center gap-1.5 text-xs bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 px-3 py-1 rounded-full border border-amber-500/40 transition-all active:scale-95"
            title="Скопировать прямую ссылку для игроков"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
            <span>{copied ? 'Ссылка скопирована!' : 'Пригласить'}</span>
          </button>
        </div>
      )}

      {/* Controls & Profile Status */}
      <div className="flex items-center gap-3">
        {/* Dice Quick Toggle */}
        <button
          onClick={onToggleDice}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 px-3.5 py-1.5 rounded-lg font-bold text-xs shadow-md shadow-amber-500/20 transition-all active:scale-95"
        >
          <Dice5 className="w-4 h-4" />
          <span className="hidden sm:inline">Бросить D20</span>
        </button>

        {/* Players Badge */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300">
          <Users className="w-4 h-4 text-amber-400" />
          <span>{players.length} Игрока(ов)</span>
        </div>

        {/* Character Sheet Button */}
        <button
          onClick={onOpenCharacter}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-all"
          title="Лист Персонажа"
        >
          <Scroll className="w-4 h-4" />
        </button>

        {/* Profile Settings Button */}
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-amber-500/30 transition-all text-xs"
        >
          {currentPlayer?.avatar?.startsWith('data:') ? (
            <img src={currentPlayer.avatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-amber-400" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs">
              {currentPlayer?.nickname?.substring(0, 1) || 'P'}
            </div>
          )}
          <span className="hidden sm:inline text-slate-200 font-medium">{currentPlayer?.nickname || 'Профиль'}</span>
          <Settings className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    </header>
  );
}
