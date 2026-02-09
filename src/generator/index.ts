/**
 * CSS generator orchestrator.
 *
 * Takes a GradientSpec (from the analyser) and GeneratorOptions,
 * and returns production-ready CSS.
 */

import { GradientSpec, GeneratorOptions } from "../types";
import { composeCSS } from "./composer";

/**
 * Generate CSS from an analysed gradient specification.
 */
export function generateCSS(
  spec: GradientSpec,
  options: GeneratorOptions
): string {
  return composeCSS(spec, options);
}
