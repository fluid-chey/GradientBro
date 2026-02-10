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
  noise: NoiseInfo,
  fidelity: FidelityLevel,
  mood?: MoodInfo
) {
  // ── baseFrequency: use the continuous value from the analyser ──────
  // Clamp for safety; the analyser already outputs 0.3-1.0
  const baseFrequency = Math.min(1.0, Math.max(0.3, noise.baseFrequency));

  // ── numOctaves: driven by sharpness ────────────────────────────────
  // Low sharpness (soft noise) → fewer octaves (smoother)
  // High sharpness (crispy grain) → more octaves (more detail)
  // Fidelity still acts as a ceiling.
  const maxOctaves = fidelity === "exact" ? 6 : fidelity === "vibe" ? 5 : 3;
  const minOctaves = fidelity === "inspired" ? 2 : 3;
  const numOctaves = Math.round(
    minOctaves + noise.sharpness * (maxOctaves - minOctaves)
  );

  // ── opacity: driven by intensity × contrast ────────────────────────
  // Replaces the old `intensity * 0.25` cap.
  // Punchy noise (high contrast) gets strong opacity.
  // Faint noise (low contrast) stays subtle.
  // Effective range: ~0.04 to ~0.50
  const rawOpacity = noise.intensity * (0.15 + noise.contrast * 0.35);
  const opacity = Math.round(Math.min(0.50, Math.max(0.03, rawOpacity)) * 100) / 100;

  // ── blend mode: based on mood ──────────────────────────────────────
  let blendMode = "overlay"; // default
  if (mood) {
    if (
      mood.brightness === "bright" ||
      mood.brightness === "medium-bright"
    ) {
      blendMode = "soft-light";
    } else if (mood.brightness === "dark" && noise.contrast > 0.5) {
      // High-contrast noise on dark backgrounds benefits from overlay
      // (already the default), but if contrast is moderate, soft-light
      // avoids washing out
      blendMode = "overlay";
    }
  }

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
