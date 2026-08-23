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

// D20 face assignment — each of the 20 faces has a fixed number
const FACE_NUMBERS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20
];

function drawD20(canvas, rotX, rotY, displayRoll, isNat20, isNat1) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) * 0.37;

  ctx.clearRect(0, 0, W, H);

  // Icosahedron unit-sphere vertices
  const phi = (1 + Math.sqrt(5)) / 2;
  const rawVerts = [
    [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
    [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1]
  ];
  const verts = rawVerts.map(v => {
    const len = Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2);
    return [v[0]/len, v[1]/len, v[2]/len];
  });

  // 20 triangular faces
  const faces = [
    [0,1,8],[0,8,4],[0,4,5],[0,5,9],[0,9,1],
    [1,6,8],[8,6,10],[8,10,4],[4,10,2],[4,2,5],
    [5,2,11],[5,11,9],[9,11,7],[9,7,1],[1,7,6],
    [3,6,7],[3,7,11],[3,11,2],[3,2,10],[3,10,6]
  ];

  // Rotation
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

  const rotate3D = ([x, y, z]) => {
    let nx = x * cosY + z * sinY;
    let ny = y;
    let nz = -x * sinY + z * cosY;
    return [nx, ny * cosX - nz * sinX, ny * sinX + nz * cosX];
  };

  // Perspective projection
  const project = ([x, y, z]) => {
    const fov = 3.2;
    const d = fov - z;
    return [cx + (x * R * fov) / d, cy - (y * R * fov) / d, z];
  };

  const rotVerts = verts.map(rotate3D);
  const projVerts = rotVerts.map(project);

  // Compute face data: depth, normal, center
  const faceData = faces.map((f, i) => {
    const r0 = rotVerts[f[0]], r1 = rotVerts[f[1]], r2 = rotVerts[f[2]];
    const p0 = projVerts[f[0]], p1 = projVerts[f[1]], p2 = projVerts[f[2]];

    // Z-depth for painter's algo
    const z = (r0[2] + r1[2] + r2[2]) / 3;

    // Screen-space normal for back-face culling
    const ex = p1[0]-p0[0], ey = p1[1]-p0[1];
    const fx = p2[0]-p0[0], fy = p2[1]-p0[1];
    const nz = ex*fy - ey*fx;

    // World-space normal for lighting
    const ax = r1[0]-r0[0], ay = r1[1]-r0[1], az = r1[2]-r0[2];
    const bx = r2[0]-r0[0], by = r2[1]-r0[1], bz = r2[2]-r0[2];
    const nx = ay*bz - az*by;
    const ny2 = az*bx - ax*bz;
    const nz2 = ax*by - ay*bx;
    const nlen = Math.sqrt(nx**2 + ny2**2 + nz2**2) || 1;
    // Dot with light direction (0.4, 0.6, 1) normalized
    const lx=0.33, ly=0.50, lz=0.8;
    const dot = Math.max(0, (nx/nlen)*lx + (ny2/nlen)*ly + (nz2/nlen)*lz);

    // Projected centroid for text
    const pcx = (p0[0]+p1[0]+p2[0])/3;
    const pcy = (p0[1]+p1[1]+p2[1])/3;

    return { i, z, nz, dot, p0, p1, p2, pcx, pcy, visible: nz > 0 };
  });

  // Sort back to front
  const sorted = [...faceData].sort((a, b) => a.z - b.z);

  sorted.forEach(({ i, nz, dot, p0, p1, p2, pcx, pcy, visible }) => {
    if (!visible) return;

    const brightness = 0.25 + dot * 0.75;
    const faceNum = FACE_NUMBERS[i];

    // Face fill color
    let r, g, b;
    if (isNat20) {
      r = Math.round(180 + brightness * 75);
      g = Math.round(90 + brightness * 80);
      b = 0;
    } else if (isNat1) {
      r = Math.round(60 + brightness * 80);
      g = 0;
      b = 0;
    } else {
      r = Math.round(10 + brightness * 30);
      g = Math.round(18 + brightness * 55);
      b = Math.round(35 + brightness * 65);
    }

    // Draw face polygon
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.closePath();
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fill();

    // Edge highlight
    ctx.strokeStyle = isNat20
      ? `rgba(255,220,50,${0.2 + dot*0.6})`
      : isNat1
      ? `rgba(255,60,60,${0.2 + dot*0.5})`
      : `rgba(245,158,11,${0.1 + dot*0.5})`;
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // --- Number on each visible face ---
    // Compute face area in screen space to scale text
    const area = Math.abs(
      (p1[0]-p0[0])*(p2[1]-p0[1]) - (p2[0]-p0[0])*(p1[1]-p0[1])
    ) / 2;
    if (area < 80) return; // too small to draw legible number

    // Compute rotation angle for the text to face "up"
    // Edge midpoint from p0→p1 defines orientation
    const edgeMx = (p0[0]+p1[0])/2 - pcx;
    const edgeMy = (p0[1]+p1[1])/2 - pcy;
    const angle = Math.atan2(edgeMy, edgeMx) + Math.PI / 2;

    const fontSize = Math.max(9, Math.min(22, Math.sqrt(area) * 0.5));
    const isTopFace = faceNum === displayRoll;

    ctx.save();
    ctx.translate(pcx, pcy);
    ctx.rotate(angle);

    // Highlight the active result face
    if (isTopFace) {
      ctx.shadowColor = isNat20 ? '#fff' : isNat1 ? '#ff3333' : '#f59e0b';
      ctx.shadowBlur = 12;
    }

    ctx.font = `900 ${isTopFace ? fontSize * 1.3 : fontSize}px Cinzel, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text color
    if (isNat20) {
      ctx.fillStyle = isTopFace ? '#fff' : `rgba(255,240,180,${0.5 + dot*0.5})`;
    } else if (isNat1) {
      ctx.fillStyle = isTopFace ? '#fca5a5' : `rgba(255,180,180,${0.5 + dot*0.5})`;
    } else {
      ctx.fillStyle = isTopFace
        ? '#fef08a'
        : `rgba(253,230,138,${0.4 + dot*0.5})`;
    }

    ctx.fillText(String(faceNum), 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  });

  // Outer glow
  const grd = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 1.3);
  if (isNat20) {
    grd.addColorStop(0, 'rgba(245,158,11,0.45)');
    grd.addColorStop(1, 'rgba(245,158,11,0)');
  } else if (isNat1) {
    grd.addColorStop(0, 'rgba(239,68,68,0.45)');
    grd.addColorStop(1, 'rgba(239,68,68,0)');
  } else {
    grd.addColorStop(0, 'rgba(245,158,11,0.12)');
    grd.addColorStop(1, 'rgba(245,158,11,0)');
  }
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();
}

export default function D20Dice({ onRoll, lastRoll, isRolling, stats = {} }) {
  const canvasRef = useRef(null);
  const rotRef = useRef({ x: 0.4, y: 0.3 });
  const velRef = useRef({ x: 0.005, y: 0.008 });
  const animRef = useRef(null);

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

  // Main render loop
  useEffect(() => {
    let frame;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const loop = () => {
      rotRef.current.x += velRef.current.x;
      rotRef.current.y += velRef.current.y;
      drawD20(canvas, rotRef.current.x, rotRef.current.y, currentRoll, isNat20, isNat1);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [currentRoll, isNat20, isNat1]);

  const handleRollClick = () => {
    if (rollingState) return;
    setLocalRolling(true);
    playDiceRollSound();

    // Blast spin velocity
    velRef.current = {
      x: (Math.random() > 0.5 ? 1 : -1) * (0.07 + Math.random() * 0.07),
      y: (Math.random() > 0.5 ? 1 : -1) * (0.09 + Math.random() * 0.09)
    };

    // Flicker numbers through all 20 values
    let count = 0;
    const iv = setInterval(() => {
      setDisplayRoll(Math.floor(Math.random() * 20) + 1);
      if (++count >= 24) clearInterval(iv);
    }, 65);

    // Decelerate over 1.7s
    const startVel = { ...velRef.current };
    const t0 = Date.now();
    const decel = () => {
      const t = Math.min(1, (Date.now() - t0) / 1700);
      const ease = 1 - Math.pow(1 - t, 3);
      velRef.current = {
        x: startVel.x * (1 - ease) + 0.005 * ease,
        y: startVel.y * (1 - ease) + 0.008 * ease,
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
    }, 1800);
  };

  useEffect(() => {
    if (lastRoll?.isNat20) confetti({ particleCount: 180, spread: 100, origin: { y: 0.6 } });
  }, [lastRoll]);

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-amber-500/30 p-4 shadow-xl backdrop-blur-md select-none">
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Dice5 className="w-5 h-5 text-amber-400" />
          <h3 className="font-cinzel text-sm font-bold text-amber-300">3D Икосаэдр D20</h3>
        </div>
        <span className="text-[10px] text-amber-400/80 font-mono">20 граней · 3D рендер</span>
      </div>

      {/* Canvas */}
      <div className="flex flex-col items-center cursor-pointer" onClick={handleRollClick}>
        <canvas ref={canvasRef} width={220} height={220} className="rounded-xl" />
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
