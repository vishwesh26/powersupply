/**
 * Resistive Load & EIA Resistor Color-Band Calculator
 * Pure TypeScript — computes Ohm's law load current, power dissipation,
 * power rating compliance, and 4-band E12/E24 color codes.
 *
 * Equations:
 *   I_load = V_out / R_load
 *   P_load = V_out * I_load = V_out^2 / R_load
 */

export interface LoadInput {
  vOut: number;
  resistanceOhms: number;
  powerRatingW: number;
}

export interface LoadOutput {
  resistanceOhms: number;
  currentA: number;
  powerW: number;
  powerRatingW: number;
  utilizationRatio: number;
  isOverpower: boolean;
}

export const E12_LOAD_PRESETS_OHMS: number[] = [
  10, 15, 22, 33, 47, 68, 100, 150, 220, 330, 470, 680, 1000, 2200, 4700, 10000,
];

export function evaluateLoad(input: LoadInput): LoadOutput {
  const rSafe = Math.max(0.1, input.resistanceOhms);
  const pRated = Math.max(0.05, input.powerRatingW);
  const v = Math.max(0, input.vOut);

  const currentA = v / rSafe;
  const powerW = v * currentA;
  const utilizationRatio = powerW / pRated;

  return {
    resistanceOhms: rSafe,
    currentA,
    powerW,
    powerRatingW: pRated,
    utilizationRatio,
    isOverpower: powerW > pRated * 1.001,
  };
}

export interface ResistorColorBand {
  name: string;
  hex: string;
}

const DIGIT_COLORS: ResistorColorBand[] = [
  { name: 'Black', hex: '#141414' }, // 0
  { name: 'Brown', hex: '#6f3b18' }, // 1
  { name: 'Red', hex: '#d62828' }, // 2
  { name: 'Orange', hex: '#f77f00' }, // 3
  { name: 'Yellow', hex: '#facc15' }, // 4
  { name: 'Green', hex: '#16a34a' }, // 5
  { name: 'Blue', hex: '#2563eb' }, // 6
  { name: 'Violet', hex: '#7c3aed' }, // 7
  { name: 'Grey', hex: '#6b7280' }, // 8
  { name: 'White', hex: '#f8fafc' }, // 9
];

const GOLD_BAND: ResistorColorBand = { name: 'Gold', hex: '#d4af37' };
const SILVER_BAND: ResistorColorBand = { name: 'Silver', hex: '#cbd5e1' };

/**
 * Computes standard 4-band EIA resistor color rings (1st digit, 2nd digit, multiplier, ±5% tolerance)
 * supporting E12/E24 values from 0.1 Ohm up to 99 MOhm.
 */
export function computeResistorColorBands(
  ohms: number
): [ResistorColorBand, ResistorColorBand, ResistorColorBand, ResistorColorBand] {
  const r = Math.max(0.1, ohms);

  // Normalize r into two significant digits [10..99] * 10^exp
  let exp = Math.floor(Math.log10(r)) - 1;
  let mantissa = Math.round(r / Math.pow(10, exp));

  if (mantissa >= 100) {
    mantissa = Math.round(mantissa / 10);
    exp += 1;
  } else if (mantissa < 10) {
    mantissa = 10;
  }

  const d1 = Math.min(9, Math.max(0, Math.floor(mantissa / 10)));
  const d2 = Math.min(9, Math.max(0, mantissa % 10));

  let multBand: ResistorColorBand;
  if (exp === -2) {
    multBand = SILVER_BAND;
  } else if (exp === -1) {
    multBand = GOLD_BAND;
  } else {
    const clampedExp = Math.min(9, Math.max(0, exp));
    multBand = DIGIT_COLORS[clampedExp];
  }

  return [DIGIT_COLORS[d1], DIGIT_COLORS[d2], multBand, GOLD_BAND];
}
