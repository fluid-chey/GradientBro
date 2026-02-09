/**
 * GradientBro — public API
 *
 * Analyse a reference image and generate layered CSS that replicates
 * its complex gradient, noise, blur, and vignette characteristics.
 */

export { analyzeImage } from "./analyzer/index";
export { generateCSS } from "./generator/index";
export type {
  GradientSpec,
  ColorRegion,
  NoiseInfo,
  BlurInfo,
  VignetteInfo,
  MoodInfo,
  FidelityLevel,
  GeneratorOptions,
} from "./types";
