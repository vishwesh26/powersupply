/**
 * Full-Wave 4-Diode Bridge Rectifier Model
 * Pure TypeScript — piecewise constant-voltage-drop diode bridge.
 *
 * Topology:
 *   - Positive half-cycle (Vsec > +2*Vf): D1 and D2 conduct current to + rail and return from GND.
 *   - Negative half-cycle (Vsec < -2*Vf): D3 and D4 conduct current to + rail and return from GND.
 *
 * Equation:
 *   Vrect(t) = max(|Vsec(t)| - 2 * Vf, 0)
 *
 * Properties:
 *   - Output is strictly non-negative (>= 0 V).
 *   - Output ripple fundamental frequency is 2 * f (100 Hz for 50 Hz mains, 120 Hz for 60 Hz).
 */

import { DiodeModelType } from './types';

export const DIODE_PRESET_DROPS: Record<Exclude<DiodeModelType, 'custom'>, number> = {
  '1N4007': 0.7, // Standard silicon rectifier diode (~0.7 V forward drop)
  '1N5819': 0.32, // Schottky barrier rectifier diode (~0.32 V forward drop)
  ideal: 0.0, // Theoretical zero-drop ideal diode
};

export function getDiodeForwardDrop(type: DiodeModelType, customDropV: number): number {
  if (type === 'custom') {
    return Math.max(0, customDropV);
  }
  return DIODE_PRESET_DROPS[type];
}

export interface BridgeRectifierInput {
  vSecondary: number;
  forwardDropPerDiodeV: number;
  isChargingCap?: boolean;
  chargingCurrentA?: number;
  vSecPeakEstimate?: number;
}

export interface BridgeRectifierOutput {
  vRectified: number;
  totalDiodeDropV: number;
  activeHalfCyclePair: 'NONE' | 'D1_D2' | 'D3_D4';
  conductingPair: 'NONE' | 'D1_D2' | 'D3_D4';
  glowPairA: number; // 0..1 intensity for D1 & D2
  glowPairB: number; // 0..1 intensity for D3 & D4
}

export function computeBridgeRectifier(input: BridgeRectifierInput): BridgeRectifierOutput {
  const vf = Math.max(0, input.forwardDropPerDiodeV);
  const twoVf = 2 * vf;
  const absVsec = Math.abs(input.vSecondary);
  const vRectified = Math.max(absVsec - twoVf, 0);

  let activeHalfCyclePair: 'NONE' | 'D1_D2' | 'D3_D4' = 'NONE';
  if (vRectified > 0 || (vf === 0 && absVsec > 1e-4)) {
    activeHalfCyclePair = input.vSecondary >= 0 ? 'D1_D2' : 'D3_D4';
  }

  // Determine actual charging conduction vs half-cycle forward bias for 3D visual glow
  const isCharging = input.isChargingCap ?? vRectified > 0;
  const conductingPair = isCharging ? activeHalfCyclePair : 'NONE';

  const peakRef = Math.max(5, input.vSecPeakEstimate ?? 17);
  const envelopeRatio = Math.min(1, vRectified / peakRef);
  const currentBoost = Math.min(1, (input.chargingCurrentA ?? 0) / 0.35);

  let glowPairA = 0;
  let glowPairB = 0;

  if (activeHalfCyclePair === 'D1_D2') {
    glowPairA = isCharging
      ? Math.min(1, 0.45 + 0.55 * Math.max(envelopeRatio, currentBoost))
      : 0.28 * envelopeRatio;
  } else if (activeHalfCyclePair === 'D3_D4') {
    glowPairB = isCharging
      ? Math.min(1, 0.45 + 0.55 * Math.max(envelopeRatio, currentBoost))
      : 0.28 * envelopeRatio;
  }

  return {
    vRectified,
    totalDiodeDropV: twoVf,
    activeHalfCyclePair,
    conductingPair,
    glowPairA,
    glowPairB,
  };
}
