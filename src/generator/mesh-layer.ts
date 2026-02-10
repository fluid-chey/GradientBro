/**
 * Mesh gradient generator.
 *
 * Produces CSS for the "mesh" and "hybrid" strategies.
 *
 * Instead of lumping all colour blobs into one ::before with a single
 * blur value, this generator groups regions by their edge sharpness and
 * creates separate layers with different blur amounts.
 *
 * For the "hybrid" strategy, the darkest/largest region becomes a
 * solid or linear-gradient base on the container, while smaller accent
 * regions become mesh-positioned layers with per-group blur.
 */

import { GradientSpec, ColorRegion, FidelityLevel } from "../types";
import { buildBlurLayers, BlurLayerResult, blurRadiusPx } from "./blur-layer";
import { luminance } from "../utils/color";

// ─── Public types ────────────────────────────────────────────────────

export interface MeshOutput {
  /** CSS background value for the container element. */
  containerBackground: string;
  /** The blur layer result (may be multi-tier). */
  blurResult: BlurLayerResult;
  /** Regions used as accent blobs (excludes the base region in hybrid). */
  accentRegions: ColorRegion[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Pick the base region for hybrid strategy: the darkest large region.
 */
function pickBaseRegion(colors: ColorRegion[]): ColorRegion | null {
  // Sort by weight * darkness (low luminance = darker)
  const scored = colors.map((c) => ({
    region: c,
    score: c.weight * (1 - luminance(c.rgb[0], c.rgb[1], c.rgb[2])),
  }));
  scored.sort((a, b) => b.score - a.score);
  // Only pick a base if it covers a meaningful portion
  if (scored[0] && scored[0].region.weight > 0.15) {
    return scored[0].region;
  }
  return null;
}

/**
 * Build a linear-gradient base from the base region and the next
 * darkest region, producing a subtle directional tone.
 */
function buildHybridBase(
  baseRegion: ColorRegion,
  secondaryRegion: ColorRegion | null
): string {
  if (!secondaryRegion) {
    return baseRegion.hex;
  }

  const dx = secondaryRegion.position.x - baseRegion.position.x;
  const dy = secondaryRegion.position.y - baseRegion.position.y;
  const angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 90);

  return `linear-gradient(${angle}deg, ${baseRegion.hex} 0%, ${secondaryRegion.hex} 100%)`;
}

/**
 * Build a solid-colour or gradient base for the mesh strategy
 * using the two darkest colours.
 */
function buildMeshBase(colors: ColorRegion[]): string {
  const sorted = [...colors].sort((a, b) => {
    const lumA = luminance(a.rgb[0], a.rgb[1], a.rgb[2]);
    const lumB = luminance(b.rgb[0], b.rgb[1], b.rgb[2]);
    return lumA - lumB;
  });

  const c1 = sorted[0];
  const c2 = sorted[Math.min(1, sorted.length - 1)];

  if (c1 === c2) return c1.hex;

  const dx = c2.position.x - c1.position.x;
  const dy = c2.position.y - c1.position.y;
  const angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 90);

  return `linear-gradient(${angle}deg, ${c1.hex} 0%, ${c2.hex} 100%)`;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Generate mesh-style output for the "mesh" strategy.
 * All regions become blur-tiered accent layers.
 */
export function buildMeshLayers(
  spec: GradientSpec,
  fidelity: FidelityLevel
): MeshOutput {
  const blurResult = buildBlurLayers(spec.colors, spec.blur, fidelity);

  // Add vignette to the base background if detected
  let containerBackground = buildMeshBase(spec.colors);
  if (spec.vignette.detected && spec.vignette.strength > 0.1) {
    const vigOpacity = Math.round(spec.vignette.strength * 0.6 * 100) / 100;
    containerBackground = [
      `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${vigOpacity}) 100%)`,
      containerBackground,
    ].join(",\n    ");
  }

  return {
    containerBackground,
    blurResult,
    accentRegions: spec.colors,
  };
}

/**
 * Generate hybrid output: a base layer from the dominant region, and
 * mesh-style accent layers for the remaining regions.
 */
export function buildHybridLayers(
  spec: GradientSpec,
  fidelity: FidelityLevel
): MeshOutput {
  const baseRegion = pickBaseRegion(spec.colors);

  let accentRegions: ColorRegion[];
  let containerBackground: string;

  if (baseRegion) {
    // Remove the base region from accent layers
    accentRegions = spec.colors.filter((c) => c !== baseRegion);

    // Find the second darkest region for the base gradient
    const darkSorted = [...accentRegions].sort((a, b) => {
      const lumA = luminance(a.rgb[0], a.rgb[1], a.rgb[2]);
      const lumB = luminance(b.rgb[0], b.rgb[1], b.rgb[2]);
      return lumA - lumB;
    });
    const secondary = darkSorted[0] || null;

    containerBackground = buildHybridBase(baseRegion, secondary);
  } else {
    // No clear dominant region — fall back to mesh-style base
    accentRegions = spec.colors;
    containerBackground = buildMeshBase(spec.colors);
  }

  // Add vignette
  if (spec.vignette.detected && spec.vignette.strength > 0.1) {
    const vigOpacity = Math.round(spec.vignette.strength * 0.6 * 100) / 100;
    containerBackground = [
      `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${vigOpacity}) 100%)`,
      containerBackground,
    ].join(",\n    ");
  }

  // Build blur layers from the accent regions only
  const blurResult = buildBlurLayers(accentRegions, spec.blur, fidelity);

  return {
    containerBackground,
    blurResult,
    accentRegions,
  };
}
