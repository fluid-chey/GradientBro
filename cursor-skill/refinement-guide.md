# GradientBro — Refinement Guide

When the user asks to adjust a generated gradient, modify the existing CSS
directly. Do NOT re-run the analysis pipeline. This guide maps natural-language
requests to specific CSS parameter changes.

---

## Quick Reference Table

| User says | Layer | Property to change | Direction |
|-----------|-------|--------------------|-----------|
| "more grain" / "grainier" / "more noise" | `::after` | `opacity` | Increase by 0.05-0.10 |
| "more grain" (alternative) | `::after` SVG | `baseFrequency` | Decrease by 0.1 (coarser = more visible) |
| "less grain" / "smoother" | `::after` | `opacity` | Decrease by 0.05-0.10 |
| "finer grain" | `::after` SVG | `baseFrequency` | Increase by 0.1-0.15 |
| "coarser grain" | `::after` SVG | `baseFrequency` | Decrease by 0.1-0.15 |
| "sharper grain" / "crispier grain" | `::after` SVG | `numOctaves` | Increase by 1-2 (more detail) |
| "softer grain" | `::after` SVG | `numOctaves` | Decrease by 1-2 (smoother) |
| "punchier grain" / "more contrast on grain" | `::after` | `opacity` | Increase by 0.08-0.15 (higher ceiling of 0.50) |
| "more blur" / "dreamier" / "softer" | blur layer(s) | `filter: blur()` | Increase by 10-20px |
| "less blur" / "sharper" | blur layer(s) | `filter: blur()` | Decrease by 10-20px |
| "sharper edges" / "more defined shapes" | sharp tier | `filter: blur()` | Decrease by 5-10px; tighten gradient stops |
| "more depth" | both tiers | blur gap | Increase sharp/diffuse gap: lower sharp blur, raise diffuse blur |
| "less depth" / "flatter" | both tiers | blur gap | Converge sharp and diffuse blur toward a single value |
| "darker" / "moodier" | base | gradient colours | Darken hex values |
| "darker" (alternative) | base | vignette opacity | Increase by 0.1-0.15 |
| "lighter" / "airier" | base | gradient colours | Lighten hex values |
| "lighter" (alternative) | base | vignette opacity | Decrease or remove |
| "more contrast" | base | colour stops | Widen brightness gap between stops |
| "less contrast" | base | colour stops | Narrow brightness gap |
| "shift [colour] left" | blur layer | radial-gradient `at X% Y%` | Decrease X% by 10-15 |
| "shift [colour] right" | blur layer | radial-gradient `at X% Y%` | Increase X% by 10-15 |
| "shift [colour] up" | blur layer | radial-gradient `at X% Y%` | Decrease Y% by 10-15 |
| "shift [colour] down" | blur layer | radial-gradient `at X% Y%` | Increase Y% by 10-15 |
| "make [colour] bigger" | blur layer | radial-gradient `transparent N%` | Increase N% by 10-15 |
| "make [colour] smaller" | blur layer | radial-gradient `transparent N%` | Decrease N% by 10-15 |
| "more [colour]" / "add more amber" | blur layer | radial-gradient opacity | Increase rgba alpha by 0.1-0.2 |
| "less [colour]" | blur layer | radial-gradient opacity | Decrease rgba alpha by 0.1-0.2 |
| "add a colour" / "add blue" | blur layer | background | Add new radial-gradient() |
| "remove [colour]" | blur layer | background | Remove the matching radial-gradient() |
| "stronger vignette" | base | vignette gradient | Increase edge opacity |
| "no vignette" | base | vignette gradient | Remove the radial-gradient |

---

## Detailed Parameter Adjustments

### Noise Opacity

The default grain is fine, crisp, and pronounced: `baseFrequency='0.9'`,
`numOctaves='6'`, `opacity: 0.45`. All refinements adjust from this baseline.

```css
/* Default: pronounced crisp grain */
.container::after { opacity: 0.45; }

/* After: "more grain" */
.container::after { opacity: 0.55; }

/* After: "less grain" */
.container::after { opacity: 0.30; }
```

- Minimum sensible: 0.03 (barely perceptible)
- Maximum sensible: 0.50 (very grainy, stylised)
- Step size: 0.05 – 0.10 per refinement

### Noise Frequency (baseFrequency in SVG)

The SVG is URL-encoded in the `background` property. To change it, decode
mentally, adjust the number, re-encode.

```
baseFrequency='0.65'  →  baseFrequency='0.55'  (coarser)
baseFrequency='0.65'  →  baseFrequency='0.80'  (finer)
```

Range: 0.3 (very coarse) to 1.0 (very fine)
Step size: 0.10 – 0.15 per refinement

### Noise Crispness (numOctaves in SVG)

```
numOctaves='3'  →  numOctaves='5'  (crispier, more defined grain)
numOctaves='5'  →  numOctaves='3'  (softer, less defined)
```

Range: 2 (very soft) to 6 (very crispy)
Step size: 1 per refinement

### Noise Blend Mode

If the user says the noise looks "too contrasty" or "washed out", try
changing the blend mode:

```css
/* Default */
mix-blend-mode: overlay;

/* Softer */
mix-blend-mode: soft-light;

/* For dark images */
mix-blend-mode: multiply;

/* For light images */
mix-blend-mode: screen;
```

### Blur Radius

```css
/* Before */
.container::before { filter: blur(50px); inset: -25%; }

/* "more blur" */
.container::before { filter: blur(65px); inset: -32%; }
```

**Always adjust `inset` proportionally** when changing blur radius.
Rule of thumb: `inset% ≈ blur_px * 0.5`

### Variable Blur / Depth Adjustment

When the output has multi-tier blur (sharp + diffuse layers):

```css
/* Before: moderate depth */
.container::before { filter: blur(70px); }       /* diffuse tier */
.container-inner::before { filter: blur(15px); }  /* sharp tier */

/* "more depth" → widen the gap */
.container::before { filter: blur(85px); }       /* more diffuse */
.container-inner::before { filter: blur(8px); }   /* sharper */

/* "less depth" / "flatter" → narrow the gap */
.container::before { filter: blur(50px); }
.container-inner::before { filter: blur(30px); }
```

### Gradient Stop Sharpness

To make a specific colour blob sharper or softer without changing blur:

```css
/* Before: soft blob */
radial-gradient(circle at 30% 40%, rgba(200,130,10,0.8) 0%, transparent 55%)

/* "make the amber more defined" → tighten the stop */
radial-gradient(circle at 30% 40%, rgba(200,130,10,0.85) 0%, transparent 35%)

/* "make the amber more diffuse" → widen the stop */
radial-gradient(circle at 30% 40%, rgba(200,130,10,0.7) 0%, transparent 70%)
```

### Colour Position

```css
/* Before: warm spot at center-left */
radial-gradient(circle at 30% 40%, rgba(200,130,10,0.8) 0%, transparent 55%)

/* "shift the warm spot right" */
radial-gradient(circle at 45% 40%, rgba(200,130,10,0.8) 0%, transparent 55%)
```

Step size: 10-15% per refinement.

### Colour Intensity

```css
/* Before */
rgba(200,130,10, 0.7)

/* "make the amber stronger" */
rgba(200,130,10, 0.85)
```

Step size: 0.10 – 0.15 per refinement.

### Vignette Strength

```css
/* Before: moderate vignette */
radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.25) 100%)

/* "stronger vignette" */
radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.40) 100%)
```

Adjust both the transparent stop position (tighter = stronger) and the
edge opacity.

---

## SVG Shape Refinements (Organic Strategy)

When the output uses inline SVG shapes, these additional refinement
mappings apply. Modify the SVG `<path>` elements and `<filter>` definitions
directly.

### Shape Blur

```xml
<!-- Before: medium blur -->
<path d="..." filter="url(#b3)"/>

<!-- "sharper shapes" → move to crisp tier -->
<path d="..." filter="url(#b5)"/>

<!-- "softer / dreamier" → move to heavy tier -->
<path d="..." filter="url(#b2)"/>
```

To adjust a specific tier's blur amount:
```xml
<!-- Before -->
<filter id="b3"><feGaussianBlur stdDeviation="4"/></filter>

<!-- "slightly sharper overall" -->
<filter id="b3"><feGaussianBlur stdDeviation="3"/></filter>
```

### Wave Parameters

| User says | SVG change |
|-----------|-----------|
| "tighter waves" / "more frequent" | Add more S-curve segments, reduce amplitude of control points |
| "broader waves" | Increase Y-offset of control points, remove S-curve segments |
| "thicker wave bands" | Increase the gap between upper and lower path edges |
| "thinner wave bands" | Decrease the gap between upper and lower path edges |
| "rotate the waves" | Adjust X/Y coordinates to change the sweep direction |

### Petal Parameters

| User says | SVG change |
|-----------|-----------|
| "rounder petals" | Widen the control point spread (bodyWidth), reduce curvature at tip |
| "sharper / pointier petals" | Tighten control points near the tip, increase curvature |
| "bigger petals" | Scale the path coordinates outward from centroid |
| "more petals" | Duplicate a `<path>` element, rotate and reposition |

### Shape Opacity and Overlap

```xml
<!-- Before: moderate overlap -->
<path d="..." fill="rgba(200,130,60,0.5)" filter="url(#b3)"/>

<!-- "more overlap / richer colour mixing" -->
<path d="..." fill="rgba(200,130,60,0.7)" filter="url(#b3)"/>

<!-- "less overlap / cleaner" -->
<path d="..." fill="rgba(200,130,60,0.3)" filter="url(#b3)"/>
```

Step size: 0.10–0.15 per refinement.

### Shape Position

```xml
<!-- Before: shape at center-right -->
<path d="M60,30 C70,20 80,40 90,35 ..." />

<!-- "shift the wave left" → subtract 15-20 from X coordinates -->
<path d="M40,30 C50,20 60,40 70,35 ..." />
```

Step size: 10-15 units (in viewBox 0-100 space) per refinement.

### Adding / Removing Shapes

To add a shape, insert a new `<path>` element in the SVG at the appropriate
depth position (before existing foreground shapes for background, after for
foreground).

To remove a shape, delete the `<path>` element.

### Depth Adjustment

```xml
<!-- Before: moderate depth -->
<filter id="b1"><feGaussianBlur stdDeviation="12"/></filter>
<filter id="b5"><feGaussianBlur stdDeviation="0.8"/></filter>

<!-- "more depth" → increase background blur, decrease foreground blur -->
<filter id="b1"><feGaussianBlur stdDeviation="16"/></filter>
<filter id="b5"><feGaussianBlur stdDeviation="0.5"/></filter>

<!-- "flatter" → converge blur values -->
<filter id="b1"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="b5"><feGaussianBlur stdDeviation="2"/></filter>
```

---

## Photo-Derived Gradient Refinements

When the gradient was generated from a photograph (using the painterly
layering approach), these additional refinement mappings apply.

| User says | What to change |
|-----------|---------------|
| "more detail" / "richer" | Add shapes to Pass 2-3, use more colour variants from the photo |
| "too busy" / "simpler" | Remove Pass 2 shapes, merge similar colours into fewer shapes |
| "the sky needs more texture" | Add cloud wisps (stroked paths) to the upper zone at b3 |
| "the sky is too flat" | Split single sky veil into 2-3 colour-banded horizontal shapes |
| "the focal point needs more punch" | Add another radiance ring, increase core opacity, or move core to b5 |
| "the focal point is too harsh" | Remove the crisp core ring, soften inner ring from b4 to b3 |
| "the colours don't match the photo" | Re-examine the photo's palette, pull hex values directly from zones |
| "needs more warm/cool contrast" | Increase saturation on warm shapes, push cool shapes bluer |
| "it's too abstract" / "closer to the photo" | Add more Pass 3-4 shapes to capture transitional zones |
| "it's too literal" / "more abstract" | Remove Pass 3-4 detail shapes, keep only Pass 1-2 washes |
| "the horizon needs to be sharper" | Move the horizon ribbon to a crisper blur tier (b3 → b4 or b5) |
| "add cloud texture" | Insert 3-5 cloud wisps with varying Y positions and stroke widths |

---

## Refinement Communication

When making adjustments, always tell the user:

1. **What you changed** — "I increased the noise overlay opacity from 0.08 to 0.16 and bumped numOctaves from 3 to 5"
2. **Which layer** — "on the ::after pseudo-element (noise overlay)"
3. **How to adjust further** — "say 'more grain' again to push it further, or 'softer grain' to smooth it out"

This helps the user build an intuition for the parameter space and makes
future refinements faster.
