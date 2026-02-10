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

/** A 2D point, normalised 0-1 relative to image dimensions. */
export interface Point2D {
  x: number;
  y: number;
}

/** Shape types that GradientBro can detect and generate as SVG. */
export type ShapeType =
  | "wave"
  | "wisp"
  | "veil"
  | "angular-veil"
  | "ribbon"
  | "petal";

/**
 * A detected shape contour — provides hints for SVG path generation.
 * The AI agent uses these as scaffolding but writes the actual bezier paths.
 */
export interface ShapeContour {
  /** Which shape archetype this contour matches */
  type: ShapeType;
  /** Bounding region centre, normalised 0-1 */
  position: Point2D;
  /** Dominant direction in degrees (0 = right, 90 = down) */
  direction: number;
  /** For waves: oscillation amplitude relative to container, 0-1 */
  amplitude?: number;
  /** For waves: number of oscillations across the shape length */
  frequency?: number;
  /** For wisps/ribbons/petals: start point, normalised 0-1 */
  startPoint?: Point2D;
  /** For wisps/ribbons/petals: end point, normalised 0-1 */
  endPoint?: Point2D;
  /** For petals: the pointed tip, normalised 0-1 */
  tipPoint?: Point2D;
  /** For petals: width of the rounded body relative to length, 0-1 */
  bodyWidth?: number;
  /** For angular-veils: vertex points defining angular edges, normalised 0-1 */
  vertices?: Point2D[];
  /** Curvature amount: 0 = straight, 1 = heavily curved */
  curvature: number;
  /** Relative thickness of the shape, 0-1 */
  thickness: number;
  /** How blurred this contour is: 0 = crisp, 1 = deeply diffuse */
  blur: number;
  /** Associated colour hex from nearest colour cluster */
  color: string;
  /** Opacity, 0-1 */
  opacity: number;
}

/** Summary of dominant shape style. */
export type ShapeStyle =
  | "blobby"
  | "wispy"
  | "wavy"
  | "angular"
  | "organic"
  | "mixed";

/** Shape analysis results — present when non-trivial shapes are detected. */
export interface ShapeInfo {
  /** Overall shape complexity, 0-1 */
  complexity: number;
  /** Dominant flow direction in degrees */
  flowDirection: number;
  /** Dominant shape style */
  style: ShapeStyle;
  /** Extracted simplified contour descriptors */
  contours: ShapeContour[];
}

/** Which CSS generation strategy to use. */
export type GradientStrategy = "simple" | "mesh" | "hybrid" | "organic";

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
  /** Shape analysis — present when organic shapes detected. */
  shapes?: ShapeInfo;
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
