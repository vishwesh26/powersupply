import React, { useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { labRuntime, useLabStore } from '../store/useLabStore';
import { BOARD_TOP_Y, holePos } from './boardLayout';
import { ComponentTooltip, useComponentInteraction } from './ComponentTooltip';

export const Regulator3D: React.FC = () => {
  const regType = useLabStore((s) => s.params.regulatorType);
  const regTemp = useLabStore((s) => s.latestSample.regulatorTempC);
  const regPower = useLabStore((s) => s.latestSample.pRegulator);
  const regRegime = useLabStore((s) => s.latestSample.regulatorRegime);

  const interact = useComponentInteraction('regulator');

  const tabMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const bodyMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const heatHaloRef = useRef<THREE.MeshBasicMaterial>(null);

  const p1 = holePos(21, 'D');
  const p2 = holePos(22, 'D');
  const p3 = holePos(23, 'D');
  const centerX = p2[0];
  const centerZ = p2[2];

  // Dynamic TO-220 Laser-Marked Package Front Texture
  const packageTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle molded bevel border
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 10;
    ctx.strokeRect(16, 16, 480, 480);

    // Manufacturer style top mark
    ctx.fillStyle = '#a1a1aa';
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ELECTROBENCH SEMI', 256, 105);

    // Main IC Part Number (LM7805 / LM7809 / LM7812 / LM317)
    ctx.fillStyle = '#f4f4f5';
    ctx.font = 'bold 92px monospace';
    ctx.fillText(regType, 256, 245);

    // Regulator Type Subtitle
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 34px sans-serif';
    const sub =
      regType === 'LM317'
        ? '1.25V–37V ADJ REG'
        : `${regType.replace('LM78', '')}V FIXED REG`;
    ctx.fillText(sub, 256, 330);

    // Pinout Marking at Bottom Edge
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 32px monospace';
    const pins = regType === 'LM317' ? 'IN   ADJ   OUT' : 'IN   GND   OUT';
    ctx.fillText(pins, 256, 445);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [regType]);

  useFrame(() => {
    const tj = labRuntime.engine.regulatorTempC;
    // Normalized heat factor: 0 below 35°C, 0.5 around 90°C, 1.0 at 150°C
    const heat = Math.max(0, Math.min(1, (tj - 35) / 115));

    if (tabMatRef.current) {
      if (heat > 0.04) {
        const glowColor = new THREE.Color('#f59e0b').lerp(
          new THREE.Color('#ef4444'),
          Math.min(1, Math.max(0, (heat - 0.35) / 0.65))
        );
        tabMatRef.current.emissive.copy(glowColor);
        tabMatRef.current.emissiveIntensity = heat * 1.15;
      } else if (interact.highlighted) {
        tabMatRef.current.emissive.set('#0ea5e9');
        tabMatRef.current.emissiveIntensity = 0.35;
      } else {
        tabMatRef.current.emissiveIntensity = 0;
      }
    }

    if (bodyMatRef.current) {
      if (heat > 0.25) {
        bodyMatRef.current.emissive.set('#dc2626');
        bodyMatRef.current.emissiveIntensity = (heat - 0.25) * 0.55;
      } else if (interact.highlighted) {
        bodyMatRef.current.emissive.set('#0ea5e9');
        bodyMatRef.current.emissiveIntensity = 0.25;
      } else {
        bodyMatRef.current.emissiveIntensity = 0;
      }
    }

    if (heatHaloRef.current) {
      heatHaloRef.current.opacity = heat * 0.36;
    }
  });

  const showTempPill = regTemp >= 45 || regRegime === 'THERMAL_SHUTDOWN';

  return (
    <group {...interact.handlers}>
      {/* 3 TO-220 Tinned Leads (IN = col 21, GND/ADJ = col 22, OUT = col 23) */}
      {[p1, p2, p3].map((p, idx) => (
        <mesh key={idx} position={[p[0], BOARD_TOP_Y + 0.32, p[2]]}>
          <boxGeometry args={[0.06, 0.68, 0.04]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.18} />
        </mesh>
      ))}

      {/* TO-220 Molded Black Epoxy Body */}
      <mesh position={[centerX, BOARD_TOP_Y + 1.05, centerZ]} castShadow>
        <boxGeometry args={[1.12, 0.92, 0.38]} />
        <meshStandardMaterial
          ref={bodyMatRef}
          color="#18181b"
          roughness={0.45}
          metalness={0.12}
        />
      </mesh>

      {/* Laser-Marked Front Face Plane (+Z facing viewer) */}
      <mesh position={[centerX, BOARD_TOP_Y + 1.05, centerZ + 0.193]}>
        <planeGeometry args={[1.08, 0.88]} />
        <meshStandardMaterial map={packageTexture} roughness={0.4} />
      </mesh>

      {/* Brushed Aluminum TO-220 Heatsink Backing Tab */}
      <mesh position={[centerX, BOARD_TOP_Y + 1.38, centerZ - 0.16]} castShadow>
        <boxGeometry args={[1.12, 1.56, 0.09]} />
        <meshStandardMaterial
          ref={tabMatRef}
          color="#cbd5e1"
          metalness={0.85}
          roughness={0.24}
        />
      </mesh>

      {/* Mounting Hole in Heatsink Tab */}
      <mesh
        position={[centerX, BOARD_TOP_Y + 1.86, centerZ - 0.16]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.16, 0.16, 0.11, 20]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>

      {/* Thermal Radiation Aura */}
      <mesh position={[centerX, BOARD_TOP_Y + 1.35, centerZ]}>
        <sphereGeometry args={[0.92, 18, 18]} />
        <meshBasicMaterial
          ref={heatHaloRef}
          color="#f97316"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* Persistent Live Tj Badge when Hot or in Thermal Shutdown */}
      {showTempPill && !interact.hovered && !interact.selected && (
        <Html
          position={[centerX, BOARD_TOP_Y + 2.55, centerZ]}
          center
          distanceFactor={18}
          zIndexRange={[10, 0]}
        >
          <div
            className={`pointer-events-none whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] font-bold shadow ${
              regRegime === 'THERMAL_SHUTDOWN'
                ? 'animate-pulse border border-red-400 bg-red-950/95 text-red-200'
                : regTemp >= 95
                ? 'border border-orange-400/80 bg-orange-950/90 text-orange-200'
                : 'border border-amber-500/60 bg-slate-900/85 text-amber-300'
            }`}
          >
            {regRegime === 'THERMAL_SHUTDOWN'
              ? `THERMAL SHUTDOWN · ${regTemp.toFixed(0)}°C`
              : `Tj: ${regTemp.toFixed(0)}°C`}
          </div>
        </Html>
      )}

      <ComponentTooltip
        id="regulator"
        position={[centerX, BOARD_TOP_Y + 2.75, centerZ]}
        title={`Voltage Regulator (${regType})`}
        valueText={`Tj = ${regTemp.toFixed(1)} °C · Pdiss = ${regPower.toFixed(2)} W`}
        subtitle={`State: ${regRegime.replace('_', ' ')}`}
        warningText={
          regRegime === 'THERMAL_SHUTDOWN'
            ? 'Thermal shutdown active (≥ 150 °C)!'
            : regRegime === 'DROPOUT'
            ? 'Insufficient Vin headroom (Dropout)'
            : regRegime === 'CURRENT_LIMITED'
            ? 'Current limit active (1.00 A)'
            : undefined
        }
      />
    </group>
  );
};
