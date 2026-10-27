import React, { useState } from 'react';
import { ComponentId } from '../engine/types';
import { useLabStore } from '../store/useLabStore';

export const SchematicView: React.FC = () => {
  const [diagramTab, setDiagramTab] = useState<'schematic' | 'block'>('schematic');

  const params = useLabStore((s) => s.params);
  const sample = useLabStore((s) => s.latestSample);
  const voltmeter = useLabStore((s) => s.voltmeter);
  const hovered = useLabStore((s) => s.hoveredComponent);
  const selected = useLabStore((s) => s.selectedComponent);
  const hoverComponent = useLabStore((s) => s.hoverComponent);
  const selectComponent = useLabStore((s) => s.selectComponent);

  const isHi = (id: ComponentId) => hovered === id || selected === id;
  const strokeFor = (id: ComponentId, base = '#e2e8f0') =>
    isHi(id) ? '#22d3ee' : base;

  const bindPart = (id: ComponentId) => ({
    onMouseEnter: () => hoverComponent(id),
    onMouseLeave: () => hoverComponent(null),
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      selectComponent(id);
    },
    style: { cursor: 'pointer' as const },
  });

  const isLm317 = params.regulatorType === 'LM317';
  const r2Ohms = Math.round(params.potPosition * params.potMaxOhms);

  return (
    <div className="flex h-full w-full flex-col bg-[#070d16] p-3">
      {/* Top Bar */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDiagramTab('schematic')}
            className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
              diagramTab === 'schematic'
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            2D Electronic Circuit Schematic (SVG)
          </button>
          <button
            onClick={() => setDiagramTab('block')}
            className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
              diagramTab === 'block'
                ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            Functional Block Diagram
          </button>
        </div>

        <div className="text-[11px] text-slate-400">
          Hover any schematic symbol to highlight its 3D counterpart · Click to edit
        </div>
      </div>

      {diagramTab === 'schematic' ? (
        <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-[#050a12] p-2">
          <svg
            viewBox="0 0 1120 520"
            className="h-full w-full max-h-[540px]"
            onClick={() => selectComponent(null)}
          >
            {/* Subtle Engineering Blueprint Grid */}
            <defs>
              <pattern
                id="schemGrid"
                width="28"
                height="28"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 28 0 L 0 0 0 28"
                  fill="none"
                  stroke="rgba(51,65,85,0.22)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="1120" height="520" fill="url(#schemGrid)" />

            {/* ================= WIRES & RAILS ================= */}
            {/* Primary AC Loop */}
            <line x1="78" y1="210" x2="78" y2="145" stroke="#fbbf24" strokeWidth="2.5" />
            <line x1="78" y1="145" x2="122" y2="145" stroke="#fbbf24" strokeWidth="2.5" />
            <line x1="176" y1="145" x2="218" y2="145" stroke="#fbbf24" strokeWidth="2.5" />
            <line x1="218" y1="145" x2="218" y2="185" stroke="#fbbf24" strokeWidth="2.5" />
            <line x1="78" y1="280" x2="78" y2="335" stroke="#60a5fa" strokeWidth="2.5" />
            <line x1="78" y1="335" x2="218" y2="335" stroke="#60a5fa" strokeWidth="2.5" />
            <line x1="218" y1="335" x2="218" y2="295" stroke="#60a5fa" strokeWidth="2.5" />

            {/* Secondary AC Wires into Bridge AC1 (left) & AC2 (right) */}
            <line x1="268" y1="185" x2="268" y2="155" stroke="#fde047" strokeWidth="2.5" />
            <line x1="268" y1="155" x2="325" y2="155" stroke="#fde047" strokeWidth="2.5" />
            <line x1="325" y1="155" x2="325" y2="240" stroke="#fde047" strokeWidth="2.5" />

            <line x1="268" y1="295" x2="268" y2="355" stroke="#4ade80" strokeWidth="2.5" />
            <line x1="268" y1="355" x2="455" y2="355" stroke="#4ade80" strokeWidth="2.5" />
            <line x1="455" y1="355" x2="455" y2="240" stroke="#4ade80" strokeWidth="2.5" />

            {/* Unregulated DC+ Bus (Bridge Top [390,175] -> up to Y=115 -> Regulator IN [655,115]) */}
            <line x1="390" y1="175" x2="390" y2="115" stroke="#ef4444" strokeWidth="3" />
            <line x1="390" y1="115" x2="655" y2="115" stroke="#ef4444" strokeWidth="3" />

            {/* Bridge Bottom GND [390,305] -> Common Ground Rail Y=410 */}
            <line x1="390" y1="305" x2="390" y2="410" stroke="#94a3b8" strokeWidth="3" />
            <line x1="390" y1="410" x2="1035" y2="410" stroke="#94a3b8" strokeWidth="3" />

            {/* Regulated Output Bus (Regulator OUT [775,115] -> Output Terminals & Load [1035,115]) */}
            <line x1="775" y1="115" x2="1035" y2="115" stroke="#4ade80" strokeWidth="3" />

            {/* Common Ground Symbol at Y=410 */}
            <g transform="translate(530, 410)">
              <line x1="0" y1="0" x2="0" y2="16" stroke="#94a3b8" strokeWidth="2.5" />
              <line x1="-18" y1="16" x2="18" y2="16" stroke="#94a3b8" strokeWidth="2.5" />
              <line x1="-11" y1="23" x2="11" y2="23" stroke="#94a3b8" strokeWidth="2.5" />
              <line x1="-5" y1="30" x2="5" y2="30" stroke="#94a3b8" strokeWidth="2.5" />
              <text x="0" y="46" textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="monospace">
                GND (0V)
              </text>
            </g>

            {/* ================= 1. AC SOURCE ================= */}
            <g {...bindPart('acSource')}>
              <circle
                cx="78"
                cy="245"
                r="34"
                fill="#0f172a"
                stroke={strokeFor('acSource', '#fbbf24')}
                strokeWidth={isHi('acSource') ? 3.5 : 2.5}
              />
              <path
                d="M 58 245 Q 68 225, 78 245 T 98 245"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2.8"
              />
              <text x="78" y="300" textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="bold">
                AC Mains
              </text>
              <text x="78" y="316" textAnchor="middle" fill="#fbbf24" fontSize="11" fontFamily="monospace">
                {params.acVrms}V / {params.acFrequencyHz}Hz
              </text>
            </g>

            {/* ================= 2. SERIES MAINS SWITCH (SW1) ================= */}
            <g {...bindPart('powerSwitch')}>
              <rect
                x="112"
                y="112"
                width="74"
                height="52"
                rx="6"
                fill="rgba(15,23,42,0.65)"
                stroke={strokeFor('powerSwitch', '#475569')}
                strokeWidth={isHi('powerSwitch') ? 2.5 : 1}
              />
              <circle cx="124" cy="145" r="4.5" fill="#fbbf24" />
              <circle cx="174" cy="145" r="4.5" fill="#fbbf24" />
              {/* Switch Blade */}
              <line
                x1="124"
                y1="145"
                x2={params.switchClosed ? 174 : 168}
                y2={params.switchClosed ? 145 : 123}
                stroke={params.switchClosed ? '#4ade80' : '#f87171'}
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <text x="149" y="104" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="bold">
                SW1 ({params.switchClosed ? 'ON' : 'OFF'})
              </text>
            </g>

            {/* ================= 3. STEP-DOWN TRANSFORMER (T1) ================= */}
            <g {...bindPart('transformer')}>
              <rect
                x="196"
                y="170"
                width="94"
                height="140"
                rx="8"
                fill="rgba(15,23,42,0.5)"
                stroke={strokeFor('transformer', '#334155')}
                strokeWidth={isHi('transformer') ? 2.5 : 1}
              />
              {/* Primary Winding Loops */}
              <path
                d="M 218 185 C 234 185, 234 212, 218 212 C 234 212, 234 240, 218 240 C 234 240, 234 268, 218 268 C 234 268, 234 295, 218 295"
                fill="none"
                stroke="#d97706"
                strokeWidth="2.8"
              />
              {/* Laminated Iron Core Lines */}
              <line x1="240" y1="182" x2="240" y2="298" stroke="#cbd5e1" strokeWidth="2.2" />
              <line x1="246" y1="182" x2="246" y2="298" stroke="#cbd5e1" strokeWidth="2.2" />
              {/* Secondary Winding Loops */}
              <path
                d="M 268 185 C 252 185, 252 212, 268 212 C 252 212, 252 240, 268 240 C 252 240, 252 268, 268 268 C 252 268, 252 295, 268 295"
                fill="none"
                stroke="#fde047"
                strokeWidth="2.8"
              />
              <text x="243" y="160" textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="bold">
                T1
              </text>
              <text x="243" y="328" textAnchor="middle" fill="#fde047" fontSize="11" fontFamily="monospace">
                {params.transformerSecondaryVrms}V RMS
              </text>
            </g>

            {/* ================= 4. 4-DIODE FULL-WAVE BRIDGE (D1-D4) ================= */}
            <g {...bindPart('bridgeDiodes')}>
              {/* Diamond Bridge Arms */}
              {/* Top-Left Arm: AC1 (325,240) -> DC+ (390,175) = D1 (Pair A) */}
              <line x1="325" y1="240" x2="390" y2="175" stroke="#cbd5e1" strokeWidth="2.2" />
              {/* Top-Right Arm: AC2 (455,240) -> DC+ (390,175) = D3 (Pair B) */}
              <line x1="455" y1="240" x2="390" y2="175" stroke="#cbd5e1" strokeWidth="2.2" />
              {/* Bottom-Left Arm: GND (390,305) -> AC1 (325,240) = D4 (Pair B) */}
              <line x1="390" y1="305" x2="325" y2="240" stroke="#cbd5e1" strokeWidth="2.2" />
              {/* Bottom-Right Arm: GND (390,305) -> AC2 (455,240) = D2 (Pair A) */}
              <line x1="390" y1="305" x2="455" y2="240" stroke="#cbd5e1" strokeWidth="2.2" />

              {/* Diode Symbol Helper: Triangle pointing toward cathode + bar */}
              {/* D1: Center (357, 207), pointing (-45 deg up-right toward 390,175) */}
              <g transform="translate(357,207) rotate(-45)">
                <polygon
                  points="-10,-9 10,0 -10,9"
                  fill={sample.diodeGlowPairA > 0.1 ? '#fb923c' : '#1e293b'}
                  stroke={strokeFor('bridgeDiodes', '#f8fafc')}
                  strokeWidth="2"
                />
                <line x1="10" y1="-10" x2="10" y2="10" stroke="#38bdf8" strokeWidth="2.8" />
              </g>
              <text x="336" y="192" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                D1
              </text>

              {/* D3: Center (422, 207), pointing (-135 deg up-left toward 390,175) */}
              <g transform="translate(422,207) rotate(-135)">
                <polygon
                  points="-10,-9 10,0 -10,9"
                  fill={sample.diodeGlowPairB > 0.1 ? '#fb923c' : '#1e293b'}
                  stroke={strokeFor('bridgeDiodes', '#f8fafc')}
                  strokeWidth="2"
                />
                <line x1="10" y1="-10" x2="10" y2="10" stroke="#38bdf8" strokeWidth="2.8" />
              </g>
              <text x="434" y="192" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                D3
              </text>

              {/* D4: Center (357, 272), pointing (-135 deg up-left from GND 390,305 -> AC1 325,240) */}
              <g transform="translate(357,272) rotate(-135)">
                <polygon
                  points="-10,-9 10,0 -10,9"
                  fill={sample.diodeGlowPairB > 0.1 ? '#fb923c' : '#1e293b'}
                  stroke={strokeFor('bridgeDiodes', '#f8fafc')}
                  strokeWidth="2"
                />
                <line x1="10" y1="-10" x2="10" y2="10" stroke="#38bdf8" strokeWidth="2.8" />
              </g>
              <text x="332" y="290" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                D4
              </text>

              {/* D2: Center (422, 272), pointing (-45 deg up-right from GND 390,305 -> AC2 455,240) */}
              <g transform="translate(422,272) rotate(-45)">
                <polygon
                  points="-10,-9 10,0 -10,9"
                  fill={sample.diodeGlowPairA > 0.1 ? '#fb923c' : '#1e293b'}
                  stroke={strokeFor('bridgeDiodes', '#f8fafc')}
                  strokeWidth="2"
                />
                <line x1="10" y1="-10" x2="10" y2="10" stroke="#38bdf8" strokeWidth="2.8" />
              </g>
              <text x="436" y="290" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                D2
              </text>

              <text x="390" y="96" textAnchor="middle" fill="#fb923c" fontSize="11" fontFamily="monospace">
                Bridge ({params.diodeType})
              </text>
            </g>

            {/* ================= 5. MAIN ELECTROLYTIC FILTER CAP (C1) ================= */}
            <g {...bindPart('mainCap')}>
              <line x1="515" y1="115" x2="515" y2="245" stroke="#cbd5e1" strokeWidth="2.5" />
              <line x1="515" y1="268" x2="515" y2="410" stroke="#cbd5e1" strokeWidth="2.5" />
              {/* Top Flat Plate (+) */}
              <line
                x1="492"
                y1="245"
                x2="538"
                y2="245"
                stroke={strokeFor('mainCap', '#38bdf8')}
                strokeWidth="3.5"
              />
              {/* Bottom Curved Polarized Plate (-) */}
              <path
                d="M 492 272 Q 515 258, 538 272"
                fill="none"
                stroke={strokeFor('mainCap', '#38bdf8')}
                strokeWidth="3.5"
              />
              <text x="498" y="236" fill="#ef4444" fontSize="14" fontWeight="bold">
                +
              </text>
              <text x="546" y="252" fill="#f8fafc" fontSize="12" fontWeight="bold">
                C1
              </text>
              <text x="546" y="268" fill="#38bdf8" fontSize="11" fontFamily="monospace">
                {params.filterCapUf}µF/{params.filterCapRatingV}V
              </text>
              <text x="546" y="284" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                Vc={sample.vCapInternal.toFixed(1)}V
              </text>
            </g>

            {/* ================= 6. INPUT BYPASS CAP (C2: 100 nF) ================= */}
            <g {...bindPart('bypassCapIn')}>
              <line x1="615" y1="115" x2="615" y2="248" stroke="#cbd5e1" strokeWidth="2" />
              <line x1="615" y1="264" x2="615" y2="410" stroke="#cbd5e1" strokeWidth="2" />
              <line
                x1="598"
                y1="248"
                x2="632"
                y2="248"
                stroke={strokeFor('bypassCapIn', '#f59e0b')}
                strokeWidth="3"
              />
              <line
                x1="598"
                y1="264"
                x2="632"
                y2="264"
                stroke={strokeFor('bypassCapIn', '#f59e0b')}
                strokeWidth="3"
              />
              <text x="615" y="292" textAnchor="middle" fill="#fcd34d" fontSize="10" fontFamily="monospace">
                C2 {params.bypassCapInNf}nF
              </text>
            </g>

            {/* ================= 7. REGULATOR IC (U1) & LM317 NETWORK ================= */}
            <g {...bindPart('regulator')}>
              <rect
                x="655"
                y="82"
                width="120"
                height="68"
                rx="6"
                fill="#0f172a"
                stroke={
                  sample.regulatorRegime === 'THERMAL_SHUTDOWN'
                    ? '#ef4444'
                    : strokeFor('regulator', '#38bdf8')
                }
                strokeWidth={isHi('regulator') ? 3.5 : 2.5}
              />
              <text x="715" y="108" textAnchor="middle" fill="#f8fafc" fontSize="14" fontWeight="bold" fontFamily="monospace">
                {params.regulatorType}
              </text>
              <text x="665" y="128" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                IN
              </text>
              <text x="765" y="128" textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                OUT
              </text>
              <text x="715" y="144" textAnchor="middle" fill="#fbbf24" fontSize="10" fontFamily="monospace">
                {isLm317 ? 'ADJ' : 'GND'}
              </text>
            </g>

            {!isLm317 ? (
              /* Fixed 78xx Direct Ground Lead */
              <line x1="715" y1="150" x2="715" y2="410" stroke="#94a3b8" strokeWidth="2.5" />
            ) : (
              /* LM317 Adjustable R1 + Potentiometer R2 Network */
              <g>
                {/* ADJ Node Wire Down to Y=245 */}
                <line x1="715" y1="150" x2="715" y2="245" stroke="#38bdf8" strokeWidth="2.5" />
                <line x1="715" y1="245" x2="805" y2="245" stroke="#38bdf8" strokeWidth="2.5" />

                {/* R1 from OUT (805,115) to ADJ (805,245) */}
                <g {...bindPart('lm317R1')}>
                  <line x1="805" y1="115" x2="805" y2="152" stroke="#cbd5e1" strokeWidth="2.2" />
                  <polyline
                    points="805,152 795,160 815,170 795,180 815,190 795,200 805,208"
                    fill="none"
                    stroke={strokeFor('lm317R1', '#e2cca8')}
                    strokeWidth="2.6"
                  />
                  <line x1="805" y1="208" x2="805" y2="245" stroke="#cbd5e1" strokeWidth="2.2" />
                  <text x="822" y="178" fill="#f8fafc" fontSize="11" fontWeight="bold">
                    R1
                  </text>
                  <text x="822" y="193" fill="#38bdf8" fontSize="10" fontFamily="monospace">
                    {params.lm317R1Ohms}Ω
                  </text>
                </g>

                {/* Potentiometer R2 from ADJ (805,245) to GND (805,410) */}
                <g {...bindPart('potentiometer')}>
                  <line x1="805" y1="245" x2="805" y2="285" stroke="#cbd5e1" strokeWidth="2.2" />
                  <polyline
                    points="805,285 795,295 815,307 795,319 815,331 795,343 805,353"
                    fill="none"
                    stroke={strokeFor('potentiometer', '#60a5fa')}
                    strokeWidth="2.6"
                  />
                  {/* Diagonal Variable Resistor Arrow */}
                  <line
                    x1="785"
                    y1="345"
                    x2="825"
                    y2="292"
                    stroke="#f97316"
                    strokeWidth="2.2"
                  />
                  <polygon points="825,292 816,296 822,302" fill="#f97316" />
                  <line x1="805" y1="353" x2="805" y2="410" stroke="#cbd5e1" strokeWidth="2.2" />
                  <text x="830" y="318" fill="#f8fafc" fontSize="11" fontWeight="bold">
                    R2 (Pot)
                  </text>
                  <text x="830" y="333" fill="#60a5fa" fontSize="10" fontFamily="monospace">
                    {r2Ohms}Ω
                  </text>
                </g>
              </g>
            )}

            {/* ================= 8. OUTPUT CAP (C3: 10 uF) ================= */}
            <g {...bindPart('bypassCapOut')}>
              <line x1="895" y1="115" x2="895" y2="245" stroke="#cbd5e1" strokeWidth="2.2" />
              <line x1="895" y1="266" x2="895" y2="410" stroke="#cbd5e1" strokeWidth="2.2" />
              <line
                x1="876"
                y1="245"
                x2="914"
                y2="245"
                stroke={strokeFor('bypassCapOut', '#60a5fa')}
                strokeWidth="3.2"
              />
              <path
                d="M 876 270 Q 895 258, 914 270"
                fill="none"
                stroke={strokeFor('bypassCapOut', '#60a5fa')}
                strokeWidth="3.2"
              />
              <text x="895" y="296" textAnchor="middle" fill="#93c5fd" fontSize="10" fontFamily="monospace">
                C3 {params.bypassCapOutUf}µF
              </text>
            </g>

            {/* ================= 9. DIGITAL VOLTMETER (V) ================= */}
            <g {...bindPart('voltmeter')}>
              <line x1="965" y1="115" x2="965" y2="225" stroke="#ef4444" strokeWidth="2" strokeDasharray="4,3" />
              <line x1="965" y1="295" x2="965" y2="410" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4,3" />
              <circle
                cx="965"
                cy="260"
                r="34"
                fill="#0f172a"
                stroke={strokeFor('voltmeter', '#eab308')}
                strokeWidth={isHi('voltmeter') ? 3.5 : 2.5}
              />
              <text x="965" y="255" textAnchor="middle" fill="#eab308" fontSize="14" fontWeight="bold">
                V
              </text>
              <text x="965" y="274" textAnchor="middle" fill="#ff4d5e" fontSize="11" fontFamily="monospace" fontWeight="bold">
                {voltmeter.isOffDisplay ? '---' : `${voltmeter.displayText}V`}
              </text>
            </g>

            {/* ================= 10. OUTPUT TERMINALS & LOAD RESISTOR (RL) ================= */}
            <circle cx="1035" cy="115" r="5" fill="#4ade80" />
            <text x="1035" y="98" textAnchor="middle" fill="#4ade80" fontSize="11" fontWeight="bold">
              +Vout
            </text>
            <circle cx="1035" cy="410" r="5" fill="#94a3b8" />

            <g {...bindPart('loadResistor')}>
              <line x1="1035" y1="115" x2="1035" y2="215" stroke="#cbd5e1" strokeWidth="2.5" />
              <polyline
                points="1035,215 1021,227 1049,241 1021,255 1049,269 1021,283 1049,297 1035,309"
                fill="none"
                stroke={
                  useLabStore.getState().faults.loadOverpowerActive
                    ? '#ef4444'
                    : strokeFor('loadResistor', '#4ade80')
                }
                strokeWidth="3"
              />
              <line x1="1035" y1="309" x2="1035" y2="410" stroke="#cbd5e1" strokeWidth="2.5" />
              <text x="1076" y="252" textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="bold">
                RL
              </text>
              <text x="1076" y="269" textAnchor="middle" fill="#4ade80" fontSize="11" fontFamily="monospace">
                {params.loadResistanceOhms}Ω
              </text>
              <text x="1076" y="285" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                {(sample.iLoad * 1000).toFixed(0)}mA
              </text>
            </g>
          </svg>
        </div>
      ) : (
        /* Functional System Block Diagram (Distinct from Circuit Schematic!) */
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-slate-800 bg-[#050a12] p-4">
          <div className="mb-3 text-center">
            <h3 className="text-sm font-bold text-slate-100">
              System Architecture Block Diagram (Signal &amp; Power Conditioning Chain)
            </h3>
            <p className="text-xs text-slate-400">
              Note: This high-level functional block diagram illustrates stage-by-stage
              energy conversion; switch to the 2D Schematic tab for pin-level circuit symbols.
            </p>
          </div>

          <svg viewBox="0 0 1060 280" className="w-full max-w-5xl">
            {[
              { id: 'acSource' as ComponentId, x: 20, title: 'AC Source', sub: `${params.acVrms}V ${params.acFrequencyHz}Hz` },
              { id: 'powerSwitch' as ComponentId, x: 165, title: 'Mains Switch', sub: params.switchClosed ? 'CLOSED (ON)' : 'OPEN (OFF)' },
              { id: 'transformer' as ComponentId, x: 310, title: 'Transformer', sub: `230V → ${params.transformerSecondaryVrms}V` },
              { id: 'bridgeDiodes' as ComponentId, x: 465, title: 'Bridge Rectifier', sub: `4× ${params.diodeType}` },
              { id: 'mainCap' as ComponentId, x: 625, title: 'Filter Capacitor', sub: `${params.filterCapUf} µF` },
              { id: 'regulator' as ComponentId, x: 780, title: 'IC Regulator', sub: params.regulatorType },
              { id: 'loadResistor' as ComponentId, x: 925, title: 'DC Load', sub: `${params.loadResistanceOhms} Ω` },
            ].map((blk, i, arr) => (
              <g key={blk.id} {...bindPart(blk.id)}>
                <rect
                  x={blk.x}
                  y={70}
                  width={120}
                  height={72}
                  rx={10}
                  fill="#0f172a"
                  stroke={strokeFor(blk.id, '#38bdf8')}
                  strokeWidth={isHi(blk.id) ? 3 : 1.8}
                />
                <text
                  x={blk.x + 60}
                  y={102}
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize="12"
                  fontWeight="bold"
                >
                  {blk.title}
                </text>
                <text
                  x={blk.x + 60}
                  y={122}
                  textAnchor="middle"
                  fill="#38bdf8"
                  fontSize="11"
                  fontFamily="monospace"
                >
                  {blk.sub}
                </text>
                {i < arr.length - 1 && (
                  <g>
                    <line
                      x1={blk.x + 120}
                      y1={106}
                      x2={arr[i + 1].x - 6}
                      y2={106}
                      stroke="#64748b"
                      strokeWidth="2.5"
                    />
                    <polygon
                      points={`${arr[i + 1].x},106 ${arr[i + 1].x - 8},101 ${arr[i + 1].x - 8},111`}
                      fill="#38bdf8"
                    />
                  </g>
                )}
              </g>
            ))}

            {/* Parallel Voltmeter Block across Output Terminals */}
            <g {...bindPart('voltmeter')}>
              <line x1="905" y1="106" x2="905" y2="210" stroke="#eab308" strokeWidth="2" strokeDasharray="4,4" />
              <line x1="905" y1="210" x2="925" y2="210" stroke="#eab308" strokeWidth="2" />
              <rect
                x="925"
                y="176"
                width="120"
                height="68"
                rx="10"
                fill="#0f172a"
                stroke={strokeFor('voltmeter', '#eab308')}
                strokeWidth="2"
              />
              <text x="985" y="206" textAnchor="middle" fill="#eab308" fontSize="12" fontWeight="bold">
                Digital Voltmeter
              </text>
              <text x="985" y="226" textAnchor="middle" fill="#ff4d5e" fontSize="12" fontFamily="monospace" fontWeight="bold">
                {voltmeter.isOffDisplay ? '---' : `${voltmeter.displayText} V`}
              </text>
            </g>
          </svg>
        </div>
      )}
    </div>
  );
};
