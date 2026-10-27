import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { labRuntime, useLabStore } from '../store/useLabStore';
import { BOARD_TOP_Y, holePos } from './boardLayout';
import { ComponentTooltip, useComponentInteraction } from './ComponentTooltip';

export const ElectrolyticCap3D: React.FC = () => {
  const capUf = useLabStore((s) => s.params.filterCapUf);
  const ratingV = useLabStore((s) => s.params.filterCapRatingV);
  const esr = useLabStore((s) => s.params.filterCapEsrOhms);
  const capVentLatched = useLabStore((s) => s.faults.capVentLatched);
  const capOvervoltageActive = useLabStore((s) => s.faults.capOvervoltageActive);

  const interact = useComponentInteraction('mainCap');

  const chargeFillRef = useRef<THREE.Mesh>(null);
  const chargeMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const ventBulgeRef = useRef<THREE.Mesh>(null);
  const plumeGroupRef = useRef<THREE.Group>(null);

  const posPlus = holePos(13, 'B');
  const posMinus = holePos(15, 'B');
  const centerX = (posPlus[0] + posMinus[0]) / 2;
  const centerZ = posPlus[2];

  // Procedural Cylindrical Sleeve Texture with Polarity Stripe (- - -) aligned to +X (col 15)
  const sleeveTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Deep navy electrolytic sleeve
    ctx.fillStyle = '#0f294a';
    ctx.fillRect(0, 0, 512, 256);

    // Wide silver-white negative stripe centered around U = 0.25 (maps to +X side toward col 15)
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(96, 0, 72, 256);

    // Minus symbols inside stripe
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('−', 132, 60);
    ctx.fillText('−', 132, 138);
    ctx.fillText('−', 132, 216);

    // Printed capacitance & voltage rating on front face
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText(`${capUf} µF`, 335, 108);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 34px monospace';
    ctx.fillText(`${ratingV} V DC`, 335, 165);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px monospace';
    ctx.fillText('105°C LOW ESR', 335, 212);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [capUf, ratingV]);

  useFrame((state) => {
    const vCap = labRuntime.engine.vCap;
    const ratio = Math.max(0, Math.min(1.25, vCap / Math.max(1, ratingV)));
    const clampedFill = Math.max(0.03, Math.min(1, ratio));

    if (chargeFillRef.current) {
      chargeFillRef.current.scale.set(1, clampedFill, 1);
      chargeFillRef.current.position.y =
        BOARD_TOP_Y + 0.32 + (1.42 * clampedFill) / 2;
    }

    if (chargeMatRef.current) {
      if (ratio > 1.001) {
        chargeMatRef.current.color.set('#ef4444');
        chargeMatRef.current.opacity = 0.55;
      } else if (ratio > 0.85) {
        chargeMatRef.current.color.set('#f59e0b');
        chargeMatRef.current.opacity = 0.4;
      } else {
        chargeMatRef.current.color.set('#22d3ee');
        chargeMatRef.current.opacity = 0.12 + 0.32 * clampedFill;
      }
    }

    // Bulging top vent if overvoltage occurred
    const faulted =
      labRuntime.engine.capVentLatched || vCap > ratingV * 1.001;
    if (ventBulgeRef.current) {
      const targetScaleY = faulted ? 1.0 : 0.08;
      ventBulgeRef.current.scale.y = THREE.MathUtils.lerp(
        ventBulgeRef.current.scale.y,
        targetScaleY,
        0.15
      );
    }

    // Subtle rising vent vapor puffs when actively overvoltaged or vented
    if (plumeGroupRef.current) {
      plumeGroupRef.current.visible = faulted;
      if (faulted) {
        const t = state.clock.elapsedTime;
        plumeGroupRef.current.children.forEach((child, idx) => {
          const phase = (t * 0.7 + idx * 0.33) % 1;
          child.position.y = phase * 1.1;
          child.position.x = Math.sin(t * 2 + idx) * 0.08;
          const s = 0.5 + phase * 1.1;
          child.scale.setScalar(s);
          const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
          mat.opacity = (1 - phase) * (capOvervoltageActive ? 0.38 : 0.16);
        });
      }
    }
  });

  return (
    <group {...interact.handlers}>
      {/* Positive Lead (+ at col 13) */}
      <mesh position={[posPlus[0], BOARD_TOP_Y + 0.18, posPlus[2]]}>
        <cylinderGeometry args={[0.03, 0.03, 0.42, 10]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Negative Lead (- at col 15) */}
      <mesh position={[posMinus[0], BOARD_TOP_Y + 0.18, posMinus[2]]}>
        <cylinderGeometry args={[0.03, 0.03, 0.42, 10]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Main Electrolytic Can */}
      <mesh position={[centerX, BOARD_TOP_Y + 1.05, centerZ]} castShadow>
        <cylinderGeometry args={[0.52, 0.52, 1.5, 28]} />
        <meshStandardMaterial
          map={sleeveTexture}
          emissive={
            capOvervoltageActive
              ? '#ef4444'
              : interact.highlighted
              ? '#0ea5e9'
              : '#000000'
          }
          emissiveIntensity={
            capOvervoltageActive ? 0.35 : interact.highlighted ? 0.25 : 0
          }
          roughness={0.35}
          metalness={0.18}
        />
      </mesh>

      {/* Live Translucent Charge-Level Collar Glow */}
      <mesh ref={chargeFillRef} position={[centerX, BOARD_TOP_Y + 0.5, centerZ]}>
        <cylinderGeometry args={[0.56, 0.56, 1.42, 24, 1, true]} />
        <meshBasicMaterial
          ref={chargeMatRef}
          color="#22d3ee"
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Brushed Aluminum K-Vent Top Cap */}
      <mesh position={[centerX, BOARD_TOP_Y + 1.81, centerZ]}>
        <cylinderGeometry args={[0.47, 0.47, 0.03, 24]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.22} />
      </mesh>

      {/* Vent Cross Score Lines */}
      <mesh position={[centerX, BOARD_TOP_Y + 1.83, centerZ]}>
        <boxGeometry args={[0.76, 0.015, 0.03]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh position={[centerX, BOARD_TOP_Y + 1.83, centerZ]}>
        <boxGeometry args={[0.03, 0.015, 0.76]} />
        <meshStandardMaterial color="#475569" />
      </mesh>

      {/* Overvoltage Vent Bulge Dome */}
      <mesh
        ref={ventBulgeRef}
        position={[centerX, BOARD_TOP_Y + 1.82, centerZ]}
        scale={[1, 0.08, 1]}
      >
        <sphereGeometry args={[0.45, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={capVentLatched ? '#94a3b8' : '#cbd5e1'}
          metalness={0.75}
          roughness={0.35}
        />
      </mesh>

      {/* Tasteful Subtle Vent Vapor Plume when Overvoltaged */}
      <group
        ref={plumeGroupRef}
        position={[centerX, BOARD_TOP_Y + 2.05, centerZ]}
        visible={false}
      >
        {[0, 1, 2].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshBasicMaterial
              color="#cbd5e1"
              transparent
              opacity={0.2}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Polarity '+' Marker on Board Next to Col 13 */}
      <ComponentTooltip
        id="mainCap"
        position={[centerX, BOARD_TOP_Y + 2.55, centerZ]}
        title="Main Filter Capacitor (C1)"
        valueText={`${capUf} µF / ${ratingV} V`}
        subtitle={`ESR: ${esr.toFixed(2)} Ω · Left (+), Right (− stripe)`}
        warningText={
          capOvervoltageActive
            ? `OVERVOLTAGE! Exceeds ${ratingV} V rating`
            : capVentLatched
            ? 'Vent bulged from prior overvoltage'
            : undefined
        }
      />
    </group>
  );
};
