import React, { useEffect, useMemo, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { CameraPresetId, useLabStore } from '../store/useLabStore';
import { Breadboard } from './Breadboard';
import { BridgeDiode3D } from './BridgeDiode3D';
import { CeramicCap3D } from './CeramicCap3D';
import { ElectrolyticCap3D } from './ElectrolyticCap3D';
import { Potentiometer3D } from './Potentiometer3D';
import { Regulator3D } from './Regulator3D';
import { Resistor3D } from './Resistor3D';
import { Switch3D } from './Switch3D';
import { Transformer3D } from './Transformer3D';
import { Voltmeter3D } from './Voltmeter3D';
import { Wires } from './Wires';

const CAMERA_PRESETS: Record<
  CameraPresetId,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  default: { pos: [0.4, 11.8, 13.8], target: [0.3, 0.8, 0.0] },
  top: { pos: [1.0, 18.0, 0.5], target: [1.0, 0.3, 0.0] },
  front: { pos: [0.5, 4.0, 16.2], target: [0.5, 1.0, 0.0] },
  regulator: { pos: [3.2, 4.3, 5.2], target: [2.8, 1.15, -0.3] },
};

const CameraRig: React.FC = () => {
  const orbitEnabled = useLabStore((s) => s.orbitEnabled);
  const cameraPreset = useLabStore((s) => s.cameraPreset);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();

  const animatingRef = useRef(false);
  const goalPosRef = useRef(new THREE.Vector3(...CAMERA_PRESETS.default.pos));
  const goalTargetRef = useRef(new THREE.Vector3(...CAMERA_PRESETS.default.target));

  useEffect(() => {
    const spec = CAMERA_PRESETS[cameraPreset.id];
    goalPosRef.current.set(...spec.pos);
    goalTargetRef.current.set(...spec.target);
    animatingRef.current = true;
  }, [cameraPreset]);

  useFrame((_, delta) => {
    if (!animatingRef.current || !controlsRef.current) return;
    const t = Math.min(1, delta * 6.5);
    camera.position.lerp(goalPosRef.current, t);
    controlsRef.current.target.lerp(goalTargetRef.current, t);
    controlsRef.current.update();

    if (
      camera.position.distanceTo(goalPosRef.current) < 0.05 &&
      controlsRef.current.target.distanceTo(goalTargetRef.current) < 0.05
    ) {
      animatingRef.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={orbitEnabled}
      enableDamping
      dampingFactor={0.08}
      minDistance={3.2}
      maxDistance={28}
      maxPolarAngle={Math.PI / 2 - 0.04}
      onStart={() => {
        animatingRef.current = false;
      }}
    />
  );
};

const WorkbenchSurface: React.FC = () => {
  const esdTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Deep slate-teal anti-static ESD mat color
    ctx.fillStyle = '#0f1c26';
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle bench measurement grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 1024; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 1024; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 2);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <group>
      {/* ESD Anti-Static Lab Mat */}
      <mesh
        position={[0, -0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[32, 18]} />
        <meshStandardMaterial map={esdTexture} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Dark Lab Bench Timber Base */}
      <mesh position={[0, -0.28, 0]} receiveShadow>
        <boxGeometry args={[33, 0.5, 19]} />
        <meshStandardMaterial color="#090d14" roughness={0.9} />
      </mesh>
    </group>
  );
};

export const LabScene: React.FC = () => {
  const selectComponent = useLabStore((s) => s.selectComponent);

  return (
    <div className="relative h-full w-full bg-[#090e17]">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0.4, 11.8, 13.8], fov: 40, near: 0.1, far: 100 }}
        onPointerMissed={() => {
          selectComponent(null);
        }}
      >
        <color attach="background" args={['#090e17']} />
        <fog attach="fog" args={['#090e17', 24, 42]} />

        {/* Balanced Studio Electronics Bench Lighting */}
        <ambientLight intensity={0.68} />
        <directionalLight
          position={[8, 16, 10]}
          intensity={1.25}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-16}
          shadow-camera-right={16}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <directionalLight position={[-10, 9, -6]} intensity={0.45} color="#bae6fd" />
        <pointLight position={[2, 6, 4]} intensity={0.3} color="#fef08a" />

        <CameraRig />
        <WorkbenchSurface />

        {/* All Physical Power Supply Hardware Modules */}
        <Breadboard />
        <Switch3D />
        <Transformer3D />
        <BridgeDiode3D />
        <ElectrolyticCap3D />
        <CeramicCap3D />
        <Regulator3D />
        <Resistor3D />
        <Potentiometer3D />
        <Voltmeter3D />
        <Wires />
      </Canvas>

      {/* Single Subtle On-Canvas Hint (kept minimal on purpose) */}
      <div className="pointer-events-none absolute bottom-2.5 left-3 rounded border border-slate-700/60 bg-slate-900/75 px-2.5 py-1 text-[10px] text-slate-400 backdrop-blur">
        🖱 Drag to orbit · Scroll to zoom · Click any part to edit it
      </div>
    </div>
  );
};
