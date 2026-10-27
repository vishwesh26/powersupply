import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronUp,
  Cpu,
  Gauge,
  Power,
  Thermometer,
  Zap,
} from 'lucide-react';
import { RegulatorRegime } from '../engine/types';
import { useLabStore } from '../store/useLabStore';

function getRegimeStyle(regime: RegulatorRegime): {
  label: string;
  classes: string;
} {
  switch (regime) {
    case 'REGULATING':
      return {
        label: 'Regulating',
        classes: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300',
      };
    case 'DROPOUT':
      return {
        label: 'Dropout',
        classes: 'border-amber-500/60 bg-amber-500/20 text-amber-200',
      };
    case 'CURRENT_LIMITED':
      return {
        label: 'Current-Limited',
        classes: 'border-orange-500/60 bg-orange-500/20 text-orange-200',
      };
    case 'THERMAL_SHUTDOWN':
      return {
        label: 'Thermal Shutdown',
        classes: 'animate-pulse border-red-500 bg-red-500/25 text-red-200',
      };
    case 'OFF':
      return {
        label: 'Off',
        classes: 'border-slate-700 bg-slate-800/80 text-slate-400',
      };
  }
}

export const MeasurementPanel: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  const params = useLabStore((s) => s.params);
  const sample = useLabStore((s) => s.latestSample);
  const voltmeter = useLabStore((s) => s.voltmeter);
  const faults = useLabStore((s) => s.faults);
  const whyExplanation = useLabStore((s) => s.whyExplanation);
  const togglePowerSwitch = useLabStore((s) => s.togglePowerSwitch);
  const selectComponent = useLabStore((s) => s.selectComponent);

  const regimeBadge = getRegimeStyle(sample.regulatorRegime);
  const warningCount = faults.messages.filter((m) => m.severity !== 'info').length;

  const capRatioPct = Math.min(
    130,
    (sample.vCapInternal / Math.max(1, params.filterCapRatingV)) * 100
  );
  const loadRatioPct = Math.min(
    130,
    (sample.pLoad / Math.max(0.05, params.loadPowerRatingW)) * 100
  );

  return (
    <section className="border-t border-slate-800 bg-slate-950/95 text-xs">
      {/* Slim always-visible summary strip */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full flex-wrap items-center gap-x-5 gap-y-1.5 px-3 py-1.5 text-left transition hover:bg-slate-900/60"
      >
        <span className="flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-mono text-base font-bold tabular-nums text-slate-100">
            {voltmeter.isOffDisplay ? '--- V' : `${voltmeter.averageV.toFixed(2)} V`}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            Output
          </span>
        </span>

        <span className="hidden items-center gap-1.5 sm:flex">
          <Zap className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-mono tabular-nums text-slate-200">
            {sample.iLoad < 1
              ? `${(sample.iLoad * 1000).toFixed(0)} mA`
              : `${sample.iLoad.toFixed(2)} A`}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            Current
          </span>
        </span>

        <span className="hidden items-center gap-1.5 md:flex">
          <Thermometer className="h-3.5 w-3.5 text-orange-400" />
          <span
            className={`font-mono tabular-nums ${
              sample.regulatorTempC >= 120 ? 'text-red-400' : 'text-slate-200'
            }`}
          >
            {sample.regulatorTempC.toFixed(0)}°C
          </span>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            IC Temp
          </span>
        </span>

        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${regimeBadge.classes}`}
        >
          {params.regulatorType} · {regimeBadge.label}
        </span>

        {warningCount > 0 && (
          <span className="flex items-center gap-1 rounded border border-amber-500/50 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            <AlertTriangle className="h-3 w-3" />
            {warningCount} warning{warningCount > 1 ? 's' : ''}
          </span>
        )}

        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-500">
          {expanded ? 'Hide details' : 'Show details'}
          <ChevronUp
            className={`h-3.5 w-3.5 transition-transform ${
              expanded ? '' : 'rotate-180'
            }`}
          />
        </span>
      </button>

      {/* Expandable detail drawer (collapsed by default to reduce clutter) */}
      {expanded && (
        <div className="border-t border-slate-800/80 px-3 py-2.5">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {/* 1. Voltmeter windowed stats */}
            <div
              onClick={() => selectComponent('voltmeter')}
              className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900/70 p-2 transition hover:border-cyan-500/40"
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                DVM ({voltmeter.node}) · 100ms window
              </div>
              <div className="mt-0.5 flex items-baseline justify-between">
                <span className="font-mono text-sm font-bold tabular-nums text-slate-100">
                  {voltmeter.isOffDisplay ? '---' : `${voltmeter.averageV.toFixed(2)} V`}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-slate-400">
                  inst {voltmeter.instantaneousV.toFixed(2)}V
                </span>
              </div>
              <div className="mt-0.5 flex justify-between font-mono text-[10px] tabular-nums text-slate-400">
                <span>min {voltmeter.minV.toFixed(2)}V</span>
                <span>max {voltmeter.maxV.toFixed(2)}V</span>
              </div>
            </div>

            {/* 2. Ripple */}
            <div
              onClick={() => selectComponent('mainCap')}
              className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900/70 p-2 transition hover:border-cyan-500/40"
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Ripple (Vpp)
              </div>
              <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-amber-300">
                {voltmeter.ripplePpV < 1
                  ? `${(voltmeter.ripplePpV * 1000).toFixed(1)} mVpp`
                  : `${voltmeter.ripplePpV.toFixed(2)} Vpp`}
              </div>
              <div className="mt-0.5 font-mono text-[10px] tabular-nums text-slate-400">
                @ {params.acFrequencyHz * 2} Hz
              </div>
            </div>

            {/* 3. Load power */}
            <div
              onClick={() => selectComponent('loadResistor')}
              className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900/70 p-2 transition hover:border-cyan-500/40"
            >
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
                <span>Load ({params.loadResistanceOhms} Ω)</span>
                <span className={faults.loadOverpowerActive ? 'font-bold text-red-400' : ''}>
                  {sample.pLoad < 1
                    ? `${(sample.pLoad * 1000).toFixed(0)}mW`
                    : `${sample.pLoad.toFixed(2)}W`}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full transition-all ${
                    faults.loadOverpowerActive ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, loadRatioPct)}%` }}
                />
              </div>
            </div>

            {/* 4. Regulator regime detail */}
            <div
              onClick={() => selectComponent('regulator')}
              className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900/70 p-2 transition hover:border-cyan-500/40"
            >
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400">
                <Cpu className="h-3 w-3 text-indigo-400" />
                {params.regulatorType}
              </div>
              <div className="mt-0.5 font-mono text-[10px] tabular-nums text-slate-300">
                Vin {sample.vFilterNode.toFixed(2)}V → Vout {sample.vRegOut.toFixed(2)}V
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                Pdiss {sample.pRegulator.toFixed(2)} W
              </div>
            </div>

            {/* 5. Capacitor voltage vs rating */}
            <div
              onClick={() => selectComponent('mainCap')}
              className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900/70 p-2 transition hover:border-cyan-500/40"
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                C1 vs Rating
              </div>
              <div className="mt-0.5 font-mono text-[11px] font-semibold tabular-nums text-sky-300">
                {sample.vCapInternal.toFixed(1)}V / {params.filterCapRatingV}V
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full transition-all ${
                    faults.capOvervoltageActive
                      ? 'bg-red-500'
                      : capRatioPct > 85
                      ? 'bg-amber-400'
                      : 'bg-sky-400'
                  }`}
                  style={{ width: `${Math.min(100, capRatioPct)}%` }}
                />
              </div>
            </div>

            {/* 6. Mains switch */}
            <button
              onClick={togglePowerSwitch}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 font-mono text-xs font-bold transition ${
                params.switchClosed
                  ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                  : 'border-rose-500/50 bg-rose-500/20 text-rose-300'
              }`}
            >
              <Power className="h-3.5 w-3.5" />
              Mains {params.switchClosed ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Why did this change? */}
          <div className="mt-2 flex items-start gap-2 rounded-md border border-cyan-500/25 bg-cyan-950/25 px-2.5 py-1.5 text-[11px] text-cyan-100">
            <span className="shrink-0 font-semibold text-cyan-400">
              Why did this change?
            </span>
            <span className="text-slate-200">{whyExplanation}</span>
          </div>
        </div>
      )}
    </section>
  );
};
