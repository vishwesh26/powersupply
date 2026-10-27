/**
 * AC Mains Source Model
 * Pure TypeScript — uses only Math.sqrt, Math.sin, and Math.PI.
 *
 * Equations:
 *   Vm = Vrms * sqrt(2)
 *   V(t) = Vm * sin(2 * pi * f * t)
 */

export interface AcSourceInput {
  vRms: number;
  frequencyHz: number;
  timeSec: number;
}

export interface AcSourceOutput {
  vPeak: number;
  vInstant: number;
  angularFrequencyRad: number;
}

const SQRT2 = Math.sqrt(2);
const TWO_PI = 2 * Math.PI;

export function computeAcSource(input: AcSourceInput): AcSourceOutput {
  const vRmsSafe = Math.max(0, input.vRms);
  const freqSafe = Math.max(0.1, input.frequencyHz);
  const vPeak = vRmsSafe * SQRT2;
  const angularFrequencyRad = TWO_PI * freqSafe;
  const vInstant = vPeak * Math.sin(angularFrequencyRad * input.timeSec);

  return {
    vPeak,
    vInstant,
    angularFrequencyRad,
  };
}
