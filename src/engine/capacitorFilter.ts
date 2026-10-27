/**
 * Electrolytic Reservoir Capacitor Filter Model
 * Pure TypeScript — true time-domain charge/discharge solver using Math.exp.
 *
 * Physics & Equations:
 *   1. Fundamental capacitor relation:
 *        I_cap = C * (dV_cap / dt)
 *
 *   2. Discharging regime (bridge diodes reverse-biased: V_rect,oc <= V_cap or switch OFF):
 *        I_rect = 0
 *        V_new = V_old * exp(-dt / (R_eff * C))
 *      where R_eff is the effective resistance presented to the capacitor by the
 *      downstream regulator + load network.
 *
 *   3. Charging / Conduction regime (bridge diodes forward-biased: V_rect,oc > V_cap):
 *        C * dV/dt = (V_rect,oc - V) / R_charge - V / R_eff
 *      Solved analytically over fixed step dt via Thevenin equivalent:
 *        V_th = V_rect,oc * R_eff / (R_charge + R_eff)
 *        tau_eq = C * (R_charge * R_eff) / (R_charge + R_eff)
 *        V_new = V_th + (V_old - V_th) * exp(-dt / tau_eq)
 *
 * Numerical Stability & Assumptions:
 *   - Analytical exponential stepping is unconditionally stable for all dt > 0,
 *     all capacitances C (e.g., 1 uF to 100,000 uF), and arbitrarily small ESR.
 *   - Electrolytic dielectric leakage current and temperature-dependent C drift
 *     are neglected; equivalent series inductance (ESL) is neglected at 50/60 Hz.
 */

export interface CapacitorFilterInput {
  vRectOpenCircuit: number; // max(|Vsec,oc| - 2*Vf, 0)
  vCapPrev: number; // V_old (V)
  capacitanceUf: number; // C in microfarads (uF)
  esrOhms: number; // Capacitor ESR (Ohms)
  windingResistanceOhms: number; // Transformer secondary winding resistance (Ohms)
  effectiveLoadResistanceOhms: number; // Effective downstream R seen by capacitor (Ohms)
  dtSec: number; // Simulation step size (s), typically 25e-6 s
  sourceConnected: boolean; // True when mains switch is ON
}

export interface CapacitorFilterOutput {
  vCapNew: number; // Updated internal capacitor voltage (V)
  vFilterTerminal: number; // Voltage at filter node including ESR*I_cap (V)
  iCap: number; // Capacitor current C*dV/dt (+ charging, - discharging) (A)
  iRectifier: number; // Total current drawn from bridge rectifier (A, >= 0)
  isCharging: boolean; // True when bridge diodes are forward-conducting
}

export function stepCapacitorFilter(input: CapacitorFilterInput): CapacitorFilterOutput {
  const cFarads = Math.max(1e-9, input.capacitanceUf * 1e-6);
  const dt = Math.max(1e-7, input.dtSec);
  const vOld = Math.max(0, input.vCapPrev);
  const rEff = Math.max(0.5, input.effectiveLoadResistanceOhms);
  const rEsr = Math.max(0, input.esrOhms);
  const rWinding = Math.max(0, input.windingResistanceOhms);

  const vRectOc = input.sourceConnected ? Math.max(0, input.vRectOpenCircuit) : 0;

  // Check whether bridge diodes are forward-biased
  if (!input.sourceConnected || vRectOc <= vOld) {
    // Discharging purely through R_eff
    const tauDischarge = rEff * cFarads;
    const vCapNew = vOld * Math.exp(-dt / tauDischarge);
    const iCap = (cFarads * (vCapNew - vOld)) / dt; // Negative during discharge
    const vFilterTerminal = Math.max(0, vCapNew + iCap * rEsr);

    return {
      vCapNew,
      vFilterTerminal,
      iCap,
      iRectifier: 0,
      isCharging: false,
    };
  }

  // Forward-biased conduction: charging capacitor & supplying load
  const rDiodeBulk = rWinding + rEsr > 0 ? 0.04 : 0;
  const rCharge = rWinding + rEsr + rDiodeBulk;

  let vCapNew: number;
  if (rCharge <= 1e-7) {
    // Strictly ideal zero-impedance charging path
    vCapNew = vRectOc;
  } else {
    const rSum = rCharge + rEff;
    const vTh = (vRectOc * rEff) / rSum;
    const rParallel = (rCharge * rEff) / rSum;
    const tauCharge = Math.max(1e-9, cFarads * rParallel);
    vCapNew = vTh + (vOld - vTh) * Math.exp(-dt / tauCharge);
  }

  vCapNew = Math.max(0, vCapNew);
  const iCap = (cFarads * (vCapNew - vOld)) / dt;
  const iLoadEff = vCapNew / rEff;
  const iRectifier = Math.max(0, iCap + iLoadEff);
  const vFilterTerminal = Math.max(0, vCapNew + iCap * rEsr);

  return {
    vCapNew,
    vFilterTerminal,
    iCap,
    iRectifier,
    isCharging: iRectifier > 1e-6,
  };
}
