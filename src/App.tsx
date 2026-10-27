import { Component, ErrorInfo, ReactNode, useEffect } from 'react';
import { LabScene } from './scene/LabScene';
import { useLabStore } from './store/useLabStore';
import { ControlBar } from './ui/ControlBar';
import { MeasurementPanel } from './ui/MeasurementPanel';
import { Modals } from './ui/Modals';
import { PropertyPanel } from './ui/PropertyPanel';
import { SchematicView } from './ui/SchematicView';
import { ScopePanel } from './ui/ScopePanel';

class WebGLErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('3D Scene Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center bg-slate-950 p-6 text-center">
          <div className="max-w-md rounded-xl border border-amber-500/40 bg-slate-900 p-5">
            <h3 className="text-sm font-bold text-amber-300">
              WebGL 3D Context Unavailable
            </h3>
            <p className="mt-2 text-xs text-slate-300">
              Hardware acceleration or WebGL could not initialize (
              {this.state.message}). Enable GPU acceleration in browser settings
              or use the interactive <strong>2D Schematic</strong> view above —
              the physics engine and 5-channel oscilloscope remain 100% active.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const viewMode = useLabStore((s) => s.viewMode);

  // Master 60 fps simulation stepping loop (runs across 3D, Split, and 2D modes)
  useEffect(() => {
    let rafId = 0;
    let prevTime = performance.now();
    let lastUiSync = prevTime;

    const tick = (now: number) => {
      const wallDeltaSec = (now - prevTime) / 1000;
      prevTime = now;

      const shouldSyncUi = now - lastUiSync >= 48; // ~21 Hz crisp telemetry sync
      if (shouldSyncUi) {
        lastUiSync = now;
      }

      useLabStore.getState().advanceSimulationFrame(wallDeltaSec, shouldSyncUi);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#080d15] text-slate-100">
      {/* Top Instrument Control Bar */}
      <ControlBar />

      {/* Center Bench + Scope Workspace */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Main Interactive Bench / Schematic Stage */}
        <main className="relative flex min-w-0 flex-1 overflow-hidden">
          {/* Floating Click-to-Edit Component Property Inspector */}
          <PropertyPanel />

          {viewMode === '3d' && (
            <div className="h-full w-full">
              <WebGLErrorBoundary>
                <LabScene />
              </WebGLErrorBoundary>
            </div>
          )}

          {viewMode === 'schematic' && (
            <div className="h-full w-full pl-0">
              <SchematicView />
            </div>
          )}

          {viewMode === 'split' && (
            <div className="grid h-full w-full grid-cols-1 lg:grid-cols-2">
              <div className="h-full min-h-[260px] border-b border-slate-800 lg:border-b-0 lg:border-r">
                <WebGLErrorBoundary>
                  <LabScene />
                </WebGLErrorBoundary>
              </div>
              <div className="h-full min-h-[260px]">
                <SchematicView />
              </div>
            </div>
          )}
        </main>

        {/* Right Collapsible 5-Channel Oscilloscope */}
        <ScopePanel />
      </div>

      {/* Always-Visible Bottom Telemetry, Status & Fault Console */}
      <MeasurementPanel />

      {/* Self-Check & Documentation Modals */}
      <Modals />
    </div>
  );
}

export default App;
