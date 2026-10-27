import React, { useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  Info,
  MoreVertical,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Square,
  Zap,
} from 'lucide-react';
import {
  CameraPresetId,
  TimeScaleOption,
  useLabStore,
  ViewMode,
} from '../store/useLabStore';

const SPEED_LABELS: Record<TimeScaleOption, string> = {
  1: '1× Real-Time',
  0.1: '0.1× Slow-Mo',
  0.01: '0.01× Very Slow',
};

const CAMERA_OPTIONS: [CameraPresetId, string][] = [
  ['default', 'Reset View'],
  ['top', 'Top View'],
  ['front', 'Front View'],
  ['regulator', 'Regulator Close-Up'],
];

const VIEW_OPTIONS: [ViewMode, string][] = [
  ['3d', '3D'],
  ['split', 'Split'],
  ['schematic', '2D'],
];

/** Small reusable popover menu trigger used for Camera & More actions. */
const MenuButton: React.FC<{
  label: React.ReactNode;
  title?: string;
  highlight?: boolean;
  children: (close: () => void) => React.ReactNode;
}> = ({ label, title, highlight, children }) => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={title}
        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
          highlight
            ? 'animate-pulse border-red-500 bg-red-500/20 text-red-200'
            : open
            ? 'border-cyan-500/50 bg-slate-800 text-cyan-300'
            : 'border-slate-800 bg-slate-900/90 text-slate-300 hover:bg-slate-800'
        }`}
      >
        {label}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} />
          <div className="absolute right-0 top-full z-40 mt-1.5 min-w-[200px] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-2xl">
            {children(close)}
          </div>
        </>
      )}
    </div>
  );
};

export const ControlBar: React.FC = () => {
  const runState = useLabStore((s) => s.runState);
  const setRunState = useLabStore((s) => s.setRunState);
  const stopAndResetSimulation = useLabStore((s) => s.stopAndResetSimulation);
  const resetAllToDefaults = useLabStore((s) => s.resetAllToDefaults);
  const timeScale = useLabStore((s) => s.timeScale);
  const setTimeScale = useLabStore((s) => s.setTimeScale);
  const triggerCameraPreset = useLabStore((s) => s.triggerCameraPreset);
  const viewMode = useLabStore((s) => s.viewMode);
  const setViewMode = useLabStore((s) => s.setViewMode);
  const faults = useLabStore((s) => s.faults);
  const resetFaults = useLabStore((s) => s.resetFaults);
  const setActiveModal = useLabStore((s) => s.setActiveModal);

  const hasLatchedOrSevereFault =
    faults.capVentLatched ||
    faults.loadScorchedLatched ||
    faults.thermalShutdownLatched ||
    faults.capOvervoltageActive ||
    faults.loadOverpowerActive ||
    faults.regulatorThermalShutdownActive;

  const activeWarningCount = faults.messages.filter(
    (m) => m.severity !== 'info'
  ).length;

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/95 px-3 py-2">
      {/* Brand Title */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/15 text-cyan-400">
          <Zap className="h-4 w-4" />
        </div>
        <h1 className="text-sm font-bold tracking-tight text-slate-100">
          ElectroBench<span className="text-cyan-400"> 3D</span>
        </h1>
      </div>

      {/* Core Simulation Controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Run/Pause single toggle + Stop */}
        <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/90 p-0.5">
          <button
            onClick={() =>
              setRunState(runState === 'running' ? 'paused' : 'running')
            }
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              runState === 'running'
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-emerald-500/20 text-emerald-300'
            }`}
            title={runState === 'running' ? 'Pause Simulation' : 'Run Simulation'}
          >
            {runState === 'running' ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            <span>{runState === 'running' ? 'Pause' : 'Run'}</span>
          </button>
          <button
            onClick={stopAndResetSimulation}
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            title="Stop & Discharge Capacitor to 0 V"
          >
            <Square className="h-3 w-3 fill-current" />
          </button>
        </div>

        {/* Speed Dropdown (replaces 3 separate buttons) */}
        <div className="relative">
          <select
            value={timeScale}
            onChange={(e) =>
              setTimeScale(Number(e.target.value) as TimeScaleOption)
            }
            title="Simulation Speed — use Slow-Mo to watch diodes alternate"
            className="appearance-none rounded-lg border border-slate-800 bg-slate-900/90 py-1.5 pl-3 pr-7 text-xs font-semibold text-cyan-300 focus:border-cyan-500 focus:outline-none"
          >
            {([1, 0.1, 0.01] as TimeScaleOption[]).map((s) => (
              <option key={s} value={s}>
                {SPEED_LABELS[s]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
        </div>

        {/* View Mode: compact 3D / Split / 2D segmented control */}
        <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/90 p-0.5">
          {VIEW_OPTIONS.map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                viewMode === mode
                  ? 'bg-indigo-500/25 text-indigo-200'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Camera Presets (hidden inside dropdown) */}
        <MenuButton
          label={
            <>
              <Camera className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Camera</span>
            </>
          }
          title="Camera Presets"
        >
          {(close) => (
            <>
              {CAMERA_OPTIONS.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => {
                    triggerCameraPreset(id);
                    close();
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800 hover:text-cyan-300"
                >
                  {label}
                </button>
              ))}
            </>
          )}
        </MenuButton>
      </div>

      {/* Right Utility Actions: collapsed into 2 compact menus */}
      <div className="flex items-center gap-1.5">
        <MenuButton
          label={
            <>
              {hasLatchedOrSevereFault || activeWarningCount > 0 ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {activeWarningCount > 0
                  ? `Warnings (${activeWarningCount})`
                  : 'Status: OK'}
              </span>
            </>
          }
          title="Faults & Warnings"
          highlight={hasLatchedOrSevereFault}
        >
          {(close) => (
            <div className="w-72 p-2">
              {faults.messages.length === 0 ? (
                <p className="px-1 py-1 text-xs text-slate-400">
                  No active warnings. Circuit operating normally.
                </p>
              ) : (
                <div className="mb-1.5 max-h-48 space-y-1 overflow-y-auto">
                  {faults.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded px-2 py-1 text-[11px] ${
                        m.severity === 'fault'
                          ? 'bg-red-950/60 text-red-200'
                          : m.severity === 'warning'
                          ? 'bg-amber-950/60 text-amber-200'
                          : 'bg-slate-800/70 text-slate-300'
                      }`}
                    >
                      {m.text}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => {
                  resetFaults();
                  close();
                }}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                Reset Faults &amp; Cool IC
              </button>
            </div>
          )}
        </MenuButton>

        <MenuButton label={<MoreVertical className="h-4 w-4" />} title="More Options">
          {(close) => (
            <>
              <button
                onClick={() => {
                  resetAllToDefaults();
                  close();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                Restore Default Bench
              </button>
              <button
                onClick={() => {
                  setActiveModal('selfCheck');
                  close();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Run Self-Check Suite
              </button>
              <button
                onClick={() => {
                  setActiveModal('about');
                  close();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
              >
                <Info className="h-3.5 w-3.5 text-cyan-400" />
                Guide, Equations &amp; Safety
              </button>
            </>
          )}
        </MenuButton>
      </div>
    </header>
  );
};
