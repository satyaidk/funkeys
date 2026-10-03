# ADR 0011: Design the interface as the instrument itself

- **Status:** Accepted
- **Area:** Visual design (`app/globals.css`, `components/ui/`, `components/console/`, `components/piano/`)

## Context

With a dozen new functions, the UI risked becoming a generic dashboard: rows of identical rounded cards, gradient accents, uppercase labels. That looks like countless template apps and says nothing about pianos. The interface needed to be **clean, attractive and interactive**, and recognizable.

## Decision

Design the page as **a digital piano seen from the bench**, drawing every visual choice from real instruments:

| Element | Real-world source |
| --- | --- |
| Plum-velvet stage with a warm spotlight | Concert-hall curtain |
| Satin-ebony cabinet, graphite control surface | Piano body, anodized panels |
| Dot-matrix amber **LCD** (DotGothic16) | Digital piano displays |
| Rubber **pads with LEDs**; LEDs on tabs when a page has changes | Hardware buttons and indicators |
| Rotary **knobs** with knurling | Volume and parameter dials |
| Gold **wordmark on the fallboard**, model badge | Piano brand lettering |
| Walnut cheeks, red felt strip | Cabinet woodwork, key felt |
| Brass **pedals** on a lyre | Grand piano pedals |

**Rules:**

- **One loud element:** the rainbow key lighting. Everything else stays quiet
- **One accent:** amber, for LEDs, the LCD, focus rings and active states
- **Motion answers actions** (keys, pedals, page changes). The only unprompted motion is a single power-on sweep, skipped for reduced motion
- **Sentence-case labels**, plain words ("Split point", not "SPLIT PT")
- **The keyboard never moves:** function pages share a fixed height on wide screens

Tokens live in `globals.css` as CSS variables exposed to Tailwind via `@theme inline`; primitives in `components/ui/` encode the hardware language once.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Generic dark dashboard (cards + gradient) | Templated look; nothing ties it to a piano |
| Photo-realistic skeuomorphism (textures, bitmaps) | Heavy assets, hard to keep crisp and accessible |
| Light minimal theme | Loses the stage atmosphere; the rainbow lighting reads best on dark |

## Consequences

- ✅ A distinctive, cohesive look that explains itself: users know what a knob or pedal does
- ✅ Reusable primitives (Knob, Pad, Led, Stepper, Segmented) keep new features consistent
- ✅ Accessible by construction: every primitive owns its ARIA role and keyboard behavior
- ⚠️ Dark-only by design; a light theme would need its own token set
