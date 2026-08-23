import React, { useState } from 'react';
import { Shield, Heart, User, MapPin, Grid, Sword } from 'lucide-react';

const PRESET_ICONS = {
  preset_knight: '⚔️',
  preset_wizard: '🔮',
  preset_rogue: '🗡️',
  preset_cleric: '✨',
  preset_barbarian: '🪓',
  preset_bard: '🪕',
  preset_ranger: '🏹',
  preset_warlock: '👁️'
};

export default function GameTabletop({ players = [], currentPlayer, onMoveToken }) {
  const [showGrid, setShowGrid] = useState(true);

  const handleBoardClick = (e) => {
    if (!currentPlayer) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    onMoveToken({ x, y });
  };

  return (
    <div className="relative w-full h-[420px] lg:h-[480px] bg-slate-950 rounded-2xl border border-amber-500/30 overflow-hidden shadow-2xl flex flex-col">
      {/* Tabletop Control Overlay */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-amber-500/30 backdrop-blur-md">
        <MapPin className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-cinzel font-bold text-amber-300">Игровой Стол Сражений</span>
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`ml-2 p-1 rounded-md text-[10px] flex items-center gap-1 border ${
            showGrid ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          <Grid className="w-3 h-3" />
          <span>Сетка</span>
        </button>
      </div>

      {/* Interactive Battle Map Board Area */}
      <div
        onClick={handleBoardClick}
        className="relative flex-1 w-full h-full cursor-crosshair bg-slate-900 overflow-hidden select-none"
        style={{
          backgroundImage: showGrid
            ? 'radial-gradient(circle, rgba(245,158,11,0.12) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)'
            : 'none',
          backgroundSize: showGrid ? '40px 40px, 40px 40px, 40px 40px' : 'auto'
        }}
      >
        {/* Subtle Dungeon Map Texture Background */}
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900/90 to-amber-950/20 pointer-events-none"></div>

        {/* Players Tokens Rendered on the Map */}
        {players.map((player) => {
          const isCurrent = player.id === currentPlayer?.id;
          const pos = player.position || { x: 200, y: 200 };
          const hpPercent = Math.max(0, Math.min(100, Math.round((player.hp / (player.maxHp || 1)) * 100)));

          return (
            <div
              key={player.id}
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                transform: 'translate(-50%, -50%)'
              }}
              className={`absolute transition-all duration-300 z-10 flex flex-col items-center group cursor-pointer ${
                isCurrent ? 'z-20' : ''
              }`}
            >
              {/* Token Circular Avatar */}
              <div
                className={`w-14 h-14 rounded-full border-2 p-0.5 shadow-xl transition-all ${
                  isCurrent
                    ? 'border-yellow-300 ring-4 ring-amber-500/40 gold-glow scale-110'
                    : 'border-amber-500/60 ring-2 ring-slate-900 hover:scale-105'
                }`}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-950 flex items-center justify-center relative">
                  {player.avatar?.startsWith('data:') ? (
                    <img src={player.avatar} alt={player.nickname} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-amber-700 to-amber-500 flex items-center justify-center text-xl">
                      {PRESET_ICONS[player.avatar] || '⚔️'}
                    </div>
                  )}

                  {/* Armor Class Emblem */}
                  <div className="absolute bottom-0 right-0 bg-slate-950 text-amber-300 border border-amber-500/60 rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-bold">
                    {player.ac || 12}
                  </div>
                </div>
              </div>

              {/* Player Name Badge & HP Bar */}
              <div className="mt-1 flex flex-col items-center">
                <div className="bg-slate-950/90 border border-amber-500/40 px-2 py-0.5 rounded-full text-[11px] font-bold text-slate-100 flex items-center gap-1 shadow-md">
                  <span>{player.nickname}</span>
                  {isCurrent && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>}
                </div>

                {/* HP Bar */}
                <div className="w-16 h-1.5 bg-slate-950 rounded-full border border-slate-700 overflow-hidden mt-1 shadow">
                  <div
                    className={`h-full transition-all ${
                      hpPercent > 50 ? 'bg-emerald-500' : hpPercent > 20 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${hpPercent}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
