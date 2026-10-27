/**
 * Fault & Operating-Warning Detection Engine
 * Pure TypeScript — checks component stress thresholds and maintains
 * latched visual damage flags until explicitly reset by the user.
 */

import { evaluateBypassCaps } from './bypassCaps';
import { CircuitParameters, FaultFlags, FaultMessage, SamplePoint } from './types';

export interface FaultDetectionInput {
  params: CircuitParameters;
  sample: SamplePoint;
  prevCapVentLatched: boolean;
  prevLoadScorchedLatched: boolean;
  thermalShutdownLatched: boolean;
}

export function evaluateFaults(input: FaultDetectionInput): FaultFlags {
  const { params, sample } = input;
  const messages: FaultMessage[] = [];

  // 1. Electrolytic Capacitor Overvoltage Check
  const capOvervoltageActive = sample.vCapInternal > params.filterCapRatingV * 1.001;
  const capVentLatched = input.prevCapVentLatched || capOvervoltageActive;

  if (capOvervoltageActive) {
    messages.push({
      id: 'cap-overvoltage',
      severity: 'fault',
      component: 'mainCap',
      text: `Capacitor overvoltage! Filter peak (${sample.vCapInternal.toFixed(1)} V) exceeds ${params.filterCapRatingV} V rating — top vent bulging.`,
    });
  } else if (capVentLatched) {
    messages.push({
      id: 'cap-vent-latched',
      severity: 'warning',
      component: 'mainCap',
      text: `Main capacitor suffered prior overvoltage stress (vent bulged). Click "Reset Faults" to replace.`,
    });
  } else if (sample.vCapInternal > params.filterCapRatingV * 0.85) {
    messages.push({
      id: 'cap-derating',
      severity: 'info',
      component: 'mainCap',
      text: `Capacitor operating above 85% of ${params.filterCapRatingV} V rating (${sample.vCapInternal.toFixed(1)} V); 20%+ voltage derating is recommended in practice.`,
    });
  }

  // 2. Load Resistor Overpower Check
  const loadOverpowerActive = sample.pLoad > params.loadPowerRatingW * 1.001;
  const loadScorchedLatched = input.prevLoadScorchedLatched || loadOverpowerActive;

  if (loadOverpowerActive) {
    messages.push({
      id: 'load-overpower',
      severity: 'fault',
      component: 'loadResistor',
      text: `Load resistor overpower! Dissipating ${sample.pLoad.toFixed(2)} W vs ${params.loadPowerRatingW.toFixed(2)} W rating — resistor body overheating/discoloring.`,
    });
  } else if (loadScorchedLatched) {
    messages.push({
      id: 'load-scorched-latched',
      severity: 'warning',
      component: 'loadResistor',
      text: `Load resistor discolored from prior overpower event. Click "Reset Faults" to restore.`,
    });
  }

  // 3. Regulator Thermal Shutdown & High Junction Temperature
  const regulatorThermalShutdownActive =
    sample.regulatorRegime === 'THERMAL_SHUTDOWN' || input.thermalShutdownLatched;
  const regulatorOverheatWarning =
    !regulatorThermalShutdownActive && sample.regulatorTempC >= 100.0;

  if (regulatorThermalShutdownActive) {
    messages.push({
      id: 'reg-thermal-shutdown',
      severity: 'fault',
      component: 'regulator',
      text: `${params.regulatorType} thermal shutdown engaged (Tj = ${sample.regulatorTempC.toFixed(0)} °C ≥ 150 °C)! Output disabled until IC cools below 125 °C or faults are reset.`,
    });
  } else if (regulatorOverheatWarning) {
    messages.push({
      id: 'reg-hot',
      severity: 'warning',
      component: 'regulator',
      text: `${params.regulatorType} running hot (Tj = ${sample.regulatorTempC.toFixed(0)} °C, Pdiss = ${sample.pRegulator.toFixed(2)} W). Consider lowering Vin or adding a heatsink.`,
    });
  }

  // 4. Regulator Current Limit & Dropout Warnings
  const regulatorCurrentLimitActive = sample.regulatorRegime === 'CURRENT_LIMITED';
  if (regulatorCurrentLimitActive) {
    messages.push({
      id: 'reg-current-limit',
      severity: 'warning',
      component: 'regulator',
      text: `${params.regulatorType} current-limiting at 1.00 A! Load (${params.loadResistanceOhms} Ω) pulls output down to ${sample.vRegOut.toFixed(2)} V.`,
    });
  }

  const regulatorDropoutActive =
    params.switchClosed &&
    sample.regulatorRegime === 'DROPOUT' &&
    sample.vFilterNode > 0.5;
  if (regulatorDropoutActive) {
    const requiredVin = sample.regulatorTargetV + 2.0;
    messages.push({
      id: 'reg-dropout',
      severity: 'warning',
      component: 'regulator',
      text: `${params.regulatorType} in dropout! Filter voltage (${sample.vFilterNode.toFixed(2)} V) is below required ${requiredVin.toFixed(2)} V headroom (Vtarget + 2.0 V).`,
    });
  }

  // 5. Bypass Capacitor Datasheet Checks
  const bypassCheck = evaluateBypassCaps({
    cInNf: params.bypassCapInNf,
    cOutUf: params.bypassCapOutUf,
  });

  if (!bypassCheck.isInputCapAdequate) {
    messages.push({
      id: 'bypass-in-low',
      severity: 'info',
      component: 'bypassCapIn',
      text: bypassCheck.notes[0],
    });
  }
  if (!bypassCheck.isOutputCapAdequate) {
    messages.push({
      id: 'bypass-out-low',
      severity: 'info',
      component: 'bypassCapOut',
      text: bypassCheck.notes[bypassCheck.notes.length - 1],
    });
  }

  return {
    capOvervoltageActive,
    loadOverpowerActive,
    regulatorThermalShutdownActive,
    regulatorOverheatWarning,
    regulatorDropoutActive,
    regulatorCurrentLimitActive,
    bypassInLowWarning: !bypassCheck.isInputCapAdequate,
    bypassOutLowWarning: !bypassCheck.isOutputCapAdequate,
    capVentLatched,
    loadScorchedLatched,
    thermalShutdownLatched: input.thermalShutdownLatched,
    messages,
  };
}
