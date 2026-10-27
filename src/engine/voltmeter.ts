/**
 * Digital Voltmeter Model (Rolling 100 ms Time-Window Analyzer)
 * Pure TypeScript — computes instantaneous, average, min, max, RMS,
 * and peak-to-peak ripple over a sliding 100 ms measurement window.
 *
 * Instrumentation Note:
 *   - Uses a strict recent window (default 0.100 s = 5 mains cycles at 50 Hz,
 *     10 ripple cycles at 100 Hz) rather than cumulative all-time min/max,
 *     so parameter changes immediately settle on the meter.
 *   - Real benchtop DVMs have finite input impedance (~10 MOhm), ADC quantization,
 *     and display update rate (~3-5 Hz); this model exposes exact windowed statistics
 *     plus realistic 7-segment display formatting ("---" when switch is OFF & discharged).
 */

import { ProbeNodeType, VoltmeterReading, VoltmeterWindowSample } from './types';

export const VOLTMETER_WINDOW_SEC = 0.1; // 100 ms recent window

export function selectProbedVoltage(
  sample: VoltmeterWindowSample,
  node: ProbeNodeType
): number {
  switch (node) {
    case 'output':
      return sample.vOut;
    case 'filter':
      return sample.vFilter;
    case 'rectifier':
      return sample.vRect;
    case 'secondary':
      return sample.vSec;
  }
}

export function formatVoltmeterDigits(
  valueV: number,
  switchClosed: boolean,
  ripplePpV: number
): { displayText: string; isOffDisplay: boolean } {
  if (!switchClosed && Math.abs(valueV) < 0.04 && ripplePpV < 0.04) {
    return { displayText: '---', isOffDisplay: true };
  }

  const absV = Math.abs(valueV);
  const sign = valueV < -0.005 ? '-' : '';
  if (absV >= 100) {
    return { displayText: `${sign}${absV.toFixed(1)}`, isOffDisplay: false };
  }
  return {
    displayText: `${sign}${absV.toFixed(2).padStart(5, '0')}`,
    isOffDisplay: false,
  };
}

export function computeVoltmeterReading(
  history: VoltmeterWindowSample[],
  node: ProbeNodeType,
  switchClosed: boolean,
  currentInstantV?: number
): VoltmeterReading {
  if (history.length === 0) {
    const vNow = currentInstantV ?? 0;
    const fmt = formatVoltmeterDigits(vNow, switchClosed, 0);
    return {
      node,
      instantaneousV: vNow,
      averageV: vNow,
      minV: vNow,
      maxV: vNow,
      ripplePpV: 0,
      rmsV: Math.abs(vNow),
      displayText: fmt.displayText,
      isOffDisplay: fmt.isOffDisplay,
    };
  }

  let sum = 0;
  let sumSq = 0;
  let minV = Infinity;
  let maxV = -Infinity;

  for (let i = 0; i < history.length; i++) {
    const v = selectProbedVoltage(history[i], node);
    sum += v;
    sumSq += v * v;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  const n = history.length;
  const averageV = sum / n;
  const rmsV = Math.sqrt(sumSq / n);
  const ripplePpV = Math.max(0, maxV - minV);
  const latestSample = history[history.length - 1];
  const instantaneousV =
    currentInstantV !== undefined
      ? currentInstantV
      : selectProbedVoltage(latestSample, node);

  // For AC secondary node, a DVM in AC/RMS or average mode: show RMS if probing AC secondary, DC avg for DC nodes
  const meterDisplayValue = node === 'secondary' ? rmsV : averageV;
  const fmt = formatVoltmeterDigits(meterDisplayValue, switchClosed, ripplePpV);

  return {
    node,
    instantaneousV,
    averageV,
    minV,
    maxV,
    ripplePpV,
    rmsV,
    displayText: fmt.displayText,
    isOffDisplay: fmt.isOffDisplay,
  };
}
