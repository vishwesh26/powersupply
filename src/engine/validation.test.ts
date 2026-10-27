import { describe, expect, it } from 'vitest';
import { computeAcSource } from './acSource';
import { computeBridgeRectifier, getDiodeForwardDrop } from './bridgeRectifier';
import { computeResistorColorBands, evaluateLoad } from './loadModel';
import { evaluateRegulator } from './regulators';
import { runEngineSelfChecks } from './selfCheck';
import {
  createDefaultParameters,
  createInitialEngineState,
  resetEngineFaults,
  stepCircuit,
} from './simulator';
import { computeTransformer } from './transformer';

describe('Regulated DC Power Supply Pure-TS Engine Validation', () => {
  it('converts 230 V RMS to ~325.27 V peak accurately', () => {
    const res = computeAcSource({ vRms: 230, frequencyHz: 50, timeSec: 0.005 });
    expect(res.vPeak).toBeCloseTo(325.269, 2);
    expect(res.vInstant).toBeCloseTo(325.269, 2);
  });

  it('scales transformer output to 12 V RMS (~16.97 V peak) with zero DC component', () => {
    const N = 1000;
    let sum = 0;
    let sumSq = 0;
    let peak = 0;
    for (let i = 0; i < N; i++) {
      const t = (i / N) * 0.02;
      const ac = computeAcSource({ vRms: 230, frequencyHz: 50, timeSec: t });
      const xf = computeTransformer({
        vPrimaryInstant: ac.vInstant,
        vPrimaryRatedRms: 230,
        vSecondaryRatedRms: 12,
      });
      sum += xf.vSecOpenCircuit;
      sumSq += xf.vSecOpenCircuit ** 2;
      peak = Math.max(peak, xf.vSecOpenCircuit);
    }
    const rms = Math.sqrt(sumSq / N);
    expect(rms).toBeCloseTo(12.0, 2);
    expect(peak).toBeCloseTo(16.97, 1);
    expect(Math.abs(sum / N)).toBeLessThan(1e-6);
  });

  it('produces non-negative bridge rectifier output at 2f (100 Hz) and higher peak with Schottky', () => {
    const vfSilicon = getDiodeForwardDrop('1N4007', 0.7);
    const vfSchottky = getDiodeForwardDrop('1N5819', 0.32);

    const posPeakSi = computeBridgeRectifier({
      vSecondary: 16.97,
      forwardDropPerDiodeV: vfSilicon,
    });
    const negPeakSi = computeBridgeRectifier({
      vSecondary: -16.97,
      forwardDropPerDiodeV: vfSilicon,
    });
    const zeroCrossSi = computeBridgeRectifier({
      vSecondary: 0.5,
      forwardDropPerDiodeV: vfSilicon,
    });
    const posPeakSch = computeBridgeRectifier({
      vSecondary: 16.97,
      forwardDropPerDiodeV: vfSchottky,
    });

    expect(posPeakSi.vRectified).toBeCloseTo(15.57, 2);
    expect(negPeakSi.vRectified).toBeCloseTo(15.57, 2);
    expect(posPeakSi.activeHalfCyclePair).toBe('D1_D2');
    expect(negPeakSi.activeHalfCyclePair).toBe('D3_D4');
    expect(zeroCrossSi.vRectified).toBe(0);
    expect(posPeakSch.vRectified).toBeGreaterThan(posPeakSi.vRectified + 0.7);
  });

  it('evaluates Ohm’s law, power dissipation, and resistor color bands accurately', () => {
    const load = evaluateLoad({ vOut: 5.0, resistanceOhms: 220, powerRatingW: 0.5 });
    expect(load.currentA).toBeCloseTo(5.0 / 220, 5);
    expect(load.powerW).toBeCloseTo(25.0 / 220, 5);
    expect(load.isOverpower).toBe(false);

    // 220 Ohm = Red (2), Red (2), Brown (x10), Gold
    const bands220 = computeResistorColorBands(220);
    expect(bands220[0].name).toBe('Red');
    expect(bands220[1].name).toBe('Red');
    expect(bands220[2].name).toBe('Brown');
  });

  it('enforces regulator dropout, current limiting, and thermal shutdown regimes', () => {
    // Sufficient headroom -> REGULATING
    const ok = evaluateRegulator({ type: 'LM7805', vIn: 10, rLoadOhms: 220 });
    expect(ok.regime).toBe('REGULATING');
    expect(ok.vOut).toBeCloseTo(5.0, 3);

    // Insufficient headroom -> DROPOUT
    const drop = evaluateRegulator({ type: 'LM7812', vIn: 12.5, rLoadOhms: 220 });
    expect(drop.regime).toBe('DROPOUT');
    expect(drop.vOut).toBeCloseTo(10.5, 3);

    // Heavy load -> CURRENT_LIMITED (1.0 A * 4 Ohm = 4.0 V)
    const clim = evaluateRegulator({ type: 'LM7812', vIn: 18, rLoadOhms: 4 });
    expect(clim.regime).toBe('CURRENT_LIMITED');
    expect(clim.vOut).toBeCloseTo(4.0, 3);

    // Overtemperature -> THERMAL_SHUTDOWN
    const hot = evaluateRegulator({
      type: 'LM7805',
      vIn: 18,
      rLoadOhms: 22,
      prevTempC: 152,
    });
    expect(hot.regime).toBe('THERMAL_SHUTDOWN');
    expect(hot.vOut).toBe(0);
  });

  it('passes all 8 end-to-end physics and interaction scenario self-checks', () => {
    const checks = runEngineSelfChecks();
    expect(checks.length).toBe(8);
    for (const check of checks) {
      expect(check.passed, `${check.title} failed: ${check.measured}`).toBe(true);
    }
  });

  it('latches and resets faults cleanly via resetEngineFaults', () => {
    const params = { ...createDefaultParameters(), filterCapRatingV: 10 };
    const state = createInitialEngineState(params);
    for (let i = 0; i < 2000; i++) {
      stepCircuit(state, params);
    }
    expect(state.faults.capVentLatched).toBe(true);

    // Raise cap rating back to 25V and reset faults
    const safeParams = { ...params, filterCapRatingV: 25 };
    resetEngineFaults(state, safeParams);
    expect(state.faults.capVentLatched).toBe(false);
  });
});
