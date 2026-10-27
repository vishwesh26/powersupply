/**
 * Bypass / Decoupling Capacitors Model (C_in = 100 nF ceramic, C_out = 10 uF)
 * Pure TypeScript — datasheet compliance & physical honesty model.
 *
 * Engineering Honesty Note:
 *   - C_in (typically 100 nF / 0.1 uF ceramic disc placed close to regulator IN-GND)
 *     prevents high-frequency oscillation (100 kHz - 10 MHz) caused by lead inductance.
 *   - C_out (typically 1 uF - 10 uF electrolytic/tantalum across OUT-GND) improves
 *     load-transient step response and damps output impedance peaks.
 *   - At 50/60 Hz mains ripple (100/120 Hz rectified), 100 nF has reactance
 *     Xc = 1/(2*pi*100*100e-9) = 15.9 kOhms — negligible 100 Hz energy storage
 *     compared to the 1000 uF reservoir capacitor (Xc = 1.59 Ohms).
 *   - Therefore, this engine does NOT fabricate artificial 100 Hz ripple reduction
 *     from C_in, and explicitly reports datasheet stability warnings when values
 *     drop below recommended minimums.
 */

export interface BypassCapsInput {
  cInNf: number; // Recommended >= 100 nF (0.1 uF)
  cOutUf: number; // Recommended >= 10 uF (especially for LM317 stability/transient response)
}

export interface BypassCapsAssessment {
  cInNf: number;
  cOutUf: number;
  isInputCapAdequate: boolean;
  isOutputCapAdequate: boolean;
  notes: string[];
}

export function evaluateBypassCaps(input: BypassCapsInput): BypassCapsAssessment {
  const cIn = Math.max(0, input.cInNf);
  const cOut = Math.max(0, input.cOutUf);

  const isInputCapAdequate = cIn >= 100;
  const isOutputCapAdequate = cOut >= 10;

  const notes: string[] = [];
  if (!isInputCapAdequate) {
    notes.push(
      `Input bypass cap (${cIn.toFixed(0)} nF) is below recommended 100 nF; real regulator could oscillate due to lead inductance.`
    );
  }
  if (!isOutputCapAdequate) {
    notes.push(
      `Output capacitor (${cOut.toFixed(1)} µF) is below recommended 10 µF for optimal transient response.`
    );
  }

  return {
    cInNf: cIn,
    cOutUf: cOut,
    isInputCapAdequate,
    isOutputCapAdequate,
    notes,
  };
}
