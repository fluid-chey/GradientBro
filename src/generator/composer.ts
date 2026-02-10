/**
 * Composer — assemble all layers into final CSS output.
 *
 * Routes to different generation paths based on the gradient strategy:
 *  - "simple"  — original linear base + single blurred blob layer
 *  - "mesh"    — mesh-style base + multi-tier blur layers
 *  - "hybrid"  — dominant-color base + mesh accent layers
 *
 * When multi-tier blur is in effect, the composer emits CSS for an
 * inner wrapper div (`${sel}-inner`) to provide extra pseudo-elements.
 */

import { GradientSpec, GeneratorOptions } from "../types";
import { buildBaseGradient, buildColorBlobs } from "./gradient-layers";
import { buildNoiseLayerCSS } from "./noise-layer";
import { buildBlurLayerCSS } from "./blur-layer";
import { buildBlurLayers, BlurLayerResult } from "./blur-layer";
import { buildMeshLayers, buildHybridLayers, MeshOutput } from "./mesh-layer";

/**
 * Turn a Record<string, string> into indented CSS declarations.
 */
function declarations(props: Record<string, string>, indent = "  "): string {
  return Object.entries(props)
    .map(([k, v]) => `${indent}${k}: ${v};`)
    .join("\n");
}

/**
 * Compose the full CSS for a gradient container.
 */
export function composeCSS(
  spec: GradientSpec,
  options: GeneratorOptions
): string {
  const { strategy } = spec;

  switch (strategy) {
    case "mesh":
    case "hybrid":
      return composeMeshCSS(spec, options);
    case "simple":
    default:
      return composeSimpleCSS(spec, options);
  }
}

// ─── Simple strategy (original path, enhanced) ──────────────────────

function composeSimpleCSS(
  spec: GradientSpec,
  options: GeneratorOptions
): string {
  const { selector, fidelity, borderRadius } = options;
  const sel = selector.startsWith(".") ? selector : `.${selector}`;
  const br = borderRadius ?? "0";

  // Layer 1: base gradient
  const baseGradient = buildBaseGradient(spec.colors);
  let backgroundValue: string;
  if (spec.vignette.detected && spec.vignette.strength > 0.1) {
    const vigOpacity = Math.round(spec.vignette.strength * 0.6 * 100) / 100;
    backgroundValue = [
      `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${vigOpacity}) 100%)`,
      baseGradient,
    ].join(",\n    ");
  } else {
    backgroundValue = baseGradient;
  }

  // Layer 2: blurred colour blobs
  const blobs = buildColorBlobs(spec.colors, fidelity);
  const blurProps = buildBlurLayerCSS(blobs, spec.blur, fidelity);

  // Layer 3: noise overlay (now mood-aware)
  const noiseProps = buildNoiseLayerCSS(spec.noise, fidelity, spec.mood);

  const lines: string[] = [];

  // Container
  lines.push(`${sel} {`);
  lines.push(`  position: relative;`);
  lines.push(`  overflow: hidden;`);
  if (br !== "0") lines.push(`  border-radius: ${br};`);
  lines.push(`  background: ${backgroundValue};`);
  lines.push(`}`);
  lines.push(``);

  // ::before — blurred blobs
  lines.push(`${sel}::before {`);
  lines.push(declarations(blurProps));
  if (br !== "0") lines.push(`  border-radius: ${br};`);
  lines.push(`  z-index: 1;`);
  lines.push(`}`);
  lines.push(``);

  // ::after — noise
  lines.push(`${sel}::after {`);
  lines.push(declarations(noiseProps));
  if (br !== "0") lines.push(`  border-radius: ${br};`);
  lines.push(`  z-index: 2;`);
  lines.push(`}`);
  lines.push(``);

  // Content z-index
  lines.push(`${sel} > * {`);
  lines.push(`  position: relative;`);
  lines.push(`  z-index: 3;`);
  lines.push(`}`);

  return lines.join("\n");
}

// ─── Mesh / Hybrid strategy ─────────────────────────────────────────

function composeMeshCSS(
  spec: GradientSpec,
  options: GeneratorOptions
): string {
  const { selector, fidelity, borderRadius } = options;
  const sel = selector.startsWith(".") ? selector : `.${selector}`;
  const br = borderRadius ?? "0";

  // Get mesh output based on strategy
  const meshOutput: MeshOutput =
    spec.strategy === "hybrid"
      ? buildHybridLayers(spec, fidelity)
      : buildMeshLayers(spec, fidelity);

  const { containerBackground, blurResult } = meshOutput;

  // Noise overlay (mood-aware)
  const noiseProps = buildNoiseLayerCSS(spec.noise, fidelity, spec.mood);

  const lines: string[] = [];

  if (blurResult.needsInnerWrapper) {
    // ── Multi-layer: uses inner wrapper for extra pseudo-elements ────
    //
    // DOM structure:
    //   <div class="sel">
    //     <div class="sel-inner">
    //       <!-- content -->
    //     </div>
    //   </div>
    //
    // Layer stack:
    //   sel            — base gradient + vignette
    //   sel::before    — diffuse blur tier (z-index 1)
    //   sel-inner::before — sharp blur tier (z-index 2)
    //   sel-inner::after  — noise overlay (z-index 3)
    //   content        — z-index 4

    const innerSel = `${sel}-inner`;

    // Container
    lines.push(`${sel} {`);
    lines.push(`  position: relative;`);
    lines.push(`  overflow: hidden;`);
    if (br !== "0") lines.push(`  border-radius: ${br};`);
    lines.push(`  background: ${containerBackground};`);
    lines.push(`}`);
    lines.push(``);

    // Assign tiers to pseudo-elements
    const diffuseLayer = blurResult.layers.find((l) => l.tier === "diffuse" || l.tier === "single");
    const sharpLayer = blurResult.layers.find((l) => l.tier === "sharp");

    // sel::before — diffuse tier
    if (diffuseLayer) {
      lines.push(`${sel}::before {`);
      lines.push(declarations(diffuseLayer.css));
      if (br !== "0") lines.push(`  border-radius: ${br};`);
      lines.push(`  z-index: 1;`);
      lines.push(`}`);
      lines.push(``);
    }

    // Inner wrapper base
    lines.push(`${innerSel} {`);
    lines.push(`  position: relative;`);
    lines.push(`  z-index: 2;`);
    lines.push(`  width: 100%;`);
    lines.push(`  height: 100%;`);
    lines.push(`}`);
    lines.push(``);

    // inner::before — sharp tier
    if (sharpLayer) {
      lines.push(`${innerSel}::before {`);
      lines.push(declarations(sharpLayer.css));
      if (br !== "0") lines.push(`  border-radius: ${br};`);
      lines.push(`  z-index: 2;`);
      lines.push(`}`);
      lines.push(``);
    }

    // inner::after — noise
    lines.push(`${innerSel}::after {`);
    lines.push(declarations(noiseProps));
    if (br !== "0") lines.push(`  border-radius: ${br};`);
    lines.push(`  z-index: 3;`);
    lines.push(`}`);
    lines.push(``);

    // Content z-index
    lines.push(`${innerSel} > * {`);
    lines.push(`  position: relative;`);
    lines.push(`  z-index: 4;`);
    lines.push(`}`);
  } else {
    // ── Single-layer: same structure as simple but with mesh base ────

    const singleLayer = blurResult.layers[0];

    // Container
    lines.push(`${sel} {`);
    lines.push(`  position: relative;`);
    lines.push(`  overflow: hidden;`);
    if (br !== "0") lines.push(`  border-radius: ${br};`);
    lines.push(`  background: ${containerBackground};`);
    lines.push(`}`);
    lines.push(``);

    // ::before — blur layer
    if (singleLayer) {
      lines.push(`${sel}::before {`);
      lines.push(declarations(singleLayer.css));
      if (br !== "0") lines.push(`  border-radius: ${br};`);
      lines.push(`  z-index: 1;`);
      lines.push(`}`);
      lines.push(``);
    }

    // ::after — noise
    lines.push(`${sel}::after {`);
    lines.push(declarations(noiseProps));
    if (br !== "0") lines.push(`  border-radius: ${br};`);
    lines.push(`  z-index: 2;`);
    lines.push(`}`);
    lines.push(``);

    // Content z-index
    lines.push(`${sel} > * {`);
    lines.push(`  position: relative;`);
    lines.push(`  z-index: 3;`);
    lines.push(`}`);
  }

  return lines.join("\n");
}
