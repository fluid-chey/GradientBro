/**
 * Strategy classifier.
 *
 * Examines the colour regions, their spatial distribution, edge
 * sharpness variance, and shape analysis to recommend which CSS
 * generation strategy will best reproduce the reference gradient:
 *
 *  - "simple"  — linear base + blurred radial blobs (fast, clean)
 *  - "mesh"    — multi-layer positioned radials with per-group blur
 *  - "hybrid"  — linear/radial base + mesh accent layers for depth
 *  - "organic" — inline SVG with per-shape blur filters for complex
 *                shapes (waves, wisps, veils, ribbons, petals)
 */

import { ColorRegion, GradientStrategy, ShapeInfo } from "../types";

/**
 * Classify the optimal gradient strategy from colour region and shape data.
 */
export function classifyStrategy(
  colors: ColorRegion[],
  shapes?: ShapeInfo
): GradientStrategy {
  // ── Organic: non-trivial shapes detected ────────────────────────────
  //
  // Gated on edge sharpness AND contour quality. K-means always creates
  // regions, even in smooth blends, and the shape analyser will find
  // veils/angular-veils in any image with large, low-elongation regions.
  // These "generic" shapes alone are NOT sufficient evidence for organic.
  //
  // "Distinctive" contours — waves, wisps, ribbons, petals — require
  // real geometric features (elongation > 2.5, sinuosity, tip detection)
  // that k-means artefacts don't produce. These are the reliable signal.
  //
  // When this classifier returns "organic", it MEANS it — the agent
  // should honour the recommendation rather than downgrading to CSS-only.
  if (shapes && shapes.style !== "blobby" && shapes.contours.length >= 2) {
    const maxEdgeSharpness = Math.max(...colors.map((c) => c.edgeSharpness));

    // Split contours into distinctive (real geometry) vs generic (just "large area")
    const distinctiveContours = shapes.contours.filter(
      (c) =>
        c.type === "wave" ||
        c.type === "wisp" ||
        c.type === "ribbon" ||
        c.type === "petal"
    );
    const contourTypes = new Set(shapes.contours.map((c) => c.type));

    // Strong signal: well-defined edges in at least one region
    const hasDefinedEdges = maxEdgeSharpness > 0.25;

    // High complexity with edge definition
    const isComplex = shapes.complexity > 0.6 && maxEdgeSharpness > 0.12;

    // Waves and petals are shapes CSS fundamentally can't reproduce;
    // trigger organic even in softer images if multiple are found
    const waveCount = distinctiveContours.filter((c) => c.type === "wave").length;
    const petalCount = distinctiveContours.filter((c) => c.type === "petal").length;
    const hasDistinctiveShapes =
      (waveCount >= 2 || petalCount >= 2) && maxEdgeSharpness > 0.10;

    // Spatially rich images: many colour regions + distinctive contours.
    // Requires at least 1 distinctive contour — veils alone are not enough.
    const hasSpatialRichness =
      colors.length >= 5 &&
      distinctiveContours.length >= 1 &&
      shapes.contours.length >= 3 &&
      maxEdgeSharpness > 0.10;

    // Abundant distinctive contours: 3+ shapes with real geometry is a
    // strong signal regardless of edge sharpness (the geometric classifiers
    // already filter out k-means artefacts).
    const hasAbundantDistinctive = distinctiveContours.length >= 3;

    // Type diversity: 3+ different contour types (e.g. wave + petal + veil)
    // indicates genuine structural complexity, not just repeated artefacts.
    const hasTypeDiversity =
      contourTypes.size >= 3 && maxEdgeSharpness > 0.10;

    if (
      hasDefinedEdges ||
      isComplex ||
      hasDistinctiveShapes ||
      hasSpatialRichness ||
      hasAbundantDistinctive ||
      hasTypeDiversity
    ) {
      return "organic";
    }
  }

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
