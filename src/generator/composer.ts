/**
 * Composer — assemble all layers into final CSS output.
 */

import { GradientSpec, GeneratorOptions } from "../types";
import { buildBaseGradient, buildColorBlobs } from "./gradient-layers";
import { buildNoiseLayerCSS } from "./noise-layer";
import { buildBlurLayerCSS } from "./blur-layer";

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
  const { selector, fidelity, borderRadius } = options;
  const sel = selector.startsWith(".") ? selector : `.${selector}`;
  const br = borderRadius ?? "0";

  // --- Layer 1: base gradient on the element itself ---
  const baseGradient = buildBaseGradient(spec.colors);

  // Build vignette if detected
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

  // --- Layer 2: blurred colour blobs on ::before ---
  const blobs = buildColorBlobs(spec.colors, fidelity);
  const blurProps = buildBlurLayerCSS(blobs, spec.blur, fidelity);

  // --- Layer 3: noise overlay on ::after ---
  const noiseProps = buildNoiseLayerCSS(spec.noise, fidelity);

  // --- Assemble ---
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
