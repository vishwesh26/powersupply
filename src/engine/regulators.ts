/**
 * Linear Series Voltage Regulators: LM7805, LM7809, LM7812, and LM317
 * Pure TypeScript — models nominal regulation, dropout headroom, pass-transistor
 * current limiting, power dissipation, and TO-220 junction temperature / thermal shutdown.
 *
 * Equations:
 *   Fixed 78xx:
 *     V_target = 5.0 V (LM7805) | 9.0 V (LM7809) | 12.0 V (LM7812)
 *   Adjustable LM317:
 *     V_target = 1.25 * (1 + R2 / R1) + I_adj * R2,  with I_adj = 50 uA
 *
 *   Headroom & Dropout (V_dropout = 2.0 V):
 *     V_headroom = max(0, V_in - V_dropout)
 *     V_pre = min(V_target, V_headroom)
 *
 *   Current Limiting (I_limit = 1.0 A):
 *     If V_pre / R_load > I_limit, V_out = I_limit * R_load (CURRENT_LIMITED)
 *
 *   Thermal Model (TO-220 in free air without bulky external finned heatsink):
 *     P_reg = max(0, V_in - V_out) * I_load + V_in * I_quiescent
 *     T_eq = T_ambient + P_reg * Theta_JA   (T_ambient = 25 °C, Theta_JA = 55 °C/W)
 *     T_j(t + dt) = T_eq + (T_j(t) - T_eq) * exp(-dt / tau_thermal)
 *     Shutdown engages at T_j >= 150 °C and recovers below 125 °C (hysteresis).
 */

import { RegulatorModelType, RegulatorRegime } from './types';

export const REGULATOR_DROPOUT_V = 2.0;
export const REGULATOR_CURRENT_LIMIT_A = 1.0;
export const REGULATOR_QUIESCENT_A = 0.0045; // 4.5 mA typical bias current
export const LM317_VREF = 1.25;
export const LM317_IADJ_A = 50e-6; // 50 uA typical ADJ pin current

export const AMBIENT_TEMP_C = 25.0;
export const TO220_THETA_JA_C_PER_W = 55.0;
export const THERMAL_TAU_SEC = 1.4;
export const THERMAL_SHUTDOWN_ON_C = 150.0;
export const THERMAL_SHUTDOWN_OFF_C = 125.0;

export interface RegulatorStepInput {
  type: RegulatorModelType;
  vIn: number;
  rLoadOhms: number;
  lm317R1Ohms?: number;
  lm317R2Ohms?: number;
  prevTempC?: number;
  prevThermalShutdown?: boolean;
  dtSec?: number;
}

export interface RegulatorStepOutput {
  vTarget: number;
  vOut: number;
  iLoad: number;
  iRegIn: number;
  powerDissipationW: number;
  tempC: number;
  thermalShutdown: boolean;
  regime: RegulatorRegime;
}

export function computeLm317TargetVoltage(r1Ohms: number, r2Ohms: number): number {
  const r1Safe = Math.max(1, r1Ohms);
  const r2Safe = Math.max(0, r2Ohms);
  return LM317_VREF * (1 + r2Safe / r1Safe) + LM317_IADJ_A * r2Safe;
}

function evaluateCoreRegulator(
  vTarget: number,
  input: RegulatorStepInput
): RegulatorStepOutput {
  const vIn = Math.max(0, input.vIn);
  const rLoad = Math.max(0.1, input.rLoadOhms);
  const prevTemp = input.prevTempC ?? AMBIENT_TEMP_C;
  const prevShutdown = input.prevThermalShutdown ?? false;
  const dt = Math.max(1e-6, input.dtSec ?? 25e-6);

  // Hysteresis check on existing junction temperature
  let thermalShutdown = prevShutdown;
  if (prevTemp >= THERMAL_SHUTDOWN_ON_C) {
    thermalShutdown = true;
  } else if (prevShutdown && prevTemp <= THERMAL_SHUTDOWN_OFF_C) {
    thermalShutdown = false;
  }

  let vOut = 0;
  let regime: RegulatorRegime = 'OFF';

  if (thermalShutdown) {
    vOut = 0;
    regime = 'THERMAL_SHUTDOWN';
  } else if (vIn < 0.15) {
    vOut = 0;
    regime = 'OFF';
  } else {
    const vMaxAvailable = Math.max(0, vIn - REGULATOR_DROPOUT_V);
    const isDropout = vMaxAvailable < vTarget - 1e-3;
    const vPreLimit = Math.min(vTarget, vMaxAvailable);

    const prospectiveCurrent = vPreLimit / rLoad;
    if (prospectiveCurrent > REGULATOR_CURRENT_LIMIT_A) {
      vOut = REGULATOR_CURRENT_LIMIT_A * rLoad;
      regime = 'CURRENT_LIMITED';
    } else if (isDropout) {
      vOut = vMaxAvailable;
      regime = 'DROPOUT';
    } else {
      vOut = vTarget;
      regime = 'REGULATING';
    }
  }

  const iLoad = vOut / rLoad;
  // Quiescent current scales down gracefully when V_in approaches 0 V
  const iqScale = Math.min(1, vIn / 3.0);
  const iQuiescent = vIn > 0.05 ? REGULATOR_QUIESCENT_A * iqScale : 0;
  const iRegIn = iLoad + iQuiescent;

  const powerDissipationW = Math.max(0, vIn - vOut) * iLoad + vIn * iQuiescent;
  const tEquilibrium = AMBIENT_TEMP_C + powerDissipationW * TO220_THETA_JA_C_PER_W;
  const tempC =
    tEquilibrium + (prevTemp - tEquilibrium) * Math.exp(-dt / THERMAL_TAU_SEC);

  if (tempC >= THERMAL_SHUTDOWN_ON_C && !thermalShutdown) {
    thermalShutdown = true;
    regime = 'THERMAL_SHUTDOWN';
  }

  return {
    vTarget,
    vOut,
    iLoad,
    iRegIn,
    powerDissipationW,
    tempC,
    thermalShutdown,
    regime,
  };
}

export function lm7805(input: Omit<RegulatorStepInput, 'type'>): RegulatorStepOutput {
  return evaluateCoreRegulator(5.0, { ...input, type: 'LM7805' });
}

export function lm7809(input: Omit<RegulatorStepInput, 'type'>): RegulatorStepOutput {
  return evaluateCoreRegulator(9.0, { ...input, type: 'LM7809' });
}

export function lm7812(input: Omit<RegulatorStepInput, 'type'>): RegulatorStepOutput {
  return evaluateCoreRegulator(12.0, { ...input, type: 'LM7812' });
}

export function lm317(input: Omit<RegulatorStepInput, 'type'>): RegulatorStepOutput {
  const r1 = input.lm317R1Ohms ?? 240;
  const r2 = input.lm317R2Ohms ?? 720;
  const vTarget = computeLm317TargetVoltage(r1, r2);
  return evaluateCoreRegulator(vTarget, { ...input, type: 'LM317' });
}

export function evaluateRegulator(input: RegulatorStepInput): RegulatorStepOutput {
  switch (input.type) {
    case 'LM7805':
      return lm7805(input);
    case 'LM7809':
      return lm7809(input);
    case 'LM7812':
      return lm7812(input);
    case 'LM317':
      return lm317(input);
  }
}
