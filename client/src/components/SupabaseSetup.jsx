import React, { useState } from 'react';
import { X, Database, CheckCircle, ExternalLink, Copy } from 'lucide-react';

export default function SupabaseSetup({ isConfigured, onSave, onClose }) {
  const [url, setUrl] = useState(localStorage.getItem('dnd_sb_url') || '');
  const [key, setKey] = useState(localStorage.getItem('dnd_sb_key') || '');

  const handleSave = () => {
    if (!url.includes('supabase.co') || key.length < 20) {
      alert('Вставь правильный URL и anon ключ из Supabase!');
      return;
    }
    onSave(url.trim(), key.trim());
  };

  const handleReset = () => {
    localStorage.removeItem('dnd_sb_url');
    localStorage.removeItem('dnd_sb_key');
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-400" />
            <h2 className="font-cinzel text-base font-bold text-amber-300">Настройка Мультиплеера</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isConfigured ? (
          <div className="p-4 bg-green-900/30 border border-green-500/40 rounded-xl flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-sm text-green-300 font-bold">Supabase подключён!</p>
              <p className="text-xs text-green-400/70 mt-0.5">Мультиплеер работает. Кенты могут заходить в одно лобби.</p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
            <p className="text-sm text-red-300 font-bold">Мультиплеер не настроен</p>
            <p className="text-xs text-red-400/70 mt-1">Без Supabase игроки не видят друг друга в лобби.</p>
          </div>
        )}

        {/* Step by step guide */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-amber-300 uppercase tracking-widest">Как настроить (2 минуты):</p>
          <ol className="space-y-2 text-xs text-slate-300">
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-600 text-slate-950 font-black flex items-center justify-center text-xs flex-shrink-0">1</span>
              <span>Зайди на <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-amber-400 underline inline-flex items-center gap-1">supabase.com <ExternalLink className="w-3 h-3" /></a> → Create a new project (бесплатно)</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-600 text-slate-950 font-black flex items-center justify-center text-xs flex-shrink-0">2</span>
              <span>В проекте: <strong className="text-slate-100">Project Settings → API</strong></span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-600 text-slate-950 font-black flex items-center justify-center text-xs flex-shrink-0">3</span>
              <span>Скопируй <strong className="text-slate-100">Project URL</strong> и <strong className="text-slate-100">anon public</strong> ключ сюда</span>
            </li>
          </ol>
        </div>

        {/* Input Fields */}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-amber-400 font-bold mb-1.5 uppercase tracking-wider">Project URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xxxxxxxxxxx.supabase.co"
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition-all font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] text-amber-400 font-bold mb-1.5 uppercase tracking-wider">anon public key</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition-all font-mono"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 text-slate-950 font-bold text-sm transition-all"
          >
            Сохранить и подключить
          </button>
          {isConfigured && (
            <button
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-red-900/50 text-slate-300 font-bold text-xs border border-slate-700 hover:border-red-500/50 transition-all"
            >
              Сбросить
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all">
            Отмена
          </button>
        </div>

        <p className="text-[10px] text-slate-500 text-center">
          Данные сохраняются только в твоём браузере. Supabase — бесплатно навсегда (Free tier).
        </p>
      </div>
    </div>
  );
}
