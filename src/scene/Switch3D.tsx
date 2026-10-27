import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useLabStore } from '../store/useLabStore';
import { ComponentTooltip, useComponentInteraction } from './ComponentTooltip';

export const Switch3D: React.FC = () => {
  const switchClosed = useLabStore((s) => s.params.switchClosed);
  const acVrms = useLabStore((s) => s.params.acVrms);
  const acFrequencyHz = useLabStore((s) => s.params.acFrequencyHz);
  const togglePowerSwitch = useLabStore((s) => s.togglePowerSwitch);
  const selectComponent = useLabStore((s) => s.selectComponent);

  const swInteract = useComponentInteraction('powerSwitch');
  const acInteract = useComponentInteraction('acSource');

  const rockerRef = useRef<THREE.Group>(null);
  const currentAngleRef = useRef(switchClosed ? 0.34 : -0.34);

  useFrame((_, delta) => {
    const target = switchClosed ? 0.34 : -0.34;
    currentAngleRef.current = THREE.MathUtils.lerp(
      currentAngleRef.current,
      target,
      Math.min(1, delta * 14)
    );
    if (rockerRef.current) {
      rockerRef.current.rotation.z = currentAngleRef.current;
    }
  });

  return (
    <group>
      {/* 1. AC Mains Input Terminal Block (Clickable for AC Source RMS/Freq) */}
      <group
        position={[-11.4, 0, -2.1]}
        {...acInteract.handlers}
      >
        {/* Insulated Bakelite Terminal Base */}
        <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.65, 0.84, 1.9]} />
          <meshStandardMaterial
            color={acInteract.highlighted ? '#334155' : '#1e293b'}
            emissive={acInteract.highlighted ? '#0ea5e9' : '#000000'}
            emissiveIntensity={acInteract.highlighted ? 0.22 : 0}
            roughness={0.5}
            metalness={0.2}
          />
        </mesh>

        {/* Incoming 3-core Insulated Mains Cable */}
        <mesh position={[-1.35, 0.38, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 1.3, 16]} />
          <meshStandardMaterial color="#111827" roughness={0.8} />
        </mesh>

        {/* High Voltage Caution Top Badge */}
        <mesh position={[0, 0.85, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.3, 1.5]} />
          <meshStandardMaterial color="#eab308" roughness={0.4} />
        </mesh>

        {/* Brass Screw Terminals (L & N) */}
        <mesh position={[0.45, 0.92, -0.45]}>
          <cylinderGeometry args={[0.13, 0.13, 0.16, 14]} />
          <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh position={[0.45, 0.92, 0.45]}>
          <cylinderGeometry args={[0.13, 0.13, 0.16, 14]} />
          <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.25} />
        </mesh>

        <ComponentTooltip
          id="acSource"
          position={[0, 1.7, 0]}
          title="AC Mains Source"
          valueText={`${acVrms} V RMS · ${acFrequencyHz} Hz`}
          subtitle={`Peak: ±${(acVrms * Math.SQRT2).toFixed(1)} V`}
        />
      </group>

      {/* 2. Mains Series SPST Toggle / Rocker Switch */}
      <group
        position={[-11.1, 0, 0.65]}
        onPointerOver={swInteract.handlers.onPointerOver}
        onPointerOut={swInteract.handlers.onPointerOut}
        onClick={(e) => {
          e.stopPropagation();
          selectComponent('powerSwitch');
          togglePowerSwitch();
        }}
      >
        {/* Switch Enclosure Box */}
        <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.55, 1.1, 1.85]} />
          <meshStandardMaterial
            color={swInteract.highlighted ? '#273549' : '#182230'}
            emissive={swInteract.highlighted ? '#0ea5e9' : '#000000'}
            emissiveIntensity={swInteract.highlighted ? 0.25 : 0}
            roughness={0.5}
            metalness={0.25}
          />
        </mesh>

        {/* Chrome Bezel */}
        <mesh position={[0, 1.14, 0]}>
          <boxGeometry args={[1.15, 0.1, 1.35]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.25} />
        </mesh>

        {/* Animated Illuminated Red Rocker Actuator + Chrome Toggle Lever */}
        <group ref={rockerRef} position={[0, 1.16, 0]}>
          <mesh position={[0, 0.12, 0]} castShadow>
            <boxGeometry args={[0.92, 0.3, 1.05]} />
            <meshStandardMaterial
              color={switchClosed ? '#ef4444' : '#7f1d1d'}
              emissive={switchClosed ? '#ef4444' : '#000000'}
              emissiveIntensity={switchClosed ? 0.75 : 0}
              roughness={0.32}
              metalness={0.1}
            />
          </mesh>
          {/* Metallic Bat Handle for tactile clarity from any camera angle */}
          <mesh position={[0, 0.48, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.1, 0.55, 14]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.15} />
          </mesh>
          <mesh position={[0, 0.76, 0]}>
            <sphereGeometry args={[0.11, 14, 14]} />
            <meshStandardMaterial
              color={switchClosed ? '#22c55e' : '#94a3b8'}
              emissive={switchClosed ? '#22c55e' : '#000000'}
              emissiveIntensity={switchClosed ? 0.5 : 0}
              metalness={0.5}
              roughness={0.25}
            />
          </mesh>
        </group>

        <ComponentTooltip
          id="powerSwitch"
          position={[0, 2.35, 0]}
          title="Mains Power Switch"
          valueText={switchClosed ? 'ON (Closed)' : 'OFF (Open)'}
          subtitle="Click switch to toggle mains power"
        />
      </group>
    </group>
  );
};
