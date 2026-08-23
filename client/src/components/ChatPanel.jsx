import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, Dice5, Sparkles, Loader2, Compass, AlertCircle } from 'lucide-react';

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

function PlayerAvatar({ avatar, sender }) {
  if (avatar?.startsWith('data:')) {
    return <img src={avatar} alt={sender} className="w-8 h-8 rounded-full object-cover border-2 border-amber-400 flex-shrink-0" />;
  }
  if (avatar && PRESET_ICONS[avatar]) {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-amber-500/60 flex items-center justify-center text-base flex-shrink-0">
        {PRESET_ICONS[avatar]}
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-700 to-amber-900 border-2 border-amber-500/60 flex items-center justify-center font-bold text-sm text-amber-200 flex-shrink-0">
      {(sender || '?').charAt(0).toUpperCase()}
    </div>
  );
}

export default function ChatPanel({ gameLog = [], isAiThinking, onSendAction, onRollCheck }) {
  const [inputText, setInputText] = useState('');
  const chatScrollRef = useRef(null);
  const lastLogLength = useRef(0);
  const isUserScrolling = useRef(false);

  // Only auto-scroll when a NEW message arrives (not when user types)
  useEffect(() => {
    if (gameLog.length > lastLogLength.current) {
      lastLogLength.current = gameLog.length;
      // Only scroll if user hasn't manually scrolled up
      if (!isUserScrolling.current) {
        requestAnimationFrame(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
          }
        });
      }
    }
  }, [gameLog]);

  // Detect manual scroll
  const handleScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrolling.current = distFromBottom > 80;
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    isUserScrolling.current = false; // Reset so we scroll down on new AI message
    onSendAction(inputText.trim());
    setInputText('');
  };

  const handleSuggestedClick = (actionText) => {
    isUserScrolling.current = false;
    onSendAction(actionText);
  };

  return (
    <div className="flex flex-col h-[500px] lg:h-[600px] bg-slate-900/90 rounded-2xl border border-amber-500/30 overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Panel Header */}
      <div className="px-4 py-3 bg-slate-950/90 border-b border-amber-500/20 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-amber-400" />
          <h3 className="font-cinzel text-sm font-bold text-amber-300">Повествование ИИ-Мастера</h3>
        </div>
        {isAiThinking && (
          <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Мастер думает...</span>
          </div>
        )}
      </div>

      {/* Game Log Messages */}
      <div
        ref={chatScrollRef}
        onScroll={handleScroll}
        className="flex-1 p-4 overflow-y-auto space-y-4"
        style={{ overscrollBehavior: 'contain' }}
      >
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

                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                  {log.text}
                </p>

                {log.checkRequired && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-amber-300 min-w-0">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="truncate">
                        Проверка: <strong>{log.checkRequired.skill}</strong> (DC {log.checkRequired.dc})
                      </span>
                    </div>
                    <button
                      onClick={() => onRollCheck && onRollCheck(log.checkRequired)}
                      className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow flex-shrink-0"
                    >
                      <Dice5 className="w-3.5 h-3.5" />
                      <span>D20</span>
                    </button>
                  </div>
                )}

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
              <PlayerAvatar avatar={log.avatar} sender={log.sender} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-amber-400 truncate">{log.sender}</span>
                  <span className="text-[10px] text-slate-500 flex-shrink-0 ml-2">{log.timestamp}</span>
                </div>
                <p className="text-xs text-slate-200 break-words">{log.text}</p>
              </div>
            </div>
          );
        })}

        {isAiThinking && (
          <div className="bg-slate-950/60 p-3 rounded-xl border border-amber-500/20 flex items-center gap-2">
            <Bot className="w-4 h-4 text-amber-400 animate-pulse" />
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input Action Form */}
      <form onSubmit={handleSubmit} className="p-3 bg-slate-950 border-t border-amber-500/20 flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Опишите действие персонажа..."
          disabled={isAiThinking}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-all"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isAiThinking}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition-all"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Отправить</span>
        </button>
      </form>
    </div>
  );
}
