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
      g.gain.setValueAtTime(0.28, ctx.currentTime + i * 0.055);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.055 + 0.06);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.055);
      osc.stop(ctx.currentTime + i * 0.055 + 0.07);
    }
  } catch (_) {}
}

/**
 * D20 Icosahedron rendered as SVG top-down view with 3D rotating canvas animation.
 * Uses canvas-based icosahedron projection for real 3D look.
 */
function drawIcosahedron(canvas, rotX, rotY, roll, isNat20, isNat1) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) * 0.38;

  ctx.clearRect(0, 0, W, H);

  // Icosahedron vertices (unit sphere)
  const phi = (1 + Math.sqrt(5)) / 2;
  const verts = [
    [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
    [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1]
  ].map(v => {
    const len = Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2);
    return [v[0]/len, v[1]/len, v[2]/len];
  });

  // 20 triangular faces of icosahedron
  const faces = [
    [0,1,8],[0,8,4],[0,4,5],[0,5,9],[0,9,1],
    [1,6,8],[8,6,10],[8,10,4],[4,10,2],[4,2,5],
    [5,2,11],[5,11,9],[9,11,7],[9,7,1],[1,7,6],
    [3,6,7],[3,7,11],[3,11,2],[3,2,10],[3,10,6]
  ];

  // 3D Rotation matrices
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

  const rotate = ([x, y, z]) => {
    // Rotate around Y
    let nx = x * cosY + z * sinY;
    let ny = y;
    let nz = -x * sinY + z * cosY;
    // Rotate around X
    let fx = nx;
    let fy = ny * cosX - nz * sinX;
    let fz = ny * sinX + nz * cosX;
    return [fx, fy, fz];
  };

  // Project 3D → 2D (simple perspective)
  const project = ([x, y, z]) => {
    const fov = 2.8;
    const d = fov - z;
    return [cx + (x * R * fov) / d, cy - (y * R * fov) / d, z];
  };

  // Compute rotated vertices + their projections
  const rotVerts = verts.map(v => rotate(v));
  const projVerts = rotVerts.map(v => project(v));

  // Sort faces back-to-front (painter's algorithm)
  const faceDepths = faces.map((f, i) => {
    const z = (rotVerts[f[0]][2] + rotVerts[f[1]][2] + rotVerts[f[2]][2]) / 3;
    return { i, z };
  }).sort((a, b) => a.z - b.z);

  // Color palette for faces
  const faceColors = [
    '#0f172a','#1e293b','#162032','#0d1b2a','#13253a',
    '#1a2d40','#0a1628','#172236','#0e1e30','#162d40',
    '#1b3050','#0f2035','#1a2840','#112035','#162540',
    '#1e3045','#0a1e30','#18293c','#0d2035','#152840'
  ];

  // Draw faces
  faceDepths.forEach(({ i, z }) => {
    const f = faces[i];
    const [ax, ay] = projVerts[f[0]];
    const [bx, by] = projVerts[f[1]];
    const [cx2, cy2] = projVerts[f[2]];

    // Back-face culling — compute normal Z
    const ex = bx - ax, ey = by - ay;
    const fx2 = cx2 - ax, fy2 = cy2 - ay;
    const nz = ex * fy2 - ey * fx2;
    if (nz < 0) return; // back face

    const brightness = Math.max(0, Math.min(1, (z + 1) / 2));
    const isTop = i === 0; // front-most face shows the number

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx2, cy2);
    ctx.closePath();

    // Fill color
    let fillColor;
    if (isNat20) {
      fillColor = `rgba(${Math.round(180 + brightness * 75)}, ${Math.round(120 + brightness * 80)}, 0, 1)`;
    } else if (isNat1) {
      fillColor = `rgba(${Math.round(80 + brightness * 60)}, 0, 0, 1)`;
    } else {
      const b = Math.round(15 + brightness * 45);
      const g = Math.round(20 + brightness * 55);
      fillColor = `rgb(${b}, ${g}, ${Math.round(b * 2.5)})`;
    }
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Edge lines
    ctx.strokeStyle = isNat20 ? `rgba(255, 200, 0, ${0.3 + brightness * 0.5})`
      : isNat1 ? `rgba(255,50,50,${0.3 + brightness * 0.4})`
      : `rgba(245, 158, 11, ${0.15 + brightness * 0.45})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  });

  // Find top face and draw number
  const topFace = faceDepths[faceDepths.length - 1];
  const f = faces[topFace.i];
  const [ax, ay] = projVerts[f[0]];
  const [bx, by] = projVerts[f[1]];
  const [cx2, cy2] = projVerts[f[2]];
  const faceCx = (ax + bx + cx2) / 3;
  const faceCy = (ay + by + cy2) / 3;

  // Compute back-face for top
  const ex = bx - ax, ey = by - ay;
  const fx2 = cx2 - ax, fy2 = cy2 - ay;
  const topNz = ex * fy2 - ey * fx2;

  if (topNz >= 0) {
    // Glow halo on top face
    const grd = ctx.createRadialGradient(faceCx, faceCy, 0, faceCx, faceCy, R * 0.55);
    if (isNat20) {
      grd.addColorStop(0, 'rgba(255,220,50,0.55)');
      grd.addColorStop(1, 'rgba(255,150,0,0)');
    } else if (isNat1) {
      grd.addColorStop(0, 'rgba(255,30,30,0.45)');
      grd.addColorStop(1, 'rgba(120,0,0,0)');
    } else {
      grd.addColorStop(0, 'rgba(245,158,11,0.18)');
      grd.addColorStop(1, 'rgba(245,158,11,0)');
    }
    ctx.beginPath();
    ctx.arc(faceCx, faceCy, R * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Number text
    const numStr = String(roll);
    const fontSize = R * 0.45;
    ctx.font = `900 ${fontSize}px Cinzel, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = isNat20 ? '#fff' : isNat1 ? '#ff3333' : '#f59e0b';
    ctx.shadowBlur = 14;
    ctx.fillStyle = isNat20 ? '#1c1917' : isNat1 ? '#fecaca' : '#fef08a';
    ctx.fillText(numStr, faceCx, faceCy);
    ctx.shadowBlur = 0;

    // D20 label
    ctx.font = `bold ${R * 0.18}px Cinzel, serif`;
    ctx.fillStyle = isNat20 ? '#78350f88' : '#f59e0b55';
    ctx.fillText('D20', faceCx, faceCy + fontSize * 0.75);
  }

  // Outer glow ring
  const grad = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.2);
  if (isNat20) {
    grad.addColorStop(0, 'rgba(245,158,11,0.5)');
    grad.addColorStop(1, 'rgba(245,158,11,0)');
  } else if (isNat1) {
    grad.addColorStop(0, 'rgba(239,68,68,0.5)');
    grad.addColorStop(1, 'rgba(239,68,68,0)');
  } else {
    grad.addColorStop(0, 'rgba(245,158,11,0.18)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
  }
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.15, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

export default function D20Dice({ onRoll, lastRoll, isRolling, stats = {} }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const rotRef = useRef({ x: 0.5, y: 0.3 });
  const velRef = useRef({ x: 0.004, y: 0.007 });
  const [selectedStat, setSelectedStat] = useState('str');
  const [customMod, setCustomMod] = useState(0);
  const [localRolling, setLocalRolling] = useState(false);
  const [displayRoll, setDisplayRoll] = useState(20);

  const computedStatMod = Math.floor(((stats[selectedStat] || 10) - 10) / 2);
  const totalModifier = computedStatMod + Number(customMod || 0);
  const rollingState = isRolling || localRolling;

  const currentRoll = rollingState ? displayRoll : (lastRoll?.rawRoll ?? 20);
  const isNat20 = !!lastRoll?.isNat20 && !rollingState;
  const isNat1 = !!lastRoll?.isNat1 && !rollingState;

  // Animation loop
  useEffect(() => {
    let frame;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const loop = () => {
      rotRef.current.x += velRef.current.x;
      rotRef.current.y += velRef.current.y;
      drawIcosahedron(canvas, rotRef.current.x, rotRef.current.y, currentRoll, isNat20, isNat1);
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    animRef.current = frame;
    return () => cancelAnimationFrame(frame);
  }, [currentRoll, isNat20, isNat1]);

  const handleRollClick = () => {
    if (rollingState) return;
    setLocalRolling(true);
    playDiceRollSound();

    // Fast spin velocity on click
    velRef.current = {
      x: (Math.random() > 0.5 ? 1 : -1) * (0.08 + Math.random() * 0.08),
      y: (Math.random() > 0.5 ? 1 : -1) * (0.10 + Math.random() * 0.10)
    };

    // Flicker number
    let count = 0;
    const interval = setInterval(() => {
      setDisplayRoll(Math.floor(Math.random() * 20) + 1);
      count++;
      if (count >= 22) clearInterval(interval);
    }, 65);

    // Slow back down over 1.6s
    const startTime = Date.now();
    const startVel = { ...velRef.current };
    const decel = () => {
      const t = Math.min(1, (Date.now() - startTime) / 1600);
      const ease = 1 - Math.pow(1 - t, 3);
      velRef.current = {
        x: startVel.x * (1 - ease) + 0.004 * ease,
        y: startVel.y * (1 - ease) + 0.007 * ease,
      };
      if (t < 1) requestAnimationFrame(decel);
    };
    requestAnimationFrame(decel);

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
      if (lastRoll.isNat20) confetti({ particleCount: 180, spread: 100, origin: { y: 0.6 } });
    }
  }, [lastRoll]);

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-amber-500/30 p-4 shadow-xl backdrop-blur-md select-none">
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Dice5 className="w-5 h-5 text-amber-400" />
          <h3 className="font-cinzel text-sm font-bold text-amber-300">3D Икосаэдр D20</h3>
        </div>
        <span className="text-[10px] text-amber-400/80 font-mono">20 граней · WebGL Canvas</span>
      </div>

      {/* 3D Canvas */}
      <div className="flex flex-col items-center cursor-pointer" onClick={handleRollClick}>
        <canvas
          ref={canvasRef}
          width={220}
          height={220}
          className="rounded-xl"
          style={{ imageRendering: 'pixelated' }}
        />
        <p className="text-[10px] text-amber-400/50 mt-1">
          {rollingState ? '⟳ Вращается...' : '← Нажмите для броска →'}
        </p>
      </div>

      {/* Roll Result */}
      {lastRoll && !rollingState && (
        <div className={`my-3 p-3 rounded-xl text-center border ${isNat20 ? 'bg-amber-500/20 border-amber-400' : isNat1 ? 'bg-red-950/50 border-red-500' : 'bg-slate-950 border-amber-500/30'}`}>
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-200">
            <span>{lastRoll.playerNickname}:</span>
            <span className="font-mono text-amber-400">
              {lastRoll.rawRoll} {lastRoll.modifier >= 0 ? `+${lastRoll.modifier}` : lastRoll.modifier} ={' '}
              <strong className="text-yellow-300 text-sm">{lastRoll.totalRoll}</strong>
            </span>
          </div>
          {isNat20 && <div className="mt-1 flex items-center justify-center gap-1 text-xs text-amber-400 font-bold"><Sparkles className="w-3 h-3" /> КРИТИЧЕСКИЙ УСПЕХ!</div>}
          {isNat1 && <div className="mt-1 flex items-center justify-center gap-1 text-xs text-red-400 font-bold"><AlertTriangle className="w-3 h-3" /> КРИТИЧЕСКИЙ ПРОВАЛ!</div>}
        </div>
      )}

      {/* Controls */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Навык:</label>
            <select value={selectedStat} onChange={(e) => setSelectedStat(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200">
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
            <input type="number" value={customMod} onChange={(e) => setCustomMod(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center text-amber-300 font-bold" />
          </div>
        </div>
        <button
          onClick={handleRollClick}
          disabled={rollingState}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:brightness-110 text-slate-950 font-black font-cinzel text-sm shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
        >
          <Dice5 className={`w-5 h-5 ${rollingState ? 'animate-spin' : ''}`} />
          <span>{rollingState ? 'Бросок...' : `БРОСИТЬ D20 (${totalModifier >= 0 ? '+' : ''}${totalModifier})`}</span>
        </button>
      </div>
    </div>
  );
}
