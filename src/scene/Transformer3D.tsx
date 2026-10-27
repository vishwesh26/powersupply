import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useLabStore } from '../store/useLabStore';
import { ComponentTooltip, useComponentInteraction } from './ComponentTooltip';

export const Transformer3D: React.FC = () => {
  const vPri = useLabStore((s) => s.params.acVrms);
  const vSec = useLabStore((s) => s.params.transformerSecondaryVrms);
  const rWind = useLabStore((s) => s.params.transformerWindingResistanceOhms);

  const interact = useComponentInteraction('transformer');

  // Dynamic rating label texture on top of the laminated E-I core
  const labelTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 256);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 492, 236);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STEP-DOWN TRANSFORMER', 256, 56);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 46px monospace';
    ctx.fillText(`${vPri}V → ${vSec}V AC`, 256, 128);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(
      `Vpk: ${(vSec * Math.SQRT2).toFixed(1)}V | Rw: ${rWind.toFixed(1)}Ω`,
      256,
      195
    );

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [vPri, vSec, rWind]);

  // Stacked lamination plates texture
  const laminationTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < 256; y += 4) {
      ctx.fillStyle = y % 8 === 0 ? '#475569' : '#64748b';
      ctx.fillRect(0, y, 256, 3);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, y + 3, 256, 1);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <group position={[-8.35, 0, 0.0]} {...interact.handlers}>
      {/* Galvanized Steel Mounting Bracket */}
      <mesh position={[0, 0.1, 0]} receiveShadow castShadow>
        <boxGeometry args={[2.5, 0.2, 3.8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.75} roughness={0.3} />
      </mesh>
      {/* 4 Mounting Bolts */}
      {[
        [-1.0, 0.22, -1.65],
        [1.0, 0.22, -1.65],
        [-1.0, 0.22, 1.65],
        [1.0, 0.22, 1.65],
      ].map(([bx, by, bz], i) => (
        <mesh key={i} position={[bx, by, bz]}>
          <cylinderGeometry args={[0.1, 0.1, 0.12, 6]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
        </mesh>
      ))}

      {/* Laminated Silicon-Steel E-I Core Stack */}
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.65, 2.65, 3.1]} />
        <meshStandardMaterial
          map={laminationTexture}
          color={interact.highlighted ? '#94a3b8' : '#cbd5e1'}
          emissive={interact.highlighted ? '#0ea5e9' : '#000000'}
          emissiveIntensity={interact.highlighted ? 0.25 : 0}
          metalness={0.68}
          roughness={0.36}
        />
      </mesh>

      {/* Molded Nylon Coil Bobbin Flanges */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[2.35, 1.85, 2.15]} />
        <meshStandardMaterial color="#1e293b" roughness={0.55} metalness={0.1} />
      </mesh>

      {/* Primary Copper Winding Coil (Left Side) */}
      <mesh position={[-0.65, 1.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.88, 0.88, 0.95, 24]} />
        <meshStandardMaterial color="#b45309" metalness={0.75} roughness={0.28} />
      </mesh>

      {/* Secondary Copper Winding Coil (Right Side facing Breadboard) */}
      <mesh position={[0.65, 1.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.88, 0.88, 0.95, 24]} />
        <meshStandardMaterial color="#d97706" metalness={0.78} roughness={0.24} />
      </mesh>

      {/* Top Specification Nameplate */}
      <mesh position={[0, 2.84, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 2.75]} />
        <meshStandardMaterial map={labelTexture} roughness={0.35} />
      </mesh>

      {/* Secondary Solder Lugs (Yellow AC output terminals facing breadboard) */}
      <mesh position={[1.22, 1.65, -0.75]}>
        <boxGeometry args={[0.24, 0.12, 0.22]} />
        <meshStandardMaterial color="#eab308" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[1.22, 1.65, 0.75]}>
        <boxGeometry args={[0.24, 0.12, 0.22]} />
        <meshStandardMaterial color="#eab308" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Primary Solder Lugs (Left side) */}
      <mesh position={[-1.22, 1.65, -0.55]}>
        <boxGeometry args={[0.24, 0.12, 0.22]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-1.22, 1.65, 0.55]}>
        <boxGeometry args={[0.24, 0.12, 0.22]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
      </mesh>

      <ComponentTooltip
        id="transformer"
        position={[0, 3.55, 0]}
        title="Step-Down Transformer"
        valueText={`${vSec} V RMS Secondary`}
        subtitle={`Peak: ±${(vSec * Math.SQRT2).toFixed(2)} V · Winding R: ${rWind.toFixed(1)} Ω`}
      />
    </group>
  );
};
