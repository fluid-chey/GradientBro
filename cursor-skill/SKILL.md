---
name: gradient-bro
description: >
  Generate complex, textural CSS gradients from reference images. Analyses an
  image to extract colour regions, noise, blur, and vignette characteristics,
  then produces layered CSS with SVG noise filters, blurred pseudo-elements,
  and blend modes — zero image assets. Use when the user asks to create,
  generate, replicate, or match a gradient, textured background, grainy
  gradient, or noisy gradient.
---

# GradientBro — Cursor Skill

Generate production-ready, asset-free CSS gradients from a reference image.

## Workflow

### Step 0 — Ensure gradient-bro is installed

Run `which gradient-bro` or `npx gradient-bro --version`.

- If the command is not found, run `npm install -g gradient-bro`.
- If `npm` is not found, install Node.js first: `curl -fsSL https://fnm.vercel.app/install | bash && fnm install --lts`.

### Step 1 — Obtain the reference image

The user will attach an image or provide a file path. If they attach it inline, save it to a temporary location:

```bash
# Example: save to /tmp/gradient-ref.png
cp <attached-image-path> /tmp/gradient-ref.png
```

If the user provides only a URL, download it:
```bash
curl -sL "<url>" -o /tmp/gradient-ref.png
```

### Step 2 — Ask for fidelity (if not already specified)

Present the three options using the AskQuestion tool:

- **Exact** — As close as possible to the reference (more CSS layers, finer detail)
- **Vibe** — Captures the mood and palette (balanced, recommended default)
- **Inspired** — Uses the reference as a starting point (minimal, clean)

If the user has already indicated a preference (e.g. "match this exactly" or "something like this"), skip the question and use the appropriate level.

### Step 3 — Run the analyser

```bash
gradient-bro analyze /tmp/gradient-ref.png --fidelity <level> --size 100
```

This outputs a JSON spec with:
- `colors` — dominant colour clusters with hex, rgb, position (x/y %), weight, spread, and **edgeSharpness** (0-1, how defined the region boundary is)
- `noise` — intensity (0-1), frequency (fine/medium/coarse), type, plus **sharpness** (0-1, grain crispness), **contrast** (0-1, grain punchiness), and **baseFrequency** (0.3-1.0, continuous feTurbulence param)
- `blur` — level (none/light/medium/heavy), variance
- `vignette` — detected (bool), strength (0-1)
- `mood` — temperature (cool/neutral/warm), brightness
- `strategy` — **"simple"**, **"mesh"**, or **"hybrid"** — the recommended CSS generation approach

Read and understand the JSON output.

### Step 4 — Visually analyse the reference image

Using your vision capabilities, look at the reference image and note:

1. **Composition** — where are the bright spots? dark areas? colour transitions?
2. **Mood** — dreamy? moody? airy? warm? cold?
3. **Texture quality** — is the grain film-like? digital? subtle? heavy?
4. **Blur character** — are some shapes sharper than others? is there depth from varying blur levels?
5. **Blend interactions** — are colours mixing smoothly or do they have hard edges?

Combine these observations with the JSON data to inform your CSS decisions. Pay special attention to the `strategy` field — it tells you which generation approach to use.

### Step 5 — Generate the CSS

Read the technique reference at `~/.cursor/skills/gradient-bro/reference.md` before writing CSS.

The generator automatically selects between three strategies:

#### Simple strategy
For images with 2-3 colours in a linear flow with uniform blur. Uses a **5-layer stack**:
1. **Base gradient** — `linear-gradient()` from the two darkest colours
2. **Vignette** (if detected) — `radial-gradient(ellipse at center, ...)` composited with the base
3. **Blurred colour blobs** on `::before` — radial gradients with uniform `filter: blur()`
4. **Noise overlay** on `::after` — SVG `feTurbulence` data URI
5. **Content z-index** on `> *`

#### Mesh strategy
For images with 4+ colour regions scattered across 2D space. Uses positioned radial gradients grouped by blur tier:
- Base: dark solid or linear-gradient from the two darkest colours
- Blur tiers: sharp regions (low blur) and diffuse regions (heavy blur) on separate layers
- Noise overlay on `::after`

#### Hybrid strategy (most common)
For images with a dominant dark base plus lighter accent regions at varying sharpness. Best of both worlds:
- Base: linear-gradient from the dominant dark region
- Accent regions: mesh-style positioned blobs with per-region blur sharpness
- When the edge sharpness variance is high (>0.4), blobs are split into sharp and diffuse tiers on separate pseudo-elements, requiring an inner wrapper div

Use the JSON spec data to set:
- Gradient colours and positions from `colors[].hex` and `colors[].position`
- Blob opacity from `colors[].weight`
- Blob spread from `colors[].spread` (adjusted by `colors[].edgeSharpness` — sharper regions get tighter stops)
- Per-region blur from `colors[].edgeSharpness` — sharp regions get less blur, diffuse regions get more
- Noise `baseFrequency` directly from `noise.baseFrequency`
- Noise opacity from `noise.intensity * (0.15 + noise.contrast * 0.35)`
- Noise crispness from `noise.sharpness` → mapped to `numOctaves`
- Blend mode automatically selected based on `mood.brightness`
- Vignette opacity from `vignette.strength`

Adjust these values based on your visual analysis if the numbers alone don't capture the aesthetic.

### Step 6 — Detect project context and place the code

Examine the current workspace to determine the appropriate output format:

| Signal | Format |
|--------|--------|
| `*.liquid` files, `templates/`, `sections/`, `snippets/` dirs | Shopify Liquid snippet in `snippets/` |
| `*.tsx` / `*.jsx` files | React: CSS module or styled-component |
| `*.vue` files | Vue: scoped `<style>` block |
| `tailwind.config.*` | Tailwind: `@apply` or CSS-in-JS with Tailwind classes for layout, raw CSS for gradients |
| None of the above | Plain CSS file or inline `<style>` block |

Place the CSS targeting the selector/container the user specified. If the user said "put it on the hero section", find the hero section element and apply the class.

**Note:** When the generator outputs multi-tier blur (hybrid/mesh with inner wrapper), the HTML structure requires an inner wrapper div:
```html
<div class="gradient-container">
  <div class="gradient-container-inner">
    <!-- content -->
  </div>
</div>
```

### Step 7 — Support iterative refinement

When the user asks for adjustments, do NOT re-run the full pipeline. Instead, modify the existing CSS directly:

Read `~/.cursor/skills/gradient-bro/refinement-guide.md` for the parameter mapping.

Common refinements:
- "**More grain / noise**" → increase `::after` opacity or decrease `baseFrequency`
- "**Less grain**" → decrease `::after` opacity or increase `baseFrequency`
- "**Sharper grain**" → increase `numOctaves` (more detail)
- "**Softer grain**" → decrease `numOctaves`
- "**More blur / dreamy**" → increase `filter: blur()` value on blur layers
- "**Sharper edges**" → decrease blur on sharp-tier layer, or tighten radial-gradient stops
- "**More depth**" → widen the gap between sharp and diffuse blur tiers
- "**Shift the warm spot left/right/up/down**" → adjust `radial-gradient` position percentages
- "**Darker / moodier**" → lower base gradient brightness, increase vignette opacity
- "**Lighter / airier**" → raise base gradient brightness, reduce vignette
- "**More contrast**" → widen the gap between light and dark colour stops
- "**Add a colour**" → add another `radial-gradient()` to the blur layer

Always explain what you changed so the user understands the parameter mapping.

## Important Notes

- NEVER use image assets. Everything must be pure CSS + inline SVG.
- The `::before` element MUST extend beyond the container (`inset: -N%`) to prevent blur edge artefacts.
- Always set `overflow: hidden` on the container.
- Always set `pointer-events: none` on pseudo-elements so they don't block interaction.
- Content inside the container needs `position: relative; z-index: 3;` (or 4 with inner wrapper) to sit above the layers.
- Test in both light and dark contexts — noise `mix-blend-mode` behaves differently.
- The noise blend mode is auto-selected: `overlay` for dark images, `soft-light` for light/airy images.
