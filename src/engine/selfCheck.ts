/**
 * Self-Check Verification Suite for the Pure-TS Power Supply Engine
 * Runs deterministic physics & scenario checks usable both in Vitest
 * and inside the interactive browser "Self-Check" diagnostic modal.
 */

import { computeAcSource } from './acSource';
import { computeBridgeRectifier, getDiodeForwardDrop } from './bridgeRectifier';
import { evaluateLoad } from './loadModel';
import { computeLm317TargetVoltage } from './regulators';
import {
  createDefaultParameters,
  createInitialEngineState,
  stepCircuit,
} from './simulator';
import { computeTransformer } from './transformer';
import { CircuitParameters } from './types';

export interface SelfCheckResult {
  id: string;
  title: string;
  passed: boolean;
  expected: string;
  measured: string;
  details: string;
}

function runForDuration(params: CircuitParameters, durationSec: number) {
  const state = createInitialEngineState(params, 0.000025);
  const steps = Math.round(durationSec / state.dtSec);
  for (let i = 0; i < steps; i++) {
    stepCircuit(state, params);
  }
  return state;
}

export function runEngineSelfChecks(): SelfCheckResult[] {
  const results: SelfCheckResult[] = [];

  // 1. 230 V RMS -> ~325.27 V Peak
  {
    const quarterPeriod = 1 / (4 * 50); // 5 ms -> sin(pi/2) = 1
    const ac = computeAcSource({ vRms: 230, frequencyHz: 50, timeSec: quarterPeriod });
    const pass = Math.abs(ac.vPeak - 325.269) < 0.02 && Math.abs(ac.vInstant - 325.269) < 0.02;
    results.push({
      id: 'ac-peak',
      title: '1. AC Mains RMS-to-Peak Conversion (230 V RMS, 50 Hz)',
      passed: pass,
      expected: 'Vm = 325.27 V peak',
      measured: `Vm = ${ac.vPeak.toFixed(2)} V (V(5ms) = ${ac.vInstant.toFixed(2)} V)`,
      details: 'Verifies Vm = Vrms × √2 and sinusoidal phase accuracy at t = T/4.',
    });
  }

  // 2. Transformer 230 V -> 12 V RMS (~16.97 V Peak) & Zero DC
  {
    let sum = 0;
    let sumSq = 0;
    let maxPeak = 0;
    const N = 800; // 1 full 50 Hz cycle (20 ms at 25 us)
    for (let i = 0; i < N; i++) {
      const t = (i / N) * 0.02;
      const ac = computeAcSource({ vRms: 230, frequencyHz: 50, timeSec: t });
      const xf = computeTransformer({
        vPrimaryInstant: ac.vInstant,
        vPrimaryRatedRms: 230,
        vSecondaryRatedRms: 12,
      });
      sum += xf.vSecOpenCircuit;
      sumSq += xf.vSecOpenCircuit * xf.vSecOpenCircuit;
      if (xf.vSecOpenCircuit > maxPeak) maxPeak = xf.vSecOpenCircuit;
    }
    const rms = Math.sqrt(sumSq / N);
    const meanDc = sum / N;
    const pass =
      Math.abs(rms - 12.0) < 0.05 &&
      Math.abs(maxPeak - 16.97) < 0.05 &&
      Math.abs(meanDc) < 1e-6;
    results.push({
      id: 'xfmr-scaling',
      title: '2. Step-Down Transformer (12 V RMS, ~16.97 V Peak, Zero DC)',
      passed: pass,
      expected: '12.00 V RMS, 16.97 V peak, 0.00 V DC',
      measured: `${rms.toFixed(2)} V RMS, ${maxPeak.toFixed(2)} V peak, ${meanDc.toFixed(4)} V DC`,
      details: 'Verifies ideal turns-ratio scaling and absence of artificial DC offset.',
    });
  }

  // 3. Bridge Rectifier Non-Negative, 2f = 100 Hz Ripple, & Schottky Comparison
  {
    let allNonNegative = true;
    let peakCount = 0;
    let prev = 0;
    let prevPrev = 0;
    const N = 800; // 20 ms (one 50 Hz cycle -> should have 2 rectified peaks = 100 Hz!)
    const vfSi = getDiodeForwardDrop('1N4007', 0.7);
    const vfSchottky = getDiodeForwardDrop('1N5819', 0.32);

    let maxSi = 0;
    let maxSchottky = 0;

    for (let i = 0; i <= N; i++) {
      const t = (i / N) * 0.02;
      const ac = computeAcSource({ vRms: 230, frequencyHz: 50, timeSec: t });
      const xf = computeTransformer({
        vPrimaryInstant: ac.vInstant,
        vPrimaryRatedRms: 230,
        vSecondaryRatedRms: 12,
      });
      const brSi = computeBridgeRectifier({
        vSecondary: xf.vSecOpenCircuit,
        forwardDropPerDiodeV: vfSi,
      });
      const brSch = computeBridgeRectifier({
        vSecondary: xf.vSecOpenCircuit,
        forwardDropPerDiodeV: vfSchottky,
      });

      if (brSi.vRectified < 0) allNonNegative = false;
      if (brSi.vRectified > maxSi) maxSi = brSi.vRectified;
      if (brSch.vRectified > maxSchottky) maxSchottky = brSch.vRectified;

      if (i >= 2 && prev > prevPrev && prev > brSi.vRectified && prev > 10) {
        peakCount += 1;
      }
      prevPrev = prev;
      prev = brSi.vRectified;
    }

    const pass = allNonNegative && peakCount === 2 && maxSchottky > maxSi + 0.5;
    results.push({
      id: 'bridge-2f',
      title: '3. Full-Wave Bridge Rectifier (≥ 0 V, 2f = 100 Hz, Schottky Gain)',
      passed: pass,
      expected: '≥ 0 V, 2 peaks / 20 ms (100 Hz), Vpk(Schottky) > Vpk(1N4007)',
      measured: `Peaks/20ms = ${peakCount} (100 Hz), 1N4007=${maxSi.toFixed(2)} V, 1N5819=${maxSchottky.toFixed(2)} V`,
      details: 'Confirms full-wave frequency doubling (2f) and lower forward drop on 1N5819 Schottky.',
    });
  }

  // 4 & 5. Capacitor Filter Ripple Reduction & Sensitivity to C and R
  {
    const baseParams = {
      ...createDefaultParameters(),
      voltmeterNode: 'filter' as const,
    };
    const state1000uF = runForDuration({ ...baseParams, filterCapUf: 1000 }, 0.25);
    const state100uF = runForDuration({ ...baseParams, filterCapUf: 100 }, 0.25);
    const stateHeavyLoad = runForDuration(
      { ...baseParams, filterCapUf: 1000, loadResistanceOhms: 22 },
      0.25
    );

    const unfilteredPp = 15.57;
    const ripple1000 = state1000uF.voltmeter.ripplePpV;
    const ripple100 = state100uF.voltmeter.ripplePpV;
    const rippleHeavy = stateHeavyLoad.voltmeter.ripplePpV;

    const pass =
      ripple1000 < unfilteredPp * 0.15 &&
      ripple100 > ripple1000 * 3 &&
      rippleHeavy > ripple1000 * 3;

    results.push({
      id: 'filter-rc-laws',
      title: '4. Filter Ripple Physics (C ↑ reduces ripple, R_load ↓ increases ripple)',
      passed: pass,
      expected: 'Ripple(1000µF,220Ω) < Ripple(100µF,220Ω) & < Ripple(1000µF,22Ω)',
      measured: `1000µF/220Ω: ${ripple1000.toFixed(2)} Vpp | 100µF/220Ω: ${ripple100.toFixed(2)} Vpp | 1000µF/22Ω: ${rippleHeavy.toFixed(2)} Vpp`,
      details: 'Validates exponential RC discharge between 100 Hz charging peaks.',
    });
  }

  // 6. Regulator Regulation vs Dropout (Scenarios 1 & 2: 7805 vs 7812 on 12 V & 18 V)
  {
    const p7805 = createDefaultParameters(); // 12V xfmr, LM7805
    const s7805 = runForDuration(p7805, 0.25);

    const p7812Dropout = { ...createDefaultParameters(), regulatorType: 'LM7812' as const };
    const s7812Dropout = runForDuration(p7812Dropout, 0.25);

    const p7812Reg = {
      ...createDefaultParameters(),
      regulatorType: 'LM7812' as const,
      transformerSecondaryVrms: 18,
    };
    const s7812Reg = runForDuration(p7812Reg, 0.25);

    const pass =
      s7805.lastSample.regulatorRegime === 'REGULATING' &&
      Math.abs(s7805.voltmeter.averageV - 5.0) < 0.05 &&
      s7812Dropout.lastSample.regulatorRegime === 'DROPOUT' &&
      s7812Dropout.voltmeter.averageV < 11.95 &&
      s7812Reg.lastSample.regulatorRegime === 'REGULATING' &&
      Math.abs(s7812Reg.voltmeter.averageV - 12.0) < 0.05 &&
      s7812Reg.lastSample.pRegulator > s7805.lastSample.pRegulator;

    results.push({
      id: 'reg-headroom',
      title: '5. Regulator Headroom & Dropout (7805 vs 7812 @ 12 V & 18 V)',
      passed: pass,
      expected: '7805@12V=5.00V (REG) | 7812@12V<12V (DROPOUT) | 7812@18V=12.00V (REG)',
      measured: `7805@12V=${s7805.voltmeter.averageV.toFixed(2)}V | 7812@12V=${s7812Dropout.voltmeter.averageV.toFixed(2)}V (${s7812Dropout.lastSample.regulatorRegime}) | 7812@18V=${s7812Reg.voltmeter.averageV.toFixed(2)}V`,
      details: 'Verifies linear regulators cannot boost insufficient headroom and dissipate more heat at 18 V.',
    });
  }

  // 7. LM317 Formula & Potentiometer Clamping
  {
    const targetMid = computeLm317TargetVoltage(240, 1200); // 1.25*(1+5) + 50e-6*1200 = 7.56 V
    const p317Mid = {
      ...createDefaultParameters(),
      regulatorType: 'LM317' as const,
      lm317R1Ohms: 240,
      potMaxOhms: 10000,
      potPosition: 0.12, // 1200 Ohms
    };
    const s317Mid = runForDuration(p317Mid, 0.25);

    const p317High = { ...p317Mid, potPosition: 0.5 }; // 5000 Ohms -> target ~27.5V > Vin!
    const s317High = runForDuration(p317High, 0.25);

    const pass =
      Math.abs(s317Mid.voltmeter.averageV - targetMid) < 0.05 &&
      s317High.lastSample.regulatorRegime === 'DROPOUT' &&
      s317High.voltmeter.averageV < s317High.lastSample.vFilterNode;

    results.push({
      id: 'lm317-pot',
      title: '6. LM317 Adjustable Output Formula & Headroom Limit',
      passed: pass,
      expected: `R2=1.2kΩ -> ${targetMid.toFixed(2)} V (REG); R2=5kΩ -> DROPOUT (< Vin)`,
      measured: `R2=1.2kΩ -> ${s317Mid.voltmeter.averageV.toFixed(2)} V; R2=5kΩ -> ${s317High.voltmeter.averageV.toFixed(2)} V (${s317High.lastSample.regulatorRegime})`,
      details: 'Verifies Vout = 1.25(1 + R2/R1) + Iadj·R2 and upper saturation at Vin − Vdropout.',
    });
  }

  // 8. Ohm's Law, Power & Switch-OFF Discharge
  {
    const loadTest = evaluateLoad({ vOut: 5.0, resistanceOhms: 220, powerRatingW: 0.5 });
    const expectedI = 5.0 / 220;
    const expectedP = 5.0 * expectedI;

    const pOn = createDefaultParameters();
    const state = runForDuration(pOn, 0.2);
    const vBeforeOff = state.vCap;

    // Flip switch OFF and run 1.2 seconds so 1000 uF * 400 Ohm (~0.4s tau) decays near 0V
    const pOff = { ...pOn, switchClosed: false };
    const offSteps = Math.round(1.5 / state.dtSec);
    for (let i = 0; i < offSteps; i++) {
      stepCircuit(state, pOff);
    }

    const pass =
      Math.abs(loadTest.currentA - expectedI) < 1e-6 &&
      Math.abs(loadTest.powerW - expectedP) < 1e-6 &&
      vBeforeOff > 12 &&
      state.vCap < 0.5 &&
      state.lastSample.vRegOut < 0.05;

    results.push({
      id: 'ohms-and-switch-off',
      title: '7. Ohm’s Law (V, I, P) & Switch-OFF Natural Capacitor Decay',
      passed: pass,
      expected: 'I = V/R, P = V·I; Switch OFF decays Vcap >12 V -> <0.5 V & Vout -> 0 V',
      measured: `I=${(loadTest.currentA * 1000).toFixed(2)} mA, P=${(loadTest.powerW * 1000).toFixed(1)} mW; Vcap ${vBeforeOff.toFixed(1)}V -> ${state.vCap.toFixed(2)}V`,
      details: 'Confirms energy conservation and exponential reservoir decay when mains is disconnected.',
    });
  }

  // 9. Fault Detection Thresholds (Cap Overvoltage, Load Overpower, Current Limit)
  {
    const pCapFault = { ...createDefaultParameters(), filterCapRatingV: 10 };
    const sCapFault = runForDuration(pCapFault, 0.1);

    const pLoadFault = {
      ...createDefaultParameters(),
      loadResistanceOhms: 10, // 5V / 10 Ohm = 0.5A, but let's use LM7812 @ 18V -> 1.0A current limit & 10W load!
      regulatorType: 'LM7812' as const,
      transformerSecondaryVrms: 18,
      loadPowerRatingW: 0.5,
    };
    const sLoadFault = runForDuration(pLoadFault, 0.15);

    const pass =
      sCapFault.faults.capOvervoltageActive &&
      sCapFault.faults.capVentLatched &&
      sLoadFault.faults.loadOverpowerActive &&
      sLoadFault.lastSample.regulatorRegime === 'CURRENT_LIMITED';

    results.push({
      id: 'fault-thresholds',
      title: '8. Fault Detectors (Cap Overvoltage, Load Overpower, Current Limit)',
      passed: pass,
      expected: '10V cap @ 12V xfmr -> Overvoltage; 10Ω load @ 7812 -> Current Limit & Overpower',
      measured: `CapFault=${sCapFault.faults.capOvervoltageActive} (${sCapFault.lastSample.vCapInternal.toFixed(1)}V > 10V), LoadOverpower=${sLoadFault.faults.loadOverpowerActive}, Regime=${sLoadFault.lastSample.regulatorRegime}`,
      details: 'Verifies fault flags latch accurately when electrical or thermal ratings are exceeded.',
    });
  }

  return results;
}
