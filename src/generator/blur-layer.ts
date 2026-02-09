/**
 * Generate CSS for the blurred colour-blob pseudo-element.
 *
 * This is the key trick: multiple radial gradients on a ::before with
 * heavy blur + inset: -N% to avoid edge artifacts.
 */

import { BlurInfo, FidelityLevel } from "../types";

/**
 * Map analysed blur info to a CSS blur radius in pixels.
 *
 * The colour blobs on ::before should ALWAYS have some blur (they simulate
 * a blurred photograph).  Even when the analyser reports "none" (because the
 * reference screenshot itself is sharp), we apply a minimum blur so the
 * radial gradients blend naturally.
 */
export function blurRadiusPx(blur: BlurInfo, fidelity: FidelityLevel): number {
  // Base radius from the blur level
  let base: number;
  switch (blur.level) {
    case "heavy":
      base = 60;
      break;
    case "medium":
      base = 35;
      break;
    case "light":
      base = 15;
      break;
    case "none":
      base = 0;
      break;
  }

  // Exact fidelity uses a finer value interpolated from the variance
  if (fidelity === "exact") {
    // variance 0 (very blurry) -> 80px, variance 1 (sharp) -> 0px
    base = Math.round((1 - blur.variance) * 80);
  }

  // Always apply a minimum blur so colour blobs look organic
  const minimums: Record<FidelityLevel, number> = {
    exact: 30,
    vibe: 40,
    inspired: 20,
  };
  return Math.max(base, minimums[fidelity]);
}

/**
 * How far to extend the ::before element beyond the container bounds
 * (prevents visible blur edges).  Returns a percentage, e.g. "25%".
 */
export function blurOverflowPct(radiusPx: number): string {
  // Rough heuristic: overflow = blur radius / 2, min 10%
  const pct = Math.max(10, Math.round(radiusPx * 0.5));
  return `${pct}%`;
}

/**
 * Build CSS properties for the blur pseudo-element.
 * `gradientValues` is an array of gradient CSS strings (from gradient-layers).
 */
export function buildBlurLayerCSS(
  gradientValues: string[],
  blur: BlurInfo,
  fidelity: FidelityLevel
): Record<string, string> {
  const radius = blurRadiusPx(blur, fidelity);
  const overflow = blurOverflowPct(radius);

  return {
    content: "''",
    position: "absolute",
    inset: `-${overflow}`,
    background: gradientValues.join(",\n    "),
    filter: radius > 0 ? `blur(${radius}px)` : "none",
    "pointer-events": "none",
  };
}
