/**
 * Step-Down Mains Transformer Model
 * Pure TypeScript — ideal turns-ratio scaling with optional copper winding resistance.
 *
 * Equations:
 *   Turns ratio (Ns / Np) = Vsec,rated / Vpri,rated
 *   Vsec,oc(t) = Vpri(t) * (Vsec,rated / Vpri,rated)
 *   Vsec,loaded(t) = Vsec,oc(t) - Isec(t) * Rwinding
 *
 * Modeling Limitations (explicitly documented):
 *   - No iron core hysteresis or eddy-current losses
 *   - No leakage inductance or inter-winding capacitance
 *   - No B-H curve magnetic core saturation
 *   - Cannot output DC (strictly AC sinusoidal primary scaling)
 */

export interface TransformerInput {
  vPrimaryInstant: number;
  vPrimaryRatedRms: number;
  vSecondaryRatedRms: number;
  windingResistanceOhms?: number;
  iSecondary?: number;
}

export interface TransformerOutput {
  turnsRatio: number;
  vSecOpenCircuit: number;
  vSecLoaded: number;
  windingResistanceOhms: number;
}

export function computeTransformer(input: TransformerInput): TransformerOutput {
  const vPriRated = Math.max(1, input.vPrimaryRatedRms);
  const vSecRated = Math.max(0, input.vSecondaryRatedRms);
  const turnsRatio = vSecRated / vPriRated;
  const vSecOpenCircuit = input.vPrimaryInstant * turnsRatio;

  const rWinding = Math.max(0, input.windingResistanceOhms ?? 0);
  const iSec = input.iSecondary ?? 0;
  const vSecLoaded = vSecOpenCircuit - iSec * rWinding;

  return {
    turnsRatio,
    vSecOpenCircuit,
    vSecLoaded,
    windingResistanceOhms: rWinding,
  };
}
