/**
 * Generate CSS for blurred colour-blob pseudo-elements.
 *
 * Supports two strategies:
 *
 *  Strategy A — Single blur layer with per-blob gradient-stop sharpness.
 *    Used when the sharpness range across regions is moderate (≤ 0.4).
 *    Sharp regions get tighter radial stops; diffuse ones get wider stops.
 *    One global blur value is applied to the ::before element.
 *
 *  Strategy B — Multiple blur tiers split by sharpness.
 *    Used when sharpness variance is high (> 0.4).
 *    Blobs are grouped into 2-3 tiers, each rendered on a separate
 *    pseudo-element layer with its own blur amount.
 *    Sharp tier: low blur (5-20px).  Diffuse tier: heavy blur (40-80px).
 */

import { BlurInfo, ColorRegion, FidelityLevel } from "../types";

// ─── Public types ────────────────────────────────────────────────────

/** A single CSS layer of blurred gradients. */
export interface BlurLayer {
  /** CSS property map for this pseudo-element. */
  css: Record<string, string>;
  /** Tier label, used for comments / class naming. */
  tier: "sharp" | "medium" | "diffuse" | "single";
}

/** Whether we need the inner wrapper div for multi-layer output. */
export interface BlurLayerResult {
  layers: BlurLayer[];
  /** True when Strategy B is in effect and we need extra DOM elements. */
  needsInnerWrapper: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Map analysed blur info to a CSS blur radius in pixels (global fallback).
 */
export function blurRadiusPx(blur: BlurInfo, fidelity: FidelityLevel): number {
  let base: number;
  switch (blur.level) {
    case "heavy":
      base = 60;
      break;
    case "medium":
      base = 35;
      break;
    case "light":
      base = 15;
      break;
    case "none":
      base = 0;
      break;
  }

  if (fidelity === "exact") {
    base = Math.round((1 - blur.variance) * 80);
  }

  const minimums: Record<FidelityLevel, number> = {
    exact: 30,
    vibe: 40,
    inspired: 20,
  };
  return Math.max(base, minimums[fidelity]);
}

/**
 * Blur-radius-appropriate inset overflow to prevent edge artefacts.
 */
export function blurOverflowPct(radiusPx: number): string {
  const pct = Math.max(10, Math.round(radiusPx * 0.5));
  return `${pct}%`;
}

/**
 * Per-region blur radius derived from edgeSharpness.
 * Sharp regions → low blur, diffuse regions → heavy blur.
 */
function regionBlurPx(
  region: ColorRegion,
  globalBlur: number
): number {
  // edgeSharpness 0 → full global blur, edgeSharpness 1 → 15% of global blur
  const factor = 1 - region.edgeSharpness * 0.85;
  return Math.round(Math.max(5, globalBlur * factor));
}

/**
 * Build a radial-gradient CSS value for a single colour blob.
 * `radiusMultiplier` adjusts the transparent-stop based on sharpness.
 */
function blobGradient(c: ColorRegion, radiusMultiplier: number = 1): string {
  const xPct = Math.round(c.position.x * 100);
  const yPct = Math.round(c.position.y * 100);
  const opacity = Math.round(Math.min(0.9, 0.4 + c.weight) * 100) / 100;
  const baseRadius = 30 + c.spread * 40;

  // Sharp regions get tighter stops; diffuse regions get wider stops
  // edgeSharpness 1 → radius * 0.6, edgeSharpness 0 → radius * 1.3
  const sharpnessFactor = 1.3 - c.edgeSharpness * 0.7;
  const radius = Math.round(baseRadius * sharpnessFactor * radiusMultiplier);

  return `radial-gradient(circle at ${xPct}% ${yPct}%, rgba(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]},${opacity}) 0%, transparent ${radius}%)`;
}

// ─── Strategy A: single layer ────────────────────────────────────────

function buildSingleLayer(
  colors: ColorRegion[],
  blur: BlurInfo,
  fidelity: FidelityLevel
): BlurLayerResult {
  const globalRadius = blurRadiusPx(blur, fidelity);
  const overflow = blurOverflowPct(globalRadius);

  const gradients = colors.map((c) => blobGradient(c));

  return {
    layers: [
      {
        tier: "single",
        css: {
          content: "''",
          position: "absolute",
          inset: `-${overflow}`,
          background: gradients.join(",\n    "),
          filter: globalRadius > 0 ? `blur(${globalRadius}px)` : "none",
          "pointer-events": "none",
        },
      },
    ],
    needsInnerWrapper: false,
  };
}

// ─── Strategy B: multi-tier layers ───────────────────────────────────

function buildMultiTierLayers(
  colors: ColorRegion[],
  blur: BlurInfo,
  fidelity: FidelityLevel
): BlurLayerResult {
  const globalRadius = blurRadiusPx(blur, fidelity);

  // Split regions into sharp (≥ 0.5) and diffuse (< 0.5) tiers
  const sharpRegions = colors.filter((c) => c.edgeSharpness >= 0.5);
  const diffuseRegions = colors.filter((c) => c.edgeSharpness < 0.5);

  const layers: BlurLayer[] = [];

  // Diffuse tier — heavy blur, goes on the outermost ::before
  if (diffuseRegions.length > 0) {
    const diffuseBlur = Math.round(globalRadius * 1.1); // slightly heavier
    const overflow = blurOverflowPct(diffuseBlur);
    const gradients = diffuseRegions.map((c) => blobGradient(c, 1.2));

    layers.push({
      tier: "diffuse",
      css: {
        content: "''",
        position: "absolute",
        inset: `-${overflow}`,
        background: gradients.join(",\n    "),
        filter: `blur(${diffuseBlur}px)`,
        "pointer-events": "none",
      },
    });
  }

  // Sharp tier — low blur, goes on an inner element's ::before
  if (sharpRegions.length > 0) {
    // Average region blur for the sharp tier
    const avgSharpBlur = Math.round(
      sharpRegions.reduce((sum, c) => sum + regionBlurPx(c, globalRadius), 0) /
        sharpRegions.length
    );
    const overflow = blurOverflowPct(avgSharpBlur);
    const gradients = sharpRegions.map((c) => blobGradient(c, 0.8));

    layers.push({
      tier: "sharp",
      css: {
        content: "''",
        position: "absolute",
        inset: `-${overflow}`,
        background: gradients.join(",\n    "),
        filter: avgSharpBlur > 0 ? `blur(${avgSharpBlur}px)` : "none",
        "pointer-events": "none",
      },
    });
  }

  return {
    layers,
    needsInnerWrapper: layers.length > 1,
  };
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Build blur layer(s) for colour blobs.
 *
 * Automatically selects Strategy A or B based on edge sharpness variance.
 */
export function buildBlurLayers(
  colors: ColorRegion[],
  blur: BlurInfo,
  fidelity: FidelityLevel
): BlurLayerResult {
  if (colors.length === 0) {
    return { layers: [], needsInnerWrapper: false };
  }

  const sharpnesses = colors.map((c) => c.edgeSharpness);
  const range = Math.max(...sharpnesses) - Math.min(...sharpnesses);

  // Strategy B when there's significant sharpness variance
  if (range > 0.4 && colors.length >= 3) {
    return buildMultiTierLayers(colors, blur, fidelity);
  }

  return buildSingleLayer(colors, blur, fidelity);
}

/**
 * Legacy API — returns a single CSS property map.
 * Used by the "simple" strategy path which only needs one layer.
 */
export function buildBlurLayerCSS(
  gradientValues: string[],
  blur: BlurInfo,
  fidelity: FidelityLevel
): Record<string, string> {
  const radius = blurRadiusPx(blur, fidelity);
  const overflow = blurOverflowPct(radius);

  return {
    content: "''",
    position: "absolute",
    inset: `-${overflow}`,
    background: gradientValues.join(",\n    "),
    filter: radius > 0 ? `blur(${radius}px)` : "none",
    "pointer-events": "none",
  };
}
