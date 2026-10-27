/**
 * Pure TypeScript types for the Regulated DC Power Supply simulation engine.
 * Zero UI, React, or 3D dependencies.
 */

export type DiodeModelType = '1N4007' | '1N5819' | 'ideal' | 'custom';

export type RegulatorModelType = 'LM7805' | 'LM7809' | 'LM7812' | 'LM317';

export type RegulatorRegime =
  | 'OFF'
  | 'REGULATING'
  | 'DROPOUT'
  | 'CURRENT_LIMITED'
  | 'THERMAL_SHUTDOWN';

export type ProbeNodeType = 'output' | 'filter' | 'rectifier' | 'secondary';

export type ComponentId =
  | 'acSource'
  | 'powerSwitch'
  | 'transformer'
  | 'bridgeDiodes'
  | 'mainCap'
  | 'bypassCapIn'
  | 'bypassCapOut'
  | 'regulator'
  | 'lm317R1'
  | 'potentiometer'
  | 'loadResistor'
  | 'voltmeter';

export interface CircuitParameters {
  // 1. AC Mains Source
  acVrms: number; // Default 230 V RMS
  acFrequencyHz: number; // Default 50 Hz (50 or 60 Hz)

  // 2. Power Switch
  switchClosed: boolean; // Default true (ON)

  // 3. Step-Down Transformer
  transformerPrimaryRatedVrms: number; // Default 230 V
  transformerSecondaryVrms: number; // Default 12 V (9 / 12 / 15 / 18 V or custom)
  transformerWindingResistanceOhms: number; // Default 4.2 Ohms (copper winding resistance referred to secondary)

  // 4. Bridge Rectifier Diodes
  diodeType: DiodeModelType; // Default '1N4007'
  diodeForwardDropV: number; // Default 0.7 V per diode

  // 5. Main Electrolytic Filter Capacitor
  filterCapUf: number; // Default 1000 uF
  filterCapRatingV: number; // Default 25 V
  filterCapEsrOhms: number; // Default 0.08 Ohms

  // 6. Bypass Capacitors (high-frequency stability & transient decoupling)
  bypassCapInNf: number; // Default 100 nF (0.1 uF)
  bypassCapOutUf: number; // Default 10 uF

  // 7. Linear Voltage Regulator IC
  regulatorType: RegulatorModelType; // Default 'LM7805'
  lm317R1Ohms: number; // Default 240 Ohms
  potMaxOhms: number; // Default 10000 Ohms (10 kOhm)
  potPosition: number; // 0.0 to 1.0 (fraction of R_pot active as R2)

  // 8. Load Resistor
  loadResistanceOhms: number; // Default 220 Ohms (10 to 10000 Ohms)
  loadPowerRatingW: number; // Default 0.5 W

  // 9. Digital Voltmeter
  voltmeterNode: ProbeNodeType; // Default 'output'
}

export interface SamplePoint {
  timeSec: number;
  vAcPrimary: number; // Mains AC source voltage (V)
  vPrimarySwitched: number; // Voltage after power switch (V)
  vSecOpenCircuit: number; // Unloaded secondary voltage (V)
  vSecLoaded: number; // Secondary terminal voltage under charging current (V)
  vRectUnfiltered: number; // Ideal full-wave rectified envelope max(|Vsec| - 2Vf, 0) (V)
  vCapInternal: number; // Capacitor dielectric state voltage (V)
  vFilterNode: number; // Capacitor terminal voltage including ESR (V)
  vRegOut: number; // Regulated output terminal voltage (V)

  // Currents & Powers
  iSecondary: number; // Transformer secondary current (A, signed with AC polarity)
  iRectifier: number; // Bridge rectifier output charging pulse current (A, >= 0)
  iCap: number; // Filter capacitor current C*dV/dt (A, + charging, - discharging)
  iRegIn: number; // Regulator input current (A)
  iLoad: number; // Output load current Vout / Rload (A)
  pLoad: number; // Power dissipated in load resistor (W)
  pRegulator: number; // Power dissipated in linear regulator pass element (W)

  // Component physical states
  conductingPair: 'NONE' | 'D1_D2' | 'D3_D4';
  diodeGlowPairA: number; // 0..1 visual conduction intensity for D1 & D2 (+ half-cycle)
  diodeGlowPairB: number; // 0..1 visual conduction intensity for D3 & D4 (- half-cycle)
  regulatorRegime: RegulatorRegime;
  regulatorTargetV: number;
  regulatorTempC: number;
}

export interface VoltmeterReading {
  node: ProbeNodeType;
  instantaneousV: number;
  averageV: number;
  minV: number;
  maxV: number;
  ripplePpV: number;
  rmsV: number;
  displayText: string; // e.g. "05.00" or "---"
  isOffDisplay: boolean;
}

export interface FaultFlags {
  // Instantaneous active warnings/faults
  capOvervoltageActive: boolean;
  loadOverpowerActive: boolean;
  regulatorThermalShutdownActive: boolean;
  regulatorOverheatWarning: boolean;
  regulatorDropoutActive: boolean;
  regulatorCurrentLimitActive: boolean;
  bypassInLowWarning: boolean;
  bypassOutLowWarning: boolean;

  // Latched physical damage states (persist visually until "Reset Faults" is clicked)
  capVentLatched: boolean;
  loadScorchedLatched: boolean;
  thermalShutdownLatched: boolean;

  messages: FaultMessage[];
}

export interface FaultMessage {
  id: string;
  severity: 'fault' | 'warning' | 'info';
  component: ComponentId;
  text: string;
}

export interface VoltmeterWindowSample {
  timeSec: number;
  vOut: number;
  vFilter: number;
  vRect: number;
  vSec: number;
}

export interface EngineState {
  timeSec: number;
  dtSec: number; // Fixed step (default 25 microseconds = 0.000025 s)
  vCap: number; // Stored voltage across main electrolytic capacitor (V)
  regulatorTempC: number; // Junction temperature Tj (°C)
  thermalShutdownLatched: boolean; // Hysteresis state for thermal protection
  capVentLatched: boolean;
  loadScorchedLatched: boolean;
  meterHistory: VoltmeterWindowSample[];
  meterSubsampleCounter: number;
  lastSample: SamplePoint;
  voltmeter: VoltmeterReading;
  faults: FaultFlags;
}
