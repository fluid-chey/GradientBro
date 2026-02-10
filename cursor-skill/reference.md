# GradientBro — CSS Technique Reference

This document is the comprehensive reference for generating complex textural
gradients in pure CSS. The Cursor agent should read this before writing any
gradient CSS.

---

## Gradient Strategy Selection

GradientBro analyses the reference image and recommends one of four strategies.
The strategy is output as `spec.strategy` in the JSON.

**Trust the analyzer.** The classifier distinguishes "distinctive" shapes (waves,
wisps, ribbons, petals — requiring real geometric features like elongation and
sinuosity) from "generic" large-area regions (veils, angular-veils). When it
recommends `"organic"`, the image genuinely has structural complexity that benefits
from SVG shapes. Honour the recommendation unless the target container is very
small (< ~250px wide). See SKILL.md Step 5 for the full routing decision.

### Simple
- **When**: 2-3 colour regions, linear spatial distribution, uniform edge sharpness
- **CSS pattern**: `linear-gradient` base + single `::before` with blurred radial blobs + `::after` noise
- **Best for**: clean directional sweeps, simple warm-to-cool transitions

### Mesh
- **When**: 4+ colour regions scattered across 2D space, no single dominant region
- **CSS pattern**: dark base + multiple radial gradients grouped into blur tiers + noise overlay
- **Best for**: complex multi-colour blends like Apple Intelligence gradients, BBC ambients

### Hybrid
- **When**: one dominant dark region + lighter accent glows at varying sharpness
- **CSS pattern**: dominant-colour base gradient + accent regions as mesh-style positioned blobs with per-group blur
- **Best for**: moody dark gradients with localised warm/bright spots

### Organic
- **When**: images with distinctive shape features — waves, wisps, ribbons, petals, or high type diversity in contours. Recommended for photographs with rich depth and directional elements.
- **Pattern**: CSS base gradient + inline `<svg>` with per-shape `<path>` elements and 5-tier blur filters + noise overlay
- **Best for**: landscape photos, sunsets, scenes with depth, any reference with distinct colour zones at varying depths
- **Key advantage**: each shape gets its own blur tier, creating perceptual depth that CSS-only strategies cannot achieve
- **Container minimum**: ~250px wide. Below this, SVG shape detail is not perceptible under blur — use CSS-only strategies instead.

The classifier considers:
- Region count (2-3 → simple, 4+ → mesh/hybrid/organic)
- Spatial linearity via PCA (high → simple, low → mesh)
- Edge sharpness variance (high → hybrid with multi-tier blur)
- Dominant region weight (>50% → hybrid)
- Distinctive contour count (waves, wisps, ribbons, petals → organic)
- Contour type diversity (3+ different types → organic)
- Spatial richness (many colours + distinctive contours → organic)

---

## Layer Architecture

Every gradient uses a layered stack. The container must have `position: relative`
and `overflow: hidden`.

### Standard stack (simple / single-tier mesh/hybrid)

```
┌─────────────────────────────────┐
│  z-index: 3  — Content (text)   │
├─────────────────────────────────┤
│  z-index: 2  — ::after (noise)  │
├─────────────────────────────────┤
│  z-index: 1  — ::before (blur)  │
├─────────────────────────────────┤
│  z-index: 0  — Element (base)   │
│  (base gradient + vignette)     │
└─────────────────────────────────┘
```

### Multi-tier stack (hybrid/mesh with wide sharpness variance)

When the edge sharpness range across regions exceeds 0.4, blobs are split into
sharp and diffuse tiers on separate layers.  This requires an inner wrapper div.

```
┌──────────────────────────────────────┐
│  z-index: 4  — Content (text)        │
├──────────────────────────────────────┤
│  z-index: 3  — inner::after (noise)  │
├──────────────────────────────────────┤
│  z-index: 2  — inner::before (sharp) │
├──────────────────────────────────────┤
│  z-index: 1  — outer::before (diff)  │
├──────────────────────────────────────┤
│  z-index: 0  — outer (base gradient) │
└──────────────────────────────────────┘
```

HTML:
```html
<div class="gradient-container">
  <div class="gradient-container-inner">
    <!-- content -->
  </div>
</div>
```

---

## Layer 1: Base Gradient

The base layer is a `linear-gradient()` or `radial-gradient()` set directly as
the `background` of the container element. It establishes the overall colour
direction and tone.

**Guidelines:**
- Use the two darkest / most dominant colours from the palette.
- Derive the angle from the spatial relationship between the two colours:
  `angle = atan2(dy, dx) * 180/π + 90`
- For images dominated by a single hue, use a subtle gradient between two
  shades of that hue (e.g. dark brown → medium brown for an amber image).
- For hybrid strategy: the dominant (heaviest + darkest) region becomes one
  end of the base; the next darkest accent region becomes the other end.

```css
.container {
  background: linear-gradient(160deg, #1A1200 0%, #3D2800 100%);
}
```

---

## Layer 2: Vignette

If the analyser detects vignette (edges darker than centre), layer a radial
gradient on top of the base:

```css
.container {
  background:
    radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.3) 100%),
    linear-gradient(160deg, #1A1200 0%, #3D2800 100%);
}
```

**Parameters:**
- `transparent 40%` — the clear centre size; increase for a tighter vignette
- `rgba(0,0,0,N)` — opacity N from `vignette.strength * 0.6`

---

## Layer 3: Blurred Colour Blobs (::before)

This is the most impactful layer. It creates the "blurred photograph" effect
using multiple radial gradients with CSS blur.

### Radial Gradient Positioning

Each colour cluster from the analyser maps to one `radial-gradient()`:

```css
radial-gradient(
  circle at <x>% <y>%,       /* from colors[i].position */
  rgba(R,G,B, <opacity>) 0%, /* opacity from colors[i].weight */
  transparent <radius>%       /* radius from colors[i].spread × edgeSharpness */
)
```

### Edge Sharpness → Gradient Stop Radius

The `edgeSharpness` value modulates the transparent stop:
- Sharp region (edgeSharpness ~1): `radius *= 0.6` — tighter, more defined blob
- Diffuse region (edgeSharpness ~0): `radius *= 1.3` — wider, softer blob

### Variable Blur (Per-Region Depth)

Instead of one blur value for all blobs, GradientBro adjusts blur per region:

**Single-tier** (sharpness range ≤ 0.4):
All blobs share one `filter: blur(Npx)`, but the gradient stop radius already
encodes sharpness differences. The global blur is set from the image's overall
blur level.

**Multi-tier** (sharpness range > 0.4):
Blobs are grouped into sharp (edgeSharpness ≥ 0.5) and diffuse (< 0.5) tiers.
Each tier gets its own pseudo-element layer with its own blur amount:

| Tier    | Blur amount              | inset      | Effect                     |
|---------|--------------------------|------------|----------------------------|
| Sharp   | 5-20px (low)             | -10% -15%  | Defined glow, clear edge   |
| Diffuse | globalBlur × 1.1 (heavy) | -30% -40%  | Soft wash, atmospheric     |

This separation creates perceptual depth — sharp objects appear "in front"
of diffuse washes, mimicking real-world light behaviour.

### The Blur Trick

Apply `filter: blur(Npx)` to the pseudo-element. **Critical:** Blur causes
visible edges at the container boundary. To prevent this, extend the
pseudo-element beyond the container:

```css
.container::before {
  content: '';
  position: absolute;
  inset: -25%;           /* extend 25% beyond each edge */
  background: ...;       /* radial gradients */
  filter: blur(50px);    /* heavy blur */
  pointer-events: none;
}
```

### Blur Radius Guidelines

| Blur Level | blur()   | inset     | Visual Effect                  |
|------------|----------|-----------|--------------------------------|
| heavy      | 50-80px  | -25% -30% | Dreamy, deeply out-of-focus   |
| medium     | 25-45px  | -15% -20% | Soft, gentle bokeh            |
| light      | 10-20px  | -10%      | Slightly softened edges        |
| none       | 0        | 0         | Sharp colour blobs             |

### Opacity Mapping

```
opacity = min(0.9, 0.4 + colors[i].weight)
```

### Spread Mapping

```
baseRadius% = 30 + spread * 40
actualRadius% = baseRadius * sharpnessFactor
```

Where `sharpnessFactor = 1.3 - edgeSharpness * 0.7`.

---

## Layer 4: Noise Overlay (::after)

SVG `feTurbulence` generates procedural Perlin noise without any image file.
It is encoded as an inline data URI.

### The SVG Filter

```xml
<svg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'>
  <filter id='n'>
    <feTurbulence
      type='fractalNoise'
      baseFrequency='0.65'
      numOctaves='4'
      stitchTiles='stitch'
    />
  </filter>
  <rect width='100%' height='100%' filter='url(#n)'/>
</svg>
```

### feTurbulence Parameters

| Parameter       | Effect                                        | Range     |
|-----------------|-----------------------------------------------|-----------|
| `baseFrequency` | Grain size. Lower = coarser, higher = finer.  | 0.3 – 1.0 |
| `numOctaves`    | Detail richness. More = crisper grain texture. | 2 – 6     |
| `type`          | `fractalNoise` (organic) vs `turbulence` (swirly) | —    |
| `stitchTiles`   | `stitch` for seamless tiling                  | —         |

### Default Grain Values

Grain uses strong fixed defaults — do NOT derive values from the analyser's
`noise` object. The analyser noise data is informational only.

| Parameter       | Default | Range       | Effect                            |
|-----------------|---------|-------------|-----------------------------------|
| `baseFrequency` | `0.45`  | 0.30 – 1.0 | Grain size (lower = coarser)      |
| `numOctaves`    | `6`     | 2 – 6       | Crispness (higher = sharper)      |
| `opacity`       | `0.9`   | 0.03 – 1.0 | Visibility (with overlay blend)   |

These defaults produce a coarse, pronounced grain texture. With
`mix-blend-mode: overlay`, opacity 0.9 creates strong grain impact
without obscuring the gradient underneath.

**User override presets** (apply when user requests a specific grain style):

| Request                    | baseFrequency | numOctaves | opacity |
|----------------------------|---------------|------------|---------|
| "subtle" / "light grain"  | 0.75          | 3          | 0.08    |
| "film-like"               | 0.55          | 4          | 0.50    |
| "coarse" / "chunky"       | 0.30          | 3          | 0.80    |
| "maximum grain"            | 0.45 (default)| 6          | 1.0 + `filter: contrast(2.5)` |
| "no grain"                 | —             | —          | — (omit `::after`) |

**Beyond opacity 1.0 — contrast boost:** When the user wants grain more
pronounced than the default, add `filter: contrast(N)` to the `::after`
element. This amplifies the noise texture's light/dark values before the
overlay blend mode is applied. Start at `contrast(1.5)`, increase by 0.5
per step. Values up to 3.0-3.5 produce very aggressive grain; above that
it starts to posterize.

Users can also fine-tune grain in follow-up prompts (see refinement guide).

### Noise Overlay CSS

```css
.container::after {
  content: '';
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,...");
  opacity: 0.12;
  mix-blend-mode: overlay;
  pointer-events: none;
  border-radius: inherit;
}
```

### Blend Mode and Brightness-Adaptive Opacity

Always use `mix-blend-mode: overlay` at `opacity: 1.0`. Overlay blends
the noise texture with the gradient — at full opacity it produces maximum
grain impact while still allowing the gradient colours to show through.
This works on both dark and light images without adjustment.

Manual override options (for special cases):

| Mode        | Effect                                           | Best for              |
|-------------|--------------------------------------------------|-----------------------|
| `overlay`   | Preserves colour, adds contrast to noise         | Default — always use  |
| `multiply`  | Darkens — noise acts like shadow grain           | Very dark, moody      |
| `screen`    | Lightens — noise acts like light speckles        | Very bright, ethereal |

---

## Layer 5: Content Z-Index

Ensure all content inside the container sits above the gradient layers:

```css
/* Standard stack */
.container > * {
  position: relative;
  z-index: 3;
}

/* Multi-tier stack (with inner wrapper) */
.container-inner > * {
  position: relative;
  z-index: 4;
}
```

---

## Fidelity Levels

### Exact

- 6-8 colour clusters
- Full variable blur with per-region sharpness
- Noise with up to `numOctaves: 6`, continuous baseFrequency
- Vignette with fine-tuned opacity
- Multi-tier blur when sharpness variance warrants it

### Vibe (default)

- 4-5 colour clusters
- Variable blur with per-region gradient stop adjustment
- Noise with up to `numOctaves: 5`
- Vignette if detected

### Inspired

- 2-3 colour clusters
- Simple blur or none
- Noise with `numOctaves: 2-3` or omitted
- No vignette

---

## SVG Shape Layer (Organic Strategy)

When the analyser outputs `strategy: "organic"`, the gradient uses inline SVG
instead of CSS `::before` for shape layers. This enables arbitrary shapes with
per-shape blur — something CSS radial/linear gradients cannot achieve.

### Layer Stack (Organic)

```
┌─────────────────────────────────────────┐
│  z-index: 3  — Content (text etc.)      │
├─────────────────────────────────────────┤
│  z-index: 2  — ::after (noise overlay)  │
├─────────────────────────────────────────┤
│  z-index: 1  — <svg> (shape layers)     │
│    ├─ <defs> blur filters (5 tiers)     │
│    ├─ shapes at b1 (atmospheric)        │
│    ├─ shapes at b2 (heavy)              │
│    ├─ shapes at b3 (medium)             │
│    ├─ shapes at b4 (light)              │
│    └─ shapes at b5 (crisp)             │
├─────────────────────────────────────────┤
│  z-index: 0  — Element (base gradient)  │
└─────────────────────────────────────────┘
```

### SVG Element Setup

```css
.gradient-shapes {
  position: absolute;
  inset: -15%;
  width: 130%;
  height: 130%;
  z-index: 1;
  pointer-events: none;
}
```

The SVG uses `viewBox="0 0 100 100"` with `preserveAspectRatio="none"` so all
coordinates are 0-100 normalised space matching the analyser's 0-1 positions
(multiply by 100).

### 5-Tier Blur Filter System

```xml
<defs>
  <!-- CRITICAL: x/y/width/height prevent blur clipping artifacts -->
  <filter id="b1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
  <filter id="b2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
  <filter id="b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4.5"/></filter>
  <filter id="b4" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.5"/></filter>
  <filter id="b5" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.4"/></filter>
</defs>
```

The `x="-50%" y="-50%" width="200%" height="200%"` attributes expand the filter
region well beyond the shape boundary. Without this, SVG clips the blur at
~10% padding, creating hard edges where a blurred shape meets the filter
boundary — this is the #1 cause of unintended sharp lines in organic gradients.

Map `contour.blur` (0-1) to tier:
- 0.0–0.2 → b5 (crisp foreground, stdDeviation 0.4)
- 0.2–0.4 → b4 (semi-defined, stdDeviation 1.5)
- 0.4–0.6 → b3 (mid-ground, stdDeviation 4.5)
- 0.6–0.8 → b2 (heavy background, stdDeviation 9)
- 0.8–1.0 → b1 (deep atmospheric, stdDeviation 18)

The tiers are deliberately spaced far apart — the jump from b5 (0.4) to
b1 (18) is 45x, creating strong perceptual depth. Every gradient should use
shapes at 3+ distinct tiers to avoid the "everything looks equally blurry"
problem.

Custom tiers: for exact fidelity, add additional `<filter>` elements with
precise `stdDeviation` values tuned to the reference image.

### Shape Type Templates

#### Waves

Closed bezier band forming a sinusoidal flowing ribbon. Used for diagonal
colour bands (Archetype B: pastel wave bands).

```xml
<!-- Upper edge: sine curve. Lower edge: offset sine. Closed into a band. -->
<path d="M-5,{y0} C{c1x},{c1y} {c2x},{c2y} {x1},{y1}
         S{s1x},{s1y} 105,{ye}
         V{ye+thickness}
         S{s1x},{s1y+thickness} {x1},{y1+thickness}
         C{c2x},{c2y+thickness} {c1x},{c1y+thickness} -5,{y0+thickness} Z"
      fill="rgba(R,G,B,A)" filter="url(#b3)"/>
```

Parameters from `contour`:
- `amplitude` → Y-offset of control points from the baseline
- `frequency` → number of S-curve segments
- `thickness` → vertical gap between upper and lower edges
- `direction` → rotation angle for the whole path

#### Wisps

Thin stroked bezier curves. Used for accent streaks and light trails.

```xml
<path d="M{x0},{y0} Q{cx},{cy} {x1},{y1}"
      stroke="rgba(R,G,B,A)" stroke-width="{w}"
      stroke-linecap="round" fill="none"
      filter="url(#b4)"/>
```

#### Veils

Large closed organic shapes with curved quadratic edges. Used for broad
translucent colour washes (Archetype F: sunset bands).

```xml
<path d="M{p0x},{p0y} Q{c1x},{c1y} {p1x},{p1y}
         Q{c2x},{c2y} {p2x},{p2y}
         Q{c3x},{c3y} {p3x},{p3y} Z"
      fill="rgba(R,G,B,A)" filter="url(#b2)"/>
```

#### Angular Veils

Large shapes with straighter edges meeting at angles. Used for tilted
translucent panes (Archetype A: pink/orange angular).

```xml
<path d="M{v0x},{v0y} L{v1x},{v1y} L{v2x},{v2y} L{v3x},{v3y} Z"
      fill="rgba(R,G,B,A)" filter="url(#b2)"/>
```

Use the `vertices` array from the contour as guide points.

#### Ribbons

Variable-width flowing bands with defined edges. Used for bold streaks
cutting through (Archetype C: blue dramatic).

```xml
<path d="M{ts_x},{ts_y} C{tc1x},{tc1y} {tc2x},{tc2y} {te_x},{te_y}
         L{be_x},{be_y} C{bc2x},{bc2y} {bc1x},{bc1y} {bs_x},{bs_y} Z"
      fill="rgba(R,G,B,A)" filter="url(#b5)"/>
```

Ribbons typically use crisp or light blur tiers (b4/b5) for defined edges.

#### Petals

Organic teardrop/leaf shapes with pointed tips. Used for botanical/flame
forms (Archetype E: orange petals).

```xml
<path d="M{tip_x},{tip_y}
         C{tip_x+dx1},{tip_y+dy1} {body_cx},{far_y-dy2} {body_cx},{far_y}
         C{body_cx},{far_y+dy2} {tip_x-dx1},{tip_y+dy1} {tip_x},{tip_y} Z"
      fill="rgba(R,G,B,A)" filter="url(#b4)"/>
```

Use `tipPoint` for the pointed vertex and `bodyWidth` to set control point
spread perpendicular to the tip-to-base axis.

### Block-First Opacity Rules

The #1 cause of muddy gradients is too many semi-transparent shapes
overlapping. Follow the 3-phase block-first model:

**Phase 1 — Opaque colour blocks** (the foundation):
- Opacity **0.85-1.0** — these are nearly solid colour fills
- Shapes are **adjacent, not overlapping** — like puzzle pieces
- Each distinct colour zone gets its own block
- Use b2-b3 blur tiers so edges blend softly
- This phase alone should look like a simplified version of the reference

**Phase 2 — Transition blends** (zone boundaries only):
- Opacity **0.2-0.5** — subtle smoothing
- Placed ONLY where Phase 1 blocks meet, never over block centres
- 3-5 shapes maximum

**Phase 3 — Detail and texture** (lightest touches):
- Wisps, accent highlights at low opacity
- Grain overlay

**Critical:** If Phase 1 blocks produce a muddy result, the blocks
themselves are wrong (wrong colours, too much overlap). Fix Phase 1
before adding Phase 2/3 — more transparent layers cannot fix bad blocks.

### SVG Gradient Fills (Natural Edge Falloff)

Flat `fill="rgba(R,G,B,A)"` makes shapes feel like vector cutouts. For
shapes that should feel like **light, glow, or atmospheric masses**, use
SVG `<radialGradient>` or `<linearGradient>` as the fill paint server.
This makes shapes fade from opaque in the centre to transparent at the
edges — like actual light rather than a filled area.

#### Radial gradient fill (glow shapes, light masses)

```xml
<defs>
  <radialGradient id="glow1" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="rgb(180,180,180)" stop-opacity="0.9"/>
    <stop offset="60%" stop-color="rgb(180,180,180)" stop-opacity="0.5"/>
    <stop offset="100%" stop-color="rgb(180,180,180)" stop-opacity="0"/>
  </radialGradient>
</defs>
<path d="..." fill="url(#glow1)" filter="url(#b4)"/>
```

Use for: glowing curves, light streaks, bright accents, cloud masses,
any shape that should radiate from a bright core.

#### Linear gradient fill (directional fades)

```xml
<defs>
  <!-- Fades from opaque at top to transparent at bottom -->
  <linearGradient id="fade1" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="rgb(180,180,180)" stop-opacity="0.85"/>
    <stop offset="100%" stop-color="rgb(180,180,180)" stop-opacity="0"/>
  </linearGradient>
</defs>
<path d="..." fill="url(#fade1)" filter="url(#b3)"/>
```

Use for: shapes that should fade in one direction (a ridge that glows on
top and fades below, a horizon band that fades upward).

#### When to use gradient fills vs flat fills

| Shape type | Fill approach |
|-----------|--------------|
| Phase 1 opaque colour blocks (solid zones) | **Flat fill** at 0.85-1.0 opacity |
| Dark silhouettes (mountains, rocks) | **Flat fill** — uniformly dark |
| Glowing curves, light streaks | **Radial gradient fill** — bright centre, fades at edges |
| Cloud masses, atmospheric glow | **Radial gradient fill** — puffy, bright core |
| Ridges, horizon glows, directional forms | **Linear gradient fill** — fades in one direction |
| Phase 2 transition blends | **Flat fill** at low opacity (0.2-0.5) — these are subtle |

---

## Photograph Abstraction Techniques

These techniques apply when the reference image is a photograph (landscape,
portrait, architecture, etc.) rather than an abstract gradient. They help
translate photographic richness into painterly abstract gradients.

### Focal Radiance (CSS Radial Gradients)

Suns, light sources, glows, and bright focal points must be rendered as
CSS `radial-gradient()` layered in the container's `background` property —
NOT as SVG shapes. CSS radial gradients produce natural, smooth radiance
with soft falloff, while SVG circles with feGaussianBlur create
hard-edged blobs that look artificial.

**Technique:** Stack one or more `radial-gradient()` calls BEFORE the base
`linear-gradient` in the CSS `background` shorthand:

```css
.container {
  background:
    /* Sun glow: bright core, soft falloff */
    radial-gradient(ellipse at 50% 38%,
      rgba(255,235,190,0.85) 0%,
      rgba(250,160,90,0.5) 12%,
      transparent 40%),
    /* Warm ambient bloom around the sun */
    radial-gradient(ellipse at 50% 40%,
      rgba(240,120,60,0.3) 0%,
      transparent 55%),
    /* Base gradient */
    linear-gradient(180deg, #3a2644 0%, #50416a 25%, #73304b 70%, #3a2644 100%);
}
```

Guidelines:
- Use 2-3 stacked `radial-gradient()` for a rich glow (bright core + warm bloom + ambient wash)
- Position with `ellipse at X% Y%` matching the focal point location
- The innermost gradient should be bright and tight (0% bright, 10-15% mid, 35-45% transparent)
- The outer bloom should be wide and subtle (0% warm, 50-60% transparent)
- For horizontal radiance (horizon glow), use wide ellipses
- For point radiance (sun, lamp), use rounder ellipses
- Colours warm toward the core: deep orange → peach → cream → near-white
- This approach is simpler, faster, and looks more natural than SVG alternatives

### Cloud Masses

For chunky, puffy clouds (cumulus, cloud banks, large white formations),
use **filled shapes with radial gradient fills**, NOT thin wisps. Cloud
masses are the dominant cloud type in most landscape photos.

```xml
<defs>
  <radialGradient id="cloud1" cx="50%" cy="45%" r="55%">
    <stop offset="0%" stop-color="rgb(220,230,245)" stop-opacity="0.85"/>
    <stop offset="50%" stop-color="rgb(200,215,240)" stop-opacity="0.5"/>
    <stop offset="100%" stop-color="rgb(180,200,235)" stop-opacity="0"/>
  </radialGradient>
</defs>
<!-- Cloud mass: puffy, bright centre, fades at edges -->
<path d="M20,18 Q30,12 42,15 Q52,18 55,24 Q52,30 42,32 Q30,30 22,26 Q18,22 20,18 Z"
      fill="url(#cloud1)" filter="url(#b3)"/>
```

Guidelines:
- Use `fill` with a `radialGradient`, NOT `stroke`
- The gradient centre (`cx`, `cy`) should be slightly above the shape
  centre to simulate top-lit clouds
- Opacity fades from 0.7-0.9 at core to 0 at edges — no hard boundary
- Use organic closed shapes (Q/C curves), not rectangles
- For multiple clouds, each gets its own gradient ID and shape
- Cloud masses belong in Phase 1 (they're distinct colour blocks) at b3-b4
- Use b3 for large distant clouds, b4 for smaller foreground clouds

### Cloud Wisps

For thin, wispy clouds (cirrus streaks, high-altitude texture), use
**thin stroked paths**. Wisps are for thin texture ONLY — use Cloud Masses
above for chunky clouds. Multiple wisps at slightly different Y positions
and colours create layered sky texture.

**CRITICAL — Wisp filter region:** Stroked paths have thin bounding boxes.
The standard `x="-50%" y="-50%" width="200%" height="200%"` filter region
is relative to the bounding box, which for a horizontal wisp is only a few
pixels tall. This causes the blur to clip, creating hard edges.

**Fix:** Use `filterUnits="userSpaceOnUse"` for filters applied to wisps.
This makes the filter region absolute (in viewBox units) rather than relative
to the shape's bounding box:

```xml
<!-- In <defs>, add wisp-specific filters alongside the standard ones -->
<filter id="bw2" filterUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="140">
  <feGaussianBlur stdDeviation="9"/>
</filter>
<filter id="bw3" filterUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="140">
  <feGaussianBlur stdDeviation="4.5"/>
</filter>
<filter id="bw4" filterUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="140">
  <feGaussianBlur stdDeviation="1.5"/>
</filter>
```

Then reference these `bw*` filters (instead of `b*`) on wisp paths:

```xml
<!-- Cloud wisp: thin, organic, slightly curved -->
<path d="M5,18 Q25,14 45,16 Q60,19 75,15 Q88,12 95,16"
      stroke="rgba(190,140,170,0.35)" stroke-width="4"
      stroke-linecap="round" fill="none" filter="url(#bw3)"/>
<!-- Second wisp: slightly different path and colour -->
<path d="M-5,22 Q18,18 38,21 Q55,24 72,20 Q90,17 105,21"
      stroke="rgba(160,120,155,0.3)" stroke-width="3"
      stroke-linecap="round" fill="none" filter="url(#bw3)"/>
<!-- Higher wisp: thinner, fainter -->
<path d="M10,12 Q30,9 50,11 Q70,14 90,10"
      stroke="rgba(180,160,190,0.25)" stroke-width="2.5"
      stroke-linecap="round" fill="none" filter="url(#bw2)"/>
```

Guidelines:
- **Always** use `bw*` (userSpaceOnUse) filters for stroked wisps, never `b*`
- Use `stroke` with `fill="none"` for natural cloud-like thinness
- `stroke-width` 2-5 in viewBox units (100x100 space)
- `stroke-linecap="round"` prevents harsh line ends
- Vary Y positions by 3-8 units for a layered sky feel
- Use warmer colours for clouds catching sunset light, cooler for shadows
- Cloud wisps typically belong in Pass 3 (medium blur, bw3) but use
  bw2 for higher/fainter clouds and bw4 for brighter cloud edges

### Colour Zone Banding

Photographs often have horizontal (or diagonal) colour bands — sky layers,
terrain gradations, water reflections. Reproduce these as broad wave shapes
with distinct colours per band, rather than one large veil:

```xml
<!-- Sky band 1: deep indigo, upper (b1) -->
<path d="M-15,-10 H115 V20 Q80,25 50,22 Q20,19 -15,24 Z"
      fill="rgba(58,38,68,0.5)" filter="url(#b1)"/>
<!-- Sky band 2: dusty purple, mid-sky (b2) -->
<path d="M-15,15 Q20,12 50,14 Q80,16 115,13 V32
         Q80,36 50,34 Q20,32 -15,36 Z"
      fill="rgba(80,65,106,0.4)" filter="url(#b2)"/>
<!-- Sky band 3: mauve-pink, lower sky (b2) -->
<path d="M-15,28 Q20,25 50,27 Q80,29 115,26 V42
         Q80,46 50,44 Q20,42 -15,46 Z"
      fill="rgba(136,114,154,0.4)" filter="url(#b2)"/>
```

Each band uses a slightly different colour from the palette inventory
(Step 4, Track B), preventing the "one big flat colour" problem.

---

## Advanced Techniques

### Multiple Blur Layers (multi-tier)

When edge sharpness variance is high, create an extra wrapper div for
additional layers:

```html
<div class="gradient-container">
  <div class="gradient-container-inner">
    <!-- content -->
  </div>
</div>
```

```css
.gradient-container { position: relative; overflow: hidden; }
.gradient-container::before { /* diffuse tier: heavy blur blobs */ }
.gradient-container-inner { position: relative; z-index: 2; }
.gradient-container-inner::before { /* sharp tier: low blur blobs */ }
.gradient-container-inner::after  { /* noise overlay */ }
.gradient-container-inner > *     { position: relative; z-index: 4; }
```

### Animated Noise (optional)

For subtle animation, slightly shift the SVG viewBox with CSS animation:

```css
@keyframes grain-drift {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-5%, -5%); }
}
.container::after {
  animation: grain-drift 8s ease-in-out infinite;
}
```

### Canvas-Based Noise (Exact fidelity)

For finer control, generate noise with a small canvas script:

```javascript
function generateNoise(canvas, intensity = 0.15) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() * 255;
    data[i] = data[i+1] = data[i+2] = v;
    data[i+3] = intensity * 255;
  }
  ctx.putImageData(imageData, 0, 0);
}
```

Use this as a background via `canvas.toDataURL()` when SVG feTurbulence
doesn't provide enough control.

---

## Browser Compatibility

| Feature            | Chrome | Firefox | Safari | Edge |
|--------------------|--------|---------|--------|------|
| CSS gradients      | 26+    | 16+     | 6.1+   | 12+  |
| SVG as CSS bg      | 5+     | 24+     | 5+     | 16+  |
| CSS filter (blur)  | 18+    | 35+     | 6+     | 79+  |
| mix-blend-mode     | 41+    | 32+     | 8+     | 79+  |
| backdrop-filter    | 76+    | 103+    | 9+     | 17+  |

All techniques used are supported in modern browsers (2020+). No polyfills needed.

---

## Common Patterns by Mood

### Warm / Amber
- Base: dark brown → medium brown
- Blobs: amber, gold, ochre — positioned center-left and center
- Blur: heavy on diffuse regions, moderate on bright spots
- Noise: medium frequency, 0.12-0.20 opacity, overlay blend
- Vignette: subtle (0.2-0.3)
- Strategy: hybrid (dark base + warm accent glows)

### Dark / Moody
- Base: near-black → very dark brown/green
- Blobs: warm amber glow off-center, dark teal accent
- Blur: heavy overall with one sharper accent
- Noise: medium-fine, 0.15-0.25 opacity, overlay blend
- Vignette: strong (0.4-0.5)
- Strategy: hybrid

### Soft / Pink / Airy
- Base: soft pink → cream
- Blobs: peach, rose, white highlights, one darker accent
- Blur: medium-heavy (40-50px), mostly uniform
- Noise: fine, 0.05-0.10 opacity, soft-light blend
- Vignette: none or very subtle
- Strategy: simple or mesh (depending on colour count)

### Complex Multi-Colour
- Base: darkest two colours as linear gradient
- Blobs: 5-8 positioned colour sources at varying sharpness
- Blur: multi-tier (sharp + diffuse)
- Noise: medium, 0.10-0.15 opacity, overlay blend
- Vignette: moderate
- Strategy: mesh
