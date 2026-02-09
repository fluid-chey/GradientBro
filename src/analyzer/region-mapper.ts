/**
 * Region mapper — detects vignette and overall mood.
 */

import { RawImageData, getPixel } from "../utils/image";
import { luminance, rgbToHsl } from "../utils/color";
import { VignetteInfo, MoodInfo } from "../types";

/**
 * Detect vignetting by comparing average edge brightness to centre brightness.
 */
export function detectVignette(img: RawImageData): VignetteInfo {
  const edgePixels: number[] = [];
  const centerPixels: number[] = [];

  const cx = img.width / 2;
  const cy = img.height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const [r, g, b] = getPixel(img, x, y);
      const lum = luminance(r, g, b);
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;

      if (dist < 0.35) {
        centerPixels.push(lum);
      } else if (dist > 0.65) {
        edgePixels.push(lum);
      }
    }
  }

  const avgCenter =
    centerPixels.reduce((a, b) => a + b, 0) / (centerPixels.length || 1);
  const avgEdge =
    edgePixels.reduce((a, b) => a + b, 0) / (edgePixels.length || 1);

  // Vignette strength: how much darker edges are than centre
  const diff = Math.max(0, avgCenter - avgEdge);
  const strength = Math.min(1, diff / 0.4); // 0.4 luminance diff ≈ full vignette

  return {
    detected: strength > 0.1,
    strength: Math.round(strength * 100) / 100,
  };
}

/**
 * Determine overall mood (colour temperature + brightness).
 */
export function detectMood(img: RawImageData): MoodInfo {
  let totalHue = 0;
  let totalSat = 0;
  let totalLum = 0;
  let saturatedCount = 0;
  const pixelCount = img.width * img.height;

  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const [r, g, b] = getPixel(img, x, y);
      const [h, s, l] = rgbToHsl(r, g, b);
      totalLum += luminance(r, g, b);

      // Only consider saturated pixels for temperature
      if (s > 0.1) {
        totalHue += h;
        totalSat += s;
        saturatedCount++;
      }
    }
  }

  const avgLum = totalLum / pixelCount;

  // Temperature from average hue of saturated pixels
  let temperature: MoodInfo["temperature"] = "neutral";
  if (saturatedCount > pixelCount * 0.05) {
    const avgHue = totalHue / saturatedCount;
    // Warm hues: 0-60 (reds/oranges/yellows) or 300-360 (magentas)
    if ((avgHue >= 0 && avgHue <= 70) || avgHue >= 300) {
      temperature = "warm";
    } else if (avgHue >= 160 && avgHue <= 280) {
      temperature = "cool";
    }
  }

  let brightness: MoodInfo["brightness"];
  if (avgLum < 0.2) brightness = "dark";
  else if (avgLum < 0.35) brightness = "medium-dark";
  else if (avgLum < 0.55) brightness = "medium";
  else if (avgLum < 0.75) brightness = "medium-bright";
  else brightness = "bright";

  return { temperature, brightness };
}
