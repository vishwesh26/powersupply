import React, { useEffect, useState } from 'react';
import { Sliders, X } from 'lucide-react';
import {
  computeResistorColorBands,
  E12_LOAD_PRESETS_OHMS,
} from '../engine/loadModel';
import { computeLm317TargetVoltage, LM317_IADJ_A } from '../engine/regulators';
import {
  ComponentId,
  DiodeModelType,
  ProbeNodeType,
  RegulatorModelType,
} from '../engine/types';
import { useLabStore } from '../store/useLabStore';

interface ValidatedNumberInputProps {
  label: string;
  unit: string;
  value: number;
  minExclusive?: number; // e.g., 0 means strictly > 0
  minInclusive?: number; // e.g., 0 means >= 0 allowed (for ideal ESR/Rwinding)
  maxInclusive?: number;
  step?: number;
  onValidChange: (val: number) => void;
}

const ValidatedNumberInput: React.FC<ValidatedNumberInputProps> = ({
  label,
  unit,
  value,
  minExclusive,
  minInclusive,
  maxInclusive = 100000,
  step = 1,
  onValidChange,
}) => {
  const [raw, setRaw] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRaw(String(Number(value.toFixed(3))));
    setError(null);
  }, [value]);

  const handleChange = (txt: string) => {
    setRaw(txt);
    if (txt.trim() === '') {
      setError('Please enter a numeric value.');
      return;
    }
    const parsed = Number(txt);
    if (!Number.isFinite(parsed)) {
      setError('Invalid number format.');
      return;
    }
    if (minExclusive !== undefined && parsed <= minExclusive) {
      setError(`Must be strictly > ${minExclusive} ${unit} (no zero/negative values).`);
      return;
    }
    if (minInclusive !== undefined && parsed < minInclusive) {
      setError(`Must be ≥ ${minInclusive} ${unit} (cannot be negative).`);
      return;
    }
    if (parsed > maxInclusive) {
      setError(`Exceeds safe lab range (max ${maxInclusive} ${unit}).`);
      return;
    }
    setError(null);
    onValidChange(parsed);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-slate-300">
        <span>{label}</span>
        <span className="font-mono text-[10px] text-slate-400">{unit}</span>
      </div>
      <input
        type="number"
        step={step}
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        className={`w-full rounded-md border bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100 focus:outline-none ${
          error
            ? 'border-red-500 focus:border-red-400'
            : 'border-slate-700 focus:border-cyan-400'
        }`}
      />
      {error && (
        <p className="text-[10px] font-medium text-red-400">⚠ {error}</p>
      )}
    </div>
  );
};

const QUICK_COMPONENTS: { id: ComponentId; short: string }[] = [
  { id: 'acSource', short: 'AC Mains' },
  { id: 'powerSwitch', short: 'Switch' },
  { id: 'transformer', short: 'Xfmr' },
  { id: 'bridgeDiodes', short: 'Diodes' },
  { id: 'mainCap', short: 'C1 Filter' },
  { id: 'bypassCapIn', short: 'C2 100nF' },
  { id: 'regulator', short: 'Reg IC' },
  { id: 'potentiometer', short: 'LM317 Pot' },
  { id: 'bypassCapOut', short: 'C3 10µF' },
  { id: 'loadResistor', short: 'Load RL' },
  { id: 'voltmeter', short: 'DVM' },
];

export const PropertyPanel: React.FC = () => {
  const selected = useLabStore((s) => s.selectedComponent);
  const selectComponent = useLabStore((s) => s.selectComponent);
  const params = useLabStore((s) => s.params);
  const updateParams = useLabStore((s) => s.updateParams);
  const setDiodePreset = useLabStore((s) => s.setDiodePreset);
  const togglePowerSwitch = useLabStore((s) => s.togglePowerSwitch);
  const whyExplanation = useLabStore((s) => s.whyExplanation);
  const sample = useLabStore((s) => s.latestSample);

  if (!selected) {
    return (
      <div className="pointer-events-auto absolute left-3 top-3 z-20 flex max-w-[280px] items-center gap-1.5 rounded-lg border border-slate-800/90 bg-slate-950/80 px-2.5 py-1.5 text-[11px] text-slate-400 shadow-xl backdrop-blur-md">
        <Sliders className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
        <span>Click any part in the 3D view to inspect &amp; edit it</span>
      </div>
    );
  }

  const r2Ohms = Math.round(params.potPosition * params.potMaxOhms);
  const lm317Nominal = computeLm317TargetVoltage(params.lm317R1Ohms, r2Ohms);
  const loadBands = computeResistorColorBands(params.loadResistanceOhms);
  const r1Bands = computeResistorColorBands(params.lm317R1Ohms);

  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-20 flex max-h-[calc(100%-24px)] w-[330px] flex-col rounded-xl border border-cyan-500/40 bg-slate-950/95 shadow-2xl backdrop-blur-md">
      {/* Header with Compact Quick-Switch Dropdown (replaces 11-button pill grid) */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
        <Sliders className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
        <select
          value={selected}
          onChange={(e) => selectComponent(e.target.value as typeof selected)}
          className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-slate-100 focus:border-cyan-400 focus:outline-none"
        >
          {QUICK_COMPONENTS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.short}
            </option>
          ))}
        </select>
        <button
          onClick={() => selectComponent(null)}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          title="Close Inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Component-Specific Editable Fields */}
      <div className="space-y-3 overflow-y-auto p-3 text-xs">
        {selected === 'acSource' && (
          <>
            <div className="font-semibold text-cyan-300">
              AC Mains Supply (Primary Input)
            </div>
            <ValidatedNumberInput
              label="RMS Mains Voltage (Vrms)"
              unit="V RMS"
              value={params.acVrms}
              minExclusive={0}
              maxInclusive={400}
              onValidChange={(v) =>
                updateParams({ acVrms: v }, `AC Mains → ${v} V RMS`)
              }
            />
            <div>
              <div className="mb-1 text-[11px] text-slate-300">
                Mains Frequency (Hz)
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[50, 60].map((hz) => (
                  <button
                    key={hz}
                    onClick={() =>
                      updateParams(
                        { acFrequencyHz: hz },
                        `Mains Frequency → ${hz} Hz`
                      )
                    }
                    className={`rounded-md border py-1.5 font-mono text-xs font-semibold ${
                      params.acFrequencyHz === hz
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {hz} Hz (Ripple {hz * 2} Hz)
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/80 p-2 font-mono text-[11px] text-slate-300">
              Peak Voltage Vm = Vrms × √2 ={' '}
              <span className="font-bold text-amber-300">
                {(params.acVrms * Math.SQRT2).toFixed(2)} V
              </span>
            </div>
          </>
        )}

        {selected === 'powerSwitch' && (
          <>
            <div className="font-semibold text-cyan-300">
              Mains Series Power Switch (SW1)
            </div>
            <button
              onClick={togglePowerSwitch}
              className={`w-full rounded-lg border py-2.5 text-sm font-bold transition ${
                params.switchClosed
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                  : 'border-rose-400 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30'
              }`}
            >
              {params.switchClosed
                ? 'SWITCH IS ON — Click to Turn OFF'
                : 'SWITCH IS OFF — Click to Turn ON'}
            </button>
            <p className="text-[11px] leading-relaxed text-slate-400">
              When switched OFF, primary AC drops to 0 V, bridge diodes
              reverse-bias, and filter capacitor C1 discharges naturally
              through the load following V(t) = V0·e^(−t/RC).
            </p>
          </>
        )}

        {selected === 'transformer' && (
          <>
            <div className="font-semibold text-cyan-300">
              Step-Down Mains Transformer (T1)
            </div>
            <div>
              <div className="mb-1 text-[11px] text-slate-300">
                Standard Secondary Presets (RMS)
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[9, 12, 15, 18].map((v) => (
                  <button
                    key={v}
                    onClick={() =>
                      updateParams(
                        { transformerSecondaryVrms: v },
                        `Transformer Secondary → ${v} V RMS`
                      )
                    }
                    className={`rounded border py-1 font-mono text-xs font-semibold ${
                      params.transformerSecondaryVrms === v
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {v} V
                  </button>
                ))}
              </div>
            </div>
            <ValidatedNumberInput
              label="Custom Secondary Rated Voltage"
              unit="V RMS"
              value={params.transformerSecondaryVrms}
              minExclusive={0}
              maxInclusive={48}
              step={0.5}
              onValidChange={(v) =>
                updateParams(
                  { transformerSecondaryVrms: v },
                  `Transformer Secondary → ${v} V RMS`
                )
              }
            />
            <ValidatedNumberInput
              label="Copper Winding Resistance (0 = Ideal)"
              unit="Ω"
              value={params.transformerWindingResistanceOhms}
              minInclusive={0}
              maxInclusive={25}
              step={0.2}
              onValidChange={(r) =>
                updateParams(
                  { transformerWindingResistanceOhms: r },
                  `Winding Resistance → ${r} Ω`
                )
              }
            />
            <div className="flex gap-1.5">
              <button
                onClick={() =>
                  updateParams(
                    { transformerWindingResistanceOhms: 0 },
                    'Transformer → Ideal (0 Ω)'
                  )
                }
                className="flex-1 rounded border border-slate-700 bg-slate-900 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
              >
                Ideal (0 Ω)
              </button>
              <button
                onClick={() =>
                  updateParams(
                    { transformerWindingResistanceOhms: 3.6 },
                    'Transformer → Practical (3.6 Ω)'
                  )
                }
                className="flex-1 rounded border border-slate-700 bg-slate-900 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
              >
                Practical (3.6 Ω)
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Note: Models turns ratio &amp; copper resistance only; core
              hysteresis, leakage inductance, and magnetic saturation are not
              simulated.
            </p>
          </>
        )}

        {selected === 'bridgeDiodes' && (
          <>
            <div className="font-semibold text-cyan-300">
              Full-Wave Bridge Rectifier (D1–D4)
            </div>
            <div>
              <div className="mb-1 text-[11px] text-slate-300">
                Diode Semiconductor Model
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['1N4007', '1N4007 (0.7V)'],
                    ['1N5819', 'Schottky (0.32V)'],
                    ['ideal', 'Ideal (0V)'],
                  ] as [DiodeModelType, string][]
                ).map(([t, label]) => (
                  <button
                    key={t}
                    onClick={() => setDiodePreset(t)}
                    className={`rounded border px-1.5 py-1.5 text-[11px] font-semibold ${
                      params.diodeType === t
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ValidatedNumberInput
              label="Forward Drop per Diode (Vf)"
              unit="V"
              value={params.diodeForwardDropV}
              minInclusive={0}
              maxInclusive={2.5}
              step={0.05}
              onValidChange={(vf) =>
                updateParams(
                  { diodeType: 'custom', diodeForwardDropV: vf },
                  `Diode Vf → ${vf.toFixed(2)} V`
                )
              }
            />
            <div className="rounded border border-slate-800 bg-slate-900/80 p-2 font-mono text-[11px] text-slate-300">
              Bridge Drop (2 × Vf):{' '}
              <span className="font-bold text-orange-300">
                {(2 * params.diodeForwardDropV).toFixed(2)} V
              </span>
            </div>
          </>
        )}

        {selected === 'mainCap' && (
          <>
            <div className="font-semibold text-cyan-300">
              Main Electrolytic Filter Capacitor (C1)
            </div>
            <div>
              <div className="mb-1 text-[11px] text-slate-300">
                Capacitance Presets (µF)
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[100, 220, 470, 1000, 2200, 4700].map((uf) => (
                  <button
                    key={uf}
                    onClick={() =>
                      updateParams(
                        { filterCapUf: uf },
                        `Filter Capacitor C1 → ${uf} µF`
                      )
                    }
                    className={`rounded border py-1 font-mono text-[11px] font-semibold ${
                      params.filterCapUf === uf
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {uf} µF
                  </button>
                ))}
              </div>
            </div>
            <ValidatedNumberInput
              label="Capacitance (C1)"
              unit="µF"
              value={params.filterCapUf}
              minExclusive={0}
              maxInclusive={47000}
              step={50}
              onValidChange={(c) =>
                updateParams({ filterCapUf: c }, `Filter C1 → ${c} µF`)
              }
            />
            <div>
              <div className="mb-1 text-[11px] text-slate-300">
                Voltage Rating Presets (V DC)
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[10, 16, 25, 35, 50].map((rv) => (
                  <button
                    key={rv}
                    onClick={() =>
                      updateParams(
                        { filterCapRatingV: rv },
                        `C1 Voltage Rating → ${rv} V`
                      )
                    }
                    className={`rounded border py-1 font-mono text-[11px] font-semibold ${
                      params.filterCapRatingV === rv
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {rv}V
                  </button>
                ))}
              </div>
            </div>
            <ValidatedNumberInput
              label="Maximum Voltage Rating"
              unit="V"
              value={params.filterCapRatingV}
              minExclusive={0}
              maxInclusive={200}
              step={1}
              onValidChange={(rv) =>
                updateParams({ filterCapRatingV: rv }, `C1 Rating → ${rv} V`)
              }
            />
            <ValidatedNumberInput
              label="Equivalent Series Resistance (ESR)"
              unit="Ω"
              value={params.filterCapEsrOhms}
              minInclusive={0}
              maxInclusive={10}
              step={0.02}
              onValidChange={(esr) =>
                updateParams({ filterCapEsrOhms: esr }, `C1 ESR → ${esr} Ω`)
              }
            />
          </>
        )}

        {(selected === 'bypassCapIn' || selected === 'bypassCapOut') && (
          <>
            <div className="font-semibold text-cyan-300">
              Decoupling / Bypass Capacitors (C2 &amp; C3)
            </div>
            <ValidatedNumberInput
              label="C2 Regulator Input Ceramic Cap"
              unit="nF"
              value={params.bypassCapInNf}
              minExclusive={0}
              maxInclusive={10000}
              step={10}
              onValidChange={(nf) =>
                updateParams({ bypassCapInNf: nf }, `Input Bypass C2 → ${nf} nF`)
              }
            />
            <ValidatedNumberInput
              label="C3 Regulator Output Stability Cap"
              unit="µF"
              value={params.bypassCapOutUf}
              minExclusive={0}
              maxInclusive={1000}
              step={1}
              onValidChange={(uf) =>
                updateParams({ bypassCapOutUf: uf }, `Output Cap C3 → ${uf} µF`)
              }
            />
            <div className="rounded border border-amber-500/30 bg-amber-950/20 p-2 text-[10px] leading-relaxed text-amber-100/90">
              <strong>Engineering Note:</strong> C2 (100 nF) prevents MHz-band
              parasitic lead oscillation and C3 (10 µF) improves transient step
              damping. Their high-frequency benefits are documented rather than
              fabricating artificial 100 Hz ripple changes.
            </div>
          </>
        )}

        {(selected === 'regulator' ||
          selected === 'lm317R1' ||
          selected === 'potentiometer') && (
          <>
            <div className="font-semibold text-cyan-300">
              Linear Voltage Regulator IC &amp; Adjust Network
            </div>
            <div>
              <div className="mb-1 text-[11px] text-slate-300">
                Select TO-220 Regulator IC
              </div>
              <select
                value={params.regulatorType}
                onChange={(e) => {
                  const ic = e.target.value as RegulatorModelType;
                  updateParams({ regulatorType: ic }, `Regulator IC → ${ic}`);
                }}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs font-bold text-cyan-300 focus:border-cyan-400 focus:outline-none"
              >
                <option value="LM7805">LM7805 — Fixed +5.0 V (2V dropout)</option>
                <option value="LM7809">LM7809 — Fixed +9.0 V (2V dropout)</option>
                <option value="LM7812">LM7812 — Fixed +12.0 V (2V dropout)</option>
                <option value="LM317">LM317 — Adjustable 1.25 V–37 V</option>
              </select>
            </div>

            {params.regulatorType === 'LM317' ? (
              <div className="space-y-2.5 rounded-lg border border-cyan-500/30 bg-slate-900/70 p-2.5">
                <div className="font-semibold text-cyan-200">
                  LM317 Voltage Divider Network (R1 &amp; Pot R2)
                </div>

                <ValidatedNumberInput
                  label="Fixed Reference Resistor R1 (OUT–ADJ)"
                  unit="Ω"
                  value={params.lm317R1Ohms}
                  minExclusive={0}
                  maxInclusive={5000}
                  step={10}
                  onValidChange={(r1) =>
                    updateParams({ lm317R1Ohms: r1 }, `LM317 R1 → ${r1} Ω`)
                  }
                />

                {/* R1 Color Bands Preview */}
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span>R1 Bands:</span>
                  {r1Bands.map((b, idx) => (
                    <span
                      key={idx}
                      className="inline-block h-3 w-4 rounded-sm border border-slate-600"
                      style={{ backgroundColor: b.hex }}
                      title={b.name}
                    />
                  ))}
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-slate-300">
                    <span>Potentiometer R2 ({r2Ohms} Ω)</span>
                    <span className="font-mono text-cyan-300">
                      {Math.round(params.potPosition * 100)}% (
                      {Math.round(params.potPosition * 270)}°)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    value={Math.round(params.potPosition * 1000)}
                    onChange={(e) => {
                      const pos = Number(e.target.value) / 1000;
                      updateParams(
                        { potPosition: pos },
                        `Potentiometer R2 → ${Math.round(pos * params.potMaxOhms)} Ω`
                      );
                    }}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Live LM317 Equation Readout */}
                <div className="rounded border border-slate-800 bg-slate-950 p-2 font-mono text-[10px] leading-relaxed text-slate-300">
                  <div className="text-cyan-300">
                    Vset = 1.25·(1 + R2/R1) + Iadj·R2
                  </div>
                  <div>
                    = 1.25·(1 + {r2Ohms}/{params.lm317R1Ohms}) +{' '}
                    {(LM317_IADJ_A * 1e6).toFixed(0)}µA·{r2Ohms}
                  </div>
                  <div className="mt-0.5 font-bold text-amber-300">
                    Formula Vset = {lm317Nominal.toFixed(2)} V · Actual Vout ={' '}
                    {sample.vRegOut.toFixed(2)} V
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded border border-slate-800 bg-slate-900/60 p-2 text-[11px] text-slate-400">
                Fixed regulator selected ({params.regulatorType}): Pin 2 connects
                directly to GND. The LM317 R1/Potentiometer network is inactive
                (shown translucent on the breadboard).
              </div>
            )}
          </>
        )}

        {selected === 'loadResistor' && (
          <>
            <div className="font-semibold text-cyan-300">
              Output Load Resistor (RL)
            </div>
            <div>
              <div className="mb-1 text-[11px] text-slate-300">
                E12 Standard Presets (10 Ω – 10 kΩ)
              </div>
              <div className="grid grid-cols-4 gap-1">
                {E12_LOAD_PRESETS_OHMS.map((ohms) => (
                  <button
                    key={ohms}
                    onClick={() =>
                      updateParams(
                        { loadResistanceOhms: ohms },
                        `Load Resistor RL → ${ohms} Ω`
                      )
                    }
                    className={`rounded border py-1 font-mono text-[10px] font-semibold ${
                      params.loadResistanceOhms === ohms
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {ohms >= 1000 ? `${ohms / 1000}kΩ` : `${ohms}Ω`}
                  </button>
                ))}
              </div>
            </div>

            <ValidatedNumberInput
              label="Load Resistance (RL)"
              unit="Ω"
              value={params.loadResistanceOhms}
              minExclusive={0}
              maxInclusive={100000}
              step={10}
              onValidChange={(r) =>
                updateParams({ loadResistanceOhms: r }, `Load RL → ${r} Ω`)
              }
            />

            {/* Live 4-Band Color Code Preview */}
            <div className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/80 px-2.5 py-1.5">
              <span className="text-[11px] text-slate-400">EIA Color Bands:</span>
              <div className="flex items-center gap-1.5">
                {loadBands.map((b, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[10px]"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: b.hex }}
                    />
                    <span>{b.name}</span>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[11px] text-slate-300">
                Resistor Power Rating (W)
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[0.25, 0.5, 1, 2, 5].map((w) => (
                  <button
                    key={w}
                    onClick={() =>
                      updateParams(
                        { loadPowerRatingW: w },
                        `Load Power Rating → ${w} W`
                      )
                    }
                    className={`rounded border py-1 font-mono text-[10px] font-semibold ${
                      params.loadPowerRatingW === w
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {w}W
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {selected === 'voltmeter' && (
          <>
            <div className="font-semibold text-cyan-300">
              Digital Bench Voltmeter (DVM)
            </div>
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-300">
                Select Probed Circuit Node (Red/Black 3D probes move automatically!)
              </div>
              {(
                [
                  ['output', 'Regulated DC Output Terminals (Default)'],
                  ['filter', 'Capacitor Filter Unregulated Bus (Vcap)'],
                  ['rectifier', 'Bridge Rectifier Unfiltered Envelope'],
                  ['secondary', 'Transformer Secondary AC Winding'],
                ] as [ProbeNodeType, string][]
              ).map(([node, label]) => (
                <button
                  key={node}
                  onClick={() =>
                    updateParams(
                      { voltmeterNode: node },
                      `Voltmeter Probes → ${label}`
                    )
                  }
                  className={`w-full rounded-md border px-2.5 py-2 text-left text-xs transition ${
                    params.voltmeterNode === node
                      ? 'border-cyan-400 bg-cyan-500/20 font-semibold text-cyan-200'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Live "Why did this change?" Explanation Line inside Inspector */}
        <div className="rounded-lg border border-cyan-500/25 bg-cyan-950/30 p-2 text-[11px] leading-relaxed">
          <div className="font-semibold text-cyan-300">Why did this change?</div>
          <div className="mt-0.5 text-slate-200">{whyExplanation}</div>
        </div>
      </div>
    </div>
  );
};
