/**
 * Shape analyser.
 *
 * Detects organic shape characteristics from cluster pixel assignments:
 *   - Global flow direction (dominant gradient orientation)
 *   - Per-region shape type (wave, wisp, veil, angular-veil, ribbon, petal)
 *   - Shape parameters (amplitude, tip-point, curvature, vertices…)
 *
 * The AI agent uses these as scaffolding — it writes the actual SVG paths
 * using its visual analysis of the reference image.
 */

import { RawImageData, getPixel } from "../utils/image";
import {
  ColorRegion,
  ShapeInfo,
  ShapeContour,
  ShapeStyle,
  ShapeType,
  Point2D,
} from "../types";
import { ClusterAssignments } from "./edge-sharpness";

/* ────────────────────────────────────────────────────────
   Public API
   ──────────────────────────────────────────────────────── */

export function analyzeShapes(
  img: RawImageData,
  colors: ColorRegion[],
  assignments: ClusterAssignments
): ShapeInfo {
  const flowDirection = computeFlowDirection(img);

  // Background = highest-weight cluster (largest pixel area)
  const bgIdx = colors.reduce(
    (max, c, i) => (c.weight > colors[max].weight ? i : max),
    0
  );

  // Analyse each non-background cluster
  const contours: ShapeContour[] = [];
  for (let i = 0; i < colors.length; i++) {
    if (i === bgIdx) continue;

    const pixels = collectClusterPixels(img, assignments, i);
    if (pixels.length < 20) continue; // too small for meaningful geometry

    const geom = analyzeGeometry(pixels, img.width, img.height);
    const shapeType = classifyShape(geom);
    if (!shapeType) continue; // remains a blob — handled by CSS radials

    contours.push(buildContour(shapeType, geom, colors[i]));
  }

  const style = computeStyle(contours);
  const complexity = computeComplexity(contours, colors.length);

  return { complexity, flowDirection, style, contours };
}

/* ────────────────────────────────────────────────────────
   Flow direction
   ──────────────────────────────────────────────────────── */

function pixelLuminance(img: RawImageData, x: number, y: number): number {
  const [r, g, b] = getPixel(img, x, y);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Dominant flow direction in degrees.
 * Computed from a histogram of Sobel gradient orientations, weighted by
 * magnitude. The flow is perpendicular to the dominant gradient.
 */
function computeFlowDirection(img: RawImageData): number {
  const BINS = 36;
  const histogram = new Float64Array(BINS);

  for (let y = 1; y < img.height - 1; y++) {
    for (let x = 1; x < img.width - 1; x++) {
      const gx = pixelLuminance(img, x + 1, y) - pixelLuminance(img, x - 1, y);
      const gy = pixelLuminance(img, x, y + 1) - pixelLuminance(img, x, y - 1);
      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag < 2) continue; // skip flat regions

      let angle = Math.atan2(gy, gx) * (180 / Math.PI);
      if (angle < 0) angle += 360;

      histogram[Math.floor(angle / (360 / BINS)) % BINS] += mag;
    }
  }

  // Smooth histogram to find the dominant peak
  const smoothed = new Float64Array(BINS);
  for (let i = 0; i < BINS; i++) {
    smoothed[i] =
      histogram[(i - 1 + BINS) % BINS] * 0.25 +
      histogram[i] * 0.5 +
      histogram[(i + 1) % BINS] * 0.25;
  }

  let maxBin = 0;
  for (let i = 1; i < BINS; i++) {
    if (smoothed[i] > smoothed[maxBin]) maxBin = i;
  }

  const gradAngle = (maxBin + 0.5) * (360 / BINS);
  return Math.round((gradAngle + 90) % 360);
}

/* ────────────────────────────────────────────────────────
   Pixel collection
   ──────────────────────────────────────────────────────── */

function collectClusterPixels(
  img: RawImageData,
  assignments: ClusterAssignments,
  clusterIdx: number
): Point2D[] {
  const pixels: Point2D[] = [];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (assignments[y * img.width + x] === clusterIdx) {
        pixels.push({
          x: x / (img.width - 1),
          y: y / (img.height - 1),
        });
      }
    }
  }
  return pixels;
}

/* ────────────────────────────────────────────────────────
   Geometry analysis
   ──────────────────────────────────────────────────────── */

interface ClusterGeometry {
  pixels: Point2D[];
  centroid: Point2D;
  /** Major axis variance */
  eigenvalue1: number;
  /** Minor axis variance */
  eigenvalue2: number;
  /** Major axis direction (degrees, 0 = right, 90 = down) */
  majorAxisAngle: number;
  /** Major axis unit vector */
  majorAxis: Point2D;
  /** Minor axis unit vector */
  minorAxis: Point2D;
  /** Bounding box aspect ratio via PCA */
  elongation: number;
  /** Fraction of image area covered by this cluster */
  area: number;
  /** Convex hull vertices */
  hull: Point2D[];
  /** Pixel area / hull area — low means concave / pointed */
  convexity: number;
  /** Smallest interior angle in the hull (degrees) */
  minHullAngle: number;
  /** The hull vertex with the smallest angle, if < 70° */
  tipPoint: Point2D | null;
  /** How much the cluster's centreline oscillates (wave detection) */
  sinuosity: number;
  /** Average cross-sectional width normalised to image size */
  avgThickness: number;
  /** Fraction of hull edges that are "straight" (angular detection) */
  edgeStraightness: number;
}

function analyzeGeometry(
  pixels: Point2D[],
  imgW: number,
  imgH: number
): ClusterGeometry {
  // ── Centroid ──
  let cx = 0,
    cy = 0;
  for (const p of pixels) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pixels.length;
  cy /= pixels.length;
  const centroid: Point2D = { x: cx, y: cy };

  // ── PCA (covariance matrix → eigenvalues/vectors) ──
  let cxx = 0,
    cyy = 0,
    cxy = 0;
  for (const p of pixels) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    cxx += dx * dx;
    cyy += dy * dy;
    cxy += dx * dy;
  }
  cxx /= pixels.length;
  cyy /= pixels.length;
  cxy /= pixels.length;

  const trace = cxx + cyy;
  const det = cxx * cyy - cxy * cxy;
  const disc = Math.sqrt(Math.max(0, trace * trace / 4 - det));
  const eigenvalue1 = trace / 2 + disc;
  const eigenvalue2 = Math.max(0.0001, trace / 2 - disc);
  const elongation = Math.sqrt(eigenvalue1 / eigenvalue2);

  // Major axis eigenvector
  let evx: number, evy: number;
  if (Math.abs(cxy) > 1e-8) {
    evx = eigenvalue1 - cyy;
    evy = cxy;
  } else {
    evx = cxx >= cyy ? 1 : 0;
    evy = cxx >= cyy ? 0 : 1;
  }
  const evLen = Math.sqrt(evx * evx + evy * evy) || 1;
  evx /= evLen;
  evy /= evLen;

  const majorAxisAngle = Math.round(
    ((Math.atan2(evy, evx) * 180) / Math.PI + 360) % 360
  );
  const majorAxis: Point2D = { x: evx, y: evy };
  const minorAxis: Point2D = { x: -evy, y: evx };

  // ── Area ──
  const area = pixels.length / (imgW * imgH);

  // ── Convex hull ──
  const hull = convexHull(pixels);

  // Hull area via shoelace
  const hullArea = polygonArea(hull);
  const convexity = hullArea > 0 ? (area * imgW * imgH) / (hullArea * imgW * imgH) : 1;

  // ── Tip detection (most acute hull vertex) ──
  const { minAngle, tipPoint } = findMinHullAngle(hull);

  // ── Cross-section analysis (sinuosity + thickness) ──
  const { sinuosity, avgThickness } = analyzeCrossSections(
    pixels,
    centroid,
    majorAxis,
    minorAxis
  );

  // ── Edge straightness ──
  const edgeStraightness = computeEdgeStraightness(hull);

  return {
    pixels,
    centroid,
    eigenvalue1,
    eigenvalue2,
    majorAxisAngle,
    majorAxis,
    minorAxis,
    elongation,
    area,
    hull,
    convexity,
    minHullAngle: minAngle,
    tipPoint,
    sinuosity,
    avgThickness,
    edgeStraightness,
  };
}

/* ────────────────────────────────────────────────────────
   Convex hull (Andrew's monotone chain)
   ──────────────────────────────────────────────────────── */

function cross(o: Point2D, a: Point2D, b: Point2D): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function convexHull(points: Point2D[]): Point2D[] {
  // Sample if too many points (>800) for performance
  let pts = points;
  if (pts.length > 800) {
    const step = Math.ceil(pts.length / 800);
    pts = pts.filter((_, i) => i % step === 0);
  }

  const sorted = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length <= 2) return sorted;

  const lower: Point2D[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point2D[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Remove last point of each half (duplicated at junction)
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function polygonArea(hull: Point2D[]): number {
  let area = 0;
  const n = hull.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += hull[i].x * hull[j].y;
    area -= hull[j].x * hull[i].y;
  }
  return Math.abs(area) / 2;
}

/* ────────────────────────────────────────────────────────
   Hull angle analysis (tip detection)
   ──────────────────────────────────────────────────────── */

function findMinHullAngle(hull: Point2D[]): {
  minAngle: number;
  tipPoint: Point2D | null;
} {
  if (hull.length < 3) return { minAngle: 180, tipPoint: null };

  let minAngle = 180;
  let tipPoint: Point2D | null = null;
  const n = hull.length;

  for (let i = 0; i < n; i++) {
    const prev = hull[(i - 1 + n) % n];
    const curr = hull[i];
    const next = hull[(i + 1) % n];

    // Vectors from current to prev and next
    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;

    const dot = v1x * v2x + v1y * v2y;
    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);

    if (len1 < 1e-8 || len2 < 1e-8) continue;

    const cosAngle = Math.max(-1, Math.min(1, dot / (len1 * len2)));
    const angle = Math.acos(cosAngle) * (180 / Math.PI);

    if (angle < minAngle) {
      minAngle = angle;
      tipPoint = curr;
    }
  }

  // Only report tip if the angle is acute enough
  if (minAngle > 70) tipPoint = null;

  return { minAngle: Math.round(minAngle), tipPoint };
}

/* ────────────────────────────────────────────────────────
   Cross-section analysis (sinuosity + thickness)
   ──────────────────────────────────────────────────────── */

function analyzeCrossSections(
  pixels: Point2D[],
  centroid: Point2D,
  majorAxis: Point2D,
  minorAxis: Point2D
): { sinuosity: number; avgThickness: number } {
  const BINS = 20;

  // Project each pixel onto major and minor axes
  const projections: Array<{ major: number; minor: number }> = [];
  let minMajor = Infinity,
    maxMajor = -Infinity;

  for (const p of pixels) {
    const dx = p.x - centroid.x;
    const dy = p.y - centroid.y;
    const major = dx * majorAxis.x + dy * majorAxis.y;
    const minor = dx * minorAxis.x + dy * minorAxis.y;
    projections.push({ major, minor });
    if (major < minMajor) minMajor = major;
    if (major > maxMajor) maxMajor = major;
  }

  const majorSpan = maxMajor - minMajor;
  if (majorSpan < 0.01) return { sinuosity: 0, avgThickness: 0 };

  // Bin by major axis position, compute per-bin minor-axis stats
  const binCenters = new Float64Array(BINS);
  const binWidths = new Float64Array(BINS);
  const binCounts = new Float64Array(BINS);

  for (const p of projections) {
    const t = (p.major - minMajor) / majorSpan;
    const bin = Math.min(BINS - 1, Math.floor(t * BINS));
    binCenters[bin] += p.minor;
    binCounts[bin]++;
  }

  // Compute centres and widths per bin
  const centres: number[] = [];
  const widths: number[] = [];

  for (let i = 0; i < BINS; i++) {
    if (binCounts[i] < 2) continue;
    binCenters[i] /= binCounts[i];
    centres.push(binCenters[i]);

    // Width = range of minor values in this bin
    let minM = Infinity,
      maxM = -Infinity;
    for (const p of projections) {
      const t = (p.major - minMajor) / majorSpan;
      const bin = Math.min(BINS - 1, Math.floor(t * BINS));
      if (bin === i) {
        if (p.minor < minM) minM = p.minor;
        if (p.minor > maxM) maxM = p.minor;
      }
    }
    widths.push(maxM - minM);
  }

  if (centres.length < 3)
    return { sinuosity: 0, avgThickness: widths.length > 0 ? avg(widths) : 0 };

  // Sinuosity: standard deviation of the centreline from a straight fit
  const meanCentre = avg(centres);
  const centreDeviation = Math.sqrt(
    centres.reduce((s, c) => s + (c - meanCentre) ** 2, 0) / centres.length
  );
  // Normalise by major span so it's relative
  const sinuosity = Math.min(1, centreDeviation / (majorSpan * 0.3));

  const avgThickness = avg(widths);

  return { sinuosity: round2(sinuosity), avgThickness: round2(avgThickness) };
}

/* ────────────────────────────────────────────────────────
   Edge straightness
   ──────────────────────────────────────────────────────── */

/**
 * Fraction of hull edges that are "long" (angular shapes have fewer,
 * longer edges; organic shapes have many short edges).
 * Returns 0-1 where 1 = very angular (few significant vertices).
 */
function computeEdgeStraightness(hull: Point2D[]): number {
  if (hull.length < 3) return 0;
  const n = hull.length;

  // Compute edge lengths
  const edgeLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = hull[j].x - hull[i].x;
    const dy = hull[j].y - hull[i].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    edgeLengths.push(len);
    totalLength += len;
  }

  if (totalLength < 1e-6) return 0;

  // Count "significant" vertices: those where the turn angle > 25°
  let significantVertices = 0;
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;

    const v1x = hull[i].x - hull[prev].x;
    const v1y = hull[i].y - hull[prev].y;
    const v2x = hull[next].x - hull[i].x;
    const v2y = hull[next].y - hull[i].y;

    const dot = v1x * v2x + v1y * v2y;
    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);

    if (len1 < 1e-8 || len2 < 1e-8) continue;

    const cosA = Math.max(-1, Math.min(1, dot / (len1 * len2)));
    const turnAngle = Math.acos(cosA) * (180 / Math.PI);

    if (turnAngle > 25) significantVertices++;
  }

  // Few significant vertices = angular shape
  // 3-5 → very angular (straightness ~0.8-1.0)
  // 6-8 → moderate
  // 9+  → smooth/organic (straightness ~0.1-0.3)
  if (significantVertices <= 2) return 0.9;
  if (significantVertices <= 5) return Math.max(0, 1 - (significantVertices - 2) * 0.1);
  return Math.max(0, 0.5 - (significantVertices - 5) * 0.06);
}

/* ────────────────────────────────────────────────────────
   Shape classification
   ──────────────────────────────────────────────────────── */

function classifyShape(g: ClusterGeometry): ShapeType | null {
  // ── Petal: concave shape with a pointed tip ──
  if (
    g.convexity < 0.7 &&
    g.minHullAngle < 70 &&
    g.tipPoint !== null &&
    g.elongation > 1.3 &&
    g.elongation < 5
  ) {
    return "petal";
  }

  // ── Wave: elongated with oscillating centreline ──
  if (g.elongation > 2.5 && g.sinuosity > 0.12) {
    return "wave";
  }

  // ── Wisp: very elongated and thin ──
  if (g.elongation > 3.5 && g.avgThickness < 0.06) {
    return "wisp";
  }

  // ── Ribbon: elongated with moderate thickness, low sinuosity ──
  if (g.elongation > 2.5 && g.avgThickness >= 0.06 && g.sinuosity < 0.12) {
    return "ribbon";
  }

  // ── Angular veil: large area, angular edges ──
  if (g.area > 0.06 && g.elongation < 2.8 && g.edgeStraightness >= 0.5) {
    return "angular-veil";
  }

  // ── Organic veil: large area, smooth curved edges ──
  if (g.area > 0.06 && g.elongation < 2.8 && g.edgeStraightness < 0.5) {
    return "veil";
  }

  // Doesn't match any organic type — it's a blob
  return null;
}

/* ────────────────────────────────────────────────────────
   Contour construction
   ──────────────────────────────────────────────────────── */

function buildContour(
  type: ShapeType,
  g: ClusterGeometry,
  color: ColorRegion
): ShapeContour {
  const base: ShapeContour = {
    type,
    position: g.centroid,
    direction: g.majorAxisAngle,
    curvature: round2(1 - g.edgeStraightness),
    thickness: round2(g.avgThickness),
    blur: round2(1 - color.edgeSharpness),
    color: color.hex,
    opacity: round2(Math.min(0.9, 0.3 + color.weight)),
  };

  switch (type) {
    case "wave": {
      base.amplitude = round2(g.sinuosity);
      // Estimate frequency from cross-section oscillation
      // (rough: count sign changes in centreline deviation)
      base.frequency = estimateWaveFrequency(g);
      base.startPoint = projectToEdge(g.centroid, g.majorAxis, g.eigenvalue1, -1);
      base.endPoint = projectToEdge(g.centroid, g.majorAxis, g.eigenvalue1, 1);
      break;
    }
    case "wisp":
    case "ribbon": {
      base.startPoint = projectToEdge(g.centroid, g.majorAxis, g.eigenvalue1, -1);
      base.endPoint = projectToEdge(g.centroid, g.majorAxis, g.eigenvalue1, 1);
      break;
    }
    case "petal": {
      if (g.tipPoint) base.tipPoint = g.tipPoint;
      base.bodyWidth = round2(g.avgThickness / Math.max(0.01, Math.sqrt(g.eigenvalue1) * 4));
      // Start/end: base of the petal (opposite from tip)
      const tipDir = g.tipPoint
        ? {
            x: g.tipPoint.x - g.centroid.x,
            y: g.tipPoint.y - g.centroid.y,
          }
        : g.majorAxis;
      const tipLen = Math.sqrt(tipDir.x ** 2 + tipDir.y ** 2) || 1;
      base.startPoint = {
        x: round2(g.centroid.x - (tipDir.x / tipLen) * Math.sqrt(g.eigenvalue1) * 2),
        y: round2(g.centroid.y - (tipDir.y / tipLen) * Math.sqrt(g.eigenvalue1) * 2),
      };
      base.endPoint = g.tipPoint ?? g.centroid;
      break;
    }
    case "angular-veil": {
      // Report simplified hull as vertices
      base.vertices = simplifyHull(g.hull, 6);
      break;
    }
    case "veil": {
      // No extra params needed — centroid, direction, size are enough
      break;
    }
  }

  return base;
}

/* ────────────────────────────────────────────────────────
   Shape parameter helpers
   ──────────────────────────────────────────────────────── */

function estimateWaveFrequency(g: ClusterGeometry): number {
  // Re-project pixels and count sign changes of centreline
  const BINS = 20;
  const centres = new Float64Array(BINS);
  const counts = new Float64Array(BINS);

  let minMaj = Infinity,
    maxMaj = -Infinity;
  const majProjections: number[] = [];
  const minProjections: number[] = [];

  for (const p of g.pixels) {
    const dx = p.x - g.centroid.x;
    const dy = p.y - g.centroid.y;
    const maj = dx * g.majorAxis.x + dy * g.majorAxis.y;
    const min = dx * g.minorAxis.x + dy * g.minorAxis.y;
    majProjections.push(maj);
    minProjections.push(min);
    if (maj < minMaj) minMaj = maj;
    if (maj > maxMaj) maxMaj = maj;
  }

  const span = maxMaj - minMaj;
  if (span < 0.01) return 1;

  for (let i = 0; i < majProjections.length; i++) {
    const t = (majProjections[i] - minMaj) / span;
    const bin = Math.min(BINS - 1, Math.floor(t * BINS));
    centres[bin] += minProjections[i];
    counts[bin]++;
  }

  // Compute mean centres per bin and count zero-crossings
  const meanCentres: number[] = [];
  for (let i = 0; i < BINS; i++) {
    if (counts[i] < 2) {
      meanCentres.push(0);
    } else {
      meanCentres.push(centres[i] / counts[i]);
    }
  }

  const globalMean = avg(meanCentres.filter((_, i) => counts[i] >= 2));
  let zeroCrossings = 0;
  let prevSign = 0;
  for (let i = 0; i < BINS; i++) {
    if (counts[i] < 2) continue;
    const sign = meanCentres[i] - globalMean > 0 ? 1 : -1;
    if (prevSign !== 0 && sign !== prevSign) zeroCrossings++;
    prevSign = sign;
  }

  // frequency ≈ zero-crossings / 2
  return Math.max(1, Math.round(zeroCrossings / 2));
}

function projectToEdge(
  centroid: Point2D,
  axis: Point2D,
  eigenvalue: number,
  sign: number
): Point2D {
  const extent = Math.sqrt(eigenvalue) * 3 * sign;
  return {
    x: round2(Math.max(0, Math.min(1, centroid.x + axis.x * extent))),
    y: round2(Math.max(0, Math.min(1, centroid.y + axis.y * extent))),
  };
}

function simplifyHull(hull: Point2D[], maxVertices: number): Point2D[] {
  if (hull.length <= maxVertices) {
    return hull.map((p) => ({ x: round2(p.x), y: round2(p.y) }));
  }

  // Keep vertices with the largest turn angles
  const n = hull.length;
  const angles: Array<{ idx: number; angle: number }> = [];

  for (let i = 0; i < n; i++) {
    const prev = hull[(i - 1 + n) % n];
    const curr = hull[i];
    const next = hull[(i + 1) % n];

    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;

    const dot = v1x * v2x + v1y * v2y;
    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);

    const cosA = len1 > 0 && len2 > 0 ? dot / (len1 * len2) : 1;
    const angle = Math.acos(Math.max(-1, Math.min(1, cosA)));
    angles.push({ idx: i, angle });
  }

  // Sort by largest turn angle, keep top N
  angles.sort((a, b) => b.angle - a.angle);
  const kept = new Set(angles.slice(0, maxVertices).map((a) => a.idx));

  return hull
    .filter((_, i) => kept.has(i))
    .map((p) => ({ x: round2(p.x), y: round2(p.y) }));
}

/* ────────────────────────────────────────────────────────
   Style & complexity
   ──────────────────────────────────────────────────────── */

function computeStyle(contours: ShapeContour[]): ShapeStyle {
  if (contours.length === 0) return "blobby";

  const counts: Record<string, number> = {};
  for (const c of contours) {
    const group =
      c.type === "petal"
        ? "organic"
        : c.type === "wave" || c.type === "wisp"
          ? "wavy"
          : c.type === "angular-veil"
            ? "angular"
            : c.type === "ribbon"
              ? "wavy"
              : "mixed";
    counts[group] = (counts[group] || 0) + 1;
  }

  // Find dominant group
  let maxGroup = "mixed";
  let maxCount = 0;
  for (const [group, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxGroup = group;
    }
  }

  // If no single group dominates (>50%), it's mixed
  if (maxCount <= contours.length / 2 && Object.keys(counts).length > 1) {
    return "mixed";
  }

  return maxGroup as ShapeStyle;
}

function computeComplexity(contours: ShapeContour[], numColors: number): number {
  if (contours.length === 0) return 0;

  // Factor 1: number of organic contours relative to total colours
  const contourRatio = Math.min(1, contours.length / Math.max(1, numColors));

  // Factor 2: shape type diversity
  const types = new Set(contours.map((c) => c.type));
  const typeDiversity = Math.min(1, types.size / 3);

  // Factor 3: blur range across contours
  const blurs = contours.map((c) => c.blur);
  const blurRange = Math.max(...blurs) - Math.min(...blurs);

  // Factor 4: has petals (adds significant complexity)
  const hasPetals = contours.some((c) => c.type === "petal") ? 0.2 : 0;

  const complexity =
    contourRatio * 0.3 + typeDiversity * 0.25 + blurRange * 0.25 + hasPetals;

  return round2(Math.min(1, complexity));
}

/* ────────────────────────────────────────────────────────
   Utilities
   ──────────────────────────────────────────────────────── */

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
