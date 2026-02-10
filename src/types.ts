/**
 * Core types for the GradientBro analysis and generation pipeline.
 */

/** A color region extracted from the image via k-means clustering. */
export interface ColorRegion {
  /** Hex color string, e.g. "#B87333" */
  hex: string;
  /** RGB components [0-255] */
  rgb: [number, number, number];
  /** Centroid position of this color cluster, normalised 0-1 */
  position: { x: number; y: number };
  /** Proportion of pixels belonging to this cluster, 0-1 */
  weight: number;
  /** How spread-out the cluster is spatially, 0-1 */
  spread: number;
  /** How sharply defined this region's boundary is, 0-1.
   *  1 = crisp edge, 0 = completely diffuse. */
  edgeSharpness: number;
}

/** Noise / grain characteristics detected in the image. */
export interface NoiseInfo {
  /** Overall noise intensity, 0-1 */
  intensity: number;
  /** Perceived frequency: fine, medium, coarse */
  frequency: "fine" | "medium" | "coarse";
  /** Type of noise pattern detected */
  type: "grain" | "speckle" | "smooth";
  /** How crisp/hard-edged the noise particles are, 0-1.
   *  High = sharp film grain, low = soft digital noise. */
  sharpness: number;
  /** Dynamic range of the noise itself, 0-1.
   *  High = punchy visible speckles, low = faint haze. */
  contrast: number;
  /** Continuous feTurbulence baseFrequency value, 0.3-1.0.
   *  Maps directly to SVG without lossy categorical conversion. */
  baseFrequency: number;
}

/** Blur characteristics detected in the image. */
export interface BlurInfo {
  /** Qualitative blur level */
  level: "none" | "light" | "medium" | "heavy";
  /** Laplacian variance (lower = blurrier), normalised 0-1 */
  variance: number;
}

/** Vignette (edge-darkening) characteristics. */
export interface VignetteInfo {
  detected: boolean;
  /** Strength of vignette, 0-1 */
  strength: number;
}

/** Overall mood / temperature summary. */
export interface MoodInfo {
  temperature: "cool" | "neutral" | "warm";
  brightness: "dark" | "medium-dark" | "medium" | "medium-bright" | "bright";
}

/** Which CSS generation strategy to use. */
export type GradientStrategy = "simple" | "mesh" | "hybrid";

/** The full gradient specification output by the analyzer. */
export interface GradientSpec {
  colors: ColorRegion[];
  noise: NoiseInfo;
  blur: BlurInfo;
  vignette: VignetteInfo;
  dimensions: { width: number; height: number };
  mood: MoodInfo;
  /** Recommended CSS generation strategy based on image characteristics. */
  strategy: GradientStrategy;
}

/** Fidelity level that controls generation detail. */
export type FidelityLevel = "exact" | "vibe" | "inspired";

/** Options for the CSS generator. */
export interface GeneratorOptions {
  /** CSS selector / class name for the container */
  selector: string;
  /** How close the output should match the reference */
  fidelity: FidelityLevel;
  /** Border radius to apply, e.g. "16px" */
  borderRadius?: string;
}
