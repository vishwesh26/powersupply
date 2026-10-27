import { create } from 'zustand';
import {
  createDefaultParameters,
  createInitialEngineState,
  explainCircuitBehavior,
  resetEngineFaults,
  stepBatch,
  stepCircuit,
} from '../engine/simulator';
import {
  CircuitParameters,
  ComponentId,
  DiodeModelType,
  EngineState,
  FaultFlags,
  SamplePoint,
  VoltmeterReading,
} from '../engine/types';
import { DIODE_PRESET_DROPS } from '../engine/bridgeRectifier';

export type SimRunState = 'running' | 'paused' | 'stopped';
export type TimeScaleOption = 1 | 0.1 | 0.01;
export type CameraPresetId = 'default' | 'top' | 'front' | 'regulator';
export type ViewMode = '3d' | 'split' | 'schematic';

const SCOPE_BUFFER_CAPACITY = 3200; // At 100 us per stored point -> 320 ms of scrolling history

/**
 * High-performance mutable runtime shared between the 60 fps R3F simulation loop
 * and the 60 fps HTML5 Canvas 2D Oscilloscope without causing React GC/re-render storms.
 */
export interface LabSimulationRuntime {
  engine: EngineState;
  scopeBuffer: SamplePoint[];
  accumulatorSec: number;
}

function createPrewarmedRuntime(params: CircuitParameters): LabSimulationRuntime {
  const engine = createInitialEngineState(params);
  // Pre-warm 160 ms (8 cycles at 50 Hz) so initial render shows live waveforms & settled voltmeter
  const points = stepBatch(engine, params, 6400, 4); // 6400 * 25us = 160ms; decimate 4 -> 100us scope resolution
  return {
    engine,
    scopeBuffer: points.slice(-SCOPE_BUFFER_CAPACITY),
    accumulatorSec: 0,
  };
}

const initialParams = createDefaultParameters();
export const labRuntime: LabSimulationRuntime = createPrewarmedRuntime(initialParams);

export interface LabStoreState {
  params: CircuitParameters;
  runState: SimRunState;
  timeScale: TimeScaleOption;

  // Interactive selection & cross-highlighting
  selectedComponent: ComponentId | null;
  hoveredComponent: ComponentId | null;
  highlightedTrace: number | null; // 0=AC, 1=Sec, 2=Rect, 3=Filter, 4=RegOut
  orbitEnabled: boolean;

  // Layout & Camera
  cameraPreset: { id: CameraPresetId; seq: number };
  viewMode: ViewMode;
  scopeCollapsed: boolean;
  scopeTimePerDivMs: 2 | 5 | 10 | 20;
  scopeAutoScale: [boolean, boolean, boolean, boolean, boolean];
  scopeManualVPerDiv: [number, number, number, number, number];
  activeModal: 'none' | 'selfCheck' | 'about';

  // Live UI telemetry snapshot
  latestSample: SamplePoint;
  voltmeter: VoltmeterReading;
  faults: FaultFlags;
  whyExplanation: string;
  lastEditedLabel: string | null;

  // Actions
  updateParams: (partial: Partial<CircuitParameters>, editedLabel?: string) => void;
  setDiodePreset: (type: DiodeModelType) => void;
  togglePowerSwitch: () => void;
  setRunState: (state: SimRunState) => void;
  stopAndResetSimulation: () => void;
  resetAllToDefaults: () => void;
  resetFaults: () => void;
  setTimeScale: (scale: TimeScaleOption) => void;
  selectComponent: (id: ComponentId | null) => void;
  hoverComponent: (id: ComponentId | null) => void;
  setHighlightedTrace: (traceIdx: number | null) => void;
  setOrbitEnabled: (enabled: boolean) => void;
  triggerCameraPreset: (id: CameraPresetId) => void;
  setViewMode: (mode: ViewMode) => void;
  setScopeCollapsed: (collapsed: boolean) => void;
  setScopeTimePerDivMs: (ms: 2 | 5 | 10 | 20) => void;
  toggleScopeAutoScale: (chIdx: number) => void;
  setScopeManualVPerDiv: (chIdx: number, vPerDiv: number) => void;
  setActiveModal: (modal: 'none' | 'selfCheck' | 'about') => void;

  // Called by animation frame loop to advance physics and sync UI snapshot
  advanceSimulationFrame: (wallDeltaSec: number, syncUiSnapshot: boolean) => void;
}

export const useLabStore = create<LabStoreState>((set, get) => ({
  params: initialParams,
  runState: 'running',
  timeScale: 1,

  selectedComponent: null,
  hoveredComponent: null,
  highlightedTrace: null,
  orbitEnabled: true,

  cameraPreset: { id: 'default', seq: 0 },
  viewMode: '3d',
  scopeCollapsed: false,
  scopeTimePerDivMs: 5,
  scopeAutoScale: [true, true, true, true, true],
  scopeManualVPerDiv: [150, 10, 8, 5, 2],
  activeModal: 'none',

  latestSample: labRuntime.engine.lastSample,
  voltmeter: labRuntime.engine.voltmeter,
  faults: labRuntime.engine.faults,
  whyExplanation: explainCircuitBehavior(
    initialParams,
    labRuntime.engine.lastSample,
    labRuntime.engine.voltmeter
  ),
  lastEditedLabel: null,

  updateParams: (partial, editedLabel) => {
    const nextParams = { ...get().params, ...partial };
    // Immediately advance a small burst so measurements, faults, and scope react within 1 frame
    const burst = stepBatch(labRuntime.engine, nextParams, 16, 4);
    for (let i = 0; i < burst.length; i++) {
      labRuntime.scopeBuffer.push(burst[i]);
    }
    if (labRuntime.scopeBuffer.length > SCOPE_BUFFER_CAPACITY) {
      labRuntime.scopeBuffer.splice(
        0,
        labRuntime.scopeBuffer.length - SCOPE_BUFFER_CAPACITY
      );
    }

    set({
      params: nextParams,
      latestSample: labRuntime.engine.lastSample,
      voltmeter: labRuntime.engine.voltmeter,
      faults: labRuntime.engine.faults,
      whyExplanation: explainCircuitBehavior(
        nextParams,
        labRuntime.engine.lastSample,
        labRuntime.engine.voltmeter
      ),
      lastEditedLabel: editedLabel ?? get().lastEditedLabel,
    });
  },

  setDiodePreset: (type) => {
    const drop =
      type === 'custom'
        ? get().params.diodeForwardDropV
        : DIODE_PRESET_DROPS[type];
    get().updateParams(
      { diodeType: type, diodeForwardDropV: drop },
      `Bridge Diodes → ${type} (Vf = ${drop.toFixed(2)} V)`
    );
  },

  togglePowerSwitch: () => {
    const nextClosed = !get().params.switchClosed;
    get().updateParams(
      { switchClosed: nextClosed },
      `Mains Power Switch → ${nextClosed ? 'ON' : 'OFF'}`
    );
  },

  setRunState: (runState) => set({ runState }),

  stopAndResetSimulation: () => {
    const params = get().params;
    labRuntime.engine = createInitialEngineState(params);
    labRuntime.scopeBuffer = [];
    labRuntime.accumulatorSec = 0;
    stepCircuit(labRuntime.engine, params);
    labRuntime.scopeBuffer.push(labRuntime.engine.lastSample);

    set({
      runState: 'stopped',
      latestSample: labRuntime.engine.lastSample,
      voltmeter: labRuntime.engine.voltmeter,
      faults: labRuntime.engine.faults,
      whyExplanation: 'Simulation stopped and capacitor state reset to 0 V. Click Run to watch turn-on inrush transient.',
    });
  },

  resetAllToDefaults: () => {
    const defaults = createDefaultParameters();
    const fresh = createPrewarmedRuntime(defaults);
    labRuntime.engine = fresh.engine;
    labRuntime.scopeBuffer = fresh.scopeBuffer;
    labRuntime.accumulatorSec = 0;

    set({
      params: defaults,
      runState: 'running',
      timeScale: 1,
      latestSample: labRuntime.engine.lastSample,
      voltmeter: labRuntime.engine.voltmeter,
      faults: labRuntime.engine.faults,
      whyExplanation: explainCircuitBehavior(
        defaults,
        labRuntime.engine.lastSample,
        labRuntime.engine.voltmeter
      ),
      lastEditedLabel: 'Restored default lab bench parameters',
    });
  },

  resetFaults: () => {
    const params = get().params;
    resetEngineFaults(labRuntime.engine, params);
    stepCircuit(labRuntime.engine, params);
    set({
      latestSample: labRuntime.engine.lastSample,
      voltmeter: labRuntime.engine.voltmeter,
      faults: labRuntime.engine.faults,
      whyExplanation: explainCircuitBehavior(
        params,
        labRuntime.engine.lastSample,
        labRuntime.engine.voltmeter
      ),
      lastEditedLabel: 'Cleared latched component faults & reset IC temperature to 25 °C',
    });
  },

  setTimeScale: (timeScale) => set({ timeScale }),
  selectComponent: (selectedComponent) => set({ selectedComponent }),
  hoverComponent: (hoveredComponent) => set({ hoveredComponent }),
  setHighlightedTrace: (highlightedTrace) => set({ highlightedTrace }),
  setOrbitEnabled: (orbitEnabled) => set({ orbitEnabled }),

  triggerCameraPreset: (id) =>
    set((s) => ({ cameraPreset: { id, seq: s.cameraPreset.seq + 1 } })),

  setViewMode: (viewMode) => set({ viewMode }),
  setScopeCollapsed: (scopeCollapsed) => set({ scopeCollapsed }),
  setScopeTimePerDivMs: (scopeTimePerDivMs) => set({ scopeTimePerDivMs }),

  toggleScopeAutoScale: (chIdx) =>
    set((s) => {
      const next = [...s.scopeAutoScale] as [
        boolean,
        boolean,
        boolean,
        boolean,
        boolean,
      ];
      next[chIdx] = !next[chIdx];
      return { scopeAutoScale: next };
    }),

  setScopeManualVPerDiv: (chIdx, vPerDiv) =>
    set((s) => {
      const next = [...s.scopeManualVPerDiv] as [
        number,
        number,
        number,
        number,
        number,
      ];
      next[chIdx] = Math.max(0.1, vPerDiv);
      const nextAuto = [...s.scopeAutoScale] as [
        boolean,
        boolean,
        boolean,
        boolean,
        boolean,
      ];
      nextAuto[chIdx] = false;
      return { scopeManualVPerDiv: next, scopeAutoScale: nextAuto };
    }),

  setActiveModal: (activeModal) => set({ activeModal }),

  advanceSimulationFrame: (wallDeltaSec, syncUiSnapshot) => {
    const { runState, timeScale, params } = get();
    if (runState !== 'running') return;

    // Clamp wallDeltaSec to avoid giant catch-up spikes when switching browser tabs
    const clampedWall = Math.min(0.05, Math.max(0, wallDeltaSec));
    const simDelta = clampedWall * timeScale;
    labRuntime.accumulatorSec += simDelta;

    const dt = labRuntime.engine.dtSec;
    const stepsToRun = Math.floor(labRuntime.accumulatorSec / dt);

    if (stepsToRun > 0) {
      labRuntime.accumulatorSec -= stepsToRun * dt;
      // Adaptive scope decimation so slow-motion (0.01x) still produces smooth scope points
      const decimation = timeScale === 1 ? 4 : timeScale === 0.1 ? 2 : 1;
      const newPoints = stepBatch(labRuntime.engine, params, stepsToRun, decimation);
      for (let i = 0; i < newPoints.length; i++) {
        labRuntime.scopeBuffer.push(newPoints[i]);
      }
      if (labRuntime.scopeBuffer.length > SCOPE_BUFFER_CAPACITY) {
        labRuntime.scopeBuffer.splice(
          0,
          labRuntime.scopeBuffer.length - SCOPE_BUFFER_CAPACITY
        );
      }
    }

    if (syncUiSnapshot) {
      set({
        latestSample: labRuntime.engine.lastSample,
        voltmeter: labRuntime.engine.voltmeter,
        faults: labRuntime.engine.faults,
        whyExplanation: explainCircuitBehavior(
          params,
          labRuntime.engine.lastSample,
          labRuntime.engine.voltmeter
        ),
      });
    }
  },
}));
