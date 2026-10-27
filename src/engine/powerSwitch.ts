/**
 * Mains Series Power Switch (SPST)
 * Pure TypeScript — controls whether AC mains reaches the transformer primary.
 *
 * When OFF (closed === false):
 *   Primary switched voltage = 0 V.
 *   No power enters the transformer, rectifier diodes reverse-bias,
 *   and the filter capacitor naturally discharges through the regulator & load.
 */

export interface PowerSwitchInput {
  vPrimaryIn: number;
  closed: boolean;
}

export interface PowerSwitchOutput {
  vPrimaryOut: number;
  isEnergized: boolean;
}

export function evaluatePowerSwitch(input: PowerSwitchInput): PowerSwitchOutput {
  if (!input.closed) {
    return {
      vPrimaryOut: 0,
      isEnergized: false,
    };
  }
  return {
    vPrimaryOut: input.vPrimaryIn,
    isEnergized: true,
  };
}
