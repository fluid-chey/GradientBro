# GradientBro

Generate complex, textural CSS gradients from reference images — noise, blur, blend modes, zero image assets.

## What It Does

Give GradientBro a reference image (screenshot, photo, design comp) and it produces layered CSS that replicates the visual, including:

- **Layered radial/linear gradients** positioned at detected colour regions
- **Heavy CSS blur** on pseudo-elements for the "blurred photograph" effect
- **SVG `feTurbulence` noise** as an inline data URI for film-grain texture
- **Vignette detection** with automatic edge-darkening gradients
- **Blend modes** for natural colour compositing

All output is pure CSS + inline SVG. No image files needed.

## Installation

```bash
npm install -g gradient-bro
```

## CLI Usage

### Analyse an image

```bash
# Output the gradient spec as JSON
gradient-bro analyze screenshot.png

# With fidelity level (exact | vibe | inspired)
gradient-bro analyze screenshot.png --fidelity exact

# Save to file
gradient-bro analyze screenshot.png -o spec.json
```

### Generate CSS directly

```bash
# Generate CSS for a selector
gradient-bro generate screenshot.png --selector .hero-bg --border-radius 16px

# With fidelity
gradient-bro generate screenshot.png -f exact -s .card-gradient

# Save to file
gradient-bro generate screenshot.png -s .gradient -o gradient.css
```

### Set up Cursor integration

```bash
gradient-bro setup-cursor
```

This copies the Cursor skill and rule to `~/.cursor/skills/gradient-bro/` and `~/.cursor/rules/gradient-bro.mdc`, enabling natural-language gradient generation in Cursor.

## Cursor Integration

After running `gradient-bro setup-cursor`, you can use natural language in Cursor:

> "Generate a gradient like this image for the `.hero-section`"

The agent will:
1. Analyse your reference image
2. Ask your preferred fidelity level
3. Generate layered CSS
4. Place it in your project
5. Support iterative refinement ("more grain", "shift the warm spot left")

## Programmatic API

```typescript
import { analyzeImage, generateCSS } from "gradient-bro";

const spec = await analyzeImage("./reference.png", "vibe");
const css = generateCSS(spec, {
  selector: ".my-gradient",
  fidelity: "vibe",
  borderRadius: "16px",
});

console.log(css);
```

## Fidelity Levels

| Level | Clusters | Layers | Noise Detail | Best For |
|-------|----------|--------|-------------|----------|
| **exact** | 6-8 | 3+ | High (5 octaves) | Pixel-level matching |
| **vibe** | 4-5 | 2 | Medium (4 octaves) | Capturing the mood (default) |
| **inspired** | 2-3 | 1 | Low (3 octaves) | Clean, minimal starting point |

## How It Works

The generated CSS uses a 5-layer stack:

1. **Base gradient** — `linear-gradient()` on the container
2. **Vignette** — `radial-gradient()` for edge darkening
3. **Blurred blobs** — multiple `radial-gradient()` values on `::before` with `filter: blur()`
4. **Noise overlay** — SVG `feTurbulence` on `::after` with `mix-blend-mode: overlay`
5. **Content z-index** — ensures children sit above gradient layers

## Sharing with Coworkers

1. Have them install: `npm install -g gradient-bro`
2. Run: `gradient-bro setup-cursor`
3. Restart Cursor

That's it — they can now generate gradients from any project.

## License

MIT
