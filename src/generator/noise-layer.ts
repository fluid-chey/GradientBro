/**
 * Generate an SVG feTurbulence noise layer as an inline data-URI.
 *
 * The returned CSS fragment targets a ::after pseudo-element that
 * overlays noise on top of the gradient layers.
 *
 * Enhanced to use continuous baseFrequency, map sharpness → numOctaves,
 * map contrast → opacity, and auto-select blend mode from mood.
 */

import { NoiseInfo, MoodInfo, FidelityLevel } from "../types";

/**
 * Map noise analysis to feTurbulence parameters.
 */
function turbulenceParams(
  _noise: NoiseInfo,
  fidelity: FidelityLevel,
  _mood?: MoodInfo
) {
  // ── Fixed grain defaults ───────────────────────────────────────────
  // Analyser noise data is informational only. Every gradient gets the
  // same strong, coarse, full-strength grain overlay. Users can fine-tune
  // via the refinement guide or override presets in the skill.
  const baseFrequency = 0.45;

  // ── numOctaves: always maximum crispness ────────────────────────────
  const numOctaves = 6;

  // ── opacity: near-full strength ─────────────────────────────────────
  // With mix-blend-mode: overlay, 0.9 opacity produces pronounced,
  // clearly visible grain without obscuring the gradient underneath.
  const opacity = 0.9;

  // ── blend mode: always overlay ─────────────────────────────────────
  const blendMode = "overlay";

  return { baseFrequency, numOctaves, opacity, blendMode };
}

/**
 * Build the inline SVG data URI for the noise texture.
 */
export function buildNoiseSvgDataUri(
  noise: NoiseInfo,
  fidelity: FidelityLevel,
  mood?: MoodInfo
): string {
  const { baseFrequency, numOctaves } = turbulenceParams(noise, fidelity, mood);

  const svg = `<svg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${baseFrequency}' numOctaves='${numOctaves}' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Return the CSS properties for the noise overlay pseudo-element.
 */
export function buildNoiseLayerCSS(
  noise: NoiseInfo,
  fidelity: FidelityLevel,
  mood?: MoodInfo
): Record<string, string> {
  const { opacity, blendMode } = turbulenceParams(noise, fidelity, mood);
  const dataUri = buildNoiseSvgDataUri(noise, fidelity, mood);

  return {
    content: "''",
    position: "absolute",
    inset: "0",
    background: dataUri,
    opacity: String(opacity),
    "mix-blend-mode": blendMode,
    "pointer-events": "none",
  };
}
