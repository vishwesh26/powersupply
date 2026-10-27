/**
 * Complete Time-Domain Regulated DC Power Supply Simulator
 * Pure TypeScript — steps AC Source -> Switch -> Transformer -> Bridge Rectifier
 * -> Electrolytic Filter -> Linear Regulator -> Load & Voltmeter.
 *
 * Zero React, Three.js, or external numerical library dependencies.
 */

import { computeAcSource } from './acSource';
import { computeBridgeRectifier, getDiodeForwardDrop } from './bridgeRectifier';
import { stepCapacitorFilter } from './capacitorFilter';
import { evaluateFaults } from './faults';
import { evaluateLoad } from './loadModel';
import { evaluatePowerSwitch } from './powerSwitch';
import {
  AMBIENT_TEMP_C,
  computeLm317TargetVoltage,
  evaluateRegulator,
  REGULATOR_DROPOUT_V,
} from './regulators';
import { computeTransformer } from './transformer';
import {
  CircuitParameters,
  EngineState,
  SamplePoint,
  VoltmeterReading,
} from './types';
import {
  computeVoltmeterReading,
  selectProbedVoltage,
  VOLTMETER_WINDOW_SEC,
} from './voltmeter';

export const DEFAULT_DT_SEC = 0.000025; // 25 microseconds (40 kHz integration rate)
const METER_SUBSAMPLE_STRIDE = 10; // Record meter history every 250 us (400 samples per 100 ms)

export function createDefaultParameters(): CircuitParameters {
  return {
    acVrms: 230,
    acFrequencyHz: 50,
    switchClosed: true,
    transformerPrimaryRatedVrms: 230,
    transformerSecondaryVrms: 12,
    transformerWindingResistanceOhms: 3.6,
    diodeType: '1N4007',
    diodeForwardDropV: 0.7,
    filterCapUf: 1000,
    filterCapRatingV: 25,
    filterCapEsrOhms: 0.08,
    bypassCapInNf: 100,
    bypassCapOutUf: 10,
    regulatorType: 'LM7805',
    lm317R1Ohms: 240,
    potMaxOhms: 10000,
    potPosition: 0.072, // ~5.04 V default when switching to LM317
    loadResistanceOhms: 220,
    loadPowerRatingW: 0.5,
    voltmeterNode: 'output',
  };
}

export function createInitialEngineState(
  params: CircuitParameters = createDefaultParameters(),
  dtSec: number = DEFAULT_DT_SEC
): EngineState {
  const zeroSample: SamplePoint = {
    timeSec: 0,
    vAcPrimary: 0,
    vPrimarySwitched: 0,
    vSecOpenCircuit: 0,
    vSecLoaded: 0,
    vRectUnfiltered: 0,
    vCapInternal: 0,
    vFilterNode: 0,
    vRegOut: 0,
    iSecondary: 0,
    iRectifier: 0,
    iCap: 0,
    iRegIn: 0,
    iLoad: 0,
    pLoad: 0,
    pRegulator: 0,
    conductingPair: 'NONE',
    diodeGlowPairA: 0,
    diodeGlowPairB: 0,
    regulatorRegime: 'OFF',
    regulatorTargetV:
      params.regulatorType === 'LM317'
        ? computeLm317TargetVoltage(
            params.lm317R1Ohms,
            params.potPosition * params.potMaxOhms
          )
        : params.regulatorType === 'LM7805'
        ? 5
        : params.regulatorType === 'LM7809'
        ? 9
        : 12,
    regulatorTempC: AMBIENT_TEMP_C,
  };

  const voltmeter = computeVoltmeterReading([], params.voltmeterNode, params.switchClosed, 0);
  const faults = evaluateFaults({
    params,
    sample: zeroSample,
    prevCapVentLatched: false,
    prevLoadScorchedLatched: false,
    thermalShutdownLatched: false,
  });

  return {
    timeSec: 0,
    dtSec,
    vCap: 0,
    regulatorTempC: AMBIENT_TEMP_C,
    thermalShutdownLatched: false,
    capVentLatched: false,
    loadScorchedLatched: false,
    meterHistory: [],
    meterSubsampleCounter: 0,
    lastSample: zeroSample,
    voltmeter,
    faults,
  };
}

/**
 * Advances the entire power supply circuit by one fixed time step (dtSec).
 * Mutates `state` in place for high-frequency batch performance (zero GC churn)
 * and returns the newly computed SamplePoint.
 */
export function stepCircuit(
  state: EngineState,
  params: CircuitParameters
): SamplePoint {
  const dt = state.dtSec;
  const t = state.timeSec + dt;

  // 1. AC Mains Source
  const ac = computeAcSource({
    vRms: params.acVrms,
    frequencyHz: params.acFrequencyHz,
    timeSec: t,
  });

  // 2. Mains Series Power Switch
  const sw = evaluatePowerSwitch({
    vPrimaryIn: ac.vInstant,
    closed: params.switchClosed,
  });

  // 3. Unloaded Transformer Secondary Voltage
  const xfmrOc = computeTransformer({
    vPrimaryInstant: sw.vPrimaryOut,
    vPrimaryRatedRms: params.transformerPrimaryRatedVrms,
    vSecondaryRatedRms: params.transformerSecondaryVrms,
    windingResistanceOhms: params.transformerWindingResistanceOhms,
    iSecondary: 0,
  });

  // 4. Bridge Rectifier Open-Circuit Envelope
  const vf = getDiodeForwardDrop(params.diodeType, params.diodeForwardDropV);
  const rectOc = computeBridgeRectifier({
    vSecondary: xfmrOc.vSecOpenCircuit,
    forwardDropPerDiodeV: vf,
  });

  // 5. Predict Regulator Current Draw to determine Effective Load Resistance R_eff on C1
  const r2Ohms = params.potPosition * params.potMaxOhms;
  const regPredict = evaluateRegulator({
    type: params.regulatorType,
    vIn: state.vCap,
    rLoadOhms: params.loadResistanceOhms,
    lm317R1Ohms: params.lm317R1Ohms,
    lm317R2Ohms: r2Ohms,
    prevTempC: state.regulatorTempC,
    prevThermalShutdown: state.thermalShutdownLatched,
    dtSec: dt,
  });

  // Total DC-bus discharge conductance = regulator input draw + bench rail bleeder (470 Ohms)
  const gBleeder = 1 / 470;
  const gReg =
    state.vCap > 0.05 && regPredict.iRegIn > 1e-6
      ? regPredict.iRegIn / state.vCap
      : 0;
  const rEff = 1 / Math.max(1e-4, gReg + gBleeder);

  // 6. Step Electrolytic Filter Capacitor ODE
  const cap = stepCapacitorFilter({
    vRectOpenCircuit: rectOc.vRectified,
    vCapPrev: state.vCap,
    capacitanceUf: params.filterCapUf,
    esrOhms: params.filterCapEsrOhms,
    windingResistanceOhms: params.transformerWindingResistanceOhms,
    effectiveLoadResistanceOhms: rEff,
    dtSec: dt,
    sourceConnected: sw.isEnergized,
  });

  // 7. Compute Loaded Transformer Secondary & Bridge Conduction Visuals
  const iSecondary =
    xfmrOc.vSecOpenCircuit >= 0 ? cap.iRectifier : -cap.iRectifier;
  const xfmrLoaded = computeTransformer({
    vPrimaryInstant: sw.vPrimaryOut,
    vPrimaryRatedRms: params.transformerPrimaryRatedVrms,
    vSecondaryRatedRms: params.transformerSecondaryVrms,
    windingResistanceOhms: params.transformerWindingResistanceOhms,
    iSecondary,
  });

  const rectLoaded = computeBridgeRectifier({
    vSecondary: xfmrLoaded.vSecLoaded,
    forwardDropPerDiodeV: vf,
    isChargingCap: cap.isCharging,
    chargingCurrentA: cap.iRectifier,
    vSecPeakEstimate: Math.max(1, params.transformerSecondaryVrms * Math.SQRT2),
  });

  // Unfiltered full-wave bridge reference waveform (0 to ~Vsec_peak - 2Vf)
  const rectUnfiltered = computeBridgeRectifier({
    vSecondary: xfmrOc.vSecOpenCircuit,
    forwardDropPerDiodeV: vf,
  });

  // 8. Evaluate Regulator at Updated Filter Terminal Voltage
  const reg = evaluateRegulator({
    type: params.regulatorType,
    vIn: cap.vFilterTerminal,
    rLoadOhms: params.loadResistanceOhms,
    lm317R1Ohms: params.lm317R1Ohms,
    lm317R2Ohms: r2Ohms,
    prevTempC: state.regulatorTempC,
    prevThermalShutdown: state.thermalShutdownLatched,
    dtSec: dt,
  });

  // 9. Evaluate Load Resistor
  const load = evaluateLoad({
    vOut: reg.vOut,
    resistanceOhms: params.loadResistanceOhms,
    powerRatingW: params.loadPowerRatingW,
  });

  const sample: SamplePoint = {
    timeSec: t,
    vAcPrimary: ac.vInstant,
    vPrimarySwitched: sw.vPrimaryOut,
    vSecOpenCircuit: xfmrOc.vSecOpenCircuit,
    vSecLoaded: xfmrLoaded.vSecLoaded,
    vRectUnfiltered: rectUnfiltered.vRectified,
    vCapInternal: cap.vCapNew,
    vFilterNode: cap.vFilterTerminal,
    vRegOut: reg.vOut,
    iSecondary,
    iRectifier: cap.iRectifier,
    iCap: cap.iCap,
    iRegIn: reg.iRegIn,
    iLoad: load.currentA,
    pLoad: load.powerW,
    pRegulator: reg.powerDissipationW,
    conductingPair: rectLoaded.conductingPair,
    diodeGlowPairA: sw.isEnergized ? rectLoaded.glowPairA : 0,
    diodeGlowPairB: sw.isEnergized ? rectLoaded.glowPairB : 0,
    regulatorRegime: reg.regime,
    regulatorTargetV: reg.vTarget,
    regulatorTempC: reg.tempC,
  };

  // Update state variables
  state.timeSec = t;
  state.vCap = cap.vCapNew;
  state.regulatorTempC = reg.tempC;
  state.thermalShutdownLatched = reg.thermalShutdown;
  state.lastSample = sample;

  // 10. Update Rolling 100 ms Voltmeter Window
  state.meterSubsampleCounter += 1;
  if (state.meterSubsampleCounter >= METER_SUBSAMPLE_STRIDE) {
    state.meterSubsampleCounter = 0;
    state.meterHistory.push({
      timeSec: t,
      vOut: sample.vRegOut,
      vFilter: sample.vFilterNode,
      vRect: sample.vRectUnfiltered,
      vSec: sample.vSecLoaded,
    });

    const cutoff = t - VOLTMETER_WINDOW_SEC;
    while (state.meterHistory.length > 2 && state.meterHistory[0].timeSec < cutoff) {
      state.meterHistory.shift();
    }
  }

  const instantProbed = selectProbedVoltage(
    {
      timeSec: t,
      vOut: sample.vRegOut,
      vFilter: sample.vFilterNode,
      vRect: sample.vRectUnfiltered,
      vSec: sample.vSecLoaded,
    },
    params.voltmeterNode
  );

  state.voltmeter = computeVoltmeterReading(
    state.meterHistory,
    params.voltmeterNode,
    params.switchClosed,
    instantProbed
  );

  // 11. Evaluate Faults & Latched Visual States
  const faults = evaluateFaults({
    params,
    sample,
    prevCapVentLatched: state.capVentLatched,
    prevLoadScorchedLatched: state.loadScorchedLatched,
    thermalShutdownLatched: state.thermalShutdownLatched,
  });

  state.capVentLatched = faults.capVentLatched;
  state.loadScorchedLatched = faults.loadScorchedLatched;
  state.faults = faults;

  return sample;
}

/**
 * Steps the engine `numSteps` times and returns subsampled scope points
 * so 60 fps rendering remains effortless even at high sample rates.
 */
export function stepBatch(
  state: EngineState,
  params: CircuitParameters,
  numSteps: number,
  scopeDecimation: number = 4
): SamplePoint[] {
  const collected: SamplePoint[] = [];
  const steps = Math.max(1, Math.floor(numSteps));
  const decimate = Math.max(1, Math.floor(scopeDecimation));

  for (let i = 0; i < steps; i++) {
    const s = stepCircuit(state, params);
    if ((i + 1) % decimate === 0 || i === steps - 1) {
      collected.push(s);
    }
  }
  return collected;
}

/**
 * Resets latched component damage/faults (capacitor vent bulge, resistor scorch,
 * and regulator thermal shutdown / elevated junction temperature).
 */
export function resetEngineFaults(state: EngineState, params: CircuitParameters): void {
  state.capVentLatched = false;
  state.loadScorchedLatched = false;
  state.thermalShutdownLatched = false;
  state.regulatorTempC = AMBIENT_TEMP_C;
  state.faults = evaluateFaults({
    params,
    sample: { ...state.lastSample, regulatorTempC: AMBIENT_TEMP_C, regulatorRegime: 'REGULATING' },
    prevCapVentLatched: false,
    prevLoadScorchedLatched: false,
    thermalShutdownLatched: false,
  });
}

/**
 * Generates a concise engineering "Why did this change?" explanation
 * based on the live operating regime of the power supply.
 */
export function explainCircuitBehavior(
  params: CircuitParameters,
  sample: SamplePoint,
  voltmeter: VoltmeterReading
): string {
  if (!params.switchClosed) {
    if (sample.vCapInternal > 0.08) {
      return `Mains switch is OFF: bridge diodes are reverse-biased and C1 (${params.filterCapUf} µF) is exponentially discharging through the load (${sample.vCapInternal.toFixed(2)} V remaining).`;
    }
    return `Mains switch is OFF and C1 has fully discharged to 0 V. Voltmeter reads "---" with zero circuit current.`;
  }

  if (sample.regulatorRegime === 'THERMAL_SHUTDOWN') {
    return `Output dropped to 0 V because ${params.regulatorType} junction temperature (${sample.regulatorTempC.toFixed(0)} °C) exceeded 150 °C thermal shutdown limit due to high (Vin − Vout)·Iload dissipation.`;
  }

  if (sample.regulatorRegime === 'CURRENT_LIMITED') {
    return `Output folded down to ${sample.vRegOut.toFixed(2)} V because load (${params.loadResistanceOhms} Ω) demands more than the ${params.regulatorType}'s 1.00 A current limit (Vout = Ilimit × Rload).`;
  }

  if (sample.regulatorRegime === 'DROPOUT') {
    const needed = sample.regulatorTargetV + REGULATOR_DROPOUT_V;
    return `Output dropped (${voltmeter.averageV.toFixed(2)} V < ${sample.regulatorTargetV.toFixed(2)} V) with ${ (voltmeter.ripplePpV * 1000).toFixed(0) } mVpp ripple because filter trough (${sample.vFilterNode.toFixed(2)} V) is below the ${params.regulatorType} headroom requirement (${needed.toFixed(2)} V = Vtarget + 2.0 V dropout).`;
  }

  if (params.filterCapUf <= 220) {
    return `Reduced C1 (${params.filterCapUf} µF) shortens RC discharge time constant, increasing 100 Hz filter ripple; ${params.regulatorType} still rejects ripple while Vin stays above ${(sample.regulatorTargetV + 2).toFixed(1)} V.`;
  }

  if (params.regulatorType === 'LM317') {
    const r2 = Math.round(params.potPosition * params.potMaxOhms);
    return `LM317 regulating cleanly at ${sample.vRegOut.toFixed(2)} V via R1=${params.lm317R1Ohms} Ω and pot R2=${r2} Ω, with ${(sample.vFilterNode - sample.vRegOut).toFixed(1)} V pass headroom (${sample.pRegulator.toFixed(2)} W dissipation).`;
  }

  return `${params.regulatorType} regulating steadily at ${sample.vRegOut.toFixed(2)} V: filter cap holds ~${sample.vFilterNode.toFixed(1)} V (above ${(sample.regulatorTargetV + 2).toFixed(1)} V dropout threshold), supplying ${(sample.iLoad * 1000).toFixed(1)} mA to the ${params.loadResistanceOhms} Ω load.`;
}
