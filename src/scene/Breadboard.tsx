import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  BOARD_TOP_Y,
  COL_COUNT,
  colX,
  RAIL_ROWS,
  rowZ,
  STRIP_ROWS,
} from './boardLayout';

export const Breadboard: React.FC = () => {
  const holeMeshRef = useRef<THREE.InstancedMesh>(null);

  // Compute all socket hole positions once
  const holePositions = useMemo(() => {
    const list: [number, number, number][] = [];
    // Terminal strip holes (36 cols x 10 rows)
    for (let c = 1; c <= COL_COUNT; c++) {
      const x = colX(c);
      for (const r of STRIP_ROWS) {
        list.push([x, BOARD_TOP_Y + 0.004, rowZ(r)]);
      }
    }
    // Power rail holes (grouped in clusters of 5 with 1-col spacing, skipping every 6th col for realism, EXCEPT keeping cols we wire into!)
    // Actually on continuous 36-col rails, keeping all 36 holes (or subtle visual grouping marks) ensures any col jumper aligns cleanly with a hole!
    for (let c = 1; c <= COL_COUNT; c++) {
      const x = colX(c);
      for (const r of RAIL_ROWS) {
        list.push([x, BOARD_TOP_Y + 0.004, rowZ(r)]);
      }
    }
    return list;
  }, []);

  useEffect(() => {
    const mesh = holeMeshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < holePositions.length; i++) {
      const [x, y, z] = holePositions[i];
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [holePositions]);

  // Procedural CanvasTexture for crisp red/blue rail lines & row/column silkscreen markings
  const silkscreenTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Base ivory ABS tone
    ctx.fillStyle = '#f2efe6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle plastic grain / micro-speckle
    ctx.fillStyle = 'rgba(180, 174, 158, 0.14)';
    for (let i = 0; i < 1200; i++) {
      const rx = (i * 7919) % canvas.width;
      const ry = (i * 6271) % canvas.height;
      ctx.fillRect(rx, ry, 2, 2);
    }

    // World bounds of board top plane: center X = 1.2, width = 16.0 => X in [-6.8, +9.2]
    // Center Z = 0.0, depth = 8.4 => Z in [-4.2, +4.2]
    const toU = (wx: number) => ((wx - -6.8) / 16.0) * canvas.width;
    const toV = (wz: number) => ((wz - -4.2) / 8.4) * canvas.height;

    // Center IC DIP channel shadow recess
    const trenchTop = toV(-0.32);
    const trenchBot = toV(0.32);
    ctx.fillStyle = '#ded9cc';
    ctx.fillRect(toU(-6.5), trenchTop, toU(8.9) - toU(-6.5), trenchBot - trenchTop);
    ctx.strokeStyle = '#c8c2b2';
    ctx.lineWidth = 3;
    ctx.strokeRect(toU(-6.5), trenchTop, toU(8.9) - toU(-6.5), trenchBot - trenchTop);

    // Rail separator grooves
    ctx.fillStyle = '#e3ded1';
    ctx.fillRect(toU(-6.5), toV(-2.85), toU(8.9) - toU(-6.5), 8);
    ctx.fillRect(toU(-6.5), toV(2.8), toU(8.9) - toU(-6.5), 8);

    // Power rail stripes (Blue for GND, Red for +V)
    const xStart = toU(colX(1) - 0.25);
    const xEnd = toU(colX(COL_COUNT) + 0.25);

    // Top Blue (-) stripe
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(xStart, toV(-3.98));
    ctx.lineTo(xEnd, toV(-3.98));
    ctx.stroke();

    // Top Red (+) stripe
    ctx.strokeStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(xStart, toV(-3.03));
    ctx.lineTo(xEnd, toV(-3.03));
    ctx.stroke();

    // Bottom Red (+) stripe
    ctx.strokeStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(xStart, toV(3.03));
    ctx.lineTo(xEnd, toV(3.03));
    ctx.stroke();

    // Bottom Blue (-) stripe
    ctx.strokeStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.moveTo(xStart, toV(3.98));
    ctx.lineTo(xEnd, toV(3.98));
    ctx.stroke();

    // + and - symbols
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1d4ed8';
    ctx.fillText('−', toU(-6.35), toV(-3.7));
    ctx.fillText('−', toU(8.75), toV(-3.7));
    ctx.fillText('−', toU(-6.35), toV(3.7));
    ctx.fillText('−', toU(8.75), toV(3.7));

    ctx.fillStyle = '#dc2626';
    ctx.fillText('+', toU(-6.35), toV(-3.3));
    ctx.fillText('+', toU(8.75), toV(-3.3));
    ctx.fillText('+', toU(-6.35), toV(3.3));
    ctx.fillText('+', toU(8.75), toV(3.3));

    // Row letters A..J
    ctx.fillStyle = '#57534e';
    ctx.font = 'bold 22px monospace';
    for (const r of STRIP_ROWS) {
      ctx.fillText(r, toU(-6.3), toV(rowZ(r)));
      ctx.fillText(r, toU(8.7), toV(rowZ(r)));
    }

    // Column numbers 1, 5, 10, 15, 20, 25, 30, 35
    ctx.font = 'bold 19px monospace';
    ctx.fillStyle = '#64748b';
    for (let c = 1; c <= COL_COUNT; c++) {
      if (c === 1 || c % 5 === 0) {
        ctx.fillText(String(c), toU(colX(c)), toV(-2.62));
        ctx.fillText(String(c), toU(colX(c)), toV(2.62));
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <group position={[0, 0, 0]}>
      {/* Main ABS Breadboard Body */}
      <mesh position={[1.2, BOARD_TOP_Y / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[16.0, BOARD_TOP_Y, 8.4]} />
        <meshStandardMaterial color="#e8e4d8" roughness={0.65} metalness={0.04} />
      </mesh>

      {/* Silkscreened Top Deck Plane */}
      <mesh
        position={[1.2, BOARD_TOP_Y + 0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[16.0, 8.4]} />
        <meshStandardMaterial
          map={silkscreenTexture}
          roughness={0.58}
          metalness={0.02}
        />
      </mesh>

      {/* Instanced Socket Holes (1 draw call for all 504 holes) */}
      <instancedMesh
        ref={holeMeshRef}
        args={[undefined, undefined, holePositions.length]}
      >
        <boxGeometry args={[0.14, 0.01, 0.14]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} metalness={0.3} />
      </instancedMesh>
    </group>
  );
};
