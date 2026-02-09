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
- `colors` — dominant colour clusters with hex, rgb, position (x/y %), weight, spread
- `noise` — intensity (0-1), frequency (fine/medium/coarse), type
- `blur` — level (none/light/medium/heavy), variance
- `vignette` — detected (bool), strength (0-1)
- `mood` — temperature (cool/neutral/warm), brightness

Read and understand the JSON output.

### Step 4 — Visually analyse the reference image

Using your vision capabilities, look at the reference image and note:

1. **Composition** — where are the bright spots? dark areas? colour transitions?
2. **Mood** — dreamy? moody? airy? warm? cold?
3. **Texture quality** — is the grain film-like? digital? subtle? heavy?
4. **Blur character** — out-of-focus bokeh? gaussian? motion blur? selective?
5. **Blend interactions** — are colours mixing smoothly or do they have hard edges?

Combine these observations with the JSON data to inform your CSS decisions.

### Step 5 — Generate the CSS

Read the technique reference at `~/.cursor/skills/gradient-bro/reference.md` before writing CSS.

The CSS uses a **5-layer stack**:

1. **Base gradient** on the container element — `linear-gradient()` using the two most prominent/darkest colours
2. **Vignette** (if detected) — `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,N) 100%)` composited with the base
3. **Blurred colour blobs** on `::before` — multiple `radial-gradient()` values positioned at each colour cluster's centroid, with `filter: blur(Npx)` and `inset: -N%` to prevent edge artifacts
4. **Noise overlay** on `::after` — inline SVG `feTurbulence` as a data URI with `mix-blend-mode: overlay` and low opacity
5. **Content z-index** on `> *` — ensures text and children sit above the gradient layers

Use the JSON spec data to set:
- Gradient colours and positions from `colors[].hex` and `colors[].position`
- Blob opacity from `colors[].weight`
- Blob spread from `colors[].spread`
- Blur radius from `blur.level` / `blur.variance`
- Noise `baseFrequency` from `noise.frequency`
- Noise opacity from `noise.intensity`
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

### Step 7 — Support iterative refinement

When the user asks for adjustments, do NOT re-run the full pipeline. Instead, modify the existing CSS directly:

Read `~/.cursor/skills/gradient-bro/refinement-guide.md` for the parameter mapping.

Common refinements:
- "**More grain / noise**" → increase `::after` opacity or decrease `baseFrequency`
- "**Less grain**" → decrease `::after` opacity or increase `baseFrequency`
- "**More blur / dreamy**" → increase `filter: blur()` value on `::before`
- "**Sharper**" → decrease blur value
- "**Shift the warm spot left/right/up/down**" → adjust `radial-gradient` position percentages
- "**Darker / moodier**" → lower base gradient brightness, increase vignette opacity
- "**Lighter / airier**" → raise base gradient brightness, reduce vignette
- "**More contrast**" → widen the gap between light and dark colour stops
- "**Add a colour**" → add another `radial-gradient()` to the `::before` background list

Always explain what you changed so the user understands the parameter mapping.

## Important Notes

- NEVER use image assets. Everything must be pure CSS + inline SVG.
- The `::before` element MUST extend beyond the container (`inset: -N%`) to prevent blur edge artefacts.
- Always set `overflow: hidden` on the container.
- Always set `pointer-events: none` on pseudo-elements so they don't block interaction.
- Content inside the container needs `position: relative; z-index: 3;` to sit above the layers.
- Test in both light and dark contexts — noise `mix-blend-mode: overlay` behaves differently.
