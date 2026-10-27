import React, { useEffect, useRef } from 'react';
import { ChevronRight, Activity } from 'lucide-react';
import { SamplePoint } from '../engine/types';
import { labRuntime, useLabStore } from '../store/useLabStore';

interface ChannelConfig {
  idx: number;
  title: string;
  shortName: string;
  color: string;
  bipolar: boolean; // True for AC (+/- around center), False for DC (0 V near bottom graticule)
  defaultMaxV: number;
  extract: (s: SamplePoint) => number;
}

const CHANNELS: ChannelConfig[] = [
  {
    idx: 0,
    title: 'CH1 · AC Mains Input',
    shortName: 'Vin(AC)',
    color: '#fbbf24',
    bipolar: true,
    defaultMaxV: 350,
    extract: (s) => s.vAcPrimary,
  },
  {
    idx: 1,
    title: 'CH2 · Transformer Secondary',
    shortName: 'Vsec',
    color: '#fde047',
    bipolar: true,
    defaultMaxV: 28,
    extract: (s) => s.vSecLoaded,
  },
  {
    idx: 2,
    title: 'CH3 · Bridge Rectifier Output',
    shortName: 'Vrect',
    color: '#fb923c',
    bipolar: false,
    defaultMaxV: 25,
    extract: (s) => s.vRectUnfiltered,
  },
  {
    idx: 3,
    title: 'CH4 · Capacitor Filter Output',
    shortName: 'Vcap',
    color: '#38bdf8',
    bipolar: false,
    defaultMaxV: 25,
    extract: (s) => s.vFilterNode,
  },
  {
    idx: 4,
    title: 'CH5 · Regulated DC Output',
    shortName: 'Vout',
    color: '#4ade80',
    bipolar: false,
    defaultMaxV: 16,
    extract: (s) => s.vRegOut,
  },
];

const V_DIV_STEPS = [0.5, 1, 2, 5, 10, 20, 50, 100, 150, 200];

function chooseAutoVPerDiv(peakAbs: number, bipolar: boolean): number {
  // 4 vertical divisions total: bipolar has ±2 divs from center, unipolar has ~3.4 divs above baseline
  const usableDivs = bipolar ? 1.85 : 3.3;
  const needed = Math.max(0.4, peakAbs / usableDivs);
  for (const step of V_DIV_STEPS) {
    if (step >= needed) return step;
  }
  return 200;
}

export const ScopePanel: React.FC = () => {
  const collapsed = useLabStore((s) => s.scopeCollapsed);
  const setCollapsed = useLabStore((s) => s.setScopeCollapsed);
  const timePerDivMs = useLabStore((s) => s.scopeTimePerDivMs);
  const setTimePerDivMs = useLabStore((s) => s.setScopeTimePerDivMs);
  const autoScale = useLabStore((s) => s.scopeAutoScale);
  const manualVPerDiv = useLabStore((s) => s.scopeManualVPerDiv);
  const toggleAutoScale = useLabStore((s) => s.toggleScopeAutoScale);
  const setManualVPerDiv = useLabStore((s) => s.setScopeManualVPerDiv);
  const highlightedTrace = useLabStore((s) => s.highlightedTrace);
  const setHighlightedTrace = useLabStore((s) => s.setHighlightedTrace);

  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    if (collapsed) return;

    let rafId = 0;

    const renderScopes = () => {
      const state = useLabStore.getState();
      const buffer = labRuntime.scopeBuffer;
      const latestTime =
        buffer.length > 0 ? buffer[buffer.length - 1].timeSec : 0;

      // 8 horizontal divisions across each oscilloscope screen
      const totalWindowSec = (state.scopeTimePerDivMs * 8) / 1000;
      const tStart = latestTime - totalWindowSec;

      // Find start index in ring buffer
      let startIdx = 0;
      for (let i = buffer.length - 1; i >= 0; i--) {
        if (buffer[i].timeSec < tStart) {
          startIdx = i;
          break;
        }
      }

      CHANNELS.forEach((ch) => {
        const canvas = canvasRefs.current[ch.idx];
        if (!canvas) return;

        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const rect = canvas.getBoundingClientRect();
        const targetW = Math.max(200, Math.floor(rect.width * dpr));
        const targetH = Math.max(80, Math.floor(rect.height * dpr));
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const W = canvas.width;
        const H = canvas.height;
        const padLeft = 42 * dpr;
        const padRight = 8 * dpr;
        const padTop = 8 * dpr;
        const padBot = 14 * dpr;
        const plotW = W - padLeft - padRight;
        const plotH = H - padTop - padBot;

        // Clear phosphor screen
        const isHighlighted = state.highlightedTrace === ch.idx;
        ctx.fillStyle = isHighlighted ? '#081b26' : '#050b12';
        ctx.fillRect(0, 0, W, H);

        // Compute channel min/max/vPerDiv
        let maxAbs = 1;
        let minVal = Infinity;
        let maxVal = -Infinity;
        for (let i = startIdx; i < buffer.length; i++) {
          const v = ch.extract(buffer[i]);
          if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
        }
        if (!Number.isFinite(minVal)) {
          minVal = 0;
          maxVal = 0;
        }

        const vPerDiv = state.scopeAutoScale[ch.idx]
          ? chooseAutoVPerDiv(maxAbs, ch.bipolar)
          : state.scopeManualVPerDiv[ch.idx];

        // 4 vertical divisions
        const divH = plotH / 4;
        const divW = plotW / 8;
        const zeroY = ch.bipolar
          ? padTop + plotH / 2
          : padTop + plotH - divH * 0.35;

        // Draw DSO Graticule Grid (8x4)
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.55)';
        ctx.lineWidth = 1 * dpr;
        for (let gx = 0; gx <= 8; gx++) {
          const x = padLeft + gx * divW;
          ctx.beginPath();
          ctx.moveTo(x, padTop);
          ctx.lineTo(x, padTop + plotH);
          ctx.stroke();
        }
        for (let gy = 0; gy <= 4; gy++) {
          const y = padTop + gy * divH;
          ctx.beginPath();
          ctx.moveTo(padLeft, y);
          ctx.lineTo(padLeft + plotW, y);
          ctx.stroke();
        }

        // 0 V Ground Reference Line
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(padLeft, zeroY);
        ctx.lineTo(padLeft + plotW, zeroY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Plot Border
        ctx.strokeStyle = isHighlighted ? '#22d3ee' : '#1e293b';
        ctx.lineWidth = (isHighlighted ? 1.8 : 1) * dpr;
        ctx.strokeRect(padLeft, padTop, plotW, plotH);

        // Y-Axis Scale Labels with Units
        ctx.fillStyle = '#94a3b8';
        ctx.font = `${9.5 * dpr}px monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        if (ch.bipolar) {
          const topV = 2 * vPerDiv;
          ctx.fillText(`+${topV >= 10 ? topV.toFixed(0) : topV.toFixed(1)}V`, padLeft - 4 * dpr, padTop + 5 * dpr);
          ctx.fillText('0V', padLeft - 4 * dpr, zeroY);
          ctx.fillText(`-${topV >= 10 ? topV.toFixed(0) : topV.toFixed(1)}V`, padLeft - 4 * dpr, padTop + plotH - 4 * dpr);
        } else {
          const topV = 3.65 * vPerDiv;
          const midV = 2.0 * vPerDiv;
          ctx.fillText(`${topV >= 10 ? topV.toFixed(0) : topV.toFixed(1)}V`, padLeft - 4 * dpr, padTop + 5 * dpr);
          ctx.fillText(`${midV >= 10 ? midV.toFixed(0) : midV.toFixed(1)}V`, padLeft - 4 * dpr, zeroY - 2 * divH);
          ctx.fillText('0V', padLeft - 4 * dpr, zeroY);
        }

        // X-axis label on bottom right
        ctx.fillStyle = '#64748b';
        ctx.font = `${8.5 * dpr}px monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(
          `${state.scopeTimePerDivMs} ms/div · ${vPerDiv} V/div`,
          padLeft + plotW - 2 * dpr,
          H - 1 * dpr
        );

        // Draw Live Scrolling Waveform Trace
        if (buffer.length > 1) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(padLeft, padTop, plotW, plotH);
          ctx.clip();

          ctx.strokeStyle = ch.color;
          ctx.lineWidth = 1.9 * dpr;
          ctx.shadowColor = ch.color;
          ctx.shadowBlur = 5 * dpr;
          ctx.beginPath();

          let started = false;
          for (let i = startIdx; i < buffer.length; i++) {
            const pt = buffer[i];
            const normX = (pt.timeSec - tStart) / totalWindowSec;
            if (normX < -0.02) continue;
            const x = padLeft + normX * plotW;
            const val = ch.extract(pt);
            const y = zeroY - (val / vPerDiv) * divH;

            if (!started) {
              ctx.moveTo(x, y);
              started = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
          ctx.restore();
        }

        // Live Overlay Metric (top-right inside screen)
        const latestVal =
          buffer.length > 0 ? ch.extract(buffer[buffer.length - 1]) : 0;
        const vpp = Math.max(0, maxVal - minVal);
        ctx.fillStyle = ch.color;
        ctx.font = `bold ${9.5 * dpr}px monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        const readout = ch.bipolar
          ? `Vpk ${(maxAbs).toFixed(1)}V`
          : `${latestVal.toFixed(2)}V (Δ${vpp < 1 ? (vpp * 1000).toFixed(0) + 'mV' : vpp.toFixed(2) + 'V'})`;
        ctx.fillText(readout, padLeft + plotW - 5 * dpr, padTop + 4 * dpr);
      });

      rafId = requestAnimationFrame(renderScopes);
    };

    rafId = requestAnimationFrame(renderScopes);
    return () => cancelAnimationFrame(rafId);
  }, [collapsed]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex h-full w-9 flex-col items-center justify-center gap-3 border-l border-slate-800 bg-slate-950/95 text-slate-300 hover:bg-slate-900 hover:text-cyan-300"
        title="Expand 5-Channel Oscilloscope"
      >
        <Activity className="h-4 w-4 text-cyan-400" />
        <span className="text-[11px] font-semibold tracking-widest [writing-mode:vertical-rl]">
          5-CH OSCILLOSCOPE
        </span>
      </button>
    );
  }

  return (
    <aside className="flex h-full w-[350px] shrink-0 flex-col border-l border-slate-800 bg-slate-950/95 xl:w-[390px]">
      {/* Scope Header & Timebase Selector */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-100">
            5-Ch Digital Oscilloscope
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={timePerDivMs}
            onChange={(e) =>
              setTimePerDivMs(Number(e.target.value) as 2 | 5 | 10 | 20)
            }
            className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-cyan-300 focus:border-cyan-500 focus:outline-none"
            title="Horizontal Timebase (ms/div)"
          >
            <option value={2}>2 ms/div</option>
            <option value={5}>5 ms/div</option>
            <option value={10}>10 ms/div</option>
            <option value={20}>20 ms/div</option>
          </select>

          <button
            onClick={() => setCollapsed(true)}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            title="Collapse Oscilloscope Panel"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 5 Stacked Scope Channels */}
      <div className="flex flex-1 flex-col justify-between gap-1.5 overflow-y-auto p-2">
        {CHANNELS.map((ch) => {
          const isAuto = autoScale[ch.idx];
          const curManual = manualVPerDiv[ch.idx];
          const isHi = highlightedTrace === ch.idx;

          return (
            <div
              key={ch.idx}
              onMouseEnter={() => setHighlightedTrace(ch.idx)}
              onMouseLeave={() => {
                if (useLabStore.getState().highlightedTrace === ch.idx) {
                  setHighlightedTrace(null);
                }
              }}
              className={`group/ch flex flex-1 min-h-[106px] flex-col rounded-md border p-1.5 transition-colors ${
                isHi
                  ? 'border-cyan-400 bg-slate-900/90'
                  : 'border-slate-800/90 bg-slate-900/45'
              }`}
            >
              <div className="mb-1 flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: ch.color }}
                  />
                  <span className="text-[11px] font-semibold text-slate-200">
                    {ch.shortName}
                  </span>
                  {!isAuto && (
                    <span className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[8px] text-slate-400">
                      manual
                    </span>
                  )}
                </div>

                {/* Auto / Manual V/div Controls — hidden until this channel is hovered to reduce clutter */}
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/ch:opacity-100">
                  <button
                    onClick={() => toggleAutoScale(ch.idx)}
                    className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold ${
                      isAuto
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                    title="Toggle Auto Vertical Scaling"
                  >
                    AUTO
                  </button>
                  <button
                    onClick={() => {
                      const idx = V_DIV_STEPS.findIndex((s) => s >= curManual);
                      const prev =
                        V_DIV_STEPS[Math.max(0, (idx === -1 ? 2 : idx) - 1)];
                      setManualVPerDiv(ch.idx, prev);
                    }}
                    className="rounded border border-slate-700 bg-slate-800 px-1 text-[10px] text-slate-300 hover:bg-slate-700"
                    title="Zoom In Vertical Scale (Lower V/div)"
                  >
                    −
                  </button>
                  <button
                    onClick={() => {
                      const idx = V_DIV_STEPS.findIndex((s) => s >= curManual);
                      const next =
                        V_DIV_STEPS[
                          Math.min(
                            V_DIV_STEPS.length - 1,
                            (idx === -1 ? 2 : idx) + 1
                          )
                        ];
                      setManualVPerDiv(ch.idx, next);
                    }}
                    className="rounded border border-slate-700 bg-slate-800 px-1 text-[10px] text-slate-300 hover:bg-slate-700"
                    title="Zoom Out Vertical Scale (Higher V/div)"
                  >
                    +
                  </button>
                </div>
              </div>

              <canvas
                ref={(el) => {
                  canvasRefs.current[ch.idx] = el;
                }}
                className="h-full w-full flex-1 rounded"
              />
            </div>
          );
        })}
      </div>
    </aside>
  );
};
