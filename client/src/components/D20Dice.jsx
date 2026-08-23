import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Dice5, Sparkles, AlertTriangle } from 'lucide-react';

function playDiceRollSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    for (let i = 0; i < 10; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = ['triangle', 'square', 'sine'][i % 3];
      osc.frequency.setValueAtTime(180 + Math.random() * 500, ctx.currentTime + i * 0.055);
      g.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.055);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.055 + 0.06);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.055);
      osc.stop(ctx.currentTime + i * 0.055 + 0.07);
    }
  } catch (_) {}
}

// The 6 standard D6-style faces for visual display, but with D20 values
const FACE_NUMBERS = [20, 1, 8, 13, 5, 17];

export default function D20Dice({ onRoll, lastRoll, isRolling, stats = {} }) {
  const [selectedStat, setSelectedStat] = useState('str');
  const [customMod, setCustomMod] = useState(0);
  const [localRolling, setLocalRolling] = useState(false);
  const [displayRoll, setDisplayRoll] = useState(20);

  // 3D rotation state
  const [rotX, setRotX] = useState(-20);
  const [rotY, setRotY] = useState(30);
  const animRef = useRef(null);
  const startTimeRef = useRef(null);
  const startRotRef = useRef({ x: -20, y: 30 });
  const targetRotRef = useRef({ x: -20, y: 30 });
  const idleRef = useRef(null);

  const computedStatMod = Math.floor(((stats[selectedStat] || 10) - 10) / 2);
  const totalModifier = computedStatMod + Number(customMod || 0);
  const rollingState = isRolling || localRolling;

  // Idle slow rotation
  useEffect(() => {
    let frame;
    let angle = 30;
    const idle = () => {
      if (!localRolling && !isRolling) {
        angle += 0.4;
        setRotX(-15 + Math.sin(angle * 0.008) * 12);
        setRotY(angle % 360);
      }
      frame = requestAnimationFrame(idle);
    };
    frame = requestAnimationFrame(idle);
    return () => cancelAnimationFrame(frame);
  }, [localRolling, isRolling]);

  const startRollAnimation = () => {
    const startX = rotX;
    const startY = rotY;
    const endX = startX + (Math.random() > 0.5 ? 1 : -1) * (720 + Math.random() * 360);
    const endY = startY + (Math.random() > 0.5 ? 1 : -1) * (1080 + Math.random() * 360);
    const duration = 1600;
    const start = performance.now();

    const animate = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // Ease out quintic
      const ease = 1 - Math.pow(1 - t, 5);

      setRotX(startX + (endX - startX) * ease);
      setRotY(startY + (endY - startY) * ease);

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  const handleRollClick = () => {
    if (rollingState) return;
    setLocalRolling(true);
    playDiceRollSound();

    // Flicker number
    let count = 0;
    const interval = setInterval(() => {
      setDisplayRoll(Math.floor(Math.random() * 20) + 1);
      count++;
      if (count >= 20) clearInterval(interval);
    }, 70);

    startRollAnimation();

    setTimeout(() => {
      setLocalRolling(false);
      const statNameMap = {
        str: 'Сила (STR)', dex: 'Ловкость (DEX)', con: 'Телосложение (CON)',
        int: 'Интеллект (INT)', wis: 'Мудрость (WIS)', cha: 'Харизма (CHA)'
      };
      onRoll({ modifier: totalModifier, statName: statNameMap[selectedStat] || 'D20 Check' });
    }, 1700);
  };

  useEffect(() => {
    if (lastRoll) {
      setDisplayRoll(lastRoll.rawRoll);
      if (lastRoll.isNat20) {
        confetti({ particleCount: 180, spread: 100, origin: { y: 0.6 } });
      }
    }
  }, [lastRoll]);

  const isNat20 = lastRoll?.isNat20 && !rollingState;
  const isNat1 = lastRoll?.isNat1 && !rollingState;

  // Face colors based on result
  const faceColor = isNat20
    ? { bg: 'from-yellow-400 to-amber-500', border: '#fbbf24', text: '#1c1917', shadow: '0 0 40px #f59e0b' }
    : isNat1
    ? { bg: 'from-red-900 to-rose-950', border: '#ef4444', text: '#fecaca', shadow: '0 0 40px #ef4444' }
    : { bg: 'from-slate-800 to-slate-950', border: '#f59e0b', text: '#fef08a', shadow: '0 0 20px rgba(245,158,11,0.3)' };

  const faceStyle = (n) => ({
    background: isNat20
      ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
      : isNat1
      ? 'linear-gradient(135deg, #450a0a, #9f1239)'
      : n === 1
      ? 'linear-gradient(135deg, #0f172a, #1e293b)'
      : 'linear-gradient(135deg, #1e293b, #0f172a)',
    border: `1.5px solid ${faceColor.border}44`,
    color: faceColor.text,
    fontSize: n === 0 ? '28px' : '16px',
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    width: '120px',
    height: '120px',
    backfaceVisibility: 'hidden',
    userSelect: 'none',
    fontFamily: 'Cinzel, serif',
    boxShadow: `inset 0 0 20px rgba(0,0,0,0.5), inset 0 0 5px ${faceColor.border}33`,
  });

  const sz = 60; // half of 120px cube

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-amber-500/30 p-4 shadow-xl backdrop-blur-md select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Dice5 className="w-5 h-5 text-amber-400" />
          <h3 className="font-cinzel text-sm font-bold text-amber-300">3D D20 Кубик</h3>
        </div>
        <span className="text-[10px] text-amber-400/80 font-mono">CSS 3D · Вращается</span>
      </div>

      {/* 3D Dice Scene */}
      <div
        className="cursor-pointer flex flex-col items-center justify-center mb-4"
        style={{ height: 180, perspective: '600px' }}
        onClick={handleRollClick}
      >
        <div
          style={{
            width: 120,
            height: 120,
            position: 'relative',
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
            transition: rollingState ? 'none' : 'transform 0.05s linear',
            filter: `drop-shadow(${faceColor.shadow})`,
          }}
        >
          {/* Front face — shows current roll */}
          <div style={{ ...faceStyle(0), transform: `translateZ(${sz}px)` }}>
            <div style={{ textAlign: 'center', lineHeight: 1 }}>
              <div style={{ fontSize: 38, fontWeight: 900, color: isNat20 ? '#1c1917' : '#fef08a' }}>
                {rollingState ? displayRoll : lastRoll ? lastRoll.rawRoll : 20}
              </div>
              <div style={{ fontSize: 10, color: isNat20 ? '#78350f' : '#f59e0b66', letterSpacing: 3, marginTop: 2 }}>D20</div>
            </div>
          </div>
          {/* Back */}
          <div style={{ ...faceStyle(1), transform: `rotateY(180deg) translateZ(${sz}px)` }}>1</div>
          {/* Right */}
          <div style={{ ...faceStyle(2), transform: `rotateY(90deg) translateZ(${sz}px)` }}>8</div>
          {/* Left */}
          <div style={{ ...faceStyle(3), transform: `rotateY(-90deg) translateZ(${sz}px)` }}>13</div>
          {/* Top */}
          <div style={{ ...faceStyle(4), transform: `rotateX(90deg) translateZ(${sz}px)` }}>5</div>
          {/* Bottom */}
          <div style={{ ...faceStyle(5), transform: `rotateX(-90deg) translateZ(${sz}px)` }}>17</div>
        </div>

        {/* Click hint */}
        <p className="text-[10px] text-amber-400/50 mt-2">
          {rollingState ? '⟳ Вращается...' : '← Нажмите для броска →'}
        </p>
      </div>

      {/* Roll Result Banner */}
      {lastRoll && !rollingState && (
        <div className={`mb-4 p-3 rounded-xl text-center border ${isNat20 ? 'bg-amber-500/20 border-amber-400' : isNat1 ? 'bg-red-950/50 border-red-500' : 'bg-slate-950 border-amber-500/30'}`}>
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-200">
            <span>{lastRoll.playerNickname}:</span>
            <span className="font-mono text-amber-400">
              {lastRoll.rawRoll} {lastRoll.modifier >= 0 ? `+${lastRoll.modifier}` : lastRoll.modifier} ={' '}
              <strong className="text-yellow-300 text-sm">{lastRoll.totalRoll}</strong>
            </span>
          </div>
          {isNat20 && (
            <div className="mt-1 flex items-center justify-center gap-1 text-xs text-amber-400 font-bold">
              <Sparkles className="w-3.5 h-3.5" /> КРИТИЧЕСКИЙ УСПЕХ! (Nat 20)
            </div>
          )}
          {isNat1 && (
            <div className="mt-1 flex items-center justify-center gap-1 text-xs text-red-400 font-bold">
              <AlertTriangle className="w-3.5 h-3.5" /> КРИТИЧЕСКИЙ ПРОВАЛ! (Nat 1)
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Навык:</label>
            <select
              value={selectedStat}
              onChange={(e) => setSelectedStat(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
            >
              <option value="str">💪 Сила</option>
              <option value="dex">🏃 Ловкость</option>
              <option value="con">🛡️ Телосложение</option>
              <option value="int">📚 Интеллект</option>
              <option value="wis">👁️ Мудрость</option>
              <option value="cha">🪕 Харизма</option>
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

        <button
          onClick={handleRollClick}
          disabled={rollingState}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:brightness-110 text-slate-950 font-black font-cinzel text-sm shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
        >
          <Dice5 className={`w-5 h-5 ${rollingState ? 'animate-spin' : ''}`} />
          <span>{rollingState ? 'Бросок...' : `БРОСИТЬ D20 (${totalModifier >= 0 ? '+' : ''}${totalModifier})`}</span>
        </button>
      </div>
    </div>
  );
}
