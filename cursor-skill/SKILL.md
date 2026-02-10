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
- `strategy` — **"simple"**, **"mesh"**, **"hybrid"**, or **"organic"** — the recommended generation approach
- `shapes` — (when strategy is `"organic"`) shape analysis with `complexity`, `flowDirection`, `style`, and `contours[]` array describing detected organic shapes (waves, wisps, veils, angular-veils, ribbons, petals)

Read and understand the JSON output. **Note:** The `noise` object from the analyser is informational only — grain uses fixed strong defaults (see Step 5) unless the user explicitly requests different grain.

### Step 4 — Visually analyse the reference image

First, determine whether the reference is an **abstract gradient/design** or a **photograph of a real scene**. This changes the analysis approach.

#### Track A — Abstract gradient reference

For images that are already abstract gradients (blurred colour fields, design assets, UI backgrounds), note:

1. **Composition** — where are the bright spots? dark areas? colour transitions?
2. **Mood** — dreamy? moody? airy? warm? cold?
3. **Texture quality** — is the grain film-like? digital? subtle? heavy?
4. **Blur character** — are some shapes sharper than others? is there depth from varying blur levels?
5. **Blend interactions** — are colours mixing smoothly or do they have hard edges?

Combine these observations with the JSON data to inform your CSS/SVG decisions.

#### Track B — Photograph reference (painterly decomposition)

When the reference is a photograph (landscape, sunset, portrait, architecture, etc.), follow this structured 7-step decomposition **before writing any SVG**. The goal is a painterly abstraction — like a blurred watercolour of the photo that preserves colour relationships and major light/dark areas while letting shapes be organic and artistic.

1. **Map the major light/dark zones** — Divide the image mentally into a 3x3 grid. For each cell, note the dominant colour and relative brightness. This prevents flattening (e.g. seeing "one big purple area" when there are 3 distinct purple zones with different hues and temperatures). **Every visually distinct zone MUST get at least one dedicated shape.** If the photo has dark mountains, a bright dune, and a glowing sky — those are 3 separate shapes minimum, not one blended wash. High-contrast adjacent zones (dark next to bright) especially need separate, non-overlapping shapes to preserve the contrast.

2. **Locate focal points and radiance** — Where does the eye go first? Note the radiance pattern: does light radiate outward from a point (sun, lamp), spread horizontally (horizon glow), or diffuse evenly? Focal points should be built with the radiance technique (see reference.md).

3. **Trace colour temperature transitions** — Map where warm colours meet cool colours. These warm/cool transition zones are where the most visually interesting shapes should be placed — they create the colour tension that makes a gradient compelling.

4. **Identify directional elements** — Cloud streaks, light rays, horizon lines, terrain contours, architectural lines. These inform shape type choices: horizontal bands = waves, diagonal streaks = wisps/ribbons, radiating light = concentric shapes, cloud texture = wisps with stroke.

5. **Note atmospheric depth layers** — What's in the far background (sky, distant mountains), mid-ground (clouds, trees, buildings), and foreground (terrain, nearby objects)? Each depth layer maps to a different blur tier, creating perceptual depth.

6. **Inventory the colour palette** — List 10-15 distinct colours visible in the photo (more than the analyzer's 8 clusters). Group them by zone (e.g. "sky: deep indigo, dusty purple, lavender, mauve-pink" / "horizon: peach, hot orange, white-gold" / "ground: crimson, wine, dark purple"). This ensures you use the full palette richness, not just the analyzer's cluster centroids.

7. **Draft a painting plan** — Before touching any code, list the shapes you'll create, what pass/blur tier each belongs to, and what part of the photo it represents. This is your blueprint.

Pay special attention to the `strategy` field — it tells you which generation approach to use.

### Step 5 — Generate the CSS

Read the technique reference at `~/.cursor/skills/gradient-bro/reference.md` before writing CSS.

#### Strategy routing decision (read this first)

Apply these rules in priority order (first match wins):

1. **User explicitly requests organic or CSS-only** → honour that request.
2. **Container is less than ~250px wide** → use CSS-only (hybrid or mesh). At this size there are not enough pixels for SVG shape detail to be perceptible under blur. Use the analyzer's strategy field to choose between simple, mesh, and hybrid.
3. **Follow the analyzer's `strategy` field** — for **both** photographs and abstract gradients. The classifier has been calibrated to distinguish images with genuine structural complexity (waves, wisps, ribbons, petals) from smooth blends that only have generic large-area regions. When it says `"organic"`, the image genuinely has shapes that benefit from SVG — **use organic**.
4. **Optional upgrade for Track B photos**: if the analyzer returned `"hybrid"` or `"mesh"` for a photograph but your visual analysis (Step 4) reveals clear depth layers, distinct directional elements, or colour zones that CSS radial/linear gradients would flatten, you MAY upgrade to organic. This is a judgement call, not a requirement.

**Key principle:** when the analyzer recommends organic, honour it. The classifier is selective — it requires distinctive geometric features (elongation, sinuosity, tip detection) not just "large colour regions." If it says organic, the image has real structure worth expressing with SVG shapes. Don't second-guess it in favour of simpler CSS unless the container is very small.

The generator supports four strategies:

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

#### Organic strategy (SVG shapes)
For images with flowing waves, organic petals, angular veils, ribbons, or other shapes that CSS radial/linear gradients cannot reproduce. Uses **inline SVG** with per-shape blur filters:
- Base: CSS `background` gradient from the two darkest colours (same as other strategies)
- Shape layer: `<svg>` element positioned absolutely inside the container, with `<defs>` defining 5 blur filter tiers and individual `<path>` elements for each shape
- Noise overlay: `::after` pseudo-element (same as other strategies)
- Content: `position: relative; z-index: 3;` to sit above SVG and noise

**HTML structure for organic strategy:**
```html
<div class="gradient-container">
  <!-- CSS background handles base gradient -->
  <svg class="gradient-shapes" viewBox="0 0 100 100" preserveAspectRatio="none"
       xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="b1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
      <filter id="b2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
      <filter id="b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4.5"/></filter>
      <filter id="b4" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.5"/></filter>
      <filter id="b5" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.4"/></filter>
    </defs>
    <!-- Shapes back-to-front: diffuse first, sharp last -->
  </svg>
  <!-- Content here -->
</div>
```

**CSS for the SVG element:**
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

**How to use the shapes data:**
The `shapes.contours` array describes detected organic forms. Each contour has a `type`, `position`, `direction`, `blur`, `color`, and `opacity`, plus type-specific parameters. Use these as scaffolding — write the actual SVG `<path>` `d` attributes using your visual analysis of the reference image.

**Shape types and their SVG patterns:**
- **wave** — Closed bezier band forming a flowing sinusoidal ribbon. Use `amplitude` and `frequency` from the contour to set control point offsets.
- **wisp** — Thin stroked bezier curve. Use `stroke` instead of `fill`, with `stroke-linecap="round"`.
- **veil** — Large closed organic shape with curved quadratic edges. Cover 10-30% of the container.
- **angular-veil** — Large shape with straighter edges. Use the `vertices` array from the contour as guide points, connect with `L` (line) commands.
- **ribbon** — Variable-width band with defined edges. Two parallel bezier edges closed into a filled shape.
- **petal** — Organic teardrop/leaf shape. Use `tipPoint` for the pointed end and `bodyWidth` for the rounded body's spread.

**5-tier blur system** — Map `contour.blur` (0-1) to filter tiers:
- 0.0–0.2 → `b5` (crisp, stdDeviation 0.4) — foreground sharp forms
- 0.2–0.4 → `b4` (light, stdDeviation 1.5) — semi-defined shapes
- 0.4–0.6 → `b3` (medium, stdDeviation 4.5) — mid-ground shapes
- 0.6–0.8 → `b2` (heavy, stdDeviation 9) — broad background shapes
- 0.8–1.0 → `b1` (atmospheric, stdDeviation 18) — deep background washes

**Critical:** All SVG `<filter>` elements MUST include `x="-50%" y="-50%" width="200%" height="200%"` to prevent blur clipping artifacts (hard edges where the filter region ends).

**Stroke-based shapes (wisps)** — Must use filters with `filterUnits="userSpaceOnUse"` to prevent blur clipping. See reference.md.

#### Block-first generation (THE core methodology)

Every gradient — whether from a photo or an abstract reference — must be built in 3 phases. The critical principle: **opaque colour blocks first, translucent overlays only on top.**

The #1 mistake is layering many semi-transparent shapes that blend into muddy intermediates. Instead:

```
WRONG:  transparent + transparent + transparent = mud
RIGHT:  opaque blocks → subtle overlays → accents
```

**Phase 1 — Opaque colour blocks** (the foundation, 60% of shapes):
- The CSS `background` sets the single largest colour region, PLUS any focal-point `radial-gradient()` glows (see below)
- SVG shapes at **0.85-1.0 opacity** tile across the canvas to block out every major colour zone
- These shapes should be **adjacent, not overlapping** — like puzzle pieces filling the frame
- Each distinct colour zone from the reference gets its own block
- Use saturated hex values pulled from the most vivid areas of the reference, NOT the analyzer's desaturated cluster averages
- **This phase alone should look like a simplified, blurred version of the reference.** If it doesn't, the blocks are wrong — fix them before moving to Phase 2.

**CRITICAL — Blur tier variation within Phase 1:** Phase 1 blocks must NOT all use the same blur tier. Assign tiers based on each block's depth role:
- **Background/atmospheric blocks** (sky, distant wash, receding zones): **b2** (stdDev 9) — soft, recedes
- **Mid-ground structural blocks** (terrain, colour bands, secondary forms): **b3** (stdDev 4.5) — moderate definition
- **Foreground/prominent blocks** (the main subject shape, bright highlights, sharp-edged forms): **b4** (stdDev 1.5) — defined, pops forward

This depth-based blur assignment is what creates the sense that some elements are "in front of" others. If all blocks share one blur tier, the result looks flat.

**Sub-block granularity:** If a colour zone has visible internal variation (a bright highlight band, a shadow, a colour shift), split it into 2-3 sub-blocks at different blur tiers. A green hill with a sunlit highlight becomes 3 blocks (dark upper slope at b3, bright sunlit band at b4, medium-dark lower slope at b3) — NOT one flat green block. This creates blur tier variation WITHIN a single colour family, adding depth even in monochromatic zones.

**Edge-specific sharpness:** If one edge of a shape needs to be sharp (foreground) while the opposite fades soft (background), split it into a soft base shape (b2/b3) + a smaller sharp edge-accent overlay (b4) covering just the defined edge.

**Gradient fills vs flat fills:** Not every shape should use flat `rgba()` colour. Shapes that represent **light, glow, or atmospheric masses** (glowing curves, cloud masses, bright accents) should use SVG `<radialGradient>` or `<linearGradient>` fills that fade from opaque at the centre to transparent at the edges. This makes them feel like natural light rather than flat vector cutouts. Keep flat fills for solid opaque blocks, dark silhouettes, and Phase 2 transition blends. See reference.md for SVG gradient fill templates.

**Phase 2 — Blending and transitions** (the polish, 25% of shapes):
- Lower-opacity shapes (0.2-0.5) placed **ONLY at zone boundaries** to smooth hard transitions between Phase 1 blocks
- Do NOT place Phase 2 shapes over the centre of a Phase 1 block — that kills vibrancy
- Light veils where colour temperature shifts need softening
- This phase is minimal — 3-5 shapes maximum

**Phase 3 — Detail and texture** (the finish, 15% of shapes):
- Wisps for cloud/sky texture (using `filterUnits="userSpaceOnUse"` filters)
- Small accent highlights
- The noise grain overlay
- These are the lightest touches, not the structural foundation

**Focal points: CSS radial-gradient, NOT SVG circles.** Suns, light sources, and glows must be rendered as `radial-gradient()` layered in the CSS `background` property. This produces natural, smooth radiance without hard edges:

```css
.container {
  background:
    /* Focal glow: bright core with soft falloff */
    radial-gradient(ellipse at 50% 38%,
      rgba(255,235,190,0.8) 0%, rgba(250,160,90,0.4) 15%, transparent 45%),
    /* Base gradient */
    linear-gradient(180deg, #3a2644 0%, #50416a 25%, #73304b 70%, #3a2644 100%);
}
```

**Shape count guidance:**
- **Abstract gradient references**: 8-12 shapes
- **Simple photographs**: 10-14 shapes (mostly Phase 1 blocks)
- **Rich photographs**: 14-20 shapes (more Phase 1 blocks, a few Phase 2/3)
- **Ceiling**: 25 shapes

Read `~/.cursor/skills/gradient-bro/reference.md` for SVG templates, wisp patterns, and worked examples.

#### CSS strategies (simple, mesh, hybrid)

Use the JSON spec data to set:
- Gradient colours and positions from `colors[].hex` and `colors[].position`
- Blob opacity from `colors[].weight`
- Blob spread from `colors[].spread` (adjusted by `colors[].edgeSharpness` — sharper regions get tighter stops)
- Per-region blur from `colors[].edgeSharpness` — sharp regions get less blur, diffuse regions get more
- Blend mode automatically selected based on `mood.brightness`
- Vignette opacity from `vignette.strength`

#### Grain defaults (ignore analyser noise data)

Every gradient gets a strong, high-res, crisp grain overlay by default. Do NOT derive grain parameters from the analyser's `noise` object — use these fixed values instead:

| Parameter       | Default value | Effect                                    |
|-----------------|---------------|-------------------------------------------|
| `baseFrequency` | `0.45`        | Coarse, textural grain                    |
| `numOctaves`    | `6`           | Maximum crispness — sharp, defined grain  |
| `opacity`       | `0.9`         | Near-full-strength grain via overlay blend |
| `blend mode`    | `overlay`     | Always overlay — works on both dark and light |

**User overrides:** If the user specifies grain preferences in their request (e.g. "subtle grain", "no grain", "film-like grain", "coarse grain"), adjust accordingly:
- "subtle" / "light grain" → opacity `0.08`, numOctaves `3`
- "no grain" → omit the `::after` layer entirely
- "film-like" → baseFrequency `0.55`, numOctaves `4`, opacity `0.5`
- "coarse" / "chunky" → baseFrequency `0.30`, numOctaves `3`, opacity `0.8`
- "maximum grain" → keep defaults + add `filter: contrast(2.5)` to `::after`
- "extreme grain" → keep defaults + add `filter: contrast(3.5)` to `::after`

**Going beyond opacity 1.0:** When the user wants grain even more pronounced than the default, use `filter: contrast(N)` on the `::after` element. This amplifies the noise texture before it blends, making each grain particle bite harder. Start at `contrast(1.5)`, step by 0.5. See the refinement guide for the full escalation sequence.

The user can also adjust grain in follow-up prompts — see Step 7.

Adjust colour/blur values based on your visual analysis if the numbers alone don't capture the aesthetic.

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

#### Multiple gradients in one document

When generating several organic gradients in the same HTML document (e.g. a grid of cards, multiple sections), SVG `id` attributes must be globally unique or the filters will collide.

**Filter ID namespacing:** Prefix every `<filter>`, `<radialGradient>`, and `<linearGradient>` `id` with an instance identifier:

```html
<!-- Card 1 -->
<svg class="gradient-shapes" ...>
  <defs>
    <filter id="b1-card1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
    <filter id="b2-card1" ...>...</filter>
    <!-- ... b3-card1, b4-card1, b5-card1 ... -->
  </defs>
  <path d="..." fill="rgba(...)" filter="url(#b3-card1)"/>
</svg>

<!-- Card 2 -->
<svg class="gradient-shapes" ...>
  <defs>
    <filter id="b1-card2" ...>...</filter>
    <!-- ... -->
  </defs>
  <path d="..." filter="url(#b2-card2)"/>
</svg>
```

**Shared defs alternative:** If all instances use the same 5-tier blur system, you can define the filters once in a hidden SVG at the top of the document and reference them from all instances:

```html
<!-- Shared filter definitions (zero visual footprint) -->
<svg style="position:absolute;width:0;height:0" aria-hidden="true">
  <defs>
    <filter id="b1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
    <filter id="b2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="b3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4.5"/></filter>
    <filter id="b4" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.5"/></filter>
    <filter id="b5" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.4"/></filter>
  </defs>
</svg>

<!-- Each card SVG references the shared filters — no id conflicts -->
<svg class="gradient-shapes" ...>
  <path d="..." filter="url(#b3)"/>
</svg>
```

SVG gradient fills (`<radialGradient>`, `<linearGradient>`) must still be namespaced per instance since their colours differ per card.

### Step 7 — Support iterative refinement

When the user asks for adjustments, do NOT re-run the full pipeline. Instead, modify the existing CSS directly:

Read `~/.cursor/skills/gradient-bro/refinement-guide.md` for the parameter mapping.

Common refinements (CSS strategies):
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

Additional refinements (organic/SVG strategy):
- "**Make the waves tighter**" → decrease amplitude, increase frequency in wave paths
- "**Broader waves**" → increase amplitude, decrease frequency
- "**Sharper shapes**" → move shapes to a crisper blur tier (e.g. `b3` → `b5`)
- "**Softer / dreamier shapes**" → move shapes to a heavier blur tier
- "**More depth**" → widen gap between background and foreground blur tiers
- "**More overlap / richer colour mixing**" → increase opacity on overlapping shapes
- "**Rotate the flow**" → adjust shape direction, recompute bezier control points
- "**Add a petal / wave / veil**" → insert a new `<path>` element to the SVG
- "**Remove [shape]**" → delete the specific `<path>` element

Always explain what you changed so the user understands the parameter mapping.

## Important Notes

- NEVER use image assets. Everything must be pure CSS + inline SVG.
- The `::before` element MUST extend beyond the container (`inset: -N%`) to prevent blur edge artefacts.
- Always set `overflow: hidden` on the container.
- Always set `pointer-events: none` on pseudo-elements so they don't block interaction.
- Content inside the container needs `position: relative; z-index: 3;` (or 4 with inner wrapper) to sit above the layers.
- Test in both light and dark contexts — noise `mix-blend-mode` behaves differently.
- The noise blend mode is auto-selected: `overlay` for dark images, `soft-light` for light/airy images.
