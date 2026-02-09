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
| "more blur" / "dreamier" / "softer" | `::before` | `filter: blur()` | Increase by 10-20px |
| "less blur" / "sharper" | `::before` | `filter: blur()` | Decrease by 10-20px |
| "darker" / "moodier" | base | gradient colours | Darken hex values |
| "darker" (alternative) | base | vignette opacity | Increase by 0.1-0.15 |
| "lighter" / "airier" | base | gradient colours | Lighten hex values |
| "lighter" (alternative) | base | vignette opacity | Decrease or remove |
| "more contrast" | base | colour stops | Widen brightness gap between stops |
| "less contrast" | base | colour stops | Narrow brightness gap |
| "shift [colour] left" | `::before` | radial-gradient `at X% Y%` | Decrease X% by 10-15 |
| "shift [colour] right" | `::before` | radial-gradient `at X% Y%` | Increase X% by 10-15 |
| "shift [colour] up" | `::before` | radial-gradient `at X% Y%` | Decrease Y% by 10-15 |
| "shift [colour] down" | `::before` | radial-gradient `at X% Y%` | Increase Y% by 10-15 |
| "make [colour] bigger" | `::before` | radial-gradient `transparent N%` | Increase N% by 10-15 |
| "make [colour] smaller" | `::before` | radial-gradient `transparent N%` | Decrease N% by 10-15 |
| "more [colour]" / "add more amber" | `::before` | radial-gradient opacity | Increase rgba alpha by 0.1-0.2 |
| "less [colour]" | `::before` | radial-gradient opacity | Decrease rgba alpha by 0.1-0.2 |
| "add a colour" / "add blue" | `::before` | background | Add new radial-gradient() |
| "remove [colour]" | `::before` | background | Remove the matching radial-gradient() |
| "stronger vignette" | base | vignette gradient | Increase edge opacity |
| "no vignette" | base | vignette gradient | Remove the radial-gradient |
| "more depth" | multiple | blur + vignette | Increase blur, add/strengthen vignette |

---

## Detailed Parameter Adjustments

### Noise Opacity

Current value is typically in the range 0.05 – 0.25.

```css
/* Before: subtle grain */
.container::after { opacity: 0.12; }

/* After: "more grain" */
.container::after { opacity: 0.18; }
```

- Minimum sensible: 0.03 (barely perceptible)
- Maximum sensible: 0.35 (very grainy, stylised)
- Step size: 0.04 – 0.08 per refinement

### Noise Frequency (baseFrequency in SVG)

The SVG is URL-encoded in the `background` property. To change it, decode
mentally, adjust the number, re-encode.

```
baseFrequency='0.65'  →  baseFrequency='0.55'  (coarser)
baseFrequency='0.65'  →  baseFrequency='0.80'  (finer)
```

Range: 0.3 (very coarse) to 1.0 (very fine)
Step size: 0.10 – 0.15 per refinement

### Blur Radius

```css
/* Before */
.container::before { filter: blur(50px); inset: -25%; }

/* "more blur" */
.container::before { filter: blur(65px); inset: -32%; }
```

**Always adjust `inset` proportionally** when changing blur radius.
Rule of thumb: `inset% ≈ blur_px * 0.5`

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

### Blend Mode

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

---

## Refinement Communication

When making adjustments, always tell the user:

1. **What you changed** — "I increased the noise overlay opacity from 0.12 to 0.18"
2. **Which layer** — "on the ::after pseudo-element"
3. **How to adjust further** — "say 'more grain' again to push it further, or 'less grain' to dial it back"

This helps the user build an intuition for the parameter space and makes
future refinements faster.
