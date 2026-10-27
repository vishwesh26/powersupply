import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  BookOpen,
  CheckCircle2,
  FlaskConical,
  PlayCircle,
  RefreshCw,
  X,
  XCircle,
} from 'lucide-react';
import { runEngineSelfChecks } from '../engine/selfCheck';
import { createDefaultParameters } from '../engine/simulator';
import { useLabStore } from '../store/useLabStore';

export const Modals: React.FC = () => {
  const activeModal = useLabStore((s) => s.activeModal);
  const setActiveModal = useLabStore((s) => s.setActiveModal);
  const updateParams = useLabStore((s) => s.updateParams);
  const resetFaults = useLabStore((s) => s.resetFaults);
  const selectComponent = useLabStore((s) => s.selectComponent);

  const [runCounter, setRunCounter] = useState(0);
  const [aboutTab, setAboutTab] = useState<'safety' | 'equations' | 'demo'>('safety');

  const checkResults = useMemo(() => {
    if (activeModal !== 'selfCheck') return [];
    return runEngineSelfChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModal, runCounter]);

  if (activeModal === 'none') return null;

  const applyDemoScenario = (
    patch: Parameters<typeof updateParams>[0],
    label: string,
    focusComp?: Parameters<typeof selectComponent>[0]
  ) => {
    resetFaults();
    updateParams({ ...createDefaultParameters(), ...patch }, label);
    if (focusComp) selectComponent(focusComp);
    setActiveModal('none');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={() => setActiveModal('none')}
    >
      {activeModal === 'selfCheck' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
                Pure-TS Physics Engine Self-Check Suite
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRunCounter((c) => c + 1)}
                className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-cyan-300 hover:bg-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Re-Run Checks</span>
              </button>
              <button
                onClick={() => setActiveModal('none')}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2.5 overflow-y-auto p-5 text-xs">
            <div className="mb-3 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-950/25 px-3.5 py-2.5">
              <span className="text-slate-200">
                Executed <strong>{checkResults.length}</strong> deterministic
                time-domain verification suites (Δt = 25 µs, pure TypeScript math).
              </span>
              <span className="rounded bg-emerald-500/20 px-2.5 py-1 font-mono font-bold text-emerald-300">
                {checkResults.filter((r) => r.passed).length} / {checkResults.length}{' '}
                PASSED
              </span>
            </div>

            {checkResults.map((res) => (
              <div
                key={res.id}
                className={`rounded-lg border p-3 ${
                  res.passed
                    ? 'border-slate-800 bg-slate-900/65'
                    : 'border-red-500/60 bg-red-950/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-100">{res.title}</span>
                  {res.passed ? (
                    <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> PASS
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-red-300">
                      <XCircle className="h-3 w-3" /> FAIL
                    </span>
                  )}
                </div>
                <div className="mt-1.5 grid gap-1 font-mono text-[11px] sm:grid-cols-2">
                  <div className="text-slate-400">
                    Expected: <span className="text-slate-200">{res.expected}</span>
                  </div>
                  <div className="text-slate-400">
                    Measured: <span className="text-cyan-300">{res.measured}</span>
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">{res.details}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeModal === 'about' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-cyan-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
                Lab Documentation, Modeling Honesty &amp; Safety Notes
              </h2>
            </div>
            <button
              onClick={() => setActiveModal('none')}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Sub-navigation Tabs */}
          <div className="flex gap-2 border-b border-slate-800 bg-slate-900/60 px-5 py-2">
            {(
              [
                ['safety', 'Safety & SPICE Limitations'],
                ['equations', 'Stage Mathematical Equations'],
                ['demo', '8 Scenarios & College Viva Guide'],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setAboutTab(tab)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                  aboutTab === tab
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-4 overflow-y-auto p-5 text-xs leading-relaxed text-slate-300">
            {aboutTab === 'safety' && (
              <>
                <div className="flex items-start gap-3 rounded-xl border border-red-500/60 bg-red-950/35 p-3.5 text-red-100">
                  <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                  <div>
                    <div className="font-bold text-red-300">
                      HIGH-VOLTAGE MAINS SAFETY WARNING (230 V AC)
                    </div>
                    <p className="mt-1 text-[11px]">
                      Real 230 V / 50 Hz AC mains electricity is lethal (~325 V peak).
                      Never wire mains AC directly onto a solderless breadboard! In
                      physical lab work, all primary connections, fusing, and switches
                      must be enclosed inside an insulated chassis, and only the
                      isolated low-voltage transformer secondary connects to the
                      breadboard. This simulator is strictly an educational learning
                      tool, not a substitute for supervised hardware safety procedures.
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-1.5 text-sm font-bold text-slate-100">
                    Educational Time-Domain Model vs. Transistor-Level SPICE
                  </h3>
                  <p>
                    ElectroBench 3D solves the coupled differential/algebraic
                    power-supply stages every <strong>Δt = 25 µs</strong> in pure
                    TypeScript. Unlike LTspice or PSpice, it intentionally uses macro
                    behavioral equations for clarity and real-time 60 fps
                    interactivity:
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                    <li>
                      <strong>Transformer:</strong> Ideal turns-ratio scaling plus
                      referred copper winding resistance. Does not model iron-core B-H
                      saturation, hysteresis/eddy losses, or leakage inductance spikes.
                    </li>
                    <li>
                      <strong>Bridge Diodes:</strong> Piecewise constant forward drop
                      (0.7 V for 1N4007, 0.32 V for 1N5819 Schottky) rather than the
                      exponential Shockley equation or reverse-recovery capacitance.
                    </li>
                    <li>
                      <strong>Linear Regulators (78xx / LM317):</strong> Macro model
                      with 2.0 V dropout headroom, 1.0 A pass-element current ceiling,
                      and first-order lumped RC thermal resistance (θJA = 55 °C/W,
                      shutdown at 150 °C). Internal bandgap transistors and loop phase
                      margin are not simulated.
                    </li>
                    <li>
                      <strong>Bypass Capacitors (100 nF &amp; 10 µF):</strong> Shown
                      physically and checked against datasheet stability guidelines,
                      without inventing artificial 50/100 Hz ripple improvements.
                    </li>
                  </ul>
                </div>
              </>
            )}

            {aboutTab === 'equations' && (
              <div className="space-y-2.5 font-mono text-[11px]">
                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                  <div className="font-sans font-bold text-cyan-300">
                    1. AC Mains &amp; Step-Down Transformer
                  </div>
                  <div className="mt-1">Vm = Vrms · √2 (230 V × √2 = 325.27 V)</div>
                  <div>Vac(t) = Vm · sin(2π f t)</div>
                  <div>Vsec,oc(t) = Vac,sw(t) · (Vsec,rated / Vpri,rated)</div>
                  <div>Vsec(t) = Vsec,oc(t) − Isec(t) · Rwinding</div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                  <div className="font-sans font-bold text-cyan-300">
                    2. Full-Wave Bridge Rectifier &amp; Reservoir Filter
                  </div>
                  <div className="mt-1">Vrect(t) = max(|Vsec(t)| − 2·Vf, 0)</div>
                  <div>Discharge: Vnew = Vold · exp(−Δt / (Reff · C1))</div>
                  <div>
                    Charge: Vnew = Vth + (Vold − Vth) · exp(−Δt / τeq), Icap = C1 ·
                    (Vnew − Vold)/Δt
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                  <div className="font-sans font-bold text-cyan-300">
                    3. Linear Regulators (7805 / 7809 / 7812 / LM317), Load &amp; Thermal
                  </div>
                  <div className="mt-1">
                    LM317 Vtarget = 1.25 · (1 + R2 / R1) + Iadj · R2 (Iadj = 50 µA)
                  </div>
                  <div>Vout = min(Vtarget, max(0, Vin − 2.0 V), Ilimit · Rload)</div>
                  <div>Iload = Vout / Rload, Pload = Vout · Iload</div>
                  <div>
                    Preg = (Vin − Vout) · Iload + Vin · Iq, Teq = 25°C + Preg · 55°C/W
                  </div>
                </div>
              </div>
            )}

            {aboutTab === 'demo' && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-cyan-300">
                  <FlaskConical className="h-4 w-4" />
                  <span className="font-bold">
                    One-Click Verification Scenarios (Also Great for Live Viva Demo!)
                  </span>
                </div>

                {[
                  {
                    title: '1. Swap 7805 → 7812 on 12 V Transformer (Dropout)',
                    desc: 'Output cannot reach 12 V (~11.5 V) because filter trough falls below 14 V headroom; 100 Hz ripple leaks to output.',
                    patch: { regulatorType: 'LM7812' as const },
                    comp: 'regulator' as const,
                  },
                  {
                    title: '2. Raise Transformer Secondary to 18 V with 7812',
                    desc: 'Filter voltage rises to ~21 V; 7812 locks cleanly onto 12.00 V, while IC power dissipation and Tj rise.',
                    patch: {
                      regulatorType: 'LM7812' as const,
                      transformerSecondaryVrms: 18,
                    },
                    comp: 'transformer' as const,
                  },
                  {
                    title: '3. Heavy Load: Reduce RL from 220 Ω → 22 Ω',
                    desc: 'Load current jumps 10×; filter ripple increases sharply, load resistor overpowers, and regulator heats up toward thermal shutdown.',
                    patch: { loadResistanceOhms: 22 },
                    comp: 'loadResistor' as const,
                  },
                  {
                    title: '4. Reduce Main Filter Cap C1: 1000 µF → 100 µF',
                    desc: 'Large 100 Hz sawtooth ripple appears on CH4 and breaks through into CH5 during deep troughs.',
                    patch: { filterCapUf: 100 },
                    comp: 'mainCap' as const,
                  },
                  {
                    title: '5. Adjustable LM317 + Potentiometer Sweep',
                    desc: 'Switches IC to LM317; drag the 3D knob or slider to watch Vout follow 1.25(1+R2/R1) up to Vin − 2V.',
                    patch: { regulatorType: 'LM317' as const, potPosition: 0.14 },
                    comp: 'potentiometer' as const,
                  },
                  {
                    title: '6. Turn Mains Switch OFF (Exponential Decay)',
                    desc: 'AC & rectifier drop to 0 V immediately while C1 exponentially discharges to 0 V and voltmeter settles to "---".',
                    patch: { switchClosed: false },
                    comp: 'powerSwitch' as const,
                  },
                  {
                    title: '7. Swap 1N4007 → 1N5819 Schottky Bridge',
                    desc: 'Lower diode drop (0.32 V vs 0.70 V) raises rectified and filtered DC peak by ~0.76 V.',
                    patch: {
                      diodeType: '1N5819' as const,
                      diodeForwardDropV: 0.32,
                    },
                    comp: 'bridgeDiodes' as const,
                  },
                  {
                    title: '8. Overvoltage Fault: Set C1 Rating to 10 V on 12 V Xfmr',
                    desc: 'Filter voltage (~14.5 V) exceeds 10 V rating — capacitor top vent bulges & fault warning triggers.',
                    patch: { filterCapRatingV: 10 },
                    comp: 'mainCap' as const,
                  },
                ].map((sc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-2.5"
                  >
                    <div>
                      <div className="font-semibold text-slate-100">{sc.title}</div>
                      <div className="text-[11px] text-slate-400">{sc.desc}</div>
                    </div>
                    <button
                      onClick={() => applyDemoScenario(sc.patch, sc.title, sc.comp)}
                      className="flex shrink-0 items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/25"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      <span>Try Live</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
