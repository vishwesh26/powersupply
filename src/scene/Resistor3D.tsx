import React, { useMemo } from 'react';
import * as THREE from 'three';
import { computeResistorColorBands } from '../engine/loadModel';
import { ComponentId } from '../engine/types';
import { BOARD_TOP_Y, holePos, StripRow } from './boardLayout';
import { ComponentTooltip, useComponentInteraction } from './ComponentTooltip';

interface SingleAxialResistorProps {
  id: ComponentId;
  ohms: number;
  startHole: [number, StripRow];
  endHole: [number, StripRow];
  title: string;
  subtitle: string;
  inactive?: boolean;
  isScorched?: boolean;
  warningText?: string;
}

export const AxialResistorMesh: React.FC<SingleAxialResistorProps> = ({
  id,
  ohms,
  startHole,
  endHole,
  title,
  subtitle,
  inactive = false,
  isScorched = false,
  warningText,
}) => {
  const interact = useComponentInteraction(id);
  const bands = useMemo(() => computeResistorColorBands(ohms), [ohms]);

  const geom = useMemo(() => {
    const pA = new THREE.Vector3(...holePos(startHole[0], startHole[1]));
    const pB = new THREE.Vector3(...holePos(endHole[0], endHole[1]));
    const yBody = BOARD_TOP_Y + 0.42;

    const topA = new THREE.Vector3(pA.x, yBody, pA.z);
    const topB = new THREE.Vector3(pB.x, yBody, pB.z);
    const span = new THREE.Vector3().subVectors(topB, topA);
    const spanLen = span.length();
    const mid = new THREE.Vector3().addVectors(topA, topB).multiplyScalar(0.5);
    const dir = span.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir
    );

    const bandOffsets = [-0.23, -0.09, 0.05, 0.24];
    const bandPositions = bandOffsets.map((off) =>
      mid.clone().addScaledVector(dir, off)
    );

    return { pA, pB, yBody, spanLen, mid, quat, bandPositions };
  }, [startHole, endHole]);

  const opacity = inactive ? 0.26 : 1.0;
  const formatOhms =
    ohms >= 1000 ? `${(ohms / 1000).toFixed(2)} kΩ` : `${ohms.toFixed(0)} Ω`;

  // Ceramic body color shifts from warm tan (#dfcba8) to charred dark brown (#3b2314) when scorched
  const ceramicColor = isScorched ? '#3f2315' : '#e2cca8';

  return (
    <group {...interact.handlers}>
      {/* Vertical Leads */}
      <mesh position={[geom.pA.x, BOARD_TOP_Y + 0.21, geom.pA.z]}>
        <cylinderGeometry args={[0.024, 0.024, 0.45, 10]} />
        <meshStandardMaterial
          color="#cbd5e1"
          metalness={0.85}
          roughness={0.2}
          transparent={inactive}
          opacity={opacity}
        />
      </mesh>
      <mesh position={[geom.pB.x, BOARD_TOP_Y + 0.21, geom.pB.z]}>
        <cylinderGeometry args={[0.024, 0.024, 0.45, 10]} />
        <meshStandardMaterial
          color="#cbd5e1"
          metalness={0.85}
          roughness={0.2}
          transparent={inactive}
          opacity={opacity}
        />
      </mesh>

      {/* Horizontal Axial Span */}
      <mesh position={geom.mid} quaternion={geom.quat}>
        <cylinderGeometry args={[0.024, 0.024, geom.spanLen, 10]} />
        <meshStandardMaterial
          color="#cbd5e1"
          metalness={0.85}
          roughness={0.2}
          transparent={inactive}
          opacity={opacity}
        />
      </mesh>

      {/* Molded Ceramic Body */}
      <mesh position={geom.mid} quaternion={geom.quat} castShadow={!inactive}>
        <cylinderGeometry args={[0.135, 0.135, 0.72, 20]} />
        <meshStandardMaterial
          color={ceramicColor}
          emissive={
            isScorched
              ? '#b91c1c'
              : interact.highlighted
              ? '#0ea5e9'
              : '#000000'
          }
          emissiveIntensity={isScorched ? 0.38 : interact.highlighted ? 0.3 : 0}
          roughness={isScorched ? 0.85 : 0.48}
          metalness={0.05}
          transparent={inactive}
          opacity={opacity}
        />
      </mesh>

      {/* 4 EIA Color Code Rings */}
      {bands.map((band, idx) => (
        <mesh key={idx} position={geom.bandPositions[idx]} quaternion={geom.quat}>
          <cylinderGeometry args={[0.14, 0.14, 0.065, 20]} />
          <meshStandardMaterial
            color={band.hex}
            metalness={band.name === 'Gold' || band.name === 'Silver' ? 0.8 : 0.1}
            roughness={0.32}
            transparent={inactive}
            opacity={opacity}
          />
        </mesh>
      ))}

      <ComponentTooltip
        id={id}
        position={[geom.mid.x, BOARD_TOP_Y + 1.25, geom.mid.z]}
        title={title}
        valueText={formatOhms}
        subtitle={`${bands.map((b) => b.name).join(' · ')} — ${subtitle}`}
        warningText={warningText}
      />
    </group>
  );
};

import { useLabStore } from '../store/useLabStore';

export const Resistor3D: React.FC = () => {
  const loadOhms = useLabStore((s) => s.params.loadResistanceOhms);
  const loadRatingW = useLabStore((s) => s.params.loadPowerRatingW);
  const pLoad = useLabStore((s) => s.latestSample.pLoad);
  const loadScorched = useLabStore((s) => s.faults.loadScorchedLatched);
  const loadOverpower = useLabStore((s) => s.faults.loadOverpowerActive);

  const regType = useLabStore((s) => s.params.regulatorType);
  const r1Ohms = useLabStore((s) => s.params.lm317R1Ohms);

  return (
    <group>
      {/* 1. Output Load Resistor (RL) at Columns 33 -> 36, Row H */}
      <AxialResistorMesh
        id="loadResistor"
        ohms={loadOhms}
        startHole={[33, 'H']}
        endHole={[36, 'H']}
        title="Output Load Resistor (RL)"
        subtitle={`P = ${(pLoad * 1000).toFixed(0)} mW / ${(loadRatingW * 1000).toFixed(0)} mW rated`}
        isScorched={loadScorched || loadOverpower}
        warningText={
          loadOverpower
            ? `OVERPOWER! ${pLoad.toFixed(2)} W > ${loadRatingW.toFixed(2)} W rating`
            : loadScorched
            ? 'Scorched from prior overpower event'
            : undefined
        }
      />

      {/* 2. LM317 Program Resistor (R1) at Columns 23 -> 26, Row B */}
      <AxialResistorMesh
        id="lm317R1"
        ohms={r1Ohms}
        startHole={[23, 'B']}
        endHole={[26, 'B']}
        title="LM317 Reference Resistor (R1)"
        subtitle={
          regType === 'LM317'
            ? 'Sets 1.25 V / R1 reference current'
            : 'Inactive (only used with LM317)'
        }
        inactive={regType !== 'LM317'}
      />
    </group>
  );
};
