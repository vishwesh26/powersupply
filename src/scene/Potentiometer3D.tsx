import React, { useEffect, useRef, useState } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useLabStore } from '../store/useLabStore';
import { BOARD_TOP_Y, holePos } from './boardLayout';
import { ComponentTooltip, useComponentInteraction } from './ComponentTooltip';

export const Potentiometer3D: React.FC = () => {
  const regType = useLabStore((s) => s.params.regulatorType);
  const potMaxOhms = useLabStore((s) => s.params.potMaxOhms);
  const potPosition = useLabStore((s) => s.params.potPosition);
  const updateParams = useLabStore((s) => s.updateParams);
  const selectComponent = useLabStore((s) => s.selectComponent);
  const setOrbitEnabled = useLabStore((s) => s.setOrbitEnabled);

  const interact = useComponentInteraction('potentiometer');
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; startPos: number }>({
    x: 0,
    y: 0,
    startPos: potPosition,
  });

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: PointerEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = dragStartRef.current.y - e.clientY;
      const delta = (dx + dy * 0.6) / 180;
      const next = Math.max(0, Math.min(1, dragStartRef.current.startPos + delta));
      const r2 = Math.round(next * potMaxOhms);
      updateParams(
        { potPosition: next },
        `Potentiometer R2 → ${r2} Ω (${Math.round(next * 100)}%)`
      );
    };

    const handleUp = () => {
      setDragging(false);
      setOrbitEnabled(true);
      document.body.style.cursor = 'auto';
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging, potMaxOhms, setOrbitEnabled, updateParams]);

  const handleKnobPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    selectComponent('potentiometer');
    setOrbitEnabled(false);
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPos: potPosition,
    };
    document.body.style.cursor = 'ew-resize';
  };

  const p1 = holePos(25, 'G');
  const p2 = holePos(26, 'G');
  const p3 = holePos(27, 'G');
  const centerX = p2[0];
  const centerZ = p2[2];

  const isActive = regType === 'LM317';
  const opacity = isActive ? 1.0 : 0.28;
  // Mechanical rotation sweep: -135 deg (-2.35 rad) to +135 deg (+2.35 rad)
  const knobRotationY = (0.5 - potPosition) * 4.7;
  const r2Ohms = Math.round(potPosition * potMaxOhms);

  return (
    <group
      onPointerOver={interact.handlers.onPointerOver}
      onPointerOut={interact.handlers.onPointerOut}
      onClick={interact.handlers.onClick}
    >
      {/* 3 Solder Pins into Col 25, 26, 27 Row G */}
      {[p1, p2, p3].map((p, idx) => (
        <mesh key={idx} position={[p[0], BOARD_TOP_Y + 0.16, p[2]]}>
          <cylinderGeometry args={[0.025, 0.025, 0.35, 8]} />
          <meshStandardMaterial
            color="#cbd5e1"
            metalness={0.85}
            roughness={0.2}
            transparent={!isActive}
            opacity={opacity}
          />
        </mesh>
      ))}

      {/* Precision Blue Molded Potentiometer Housing */}
      <mesh position={[centerX, BOARD_TOP_Y + 0.58, centerZ]} castShadow={isActive}>
        <boxGeometry args={[1.05, 0.62, 0.95]} />
        <meshStandardMaterial
          color="#1e40af"
          emissive={
            dragging || interact.highlighted ? '#38bdf8' : '#000000'
          }
          emissiveIntensity={dragging ? 0.5 : interact.highlighted ? 0.3 : 0}
          roughness={0.42}
          metalness={0.15}
          transparent={!isActive}
          opacity={opacity}
        />
      </mesh>

      {/* Threaded Brass Bushing Collar */}
      <mesh position={[centerX, BOARD_TOP_Y + 0.96, centerZ]}>
        <cylinderGeometry args={[0.26, 0.26, 0.16, 20]} />
        <meshStandardMaterial
          color="#d4af37"
          metalness={0.85}
          roughness={0.22}
          transparent={!isActive}
          opacity={opacity}
        />
      </mesh>

      {/* Rotatable Knurled Knob (Drag horizontally/vertically in 3D!) */}
      <group
        position={[centerX, BOARD_TOP_Y + 1.32, centerZ]}
        rotation={[0, knobRotationY, 0]}
        onPointerDown={handleKnobPointerDown}
      >
        <mesh castShadow={isActive}>
          <cylinderGeometry args={[0.36, 0.39, 0.58, 24]} />
          <meshStandardMaterial
            color="#334155"
            metalness={0.55}
            roughness={0.35}
            transparent={!isActive}
            opacity={opacity}
          />
        </mesh>
        {/* Top Aluminum Cap */}
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.03, 24]} />
          <meshStandardMaterial
            color="#e2e8f0"
            metalness={0.85}
            roughness={0.2}
            transparent={!isActive}
            opacity={opacity}
          />
        </mesh>
        {/* White Pointer Indicator Line */}
        <mesh position={[0, 0.32, 0.14]}>
          <boxGeometry args={[0.06, 0.03, 0.26]} />
          <meshStandardMaterial
            color="#f97316"
            emissive="#f97316"
            emissiveIntensity={isActive ? 0.6 : 0}
            transparent={!isActive}
            opacity={opacity}
          />
        </mesh>
      </group>

      <ComponentTooltip
        id="potentiometer"
        position={[centerX, BOARD_TOP_Y + 2.25, centerZ]}
        title="10 kΩ Adjust Potentiometer (R2)"
        valueText={`${r2Ohms} Ω (${Math.round(potPosition * 100)}%)`}
        subtitle={
          isActive
            ? 'Drag knob in 3D or use slider to adjust LM317 Vout'
            : 'Inactive (select LM317 IC to enable variable output)'
        }
      />
    </group>
  );
};
