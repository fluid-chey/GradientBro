/**
 * Generate CSS gradient layers from colour regions.
 *
 * Builds a set of radial-gradient() values for the blurred colour blobs,
 * and a linear-gradient() for the base.
 */

import { ColorRegion, FidelityLevel } from "../types";

/**
 * Build the base linear-gradient CSS value.
 * Uses the two darkest / most widespread colours.
 */
export function buildBaseGradient(colors: ColorRegion[]): string {
  // Pick the two most prominent colors, preferring darker ones for the base
  const sorted = [...colors].sort((a, b) => {
    // Sort by luminance ascending (darker first), weighted by cluster weight
    const lumA = 0.299 * a.rgb[0] + 0.587 * a.rgb[1] + 0.114 * a.rgb[2];
    const lumB = 0.299 * b.rgb[0] + 0.587 * b.rgb[1] + 0.114 * b.rgb[2];
    return lumA - lumB;
  });

  const c1 = sorted[0];
  const c2 = sorted[Math.min(1, sorted.length - 1)];

  // Angle derived from the spatial relationship between the two colours
  const dx = c2.position.x - c1.position.x;
  const dy = c2.position.y - c1.position.y;
  const angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 90);

  return `linear-gradient(${angle}deg, ${c1.hex} 0%, ${c2.hex} 100%)`;
}

/**
 * Build radial-gradient() values for colour blobs.
 * Each colour region becomes a radial gradient positioned at its centroid.
 */
export function buildColorBlobs(
  colors: ColorRegion[],
  fidelity: FidelityLevel
): string[] {
  // For "inspired" level, use only the top 2 blobs
  const maxBlobs =
    fidelity === "exact" ? colors.length : fidelity === "vibe" ? Math.min(colors.length, 4) : 2;
  const blobs = colors.slice(0, maxBlobs);

  return blobs.map((c) => {
    const xPct = Math.round(c.position.x * 100);
    const yPct = Math.round(c.position.y * 100);
    // Opacity based on weight (heavier cluster = more opaque)
    const opacity = Math.round(Math.min(0.9, 0.4 + c.weight) * 100) / 100;
    // Spread radius from the spread value
    const radius = Math.round(30 + c.spread * 40);

    // 3-stop gradient for natural falloff:
    // - Mid-stop at 55% of radius with 35% of peak opacity (soft knee)
    // - Use rgba(R,G,B,0) instead of `transparent` to avoid dark halos
    //   (transparent = rgba(0,0,0,0) which interpolates toward black)
    const midRadius = Math.round(radius * 0.55);
    const midOpacity = Math.round(opacity * 0.35 * 100) / 100;

    return `radial-gradient(circle at ${xPct}% ${yPct}%, rgba(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]},${opacity}) 0%, rgba(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]},${midOpacity}) ${midRadius}%, rgba(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]},0) ${radius}%)`;
  });
}
