# ADR 0004: Size keys with CSS variables and `clamp()`

- **Status:** Accepted
- **Area:** Layout (`src/components/piano/Piano.tsx`, `PianoKey.tsx`)

## Context

At a fixed 60px per white key, the 10-key keyboard is ~620px wide, wider than most phones (320–430px). Options were to scroll horizontally, to scale it, or to resize the keys.

Black keys must stay **exactly centered** on white-key boundaries at every size, and resizing must not cause React re-renders.

## Decision

`Piano` defines four CSS custom properties on its container, computed by the browser:

```css
--white-key-width:  clamp(26px, calc((100vw - 4rem) / <whiteKeyCount>), 60px);
--white-key-height: clamp(140px, calc(var(--white-key-width) * 3.33), 200px);
--black-key-width:  calc(var(--white-key-width) * 0.6);
--black-key-height: calc(var(--white-key-height) * 0.65);
```

Every key reads these variables (with constants as fallbacks), and black keys are positioned at `calc(var(--white-key-width) * whiteKeysBefore)`.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Horizontal scroll | Poor UX: you can't see the whole keyboard while playing, and swiping conflicts with playing |
| JavaScript `resize` listener + state | Re-renders on every resize event; more code; flashes on first paint before JS runs |
| CSS `transform: scale()` on the whole piano | Blurry text, awkward hit areas, layout box keeps original size |
| Tailwind breakpoints (`sm:w-…`) | Only a few fixed sizes; doesn't fit every phone width smoothly |

## Consequences

- ✅ Fits every width from 320px phones to desktops (verified at 320, 375 and 1280px) without horizontal page scroll
- ✅ Zero JavaScript on resize, and correct on the very first server-rendered paint
- ✅ Black-key positions derive from the same variable, so they can't drift out of alignment
- ⚠️ Below the 26px minimum (very narrow screens) the frame scrolls horizontally as a fallback
- ⚠️ CSS math is less familiar to some developers than JS; documented here and in `Piano.tsx`
