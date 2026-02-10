/**
 * Image analysis orchestrator.
 *
 * Runs the full pipeline: load image -> extract colors -> analyse noise ->
 * analyse blur -> compute edge sharpness -> detect vignette -> detect mood ->
 * classify strategy -> return GradientSpec.
 */

import { loadImage } from "../utils/image";
import { extractColors } from "./color-extractor";
import { analyzeNoise } from "./noise-analyzer";
import { analyzeBlur } from "./blur-analyzer";
import { assignPixelsToClusters, computeEdgeSharpness } from "./edge-sharpness";
import { classifyStrategy } from "./strategy-classifier";
import { detectVignette, detectMood } from "./region-mapper";
import { GradientSpec, FidelityLevel } from "../types";

export interface AnalyzeOptions {
  /** Number of color clusters to extract.  Driven by fidelity level. */
  colorClusters?: number;
  /** Resize dimension for analysis (higher = more precise but slower). */
  analysisSize?: number;
}

/** Map fidelity to default cluster count. */
function clustersForFidelity(fidelity: FidelityLevel): number {
  switch (fidelity) {
    case "exact":
      return 8;
    case "vibe":
      return 5;
    case "inspired":
      return 3;
  }
}

/**
 * Analyse a reference image and return a full GradientSpec.
 */
export async function analyzeImage(
  imagePath: string,
  fidelity: FidelityLevel = "vibe",
  options: AnalyzeOptions = {}
): Promise<GradientSpec> {
  const clusters = options.colorClusters ?? clustersForFidelity(fidelity);
  const size = options.analysisSize ?? 100;

  // Load image to a small working size
  const img = await loadImage(imagePath, size);

  // Run core analysers
  const colors = extractColors(img, clusters);
  const noise = analyzeNoise(img);
  const blur = analyzeBlur(img);
  const vignette = detectVignette(img);
  const mood = detectMood(img);

  // Compute per-region edge sharpness
  const assignments = assignPixelsToClusters(img, colors);
  computeEdgeSharpness(img, colors, assignments);

  // Classify the optimal CSS generation strategy
  const strategy = classifyStrategy(colors);

  return {
    colors,
    noise,
    blur,
    vignette,
    dimensions: {
      width: img.originalWidth,
      height: img.originalHeight,
    },
    mood,
    strategy,
  };
}
