import React, { useState } from 'react';
import { X, Upload, User, Shield, Heart, Zap, Award, Sparkles, Check, Key, Cpu } from 'lucide-react';

const PRESET_AVATARS = [
  { id: 'preset_knight', label: 'Рыцарь', icon: '⚔️', bg: 'from-amber-600 to-red-600' },
  { id: 'preset_wizard', label: 'Волшебник', icon: '🔮', bg: 'from-purple-600 to-indigo-600' },
  { id: 'preset_rogue', label: 'Плут', icon: '🗡️', bg: 'from-slate-700 to-zinc-900' },
  { id: 'preset_cleric', label: 'Жрец', icon: '✨', bg: 'from-yellow-500 to-amber-600' },
  { id: 'preset_barbarian', label: 'Варвар', icon: '🪓', bg: 'from-red-600 to-orange-700' },
  { id: 'preset_bard', label: 'Бард', icon: '🪕', bg: 'from-emerald-600 to-teal-700' },
  { id: 'preset_ranger', label: 'Следопыт', icon: '🏹', bg: 'from-green-700 to-emerald-800' },
  { id: 'preset_warlock', label: 'Чернокнижник', icon: '👁️', bg: 'from-violet-900 to-fuchsia-950' }
];

export default function ProfileModal({ currentPlayer, room, onSave, onClose }) {
  const [nickname, setNickname] = useState(currentPlayer?.nickname || '');
  const [characterClass, setCharacterClass] = useState(currentPlayer?.characterClass || 'Воин (Warrior)');
  const [avatar, setAvatar] = useState(currentPlayer?.avatar || 'preset_knight');
  const [hp, setHp] = useState(currentPlayer?.hp || 12);
  const [maxHp, setMaxHp] = useState(currentPlayer?.maxHp || 12);
  const [ac, setAc] = useState(currentPlayer?.ac || 15);
  const [stats, setStats] = useState(currentPlayer?.stats || { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 8 });

  // Custom AI Settings (Host configuration)
  const [aiProvider, setAiProvider] = useState(room?.aiSettings?.provider || 'pollinations');
  const [aiApiKey, setAiApiKey] = useState(room?.aiSettings?.apiKey || '');
  const [aiModel, setAiModel] = useState(room?.aiSettings?.model || 'meta-llama/llama-3.3-70b-instruct:free');

  // Handle custom image file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Размер файла не должен превышать 5 МБ');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result); // Data URL base64 image
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    onSave({
      nickname,
      characterClass,
      avatar,
      hp: Number(hp),
      maxHp: Number(maxHp),
      ac: Number(ac),
      stats,
      aiSettings: {
        provider: aiProvider,
        apiKey: aiApiKey,
        model: aiModel
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-2xl glass-panel rounded-2xl p-6 border border-amber-500/40 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-500/20 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-amber-400" />
            <h2 className="font-cinzel text-xl font-bold text-amber-300">Настройки Профиля и ИИ</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Avatar Upload & Presets Section */}
          <div>
            <label className="block text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
              Аватар Персонажа
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-900/60 p-4 rounded-xl border border-slate-800 mb-4">
              {/* Active Avatar Preview */}
              <div className="flex flex-col items-center gap-2">
                {avatar.startsWith('data:') ? (
                  <img src={avatar} alt="Custom Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-amber-400 shadow-lg shadow-amber-500/20" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 border-2 border-amber-300 flex items-center justify-center text-3xl shadow-lg shadow-amber-500/20">
                    {PRESET_AVATARS.find(p => p.id === avatar)?.icon || '⚔️'}
                  </div>
                )}
                <span className="text-[11px] text-slate-400">Текущий аватар</span>
              </div>

              {/* Upload Custom File */}
              <div className="flex-1 w-full">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-amber-500/30 hover:border-amber-400 rounded-xl p-3 cursor-pointer bg-slate-950/60 transition-all">
                  <Upload className="w-5 h-5 text-amber-400 mb-1" />
                  <span className="text-xs text-amber-300 font-medium">Загрузить свое фото/картинку</span>
                  <span className="text-[10px] text-slate-500">PNG, JPG или GIF (до 5 МБ)</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {PRESET_AVATARS.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  onClick={() => setAvatar(preset.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                    avatar === preset.id
                      ? 'border-amber-400 bg-amber-500/20 scale-105 shadow-md shadow-amber-500/20'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <span className="text-xl mb-1">{preset.icon}</span>
                  <span className="text-[10px] text-slate-300 truncate w-full text-center">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Basic Profile Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1.5">
                Имя Игрока / Никнейм
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wider mb-1.5">
                Класс Персонажа
              </label>
              <input
                type="text"
                value={characterClass}
                onChange={(e) => setCharacterClass(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Combat & Health Stats */}
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-400" />
              <span>Здоровье (HP) и Защита (AC)</span>
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Текущее HP</label>
                <input
                  type="number"
                  value={hp}
                  onChange={(e) => setHp(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-center text-sm font-bold text-green-400"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Макс HP</label>
                <input
                  type="number"
                  value={maxHp}
                  onChange={(e) => setMaxHp(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-center text-sm font-bold text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Класс Брони (AC)</label>
                <input
                  type="number"
                  value={ac}
                  onChange={(e) => setAc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-center text-sm font-bold text-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Character Attribute Modifiers (STR, DEX, CON, INT, WIS, CHA) */}
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Характеристики D&D 5e</span>
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { key: 'str', label: 'Сила (STR)' },
                { key: 'dex', label: 'Ловк (DEX)' },
                { key: 'con', label: 'Тел (CON)' },
                { key: 'int', label: 'Инт (INT)' },
                { key: 'wis', label: 'Мудр (WIS)' },
                { key: 'cha', label: 'Хар (CHA)' }
              ].map(({ key, label }) => {
                const val = stats[key] || 10;
                const mod = Math.floor((val - 10) / 2);
                return (
                  <div key={key} className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
                    <label className="block text-[10px] text-slate-400 font-semibold mb-1">{label}</label>
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => setStats({ ...stats, [key]: Number(e.target.value) })}
                      className="w-full bg-slate-900 text-center text-sm font-bold text-amber-300 rounded border border-slate-700 focus:outline-none"
                    />
                    <div className="text-[10px] text-amber-400 font-mono mt-1">
                      {mod >= 0 ? `+${mod}` : mod}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI DM Provider Settings */}
          {currentPlayer?.isHost && (
            <div className="bg-slate-900/80 p-4 rounded-xl border border-amber-500/30">
              <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-400" />
                <span>Настройки Ведущего ИИ (AI Dungeon Master)</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Провайдер ИИ:</label>
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                  >
                    <option value="pollinations">🟢 Pollinations AI (Бесплатно, без API ключа)</option>
                    <option value="openrouter">⚡ OpenRouter (Бесплатные модели Llama 3.3 / Gemini)</option>
                  </select>
                </div>

                {aiProvider === 'openrouter' && (
                  <div>
                    <label className="block text-xs text-slate-300 mb-1 flex items-center gap-1">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span>OpenRouter API Key (необязательно для free моделей):</span>
                    </label>
                    <input
                      type="password"
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      placeholder="sk-or-v1-..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20"
            >
              Сохранить Профиль
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
