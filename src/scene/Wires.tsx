import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SamplePoint } from '../engine/types';
import { labRuntime, useLabStore } from '../store/useLabStore';
import { BOARD_TOP_Y, holePos } from './boardLayout';

type CurrentSourceKind =
  | 'acPrimary'
  | 'acSecondaryPos'
  | 'acSecondaryNeg'
  | 'rectifiedBus'
  | 'filterToReg'
  | 'regOut'
  | 'adjLoop'
  | 'groundReturn';

interface WireSpec {
  id: string;
  color: string;
  radius: number;
  points: [number, number, number][];
  traceIndex: number; // 0=AC, 1=Sec, 2=Rect, 3=Filter, 4=RegOut
  currentKind: CurrentSourceKind;
  particleCount: number;
  lm317Only?: boolean;
  fixedRegOnly?: boolean;
}

function makeJumperPoints(
  start: [number, number, number],
  end: [number, number, number],
  archHeight = 0.22
): [number, number, number][] {
  const midX = (start[0] + end[0]) / 2;
  const midZ = (start[2] + end[2]) / 2;
  const topY = Math.max(start[1], end[1]) + archHeight;
  return [
    start,
    [start[0], topY * 0.85, start[2]],
    [midX, topY, midZ],
    [end[0], topY * 0.85, end[2]],
    end,
  ];
}

function buildWireSpecs(): WireSpec[] {
  return [
    // --- AC MAINS PRIMARY WIRES (Trace 0) ---
    {
      id: 'ac-live-to-sw',
      color: '#b45309', // Brown Mains Live
      radius: 0.048,
      points: [
        [-10.95, 0.92, -2.55],
        [-10.95, 1.35, -1.2],
        [-11.1, 1.05, 0.1],
      ],
      traceIndex: 0,
      currentKind: 'acPrimary',
      particleCount: 6,
    },
    {
      id: 'sw-to-xfmr-pri1',
      color: '#ef4444', // Switched Live to Transformer Primary
      radius: 0.048,
      points: [
        [-10.55, 0.85, 0.85],
        [-9.9, 1.45, 0.7],
        [-9.57, 1.65, 0.55],
      ],
      traceIndex: 0,
      currentKind: 'acPrimary',
      particleCount: 6,
    },
    {
      id: 'ac-neutral-to-xfmr-pri2',
      color: '#2563eb', // Blue Mains Neutral
      radius: 0.048,
      points: [
        [-10.95, 0.92, -1.65],
        [-10.1, 1.35, -1.05],
        [-9.57, 1.65, -0.55],
      ],
      traceIndex: 0,
      currentKind: 'acPrimary',
      particleCount: 6,
    },

    // --- TRANSFORMER SECONDARY AC WIRES (Trace 1: Yellow & Green) ---
    {
      id: 'xfmr-sec1-to-board',
      color: '#eab308', // Yellow AC Secondary 1 -> (col 3, row C)
      radius: 0.046,
      points: [
        [-7.13, 1.65, -0.75],
        [-6.3, 1.45, -1.25],
        [holePos(3, 'C')[0], BOARD_TOP_Y + 0.55, holePos(3, 'C')[2]],
        holePos(3, 'C'),
      ],
      traceIndex: 1,
      currentKind: 'acSecondaryPos',
      particleCount: 9,
    },
    {
      id: 'xfmr-sec2-to-board',
      color: '#22c55e', // Green AC Secondary 2 -> (col 3, row H)
      radius: 0.046,
      points: [
        [-7.13, 1.65, 0.75],
        [-6.25, 1.45, 1.3],
        [holePos(3, 'H')[0], BOARD_TOP_Y + 0.55, holePos(3, 'H')[2]],
        holePos(3, 'H'),
      ],
      traceIndex: 1,
      currentKind: 'acSecondaryNeg',
      particleCount: 9,
    },

    // --- BRIDGE OUTPUT & UNREGULATED FILTER DC+ RAIL (Trace 2 / Trace 3: Red) ---
    {
      id: 'bridge-plus-to-rail',
      color: '#dc2626',
      radius: 0.038,
      points: makeJumperPoints(holePos(9, 'A'), holePos(9, 'TOP_PLUS'), 0.25),
      traceIndex: 2,
      currentKind: 'rectifiedBus',
      particleCount: 5,
    },
    {
      id: 'rail-plus-bridge-to-cap',
      color: '#dc2626',
      radius: 0.038,
      points: makeJumperPoints(holePos(9, 'TOP_PLUS'), holePos(13, 'TOP_PLUS'), 0.14),
      traceIndex: 3,
      currentKind: 'rectifiedBus',
      particleCount: 5,
    },
    {
      id: 'rail-plus-to-c1',
      color: '#dc2626',
      radius: 0.038,
      points: makeJumperPoints(holePos(13, 'TOP_PLUS'), holePos(13, 'A'), 0.22),
      traceIndex: 3,
      currentKind: 'rectifiedBus',
      particleCount: 4,
    },
    {
      id: 'rail-plus-c1-to-reg',
      color: '#dc2626',
      radius: 0.038,
      points: makeJumperPoints(holePos(13, 'TOP_PLUS'), holePos(21, 'TOP_PLUS'), 0.18),
      traceIndex: 3,
      currentKind: 'filterToReg',
      particleCount: 9,
    },
    {
      id: 'rail-plus-to-c2',
      color: '#dc2626',
      radius: 0.034,
      points: makeJumperPoints(holePos(18, 'TOP_PLUS'), holePos(18, 'A'), 0.18),
      traceIndex: 3,
      currentKind: 'filterToReg',
      particleCount: 3,
    },
    {
      id: 'rail-plus-to-reg-in',
      color: '#dc2626',
      radius: 0.04,
      points: makeJumperPoints(holePos(21, 'TOP_PLUS'), holePos(21, 'A'), 0.24),
      traceIndex: 3,
      currentKind: 'filterToReg',
      particleCount: 5,
    },

    // --- REGULATED OUTPUT DC+ RAIL (Trace 4: Bright Red) ---
    {
      id: 'reg-out-to-bot-plus',
      color: '#ef4444',
      radius: 0.042,
      points: makeJumperPoints(holePos(23, 'E'), holePos(23, 'BOT_PLUS'), 0.48),
      traceIndex: 4,
      currentKind: 'regOut',
      particleCount: 10,
    },
    {
      id: 'bot-plus-to-load-rail',
      color: '#ef4444',
      radius: 0.038,
      points: makeJumperPoints(holePos(23, 'BOT_PLUS'), holePos(33, 'BOT_PLUS'), 0.18),
      traceIndex: 4,
      currentKind: 'regOut',
      particleCount: 10,
    },
    {
      id: 'bot-plus-to-c3',
      color: '#ef4444',
      radius: 0.034,
      points: makeJumperPoints(holePos(30, 'BOT_PLUS'), holePos(30, 'J'), 0.2),
      traceIndex: 4,
      currentKind: 'regOut',
      particleCount: 3,
    },
    {
      id: 'bot-plus-to-load',
      color: '#ef4444',
      radius: 0.04,
      points: makeJumperPoints(holePos(33, 'BOT_PLUS'), holePos(33, 'J'), 0.24),
      traceIndex: 4,
      currentKind: 'regOut',
      particleCount: 5,
    },

    // --- GROUND WIRES (Black) ---
    {
      id: 'bridge-gnd-to-bot-gnd',
      color: '#1e293b',
      radius: 0.038,
      points: makeJumperPoints(holePos(6, 'J'), holePos(6, 'BOT_GND'), 0.22),
      traceIndex: 2,
      currentKind: 'groundReturn',
      particleCount: 5,
    },
    {
      id: 'gnd-rail-tie-left',
      color: '#1e293b',
      radius: 0.038,
      points: makeJumperPoints(holePos(1, 'BOT_GND'), holePos(1, 'TOP_GND'), 0.35),
      traceIndex: 3,
      currentKind: 'groundReturn',
      particleCount: 8,
    },
    {
      id: 'c1-minus-to-top-gnd',
      color: '#1e293b',
      radius: 0.038,
      points: makeJumperPoints(holePos(15, 'A'), holePos(15, 'TOP_GND'), 0.22),
      traceIndex: 3,
      currentKind: 'groundReturn',
      particleCount: 4,
    },
    {
      id: 'c2-minus-to-top-gnd',
      color: '#1e293b',
      radius: 0.034,
      points: makeJumperPoints(holePos(19, 'A'), holePos(19, 'TOP_GND'), 0.18),
      traceIndex: 3,
      currentKind: 'groundReturn',
      particleCount: 2,
    },
    {
      id: 'fixed-reg-gnd',
      color: '#1e293b',
      radius: 0.038,
      points: makeJumperPoints(holePos(22, 'A'), holePos(22, 'TOP_GND'), 0.22),
      traceIndex: 4,
      currentKind: 'groundReturn',
      particleCount: 4,
      fixedRegOnly: true,
    },
    {
      id: 'lm317-adj-to-pot',
      color: '#38bdf8', // Cyan/Blue ADJ node sense jumper (col 22 E -> col 26 F)
      radius: 0.036,
      points: makeJumperPoints(holePos(22, 'E'), holePos(26, 'F'), 0.38),
      traceIndex: 4,
      currentKind: 'adjLoop',
      particleCount: 5,
      lm317Only: true,
    },
    {
      id: 'lm317-r1-to-pot-wiper',
      color: '#38bdf8',
      radius: 0.034,
      points: makeJumperPoints(holePos(26, 'E'), holePos(26, 'H'), 0.3),
      traceIndex: 4,
      currentKind: 'adjLoop',
      particleCount: 4,
      lm317Only: true,
    },
    {
      id: 'lm317-pot-to-gnd',
      color: '#1e293b',
      radius: 0.036,
      points: makeJumperPoints(holePos(27, 'J'), holePos(27, 'BOT_GND'), 0.2),
      traceIndex: 4,
      currentKind: 'adjLoop',
      particleCount: 4,
      lm317Only: true,
    },
    {
      id: 'c3-minus-to-bot-gnd',
      color: '#1e293b',
      radius: 0.034,
      points: makeJumperPoints(holePos(31, 'J'), holePos(31, 'BOT_GND'), 0.2),
      traceIndex: 4,
      currentKind: 'groundReturn',
      particleCount: 2,
    },
    {
      id: 'load-minus-to-bot-gnd',
      color: '#1e293b',
      radius: 0.04,
      points: makeJumperPoints(holePos(36, 'J'), holePos(36, 'BOT_GND'), 0.24),
      traceIndex: 4,
      currentKind: 'groundReturn',
      particleCount: 6,
    },
    {
      id: 'bot-gnd-return-bus',
      color: '#1e293b',
      radius: 0.038,
      points: makeJumperPoints(holePos(36, 'BOT_GND'), holePos(6, 'BOT_GND'), 0.16),
      traceIndex: 4,
      currentKind: 'groundReturn',
      particleCount: 10,
    },
  ];
}

function getSignedBranchCurrent(kind: CurrentSourceKind, s: SamplePoint): number {
  switch (kind) {
    case 'acPrimary':
      return Math.abs(s.vPrimarySwitched) > 1 ? s.iSecondary * 0.06 : 0;
    case 'acSecondaryPos':
      return s.iSecondary;
    case 'acSecondaryNeg':
      return -s.iSecondary;
    case 'rectifiedBus':
      return s.iRectifier;
    case 'filterToReg':
      return s.iRegIn;
    case 'regOut':
      return s.iLoad;
    case 'adjLoop':
      return s.vRegOut > 0.2 ? 0.035 : 0;
    case 'groundReturn':
      return s.iLoad;
  }
}

export const Wires: React.FC = () => {
  const regType = useLabStore((s) => s.params.regulatorType);
  const highlightedTrace = useLabStore((s) => s.highlightedTrace);
  const setHighlightedTrace = useLabStore((s) => s.setHighlightedTrace);

  const built = useMemo(() => {
    const specs = buildWireSpecs();
    let totalParticles = 0;

    const wires = specs.map((spec) => {
      const curve = new THREE.CatmullRomCurve3(
        spec.points.map((p) => new THREE.Vector3(...p))
      );
      const geometry = new THREE.TubeGeometry(curve, 24, spec.radius, 10, false);
      const startIndex = totalParticles;
      totalParticles += spec.particleCount;
      return {
        spec,
        curve,
        geometry,
        startIndex,
      };
    });

    return { wires, totalParticles };
  }, []);

  const particleMeshRef = useRef<THREE.InstancedMesh>(null);
  const phaseOffsetsRef = useRef<Float32Array>(
    new Float32Array(built.totalParticles).map(
      (_, idx) => (idx * 0.61803398875) % 1
    )
  );
  const dummyObj = useMemo(() => new THREE.Object3D(), []);
  const tempVec = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const mesh = particleMeshRef.current;
    if (!mesh) return;

    const store = useLabStore.getState();
    const runMultiplier = store.runState === 'running' ? 1 : 0;
    // Tie 3D particle velocity smoothly to simulation timeScale (with gentle perceptual scaling so 0.01x is still visibly flowing)
    const speedTimeFactor =
      store.timeScale === 1 ? 1.0 : store.timeScale === 0.1 ? 0.42 : 0.18;

    const sample = labRuntime.engine.lastSample;
    const isLm317 = store.params.regulatorType === 'LM317';

    for (let wIdx = 0; wIdx < built.wires.length; wIdx++) {
      const w = built.wires[wIdx];
      const activeWire =
        (w.spec.lm317Only ? isLm317 : true) &&
        (w.spec.fixedRegOnly ? !isLm317 : true);

      const branchI = activeWire
        ? getSignedBranchCurrent(w.spec.currentKind, sample)
        : 0;
      const absI = Math.abs(branchI);

      // Visible flow threshold: stops completely when switch is OFF & discharged
      const visible = activeWire && absI > 0.0015;
      const direction = branchI >= 0 ? 1 : -1;

      // Speed proportional to current magnitude (clamped for smooth legibility)
      const normalizedSpeed = Math.min(2.6, 0.35 + Math.sqrt(absI) * 2.4);
      const stepU =
        delta * runMultiplier * speedTimeFactor * normalizedSpeed * direction;

      const particleScale = visible
        ? Math.min(1.35, 0.55 + Math.sqrt(absI) * 1.1)
        : 0.0001;

      for (let k = 0; k < w.spec.particleCount; k++) {
        const pIdx = w.startIndex + k;
        if (visible) {
          let nextU =
            (phaseOffsetsRef.current[pIdx] + k / w.spec.particleCount + stepU) % 1;
          if (nextU < 0) nextU += 1;
          phaseOffsetsRef.current[pIdx] =
            (phaseOffsetsRef.current[pIdx] + stepU + 1) % 1;

          w.curve.getPointAt(nextU, tempVec);
          dummyObj.position.copy(tempVec);
          dummyObj.scale.setScalar(particleScale);
        } else {
          dummyObj.position.set(0, -10, 0);
          dummyObj.scale.setScalar(0.0001);
        }
        dummyObj.updateMatrix();
        mesh.setMatrixAt(pIdx, dummyObj.matrix);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  const isLm317 = regType === 'LM317';

  return (
    <group>
      {built.wires.map((w) => {
        if (w.spec.lm317Only && !isLm317) return null;
        if (w.spec.fixedRegOnly && isLm317) return null;

        const isHighlighted = highlightedTrace === w.spec.traceIndex;

        return (
          <mesh
            key={w.spec.id}
            geometry={w.geometry}
            castShadow
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
              setHighlightedTrace(w.spec.traceIndex);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'auto';
              if (useLabStore.getState().highlightedTrace === w.spec.traceIndex) {
                setHighlightedTrace(null);
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              setHighlightedTrace(
                highlightedTrace === w.spec.traceIndex ? null : w.spec.traceIndex
              );
            }}
          >
            <meshStandardMaterial
              color={w.spec.color}
              emissive={isHighlighted ? '#22d3ee' : '#000000'}
              emissiveIntensity={isHighlighted ? 0.65 : 0}
              roughness={0.42}
              metalness={0.12}
            />
          </mesh>
        );
      })}

      {/* Instanced Current-Flow Charge Carriers (1 Draw Call for all ~145 particles) */}
      <instancedMesh
        ref={particleMeshRef}
        args={[undefined, undefined, built.totalParticles]}
      >
        <sphereGeometry args={[0.068, 10, 10]} />
        <meshBasicMaterial color="#fde047" />
      </instancedMesh>
    </group>
  );
};
