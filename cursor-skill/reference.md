# GradientBro — CSS Technique Reference

This document is the comprehensive reference for generating complex textural
gradients in pure CSS. The Cursor agent should read this before writing any
gradient CSS.

---

## Gradient Strategy Selection

GradientBro analyses the reference image and recommends one of three strategies.
The strategy is output as `spec.strategy` in the JSON.

### Simple
- **When**: 2-3 colour regions, linear spatial distribution, uniform edge sharpness
- **CSS pattern**: `linear-gradient` base + single `::before` with blurred radial blobs + `::after` noise
- **Best for**: clean directional sweeps, simple warm-to-cool transitions

### Mesh
- **When**: 4+ colour regions scattered across 2D space, no single dominant region
- **CSS pattern**: dark base + multiple radial gradients grouped into blur tiers + noise overlay
- **Best for**: complex multi-colour blends like Apple Intelligence gradients, BBC ambients

### Hybrid (most common)
- **When**: one dominant dark region + lighter accent glows at varying sharpness
- **CSS pattern**: dominant-colour base gradient + accent regions as mesh-style positioned blobs with per-group blur
- **Best for**: moody dark gradients with localised warm/bright spots

The classifier considers:
- Region count (2-3 → simple, 4+ → mesh/hybrid)
- Spatial linearity via PCA (high → simple, low → mesh)
- Edge sharpness variance (high → hybrid with multi-tier blur)
- Dominant region weight (>50% → hybrid)

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
<svg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'>
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

### Enhanced Noise Parameter Mapping

The analyser now outputs continuous values for precise noise replication:

**baseFrequency** — Use `noise.baseFrequency` directly (0.3-1.0). No categorical conversion needed.

**numOctaves** — Derived from `noise.sharpness`:
- Low sharpness (0-0.3): 2-3 octaves (smooth, soft noise)
- Medium sharpness (0.3-0.7): 3-5 octaves
- High sharpness (0.7-1.0): 5-6 octaves (crispy film grain)

**opacity** — Derived from `noise.intensity × (0.15 + noise.contrast × 0.35)`:
- Faint, low-contrast noise: ~0.03-0.08 (barely visible)
- Moderate noise: ~0.10-0.20 (noticeable texture)
- Heavy, punchy grain: ~0.25-0.50 (strong stylised grain)

This replaces the old `intensity * 0.25` cap that kept noise too subtle.

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

### Blend Mode Selection

Auto-selected based on image mood:

| Mood brightness       | Blend mode   | Reason                              |
|-----------------------|-------------|--------------------------------------|
| dark / medium-dark    | `overlay`   | Preserves colour, adds grain bite    |
| bright / medium-bright| `soft-light`| Subtler, avoids washing out lights   |
| dark + high contrast  | `overlay`   | Punchy grain needs strong blending   |

Manual override options:

| Mode        | Effect                                           | Best for              |
|-------------|--------------------------------------------------|-----------------------|
| `overlay`   | Preserves colour, adds contrast to noise         | Most cases (default)  |
| `soft-light`| Subtler version of overlay                       | Light / airy images   |
| `multiply`  | Darkens — noise acts like shadow grain           | Dark / moody images   |
| `screen`    | Lightens — noise acts like light speckles        | Bright / ethereal     |

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
