import React, { useState } from 'react';
import { X, Scroll, Heart, Shield, Zap, Plus, Minus, Backpack, Sword } from 'lucide-react';

export default function CharacterPanel({ player, onUpdateHp, onClose }) {
  const [newItem, setNewItem] = useState('');
  const [inventory, setInventory] = useState([
    'Зелье лечения (2d4 + 2)',
    'Двуручный меч +1',
    'Факел (3 шт)',
    'Веревка пеньковая (15м)'
  ]);

  if (!player) return null;

  const stats = player.stats || { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    setInventory([...inventory, newItem.trim()]);
    setNewItem('');
  };

  const handleRemoveItem = (index) => {
    setInventory(inventory.filter((_, idx) => idx !== index));
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-950/95 border-l border-amber-500/30 p-6 shadow-2xl backdrop-blur-md overflow-y-auto">
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <Scroll className="w-6 h-6 text-amber-400" />
          <div>
            <h2 className="font-cinzel text-lg font-bold text-amber-300">{player.nickname}</h2>
            <p className="text-xs text-slate-400">{player.characterClass || 'Персонаж D&D 5e'}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* HP & Armor Class Card */}
      <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            <span className="text-xs font-bold text-slate-200">Здоровье (HP):</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdateHp && onUpdateHp(Math.max(0, player.hp - 1))}
              className="p-1 bg-red-950 hover:bg-red-900 text-red-300 rounded border border-red-800"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-sm font-bold text-amber-300">
              {player.hp} / {player.maxHp}
            </span>
            <button
              onClick={() => onUpdateHp && onUpdateHp(Math.min(player.maxHp, player.hp + 1))}
              className="p-1 bg-green-950 hover:bg-green-900 text-green-300 rounded border border-green-800"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 pt-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-bold text-slate-200">Класс Брони (AC):</span>
          </div>
          <span className="font-mono text-sm font-bold text-amber-400">{player.ac || 15}</span>
        </div>
      </div>

      {/* Stats Breakdown */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Характеристики (Stats)</span>
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'str', label: 'Сила (STR)' },
            { key: 'dex', label: 'Ловкость (DEX)' },
            { key: 'con', label: 'Телосложение (CON)' },
            { key: 'int', label: 'Интеллект (INT)' },
            { key: 'wis', label: 'Мудрость (WIS)' },
            { key: 'cha', label: 'Харизма (CHA)' }
          ].map(({ key, label }) => {
            const val = stats[key] || 10;
            const mod = Math.floor((val - 10) / 2);
            return (
              <div key={key} className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-300">{label}</span>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-100">{val}</div>
                  <div className="text-[10px] text-amber-400 font-mono">{mod >= 0 ? `+${mod}` : mod}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inventory & Items */}
      <div>
        <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Backpack className="w-4 h-4 text-amber-400" />
          <span>Инвентарь и Предметы</span>
        </h3>

        <form onSubmit={handleAddItem} className="flex gap-2 mb-3">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Добавить предмет..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs"
          >
            +
          </button>
        </form>

        <div className="space-y-2">
          {inventory.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between bg-slate-900/40 p-2.5 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-300">📦 {item}</span>
              <button
                onClick={() => handleRemoveItem(idx)}
                className="text-slate-500 hover:text-red-400"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
