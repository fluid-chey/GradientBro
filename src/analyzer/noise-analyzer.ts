/**
 * Noise / grain analyser.
 *
 * Detects the amount, frequency, sharpness, and contrast of noise in an
 * image by isolating the high-frequency residual (original minus a blurred
 * copy) and measuring its statistical properties.
 */

import { RawImageData, getPixel } from "../utils/image";
import { NoiseInfo } from "../types";

/**
 * Analyse the noise characteristics of an image.
 *
 * Strategy:
 * 1. Compute average neighbour-difference for intensity and alternation
 *    rate for frequency (original approach, kept for backward compat).
 * 2. Build a high-pass residual by subtracting a simple box-blur from the
 *    original.  From the residual we derive:
 *      - sharpness:     Laplacian variance of the residual (crispy vs soft grain)
 *      - contrast:      Standard deviation of residual values (punchy vs faint)
 *      - baseFrequency: Continuous 0.3-1.0 value from the alternation rate
 */
export function analyzeNoise(img: RawImageData): NoiseInfo {
  // ── Step 1: Original neighbour-difference metrics ──────────────────

  let totalDiff = 0;
  let alternations = 0;
  let comparisons = 0;
  let prevDiffSign = 0;

  for (let y = 0; y < img.height - 1; y++) {
    for (let x = 0; x < img.width - 1; x++) {
      const [r, g, b] = getPixel(img, x, y);
      const [rr, rg, rb] = getPixel(img, x + 1, y); // right neighbour
      const [dr, dg, db] = getPixel(img, x, y + 1); // bottom neighbour

      // Luminance-weighted difference to right
      const diffRight =
        0.299 * (rr - r) + 0.587 * (rg - g) + 0.114 * (rb - b);
      // Luminance-weighted difference downward
      const diffDown =
        0.299 * (dr - r) + 0.587 * (dg - g) + 0.114 * (db - b);

      totalDiff += Math.abs(diffRight) + Math.abs(diffDown);
      comparisons += 2;

      // Track sign alternations for frequency estimation
      const sign = diffRight >= 0 ? 1 : -1;
      if (prevDiffSign !== 0 && sign !== prevDiffSign) {
        alternations++;
      }
      prevDiffSign = sign;
    }
  }

  // Average difference normalised to 0-1 (max possible is 255)
  const avgDiff = totalDiff / comparisons / 255;

  // Intensity: scale so typical noisy images land around 0.5-0.8
  const intensity = Math.min(1, avgDiff * 10);

  // Frequency: alternation rate — higher = finer grain
  const totalPossibleAlternations = (img.width - 1) * (img.height - 1);
  const alternationRate = alternations / totalPossibleAlternations;

  let frequency: NoiseInfo["frequency"];
  if (alternationRate > 0.6) frequency = "fine";
  else if (alternationRate > 0.35) frequency = "medium";
  else frequency = "coarse";

  let type: NoiseInfo["type"];
  if (intensity < 0.15) type = "smooth";
  else if (frequency === "fine") type = "grain";
  else type = "speckle";

  // ── Step 2: Continuous baseFrequency from alternation rate ─────────
  // Map alternationRate (typically 0.2-0.8) to baseFrequency 0.3-1.0
  const baseFrequency = round(
    Math.min(1.0, Math.max(0.3, 0.3 + alternationRate * 0.875))
  );

  // ── Step 3: High-pass residual analysis ────────────────────────────
  // Build a simple 5×5 box-blurred version of the image, then compute
  // the per-pixel residual (original - blurred).

  const blurRadius = 2; // 5×5 kernel
  const residuals: number[] = [];

  for (let y = blurRadius; y < img.height - blurRadius; y++) {
    for (let x = blurRadius; x < img.width - blurRadius; x++) {
      // Original luminance
      const [or, og, ob] = getPixel(img, x, y);
      const origLum = 0.299 * or + 0.587 * og + 0.114 * ob;

      // Box-blur luminance (5×5 neighbourhood)
      let blurSum = 0;
      let blurCount = 0;
      for (let dy = -blurRadius; dy <= blurRadius; dy++) {
        for (let dx = -blurRadius; dx <= blurRadius; dx++) {
          const [br, bg, bb] = getPixel(img, x + dx, y + dy);
          blurSum += 0.299 * br + 0.587 * bg + 0.114 * bb;
          blurCount++;
        }
      }
      const blurLum = blurSum / blurCount;

      residuals.push(origLum - blurLum);
    }
  }

  // ── Step 3a: Contrast — standard deviation of residuals ────────────
  // Normalised to 0-1 where 1 = very high-contrast noise
  const n = residuals.length;
  const meanResidual = residuals.reduce((a, b) => a + b, 0) / n;
  const residualVariance =
    residuals.reduce((sum, v) => sum + (v - meanResidual) ** 2, 0) / n;
  const residualStdDev = Math.sqrt(residualVariance);

  // Typical residual stddev: 0-2 for smooth images, 5-15 for grainy.
  // Map to 0-1 with a ceiling at ~20.
  const contrast = round(Math.min(1, residualStdDev / 20));

  // ── Step 3b: Sharpness — Laplacian variance of the residual ───────
  // Build the residual as a 2D grid and compute its Laplacian variance.
  // High Laplacian variance = crispy, hard-edged noise particles.
  const residualW = img.width - 2 * blurRadius;
  const residualH = img.height - 2 * blurRadius;

  const laplacianValues: number[] = [];
  for (let y = 1; y < residualH - 1; y++) {
    for (let x = 1; x < residualW - 1; x++) {
      const idx = y * residualW + x;
      const center = residuals[idx];
      const top = residuals[(y - 1) * residualW + x];
      const bottom = residuals[(y + 1) * residualW + x];
      const left = residuals[y * residualW + (x - 1)];
      const right = residuals[y * residualW + (x + 1)];

      laplacianValues.push(top + bottom + left + right - 4 * center);
    }
  }

  const lapN = laplacianValues.length;
  const lapMean = laplacianValues.reduce((a, b) => a + b, 0) / lapN;
  const lapVariance =
    laplacianValues.reduce((sum, v) => sum + (v - lapMean) ** 2, 0) / lapN;

  // Typical Laplacian variance of residual: 0-5 for soft noise, 20-100+
  // for crispy grain.  Map to 0-1 with ceiling at 80.
  const sharpness = round(Math.min(1, lapVariance / 80));

  return {
    intensity: round(intensity),
    frequency,
    type,
    sharpness,
    contrast,
    baseFrequency,
  };
}

/** Round to 2 decimal places. */
function round(v: number): number {
  return Math.round(v * 100) / 100;
}
