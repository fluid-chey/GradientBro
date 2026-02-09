/**
 * K-means color clustering with spatial position tracking.
 *
 * Extracts dominant color regions from raw pixel data, returning
 * each cluster's average color, centroid position, weight, and spread.
 */

import { RawImageData, getPixel } from "../utils/image";
import { rgbToHex, colorDistance } from "../utils/color";
import { ColorRegion } from "../types";

interface PixelSample {
  r: number;
  g: number;
  b: number;
  x: number; // normalised 0-1
  y: number; // normalised 0-1
}

interface Centroid {
  r: number;
  g: number;
  b: number;
  x: number;
  y: number;
}

/**
 * Run k-means clustering on image pixels with spatial tracking.
 * @param img  Raw image data
 * @param k    Number of clusters (4-8 typical)
 * @param maxIter  Maximum iterations
 */
export function extractColors(
  img: RawImageData,
  k: number = 5,
  maxIter: number = 20
): ColorRegion[] {
  // 1. Sample all pixels with their positions
  const samples: PixelSample[] = [];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const [r, g, b] = getPixel(img, x, y);
      samples.push({
        r,
        g,
        b,
        x: x / (img.width - 1),
        y: y / (img.height - 1),
      });
    }
  }

  // 2. Initialise centroids using k-means++ seeding
  const centroids = kMeansPlusPlusInit(samples, k);

  // 3. Iterate: assign pixels to nearest centroid, recompute centroids
  const assignments = new Int32Array(samples.length);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;

    // Assign each pixel to nearest centroid (by color distance only)
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      let bestDist = Infinity;
      let bestIdx = 0;
      for (let c = 0; c < centroids.length; c++) {
        const d = colorDistance(
          [s.r, s.g, s.b],
          [centroids[c].r, centroids[c].g, centroids[c].b]
        );
        if (d < bestDist) {
          bestDist = d;
          bestIdx = c;
        }
      }
      if (assignments[i] !== bestIdx) {
        assignments[i] = bestIdx;
        changed = true;
      }
    }

    if (!changed) break;

    // Recompute centroids (average color + average position)
    const sums = centroids.map(() => ({
      r: 0,
      g: 0,
      b: 0,
      x: 0,
      y: 0,
      count: 0,
    }));
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const a = assignments[i];
      sums[a].r += s.r;
      sums[a].g += s.g;
      sums[a].b += s.b;
      sums[a].x += s.x;
      sums[a].y += s.y;
      sums[a].count++;
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sums[c].count === 0) continue;
      centroids[c].r = sums[c].r / sums[c].count;
      centroids[c].g = sums[c].g / sums[c].count;
      centroids[c].b = sums[c].b / sums[c].count;
      centroids[c].x = sums[c].x / sums[c].count;
      centroids[c].y = sums[c].y / sums[c].count;
    }
  }

  // 4. Build results: weight + spread for each cluster
  const clusterPixels: PixelSample[][] = centroids.map(() => []);
  for (let i = 0; i < samples.length; i++) {
    clusterPixels[assignments[i]].push(samples[i]);
  }

  const totalPixels = samples.length;
  const results: ColorRegion[] = [];

  for (let c = 0; c < centroids.length; c++) {
    const pixels = clusterPixels[c];
    if (pixels.length === 0) continue;

    const weight = pixels.length / totalPixels;
    const cent = centroids[c];

    // Spread = average distance of cluster pixels from centroid position
    let spreadSum = 0;
    for (const p of pixels) {
      spreadSum += Math.sqrt((p.x - cent.x) ** 2 + (p.y - cent.y) ** 2);
    }
    const spread = Math.min(1, (spreadSum / pixels.length) / 0.707); // normalise by max possible distance

    const rgb: [number, number, number] = [
      Math.round(cent.r),
      Math.round(cent.g),
      Math.round(cent.b),
    ];

    results.push({
      hex: rgbToHex(rgb[0], rgb[1], rgb[2]),
      rgb,
      position: {
        x: Math.round(cent.x * 100) / 100,
        y: Math.round(cent.y * 100) / 100,
      },
      weight: Math.round(weight * 100) / 100,
      spread: Math.round(spread * 100) / 100,
    });
  }

  // Sort by weight descending
  results.sort((a, b) => b.weight - a.weight);
  return results;
}

/** K-means++ initialisation: pick initial centroids spread apart. */
function kMeansPlusPlusInit(
  samples: PixelSample[],
  k: number
): Centroid[] {
  const centroids: Centroid[] = [];

  // Pick the first centroid randomly
  const first = samples[Math.floor(Math.random() * samples.length)];
  centroids.push({ r: first.r, g: first.g, b: first.b, x: first.x, y: first.y });

  for (let c = 1; c < k; c++) {
    // For each sample, compute distance to nearest existing centroid
    const distances = samples.map((s) => {
      let minDist = Infinity;
      for (const cent of centroids) {
        const d = colorDistance([s.r, s.g, s.b], [cent.r, cent.g, cent.b]);
        if (d < minDist) minDist = d;
      }
      return minDist * minDist; // squared for probability weighting
    });

    // Pick next centroid proportional to distance squared
    const totalDist = distances.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalDist;
    let idx = 0;
    for (let i = 0; i < distances.length; i++) {
      r -= distances[i];
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    const pick = samples[idx];
    centroids.push({ r: pick.r, g: pick.g, b: pick.b, x: pick.x, y: pick.y });
  }

  return centroids;
}
