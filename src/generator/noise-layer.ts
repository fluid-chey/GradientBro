/**
 * Generate an SVG feTurbulence noise layer as an inline data-URI.
 *
 * The returned CSS fragment targets a ::after pseudo-element that
 * overlays noise on top of the gradient layers.
 */

import { NoiseInfo, FidelityLevel } from "../types";

/**
 * Map noise analysis to feTurbulence parameters.
 */
function turbulenceParams(noise: NoiseInfo, fidelity: FidelityLevel) {
  // baseFrequency: higher = finer grain
  let baseFrequency: number;
  switch (noise.frequency) {
    case "fine":
      baseFrequency = 0.85;
      break;
    case "medium":
      baseFrequency = 0.65;
      break;
    case "coarse":
      baseFrequency = 0.45;
      break;
  }

  // numOctaves: more = richer detail, more expensive
  const numOctaves = fidelity === "exact" ? 5 : fidelity === "vibe" ? 4 : 3;

  // Opacity driven by intensity
  const opacity = Math.round(noise.intensity * 0.25 * 100) / 100; // max 0.25

  return { baseFrequency, numOctaves, opacity };
}

/**
 * Build the inline SVG data URI for the noise texture.
 */
export function buildNoiseSvgDataUri(
  noise: NoiseInfo,
  fidelity: FidelityLevel
): string {
  const { baseFrequency, numOctaves } = turbulenceParams(noise, fidelity);

  // We encode a minimal SVG with an feTurbulence filter
  const svg = `<svg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${baseFrequency}' numOctaves='${numOctaves}' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Return the CSS properties for the noise overlay pseudo-element.
 */
export function buildNoiseLayerCSS(
  noise: NoiseInfo,
  fidelity: FidelityLevel
): Record<string, string> {
  const { opacity } = turbulenceParams(noise, fidelity);
  const dataUri = buildNoiseSvgDataUri(noise, fidelity);

  return {
    content: "''",
    position: "absolute",
    inset: "0",
    background: dataUri,
    opacity: String(opacity),
    "mix-blend-mode": "overlay",
    "pointer-events": "none",
  };
}
