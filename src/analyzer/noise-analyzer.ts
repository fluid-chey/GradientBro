/**
 * Noise / grain analyser.
 *
 * Detects the amount and frequency of noise in an image by measuring
 * high-frequency variation between neighbouring pixels.
 */

import { RawImageData, getPixel } from "../utils/image";
import { NoiseInfo } from "../types";

/**
 * Analyse the noise characteristics of an image.
 *
 * Strategy: compute the average absolute difference between each pixel
 * and its right/below neighbours.  High values suggest heavy noise/grain,
 * low values suggest smooth or heavily-blurred content.
 *
 * We also measure the *frequency* by looking at how often the sign
 * of the difference alternates (high alternation = fine grain).
 */
export function analyzeNoise(img: RawImageData): NoiseInfo {
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
  // Very smooth/blurred images ≈ 0.01-0.1
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

  return {
    intensity: Math.round(intensity * 100) / 100,
    frequency,
    type,
  };
}
