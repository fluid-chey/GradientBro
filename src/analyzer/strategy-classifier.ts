/**
 * Strategy classifier.
 *
 * Examines the colour regions, their spatial distribution, and edge
 * sharpness variance to recommend which CSS generation strategy will
 * best reproduce the reference gradient:
 *
 *  - "simple"  — linear base + blurred radial blobs (fast, clean)
 *  - "mesh"    — multi-layer positioned radials with per-group blur
 *  - "hybrid"  — linear/radial base + mesh accent layers for depth
 */

import { ColorRegion, GradientStrategy } from "../types";

/**
 * Classify the optimal gradient strategy from colour region data.
 */
export function classifyStrategy(colors: ColorRegion[]): GradientStrategy {
  if (colors.length <= 2) return "simple";

  // ── Factor 1: Number of distinct regions ───────────────────────────
  // More regions → more likely to need mesh-style layout
  const regionCount = colors.length;

  // ── Factor 2: Spatial distribution — do centroids align on one axis? ─
  // Compute the variance of centroid positions perpendicular to the
  // principal axis.  Low perpendicular variance = linear, high = 2D scatter.
  const xs = colors.map((c) => c.position.x);
  const ys = colors.map((c) => c.position.y);
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;

  // Covariance matrix elements
  let cxx = 0, cyy = 0, cxy = 0;
  for (let i = 0; i < colors.length; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    cxx += dx * dx;
    cyy += dy * dy;
    cxy += dx * dy;
  }
  cxx /= colors.length;
  cyy /= colors.length;
  cxy /= colors.length;

  // Eigenvalues of 2×2 covariance matrix (principal component analysis)
  const trace = cxx + cyy;
  const det = cxx * cyy - cxy * cxy;
  const disc = Math.sqrt(Math.max(0, trace * trace / 4 - det));
  const eigen1 = trace / 2 + disc; // major axis variance
  const eigen2 = trace / 2 - disc; // minor axis variance

  // Linearity: how much of the spatial variance is on one axis
  // 1 = perfectly linear, 0 = perfectly circular scatter
  const totalVariance = eigen1 + eigen2;
  const linearity = totalVariance > 0 ? eigen1 / totalVariance : 0.5;

  // ── Factor 3: Edge sharpness variance ──────────────────────────────
  // Wide variance means some regions are sharp and some are diffuse,
  // which benefits from multi-layer approach.
  const sharpnesses = colors.map((c) => c.edgeSharpness);
  const minSharpness = Math.min(...sharpnesses);
  const maxSharpness = Math.max(...sharpnesses);
  const sharpnessRange = maxSharpness - minSharpness;

  // ── Factor 4: Dominant region coverage ─────────────────────────────
  // If one color covers >50% of pixels, it makes a good base layer
  // and the rest become accent regions (hybrid territory).
  const maxWeight = Math.max(...colors.map((c) => c.weight));
  const hasDominantBase = maxWeight > 0.5;

  // ── Decision logic ─────────────────────────────────────────────────

  // Simple: few regions, linear distribution, uniform sharpness
  if (regionCount <= 3 && linearity > 0.75 && sharpnessRange < 0.3) {
    return "simple";
  }

  // Mesh: many regions scattered in 2D, no single dominant base
  if (regionCount >= 5 && linearity < 0.65 && !hasDominantBase) {
    return "mesh";
  }

  // Hybrid: dominant base + accent regions, OR wide sharpness variance
  if (hasDominantBase || sharpnessRange > 0.4) {
    return "hybrid";
  }

  // Fallback: 4+ regions with moderate scatter → mesh
  if (regionCount >= 4 && linearity < 0.7) {
    return "mesh";
  }

  // Default to hybrid as the safest middle ground
  return "hybrid";
}
