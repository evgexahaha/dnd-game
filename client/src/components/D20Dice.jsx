import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Dice5, Sparkles, AlertTriangle } from 'lucide-react';

/**
 * Web Audio API Dice Rolling Sound Synthesizer
 */
function playDiceRollSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    for (let i = 0; i < 7; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(180 + Math.random() * 320, ctx.currentTime + i * 0.07);

      gain.gain.setValueAtTime(0.35, ctx.currentTime + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.07 + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + i * 0.07);
      osc.stop(ctx.currentTime + i * 0.07 + 0.07);
    }
  } catch (e) {
    // Silent fallback if audio context blocked
  }
}

export default function D20Dice({ onRoll, lastRoll, isRolling, stats = {} }) {
  const [selectedStat, setSelectedStat] = useState('str');
  const [customMod, setCustomMod] = useState(0);
  const [displayRoll, setDisplayRoll] = useState(20);
  const [localRolling, setLocalRolling] = useState(false);

  const computedStatMod = Math.floor(((stats[selectedStat] || 10) - 10) / 2);
  const totalModifier = computedStatMod + Number(customMod || 0);

  const handleRollClick = () => {
    if (isRolling || localRolling) return;

    setLocalRolling(true);
    playDiceRollSound();

    let count = 0;
    const interval = setInterval(() => {
      setDisplayRoll(Math.floor(Math.random() * 20) + 1);
      count++;
      if (count >= 18) {
        clearInterval(interval);
      }
    }, 70);

    setTimeout(() => {
      setLocalRolling(false);
      const statNameMap = {
        str: 'Сила (STR)',
        dex: 'Ловкость (DEX)',
        con: 'Телосложение (CON)',
        int: 'Интеллект (INT)',
        wis: 'Мудрость (WIS)',
        cha: 'Харизма (CHA)'
      };
      onRoll({
        modifier: totalModifier,
        statName: statNameMap[selectedStat] || 'D20 Check'
      });
    }, 1800);
  };

  useEffect(() => {
    if (lastRoll?.isNat20) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  }, [lastRoll]);

  const rollingState = isRolling || localRolling;

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-amber-500/30 p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Dice5 className="w-5 h-5 text-amber-400" />
          <h3 className="font-cinzel text-sm font-bold text-amber-300">Бросок 3D Кубика D20</h3>
        </div>
        <span className="text-[10px] text-amber-400/80 font-mono">20-гранный кубик</span>
      </div>

      {/* 3D Polyhedron Tumbling Dice Container */}
      <div className="my-6 text-center">
        <div className="dice-container-3d cursor-pointer" onClick={handleRollClick}>
          <div className={`dice-3d-wrapper ${rollingState ? 'rolling' : ''}`}>
            <div
              className={`w-32 h-32 mx-auto d20-facet transition-all flex flex-col items-center justify-center relative border-2 ${
                lastRoll?.isNat20
                  ? 'from-amber-500 via-yellow-300 to-amber-600 border-yellow-200 shadow-amber-500/80 gold-glow scale-110'
                  : lastRoll?.isNat1
                  ? 'from-red-950 via-rose-900 to-red-900 border-red-500 shadow-red-600/60'
                  : 'from-slate-900 via-slate-800 to-amber-950/90 border-amber-500/60 shadow-amber-500/30'
              }`}
              style={{
                background: lastRoll?.isNat20
                  ? 'linear-gradient(135deg, #f59e0b, #fef08a, #d97706)'
                  : lastRoll?.isNat1
                  ? 'linear-gradient(135deg, #450a0a, #881337, #9f1239)'
                  : 'linear-gradient(135deg, #0f172a, #1e293b, #451a03)'
              }}
            >
              <span className="text-4xl font-black font-cinzel text-amber-200 drop-shadow-lg">
                {rollingState ? displayRoll : lastRoll ? lastRoll.rawRoll : 20}
              </span>
              <span className="text-[9px] uppercase font-bold tracking-widest text-amber-400/90 mt-0.5">
                D20
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Roll Results Banner */}
      {lastRoll && !rollingState && (
        <div className="mb-4 p-3 rounded-xl bg-slate-950 border border-amber-500/30 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-200">
            <span>{lastRoll.playerNickname}:</span>
            <span className="text-amber-400 font-mono">
              {lastRoll.rawRoll} {lastRoll.modifier >= 0 ? `+ ${lastRoll.modifier}` : `- ${Math.abs(lastRoll.modifier)}`} ={' '}
              <strong className="text-sm text-yellow-300">{lastRoll.totalRoll}</strong>
            </span>
          </div>

          {lastRoll.isNat20 && (
            <div className="mt-1 flex items-center justify-center gap-1 text-xs text-amber-400 font-bold gold-text-glow">
              <Sparkles className="w-3.5 h-3.5" />
              <span>КРИТИЧЕСКИЙ УСПЕХ! (Nat 20)</span>
            </div>
          )}

          {lastRoll.isNat1 && (
            <div className="mt-1 flex items-center justify-center gap-1 text-xs text-red-400 font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>КРИТИЧЕСКИЙ ПРОВАЛ! (Nat 1)</span>
            </div>
          )}
        </div>
      )}

      {/* Modifier Selector */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Проверка навыка:</label>
            <select
              value={selectedStat}
              onChange={(e) => setSelectedStat(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
            >
              <option value="str">💪 Сила (STR)</option>
              <option value="dex">🏃 Ловкость (DEX)</option>
              <option value="con">🛡️ Телосложение (CON)</option>
              <option value="int">📚 Интеллект (INT)</option>
              <option value="wis">👁️ Мудрость (WIS)</option>
              <option value="cha">🪕 Харизма (CHA)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Доп. мод:</label>
            <input
              type="number"
              value={customMod}
              onChange={(e) => setCustomMod(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center text-amber-300 font-bold"
            />
          </div>
        </div>

        {/* Big Roll Button */}
        <button
          onClick={handleRollClick}
          disabled={rollingState}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-black font-cinzel text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          <Dice5 className={`w-5 h-5 ${rollingState ? 'animate-spin' : ''}`} />
          <span>{rollingState ? 'Кубик вращается в 3D...' : `БРОСИТЬ D20 (${totalModifier >= 0 ? '+' : ''}${totalModifier})`}</span>
        </button>
      </div>
    </div>
  );
}
