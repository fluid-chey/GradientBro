# GradientBro — CSS Technique Reference

This document is the comprehensive reference for generating complex textural
gradients in pure CSS. The Cursor agent should read this before writing any
gradient CSS.

---

## Layer Architecture

Every gradient uses a 5-layer stack. The container must have `position: relative`
and `overflow: hidden`.

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
using multiple radial gradients with heavy CSS blur.

### Radial Gradient Positioning

Each colour cluster from the analyser maps to one `radial-gradient()`:

```css
radial-gradient(
  circle at <x>% <y>%,       /* from colors[i].position */
  rgba(R,G,B, <opacity>) 0%, /* opacity from colors[i].weight */
  transparent <radius>%       /* radius from colors[i].spread */
)
```

### The Blur Trick

Apply `filter: blur(Npx)` to the `::before` element. This creates the soft,
out-of-focus look.

**Critical:** Blur causes visible edges at the container boundary. To prevent
this, extend the pseudo-element beyond the container:

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

Heavier clusters (more pixels) get higher opacity because they represent
larger colour regions in the reference.

### Spread Mapping

```
radius% = 30 + spread * 40
```

Where `spread` is 0-1 from the analyser. A spread of 0.5 means the colour
region covers about half the image, so the gradient fades to transparent at 50%.

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
| `numOctaves`    | Detail richness. More = more complex texture. | 2 – 6     |
| `type`          | `fractalNoise` (organic) vs `turbulence` (swirly) | —    |
| `stitchTiles`   | `stitch` for seamless tiling                  | —         |

### Frequency → baseFrequency Mapping

| Analysed frequency | baseFrequency | Visual                    |
|--------------------|---------------|---------------------------|
| fine               | 0.80 – 0.95   | Film grain, subtle        |
| medium             | 0.55 – 0.75   | Noticeable texture        |
| coarse             | 0.35 – 0.50   | Gritty, sand-like         |

### Noise Overlay CSS

```css
.container::after {
  content: '';
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,...");
  opacity: 0.12;              /* from noise.intensity * 0.25 */
  mix-blend-mode: overlay;    /* blends naturally with colours */
  pointer-events: none;
  border-radius: inherit;
}
```

### Blend Mode Options

| Mode        | Effect                                           | Best for              |
|-------------|--------------------------------------------------|-----------------------|
| `overlay`   | Preserves colour, adds contrast to noise         | Most cases (default)  |
| `soft-light`| Subtler version of overlay                       | Light / airy images   |
| `multiply`  | Darkens — noise acts like shadow grain           | Dark / moody images   |
| `screen`    | Lightens — noise acts like light speckles        | Bright / ethereal     |

### Opacity Guidelines

```
opacity = noise.intensity * 0.25
```

This keeps noise subtle. Maximum 0.25 even for very noisy references. The
user can always ask for "more grain" to push it higher.

---

## Layer 5: Content Z-Index

Ensure all content inside the container sits above the gradient layers:

```css
.container > * {
  position: relative;
  z-index: 3;
}
```

---

## Fidelity Levels

### Exact

- 6-8 colour clusters
- Full blur layer with precise radius
- Noise with `numOctaves: 5`
- Vignette with fine-tuned opacity
- Consider adding a second wrapper div for additional gradient layers
  beyond `::before` and `::after`

### Vibe (default)

- 4-5 colour clusters
- Standard blur layer
- Noise with `numOctaves: 4`
- Vignette if detected

### Inspired

- 2-3 colour clusters
- Simple blur or none
- Noise with `numOctaves: 3` or omitted
- No vignette

---

## Advanced Techniques

### Multiple Blur Layers (Exact fidelity)

When `::before` and `::after` are both used, create an extra wrapper div for
additional layers:

```html
<div class="gradient-container">
  <div class="gradient-inner">
    <!-- content -->
  </div>
</div>
```

```css
.gradient-container { position: relative; overflow: hidden; }
.gradient-container::before { /* heavy blur blobs */ }
.gradient-container::after  { /* secondary blur blobs or light effects */ }
.gradient-inner::after      { /* noise overlay */ }
.gradient-inner > *         { position: relative; z-index: 5; }
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

### Warm / Amber (like Healthspan middle card)
- Base: dark brown → medium brown
- Blobs: amber, gold, ochre — positioned center-left and center
- Blur: heavy (50-60px)
- Noise: medium frequency, 0.12 opacity, overlay blend
- Vignette: subtle (0.2-0.3)

### Dark / Moody (like Healthspan left card)
- Base: near-black → very dark brown/green
- Blobs: warm amber glow off-center, dark teal accent
- Blur: heavy (60-80px)
- Noise: medium-fine, 0.15 opacity, multiply blend
- Vignette: strong (0.4-0.5)

### Soft / Pink / Airy (like Healthspan right card)
- Base: soft pink → cream
- Blobs: peach, rose, white highlights, one darker accent
- Blur: medium-heavy (40-50px)
- Noise: fine, 0.08-0.10 opacity, soft-light blend
- Vignette: none or very subtle
