import React from 'react';
import { useLabStore } from '../store/useLabStore';
import { BOARD_TOP_Y, holePos } from './boardLayout';
import { ComponentTooltip, useComponentInteraction } from './ComponentTooltip';

export const CeramicCap3D: React.FC = () => {
  const cInNf = useLabStore((s) => s.params.bypassCapInNf);
  const cOutUf = useLabStore((s) => s.params.bypassCapOutUf);

  const inInteract = useComponentInteraction('bypassCapIn');
  const outInteract = useComponentInteraction('bypassCapOut');

  // C2: 100 nF Ceramic Disc at Col 18-19, Row C (Regulator Input Decoupling)
  const inA = holePos(18, 'C');
  const inB = holePos(19, 'C');
  const inMidX = (inA[0] + inB[0]) / 2;

  // C3: 10 uF Output Capacitor at Col 30-31, Row G (Regulator Output Stability)
  const outA = holePos(30, 'G');
  const outB = holePos(31, 'G');
  const outMidX = (outA[0] + outB[0]) / 2;

  return (
    <group>
      {/* 1. C2: 100 nF Ceramic Disc Input Bypass Capacitor */}
      <group {...inInteract.handlers}>
        <mesh position={[inA[0], BOARD_TOP_Y + 0.22, inA[2]]}>
          <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[inB[0], BOARD_TOP_Y + 0.22, inB[2]]}>
          <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Ochre Ceramic Lentil Disc */}
        <mesh
          position={[inMidX, BOARD_TOP_Y + 0.62, inA[2]]}
          scale={[1, 1, 0.36]}
          castShadow
        >
          <sphereGeometry args={[0.28, 20, 16]} />
          <meshStandardMaterial
            color="#d97706"
            emissive={inInteract.highlighted ? '#0ea5e9' : '#000000'}
            emissiveIntensity={inInteract.highlighted ? 0.35 : 0}
            roughness={0.55}
            metalness={0.05}
          />
        </mesh>

        <ComponentTooltip
          id="bypassCapIn"
          position={[inMidX, BOARD_TOP_Y + 1.35, inA[2]]}
          title="Input Bypass Capacitor (C2)"
          valueText={`${cInNf} nF Ceramic`}
          subtitle="High-frequency regulator input stability"
          warningText={
            cInNf < 100 ? 'Below datasheet 100 nF minimum' : undefined
          }
        />
      </group>

      {/* 2. C3: 10 uF Output Decoupling Capacitor */}
      <group {...outInteract.handlers}>
        <mesh position={[outA[0], BOARD_TOP_Y + 0.22, outA[2]]}>
          <cylinderGeometry args={[0.022, 0.022, 0.45, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[outB[0], BOARD_TOP_Y + 0.22, outB[2]]}>
          <cylinderGeometry args={[0.022, 0.022, 0.45, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Compact Radial Output Capacitor Can / Tantalum Pearl */}
        <mesh position={[outMidX, BOARD_TOP_Y + 0.68, outA[2]]} castShadow>
          <cylinderGeometry args={[0.25, 0.25, 0.68, 20]} />
          <meshStandardMaterial
            color="#1d4ed8"
            emissive={outInteract.highlighted ? '#38bdf8' : '#000000'}
            emissiveIntensity={outInteract.highlighted ? 0.35 : 0}
            roughness={0.38}
            metalness={0.15}
          />
        </mesh>
        {/* Top Silver Cap */}
        <mesh position={[outMidX, BOARD_TOP_Y + 1.03, outA[2]]}>
          <cylinderGeometry args={[0.21, 0.21, 0.02, 20]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.85} roughness={0.2} />
        </mesh>

        <ComponentTooltip
          id="bypassCapOut"
          position={[outMidX, BOARD_TOP_Y + 1.55, outA[2]]}
          title="Output Capacitor (C3)"
          valueText={`${cOutUf} µF`}
          subtitle="Improves load-transient response & loop damping"
          warningText={
            cOutUf < 10 ? 'Below recommended 10 µF for transient stability' : undefined
          }
        />
      </group>
    </group>
  );
};
