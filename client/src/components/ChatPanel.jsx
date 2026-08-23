import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Dice5, Sparkles, Loader2, Compass, AlertCircle } from 'lucide-react';

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

export default function ChatPanel({ gameLog = [], isAiThinking, onSendAction, onRollCheck }) {
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameLog, isAiThinking]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendAction(inputText.trim());
    setInputText('');
  };

  const handleSuggestedClick = (actionText) => {
    onSendAction(actionText);
  };

  return (
    <div className="flex flex-col h-[500px] lg:h-[580px] bg-slate-900/90 rounded-2xl border border-amber-500/30 overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Panel Header */}
      <div className="px-4 py-3 bg-slate-950/90 border-b border-amber-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-amber-400" />
          <h3 className="font-cinzel text-sm font-bold text-amber-300">Повествование ИИ-Мастера</h3>
        </div>
        {isAiThinking && (
          <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            <span>Мастер думает...</span>
          </div>
        )}
      </div>

      {/* Game Log Messages List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {gameLog.map((log) => {
          // AI DM Message
          if (log.isAi) {
            return (
              <div key={log.id} className="bg-slate-950/80 p-4 rounded-xl border border-amber-500/30 shadow-md space-y-3">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                  <div className="flex items-center gap-2 text-amber-400 font-cinzel font-bold text-xs">
                    <Bot className="w-4 h-4" />
                    <span>AI Dungeon Master</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                </div>

                <p className="text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-line">
                  {log.text}
                </p>

                {/* Check Required Highlight */}
                {log.checkRequired && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-amber-300">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span>
                        Требуется проверка: <strong>{log.checkRequired.skill || log.checkRequired.description}</strong> (DC {log.checkRequired.dc})
                      </span>
                    </div>
                    <button
                      onClick={() => onRollCheck && onRollCheck(log.checkRequired)}
                      className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow"
                    >
                      <Dice5 className="w-3.5 h-3.5" />
                      <span>Бросить D20</span>
                    </button>
                  </div>
                )}

                {/* Suggested Action Options */}
                {log.suggestedActions && log.suggestedActions.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <div className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5" />
                      <span>Варианты действий:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {log.suggestedActions.map((act, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestedClick(act)}
                          className="text-xs bg-slate-900 hover:bg-amber-500/20 text-slate-300 hover:text-amber-200 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-amber-500/50 transition-all text-left"
                        >
                          👉 {act}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // Dice Roll Message
          if (log.isRoll) {
            return (
              <div key={log.id} className="bg-slate-950/60 p-3 rounded-xl border border-amber-500/20 text-center">
                <div className="text-xs text-amber-300 font-mono">
                  🎲 <strong>{log.rollData?.playerNickname || log.sender}:</strong> {log.text}
                </div>
              </div>
            );
          }

          // System Message
          if (log.isSystem) {
            return (
              <div key={log.id} className="text-center my-2 text-xs text-slate-500 font-mono">
                — {log.text} —
              </div>
            );
          }

          // Player Message
          return (
            <div key={log.id} className="flex gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
              {/* Player Avatar */}
              {log.avatar?.startsWith('data:') ? (
                <img src={log.avatar} alt={log.sender} className="w-8 h-8 rounded-full object-cover border border-amber-400" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-amber-500/40 flex items-center justify-center font-bold text-sm text-amber-300">
                  {PRESET_ICONS[log.avatar] || log.sender.substring(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-amber-400">{log.sender}</span>
                  <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                </div>
                <p className="text-xs text-slate-200">{log.text}</p>
              </div>
            </div>
          );
        })}

        <div ref={chatEndRef} />
      </div>

      {/* Input Action Form */}
      <form onSubmit={handleSubmit} className="p-3 bg-slate-950 border-t border-amber-500/20 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Опишите действие вашего персонажа или задайте вопрос Мастеру..."
          disabled={isAiThinking}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-all"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isAiThinking}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Отправить</span>
        </button>
      </form>
    </div>
  );
}
