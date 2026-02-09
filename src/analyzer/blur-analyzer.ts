/**
 * Blur analyser.
 *
 * Estimates how blurred the image is using a Laplacian-based approach.
 * A lower Laplacian variance indicates a blurrier image.
 */

import { RawImageData, getPixel } from "../utils/image";
import { BlurInfo } from "../types";

/**
 * Analyse the blur level of an image using the variance of the Laplacian.
 *
 * The Laplacian highlights edges. In a blurry image edges are soft so
 * the Laplacian variance is low.  In a sharp image it is high.
 */
export function analyzeBlur(img: RawImageData): BlurInfo {
  const laplacianValues: number[] = [];

  // Apply a simple 3×3 Laplacian kernel: [0 1 0; 1 -4 1; 0 1 0]
  for (let y = 1; y < img.height - 1; y++) {
    for (let x = 1; x < img.width - 1; x++) {
      const center = pixelLuminance(img, x, y);
      const top = pixelLuminance(img, x, y - 1);
      const bottom = pixelLuminance(img, x, y + 1);
      const left = pixelLuminance(img, x - 1, y);
      const right = pixelLuminance(img, x + 1, y);

      const laplacian = top + bottom + left + right - 4 * center;
      laplacianValues.push(laplacian);
    }
  }

  // Compute variance
  const n = laplacianValues.length;
  const mean = laplacianValues.reduce((a, b) => a + b, 0) / n;
  const variance =
    laplacianValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;

  // Normalise: sharp images have variance ~500-2000+, blurry ≈ 0-100
  // We map to 0-1 where 1 = very sharp, 0 = very blurry
  const normalisedVariance = Math.min(1, variance / 1000);

  let level: BlurInfo["level"];
  if (normalisedVariance > 0.5) level = "none";
  else if (normalisedVariance > 0.25) level = "light";
  else if (normalisedVariance > 0.1) level = "medium";
  else level = "heavy";

  return {
    level,
    variance: Math.round(normalisedVariance * 100) / 100,
  };
}

function pixelLuminance(img: RawImageData, x: number, y: number): number {
  const [r, g, b] = getPixel(img, x, y);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
