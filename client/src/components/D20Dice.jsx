import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
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

    for (let i = 0; i < 8; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(220 + Math.random() * 400, ctx.currentTime + i * 0.06);

      gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.06 + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + i * 0.06);
      osc.stop(ctx.currentTime + i * 0.06 + 0.07);
    }
  } catch (e) {
    // Silent audio fallback
  }
}

// Generate number textures for 3D polyhedron faces
function createFaceTexture(number, isNat20 = false, isNat1 = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  if (isNat20) {
    grad.addColorStop(0, '#f59e0b');
    grad.addColorStop(0.5, '#fbbf24');
    grad.addColorStop(1, '#b45309');
  } else if (isNat1) {
    grad.addColorStop(0, '#7f1d1d');
    grad.addColorStop(0.5, '#9f1239');
    grad.addColorStop(1, '#450a0a');
  } else {
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e293b');
    grad.addColorStop(1, '#451a03');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = isNat20 ? '#fef08a' : isNat1 ? '#f87171' : '#f59e0b';
  ctx.lineWidth = 12;
  ctx.strokeRect(10, 10, 236, 236);

  ctx.font = 'bold 120px Cinzel, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isNat20 ? '#ffffff' : isNat1 ? '#fecdd3' : '#fef08a';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 10;
  ctx.fillText(number.toString(), 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export default function D20Dice({ onRoll, lastRoll, isRolling, stats = {} }) {
  const containerRef = useRef(null);
  const diceMeshRef = useRef(null);
  const animFrameRef = useRef(null);

  const [selectedStat, setSelectedStat] = useState('str');
  const [customMod, setCustomMod] = useState(0);
  const [localRolling, setLocalRolling] = useState(false);
  const [displayNumber, setDisplayNumber] = useState(20);

  const computedStatMod = Math.floor(((stats[selectedStat] || 10) - 10) / 2);
  const totalModifier = computedStatMod + Number(customMod || 0);

  // Trigger 3D Spin Animation Physics
  const trigger3DSpinAnimation = () => {
    playDiceRollSound();

    const mesh = diceMeshRef.current;
    if (!mesh) return;

    const startX = mesh.rotation.x;
    const startY = mesh.rotation.y;
    const startZ = mesh.rotation.z;

    const targetRotX = startX + Math.PI * 10 + (Math.random() * Math.PI);
    const targetRotY = startY + Math.PI * 12 + (Math.random() * Math.PI);
    const targetRotZ = startZ + Math.PI * 8 + (Math.random() * Math.PI);

    const startTime = performance.now();
    const duration = 1800;

    const rollStep = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      mesh.rotation.x = startX + (targetRotX - startX) * ease;
      mesh.rotation.y = startY + (targetRotY - startY) * ease;
      mesh.rotation.z = startZ + (targetRotZ - startZ) * ease;

      if (progress < 0.95) {
        setDisplayNumber(Math.floor(Math.random() * 20) + 1);
      }

      if (progress < 1) {
        requestAnimationFrame(rollStep);
      } else {
        setLocalRolling(false);
      }
    };

    requestAnimationFrame(rollStep);
  };

  // Setup Three.js WebGL Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = 240;
    const height = 220;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 4.6;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xfff5ea, 1.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xf59e0b, 2.5);
    dirLight1.position.set(5, 5, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 1.5);
    dirLight2.position.set(-5, -5, 3);
    scene.add(dirLight2);

    const geometry = new THREE.IcosahedronGeometry(1.4, 0);

    const materials = [];
    for (let i = 1; i <= 20; i++) {
      materials.push(
        new THREE.MeshStandardMaterial({
          map: createFaceTexture(i),
          roughness: 0.25,
          metalness: 0.8
        })
      );
    }

    const mesh = new THREE.Mesh(geometry, materials);
    scene.add(mesh);
    diceMeshRef.current = mesh;

    let rotationSpeedX = 0.006;
    let rotationSpeedY = 0.009;

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      if (mesh && !localRolling && !isRolling) {
        mesh.rotation.x += rotationSpeedX;
        mesh.rotation.y += rotationSpeedY;
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Watch for external rolls or clicks to trigger 3D animation
  useEffect(() => {
    if (isRolling || lastRoll) {
      trigger3DSpinAnimation();
    }
  }, [lastRoll]);

  const handleRollClick = () => {
    if (isRolling || localRolling) return;
    setLocalRolling(true);
    trigger3DSpinAnimation();

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
  };

  useEffect(() => {
    if (lastRoll?.isNat20) {
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 }
      });
    }
  }, [lastRoll]);

  const rollingState = isRolling || localRolling;

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-amber-500/30 p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-2">
        <div className="flex items-center gap-2">
          <Dice5 className="w-5 h-5 text-amber-400" />
          <h3 className="font-cinzel text-sm font-bold text-amber-300">Настоящий 3D D20 Кубик (Three.js WebGL)</h3>
        </div>
        <span className="text-[10px] text-amber-400/80 font-mono">3D Икосаэдр</span>
      </div>

      {/* Three.js WebGL 3D Canvas Container */}
      <div className="my-2 relative flex flex-col items-center cursor-pointer select-none" onClick={handleRollClick}>
        <div ref={containerRef} className="w-[240px] h-[220px] flex items-center justify-center mx-auto"></div>

        {/* Live Roll Value Overlay Badge */}
        <div className="absolute bottom-2 bg-slate-950/90 px-4 py-1 rounded-full border border-amber-500/50 shadow-lg">
          <span className="text-xs text-slate-400 font-mono">Выпало: </span>
          <strong className="text-base font-cinzel text-yellow-300 font-bold">
            {rollingState ? displayNumber : lastRoll ? lastRoll.rawRoll : 20}
          </strong>
        </div>
      </div>

      {/* Roll Results Banner */}
      {lastRoll && !rollingState && (
        <div className="mb-3 p-3 rounded-xl bg-slate-950 border border-amber-500/30 text-center animate-fade-in">
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
          <span>{rollingState ? 'Вращение 3D D20...' : `БРОСИТЬ 3D D20 (${totalModifier >= 0 ? '+' : ''}${totalModifier})`}</span>
        </button>
      </div>
    </div>
  );
}
