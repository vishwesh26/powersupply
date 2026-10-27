import React, { useMemo } from 'react';
import * as THREE from 'three';
import { ProbeNodeType } from '../engine/types';
import { useLabStore } from '../store/useLabStore';
import { BOARD_TOP_Y, holePos } from './boardLayout';
import { ComponentTooltip, useComponentInteraction } from './ComponentTooltip';

// Custom 7-segment vector digit renderer on HTML5 Canvas
const SEG_MAP: Record<string, number[]> = {
  '0': [1, 1, 1, 1, 1, 1, 0],
  '1': [0, 1, 1, 0, 0, 0, 0],
  '2': [1, 1, 0, 1, 1, 0, 1],
  '3': [1, 1, 1, 1, 0, 0, 1],
  '4': [0, 1, 1, 0, 0, 1, 1],
  '5': [1, 0, 1, 1, 0, 1, 1],
  '6': [1, 0, 1, 1, 1, 1, 1],
  '7': [1, 1, 1, 0, 0, 0, 0],
  '8': [1, 1, 1, 1, 1, 1, 1],
  '9': [1, 1, 1, 1, 0, 1, 1],
  '-': [0, 0, 0, 0, 0, 0, 1],
  ' ': [0, 0, 0, 0, 0, 0, 0],
};

function drawSevenSegChar(
  ctx: CanvasRenderingContext2D,
  ch: string,
  x: number,
  y: number,
  w: number,
  h: number,
  litColor: string,
  dimColor: string
) {
  const segs = SEG_MAP[ch] ?? SEG_MAP[' '];
  const t = 8; // segment thickness
  const halfH = h / 2;

  const rects: [number, number, number, number][] = [
    [x + t, y, w - 2 * t, t], // a (top)
    [x + w - t, y + t, t, halfH - 1.5 * t], // b (top-right)
    [x + w - t, y + halfH + 0.5 * t, t, halfH - 1.5 * t], // c (bot-right)
    [x + t, y + h - t, w - 2 * t, t], // d (bottom)
    [x, y + halfH + 0.5 * t, t, halfH - 1.5 * t], // e (bot-left)
    [x, y + t, t, halfH - 1.5 * t], // f (top-left)
    [x + t, y + halfH - t / 2, w - 2 * t, t], // g (middle)
  ];

  rects.forEach(([rx, ry, rw, rh], idx) => {
    const on = segs[idx] === 1;
    ctx.fillStyle = on ? litColor : dimColor;
    ctx.shadowColor = on ? litColor : 'transparent';
    ctx.shadowBlur = on ? 12 : 0;
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, 3);
    ctx.fill();
  });
  ctx.shadowBlur = 0;
}

function getProbeTargets(node: ProbeNodeType): {
  redTip: [number, number, number];
  blackTip: [number, number, number];
  label: string;
} {
  switch (node) {
    case 'output':
      return {
        redTip: holePos(33, 'I', 0.04),
        blackTip: holePos(36, 'I', 0.04),
        label: 'DC OUTPUT',
      };
    case 'filter':
      return {
        redTip: holePos(13, 'D', 0.04),
        blackTip: holePos(15, 'D', 0.04),
        label: 'CAP FILTER',
      };
    case 'rectifier':
      return {
        redTip: holePos(9, 'C', 0.04),
        blackTip: holePos(6, 'H', 0.04),
        label: 'BRIDGE OUT',
      };
    case 'secondary':
      return {
        redTip: holePos(3, 'D', 0.04),
        blackTip: holePos(3, 'J', 0.04),
        label: 'XFMR SEC AC',
      };
  }
}

export const Voltmeter3D: React.FC = () => {
  const voltmeter = useLabStore((s) => s.voltmeter);
  const interact = useComponentInteraction('voltmeter');

  const probeInfo = useMemo(
    () => getProbeTargets(voltmeter.node),
    [voltmeter.node]
  );

  // 7-Segment LED Display CanvasTexture
  const displayTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Deep tinted acrylic LED window
    ctx.fillStyle = '#0d0608';
    ctx.fillRect(0, 0, 512, 256);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 244);

    // Header bar
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`NODE: ${probeInfo.label}`, 24, 38);

    ctx.fillStyle = voltmeter.node === 'secondary' ? '#fbbf24' : '#38bdf8';
    ctx.textAlign = 'right';
    ctx.fillText(voltmeter.node === 'secondary' ? 'AC RMS' : 'DC AVG', 488, 38);

    const litColor = voltmeter.isOffDisplay ? '#f87171' : '#ff2e43';
    const dimColor = '#290d12';

    const text = voltmeter.displayText;
    if (text === '---') {
      drawSevenSegChar(ctx, '-', 95, 72, 68, 122, litColor, dimColor);
      drawSevenSegChar(ctx, '-', 195, 72, 68, 122, litColor, dimColor);
      drawSevenSegChar(ctx, '-', 295, 72, 68, 122, litColor, dimColor);
    } else {
      // Parse characters and decimal points cleanly
      let cursorX = 36;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '.') {
          ctx.fillStyle = litColor;
          ctx.shadowColor = litColor;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(cursorX - 6, 188, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          cursorX += 14;
        } else {
          drawSevenSegChar(ctx, c, cursorX, 70, 62, 124, litColor, dimColor);
          cursorX += 80;
        }
      }
    }

    // Unit 'V' on right
    ctx.fillStyle = '#ff4d5e';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('V', 490, 192);

    // Ripple footer readout
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      voltmeter.isOffDisplay
        ? 'DE-ENERGIZED (0.00 V)'
        : `Vpp Ripple: ${(voltmeter.ripplePpV * 1000).toFixed(0)} mV`,
      24,
      234
    );

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [
    voltmeter.displayText,
    voltmeter.isOffDisplay,
    voltmeter.node,
    voltmeter.ripplePpV,
    probeInfo.label,
  ]);

  // Meter console position on right side of workbench
  const meterPos: [number, number, number] = [11.6, 0, 0.4];

  // Flexible silicone lead curves from meter jacks to probe handles
  const { redLeadGeo, blackLeadGeo, redTipVec, blackTipVec } = useMemo(() => {
    const rTip = new THREE.Vector3(...probeInfo.redTip);
    const bTip = new THREE.Vector3(...probeInfo.blackTip);

    const rHandleTop = rTip.clone().add(new THREE.Vector3(0.35, 1.85, 0.25));
    const bHandleTop = bTip.clone().add(new THREE.Vector3(0.45, 1.85, 0.35));

    const rJack = new THREE.Vector3(meterPos[0] - 0.55, 0.45, meterPos[2] + 0.95);
    const bJack = new THREE.Vector3(meterPos[0] + 0.25, 0.45, meterPos[2] + 0.95);

    const rCurve = new THREE.CatmullRomCurve3([
      rJack,
      new THREE.Vector3(
        (rJack.x + rHandleTop.x) / 2,
        2.35,
        Math.max(rJack.z, rHandleTop.z) + 0.8
      ),
      rHandleTop,
    ]);

    const bCurve = new THREE.CatmullRomCurve3([
      bJack,
      new THREE.Vector3(
        (bJack.x + bHandleTop.x) / 2 + 0.3,
        2.15,
        Math.max(bJack.z, bHandleTop.z) + 1.15
      ),
      bHandleTop,
    ]);

    return {
      redLeadGeo: new THREE.TubeGeometry(rCurve, 28, 0.042, 10, false),
      blackLeadGeo: new THREE.TubeGeometry(bCurve, 28, 0.042, 10, false),
      redTipVec: rTip,
      blackTipVec: bTip,
    };
  }, [probeInfo]);

  const probeTiltQuat = useMemo(() => {
    const dir = new THREE.Vector3(0.35, 1.85, 0.25).normalize();
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir
    );
  }, []);

  return (
    <group>
      {/* Benchtop Digital Voltmeter Housing */}
      <group position={meterPos} {...interact.handlers}>
        {/* Rubberized Protective Holster Base */}
        <mesh position={[0, 0.85, 0]} rotation={[-0.45, -0.22, -0.08]} castShadow>
          <boxGeometry args={[2.65, 1.85, 1.15]} />
          <meshStandardMaterial
            color={interact.highlighted ? '#eab308' : '#ca8a04'}
            emissive={interact.highlighted ? '#0ea5e9' : '#000000'}
            emissiveIntensity={interact.highlighted ? 0.22 : 0}
            roughness={0.55}
            metalness={0.1}
          />
        </mesh>

        {/* Dark Charcoal Front Instrument Faceplate */}
        <mesh position={[-0.03, 0.92, 0.08]} rotation={[-0.45, -0.22, -0.08]}>
          <boxGeometry args={[2.38, 1.62, 1.06]} />
          <meshStandardMaterial color="#1e293b" roughness={0.45} metalness={0.2} />
        </mesh>

        {/* Glowing 7-Segment LED Display Window */}
        <mesh position={[-0.08, 1.15, 0.57]} rotation={[-0.45, -0.22, -0.08]}>
          <planeGeometry args={[2.12, 1.06]} />
          <meshBasicMaterial map={displayTexture} />
        </mesh>

        {/* Red & Black Banana Input Jacks */}
        <mesh position={[-0.55, 0.45, 0.92]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.2, 16]} />
          <meshStandardMaterial color="#dc2626" roughness={0.35} />
        </mesh>
        <mesh position={[0.25, 0.45, 0.92]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.2, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.35} />
        </mesh>

        <ComponentTooltip
          id="voltmeter"
          position={[0, 2.4, 0]}
          title="Digital Bench Voltmeter"
          valueText={
            voltmeter.isOffDisplay ? '--- (OFF)' : `${voltmeter.displayText} V`
          }
          subtitle={`Probing: ${probeInfo.label} · Click to switch node`}
        />
      </group>

      {/* Red Positive Test Probe Touching Probed Node */}
      <group position={redTipVec} quaternion={probeTiltQuat}>
        {/* Sharp Stainless Probe Tip */}
        <mesh position={[0, 0.22, 0]}>
          <coneGeometry args={[0.035, 0.44, 12]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.15} />
        </mesh>
        {/* Red Insulated Finger Grip Handle */}
        <mesh position={[0, 1.15, 0]} castShadow>
          <cylinderGeometry args={[0.085, 0.065, 1.45, 14]} />
          <meshStandardMaterial color="#dc2626" roughness={0.4} />
        </mesh>
      </group>

      {/* Black Ground/Reference Test Probe Touching Return Node */}
      <group position={blackTipVec} quaternion={probeTiltQuat}>
        <mesh position={[0, 0.22, 0]}>
          <coneGeometry args={[0.035, 0.44, 12]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.15} />
        </mesh>
        <mesh position={[0, 1.15, 0]} castShadow>
          <cylinderGeometry args={[0.085, 0.065, 1.45, 14]} />
          <meshStandardMaterial color="#18181b" roughness={0.45} />
        </mesh>
      </group>

      {/* Flexible Silicone Probe Leads */}
      <mesh geometry={redLeadGeo}>
        <meshStandardMaterial color="#ef4444" roughness={0.5} />
      </mesh>
      <mesh geometry={blackLeadGeo}>
        <meshStandardMaterial color="#1f2937" roughness={0.55} />
      </mesh>

      {/* Invisible Ground Reference Plane Alignment Helper */}
      <group position={[0, BOARD_TOP_Y, 0]} visible={false} />
    </group>
  );
};
