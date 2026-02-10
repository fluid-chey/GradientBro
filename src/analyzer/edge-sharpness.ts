/**
 * Per-region edge sharpness analyser.
 *
 * After colour clustering, each ColorRegion gets an `edgeSharpness` score
 * (0-1) that describes how sharply defined that region's boundary is.
 *
 * Sharp = crisp glow with a defined edge (like a spotlight)
 * Diffuse = soft wash that blends gradually into its surroundings
 *
 * This drives the variable-blur system: sharp regions get less blur,
 * diffuse regions get heavy blur, creating perceptual depth.
 */

import { RawImageData, getPixel } from "../utils/image";
import { colorDistance } from "../utils/color";
import { ColorRegion } from "../types";

/**
 * Pixel-to-cluster assignment map.  assignments[y * width + x] = cluster index.
 */
export type ClusterAssignments = Int32Array;

/**
 * Re-run cluster assignment to get per-pixel labels.
 * (The color extractor doesn't expose this, so we recompute cheaply.)
 */
export function assignPixelsToClusters(
  img: RawImageData,
  colors: ColorRegion[]
): ClusterAssignments {
  const assignments = new Int32Array(img.width * img.height);

  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const [r, g, b] = getPixel(img, x, y);
      let bestDist = Infinity;
      let bestIdx = 0;

      for (let c = 0; c < colors.length; c++) {
        const d = colorDistance(
          [r, g, b],
          colors[c].rgb
        );
        if (d < bestDist) {
          bestDist = d;
          bestIdx = c;
        }
      }
      assignments[y * img.width + x] = bestIdx;
    }
  }

  return assignments;
}

/**
 * Compute edge sharpness for each colour region.
 *
 * Strategy:
 * 1. For each cluster, find boundary pixels (pixels adjacent to a
 *    different cluster).
 * 2. At each boundary pixel, compute the luminance gradient magnitude
 *    (how abruptly brightness changes across the boundary).
 * 3. Average gradient magnitude = region's edgeSharpness.
 *
 * Mutates each ColorRegion in place, setting `edgeSharpness`.
 */
export function computeEdgeSharpness(
  img: RawImageData,
  colors: ColorRegion[],
  assignments: ClusterAssignments
): void {
  const w = img.width;
  const h = img.height;

  // Per-cluster accumulators: sum of gradient magnitudes and count
  const gradSums = new Float64Array(colors.length);
  const gradCounts = new Float64Array(colors.length);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const cluster = assignments[idx];

      // Check if this pixel is on a boundary (any 4-connected neighbour
      // belongs to a different cluster)
      const top = assignments[(y - 1) * w + x];
      const bottom = assignments[(y + 1) * w + x];
      const left = assignments[y * w + (x - 1)];
      const right = assignments[y * w + (x + 1)];

      const isBoundary =
        top !== cluster ||
        bottom !== cluster ||
        left !== cluster ||
        right !== cluster;

      if (!isBoundary) continue;

      // Compute Sobel-like gradient magnitude at this pixel
      const [r, g, b] = getPixel(img, x, y);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      const [lr, lg, lb] = getPixel(img, x - 1, y);
      const lumLeft = 0.299 * lr + 0.587 * lg + 0.114 * lb;
      const [rr, rg, rb] = getPixel(img, x + 1, y);
      const lumRight = 0.299 * rr + 0.587 * rg + 0.114 * rb;

      const [tr, tg, tb] = getPixel(img, x, y - 1);
      const lumTop = 0.299 * tr + 0.587 * tg + 0.114 * tb;
      const [br2, bg2, bb2] = getPixel(img, x, y + 1);
      const lumBottom = 0.299 * br2 + 0.587 * bg2 + 0.114 * bb2;

      const gx = lumRight - lumLeft;
      const gy = lumBottom - lumTop;
      const gradMag = Math.sqrt(gx * gx + gy * gy);

      gradSums[cluster] += gradMag;
      gradCounts[cluster]++;
    }
  }

  // Normalise to 0-1.
  // Typical boundary gradient magnitudes: 0-5 for diffuse, 20-80 for sharp.
  // We normalise by the per-region average, capping at 50.
  for (let c = 0; c < colors.length; c++) {
    if (gradCounts[c] === 0) {
      // No boundary pixels found — region fills the entire image or is 1px
      colors[c].edgeSharpness = 0;
      continue;
    }
    const avgGrad = gradSums[c] / gradCounts[c];
    colors[c].edgeSharpness = Math.round(Math.min(1, avgGrad / 50) * 100) / 100;
  }
}
