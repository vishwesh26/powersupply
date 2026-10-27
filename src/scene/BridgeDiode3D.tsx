import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { labRuntime, useLabStore } from '../store/useLabStore';
import { BOARD_TOP_Y, holePos, StripRow } from './boardLayout';
import { ComponentTooltip, useComponentInteraction } from './ComponentTooltip';

interface SingleDiodeSpec {
  name: string;
  pair: 'A' | 'B';
  anode: [number, StripRow];
  cathode: [number, StripRow];
  bodyHeightOffset: number;
}

const BRIDGE_SPECS: SingleDiodeSpec[] = [
  // Pair A (+ half-cycle): AC1 (col 3 upper) -> DC+ (col 9 upper), return GND (col 6 lower) -> AC2 (col 3 lower)
  { name: 'D1', pair: 'A', anode: [3, 'B'], cathode: [9, 'B'], bodyHeightOffset: 0.36 },
  { name: 'D2', pair: 'A', anode: [6, 'I'], cathode: [3, 'I'], bodyHeightOffset: 0.36 },
  // Pair B (- half-cycle): AC2 (col 3 lower) -> DC+ (col 9 upper), return GND (col 6 lower) -> AC1 (col 3 upper)
  { name: 'D3', pair: 'B', anode: [3, 'G'], cathode: [9, 'D'], bodyHeightOffset: 0.56 },
  { name: 'D4', pair: 'B', anode: [6, 'F'], cathode: [3, 'E'], bodyHeightOffset: 0.52 },
];

export const BridgeDiode3D: React.FC = () => {
  const diodeType = useLabStore((s) => s.params.diodeType);
  const vf = useLabStore((s) => s.params.diodeForwardDropV);
  const interact = useComponentInteraction('bridgeDiodes');

  const bodyMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const haloMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  const geometries = useMemo(() => {
    return BRIDGE_SPECS.map((spec) => {
      const aPos = new THREE.Vector3(...holePos(spec.anode[0], spec.anode[1], 0));
      const cPos = new THREE.Vector3(...holePos(spec.cathode[0], spec.cathode[1], 0));

      const yTop = BOARD_TOP_Y + spec.bodyHeightOffset;
      const aTop = new THREE.Vector3(aPos.x, yTop, aPos.z);
      const cTop = new THREE.Vector3(cPos.x, yTop, cPos.z);

      const spanVec = new THREE.Vector3().subVectors(cTop, aTop);
      const spanLen = spanVec.length();
      const mid = new THREE.Vector3().addVectors(aTop, cTop).multiplyScalar(0.5);
      const dir = spanVec.clone().normalize();

      // Orient cylinder (default +Y axis) along Anode -> Cathode direction
      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir
      );

      // Cathode band sits at +0.24 along dir from center (body length = 0.72)
      const bandPos = mid.clone().addScaledVector(dir, 0.22);

      return {
        spec,
        aPos,
        cPos,
        yTop,
        leadHeight: spec.bodyHeightOffset + 0.08,
        spanLen,
        mid,
        quat,
        bandPos,
      };
    });
  }, []);

  useFrame(() => {
    const sample = labRuntime.engine.lastSample;
    const gA = sample.diodeGlowPairA;
    const gB = sample.diodeGlowPairB;

    geometries.forEach((g, idx) => {
      const glow = g.spec.pair === 'A' ? gA : gB;
      const mat = bodyMatRefs.current[idx];
      const halo = haloMatRefs.current[idx];
      if (mat) {
        if (glow > 0.02) {
          mat.emissive.set('#f97316');
          mat.emissiveIntensity = glow * 1.15;
        } else if (interact.highlighted) {
          mat.emissive.set('#0ea5e9');
          mat.emissiveIntensity = 0.35;
        } else {
          mat.emissiveIntensity = 0;
        }
      }
      if (halo) {
        halo.opacity = glow * 0.42;
      }
    });
  });

  const cathodeColor =
    diodeType === '1N5819'
      ? '#fbbf24'
      : diodeType === 'ideal'
      ? '#38bdf8'
      : '#e2e8f0';

  return (
    <group {...interact.handlers}>
      {geometries.map((g, idx) => (
        <group key={g.spec.name}>
          {/* Anode Vertical Lead */}
          <mesh
            position={[g.aPos.x, BOARD_TOP_Y + g.spec.bodyHeightOffset / 2, g.aPos.z]}
          >
            <cylinderGeometry args={[0.026, 0.026, g.leadHeight, 10]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.2} />
          </mesh>

          {/* Cathode Vertical Lead */}
          <mesh
            position={[g.cPos.x, BOARD_TOP_Y + g.spec.bodyHeightOffset / 2, g.cPos.z]}
          >
            <cylinderGeometry args={[0.026, 0.026, g.leadHeight, 10]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.2} />
          </mesh>

          {/* Horizontal Axial Wire Span */}
          <mesh position={g.mid} quaternion={g.quat}>
            <cylinderGeometry args={[0.026, 0.026, g.spanLen, 10]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.2} />
          </mesh>

          {/* DO-41 Black Epoxy Diode Package */}
          <mesh position={g.mid} quaternion={g.quat} castShadow>
            <cylinderGeometry args={[0.115, 0.115, 0.72, 18]} />
            <meshStandardMaterial
              ref={(el) => {
                bodyMatRefs.current[idx] = el;
              }}
              color="#171717"
              roughness={0.42}
              metalness={0.18}
            />
          </mesh>

          {/* Polarity Cathode Band (Strictly on Cathode Side!) */}
          <mesh position={g.bandPos} quaternion={g.quat}>
            <cylinderGeometry args={[0.119, 0.119, 0.13, 18]} />
            <meshStandardMaterial
              color={cathodeColor}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>

          {/* Subtle Conduction Glow Aura */}
          <mesh position={g.mid} quaternion={g.quat}>
            <cylinderGeometry args={[0.19, 0.19, 0.78, 16]} />
            <meshBasicMaterial
              ref={(el) => {
                haloMatRefs.current[idx] = el;
              }}
              color="#fb923c"
              transparent
              opacity={0}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      <ComponentTooltip
        id="bridgeDiodes"
        position={[holePos(6, 'C')[0], BOARD_TOP_Y + 1.35, 0]}
        title="Full-Wave Bridge Diodes (D1–D4)"
        valueText={`${diodeType} · Vf = ${vf.toFixed(2)} V`}
        subtitle={`Bridge drop 2Vf = ${(2 * vf).toFixed(2)} V · Silver band = Cathode`}
      />
    </group>
  );
};
