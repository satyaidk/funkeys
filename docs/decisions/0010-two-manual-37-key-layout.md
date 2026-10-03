# ADR 0010: A 37-key two-manual layout, scrolling on phones

- **Status:** Accepted (amends [ADR 0004](./0004-css-variables-for-responsive-keys.md))
- **Area:** Input and layout (`lib/music/keyboard-map.ts`, `components/piano/Piano.tsx`)

## Context

The first version used one row of letters for 17 keys (C4–E5). Users wanted to use **the whole keyboard**. Options for mapping four rows:

- **Tracker layout** (FastTracker, LMMS): bottom rows = octave N, top rows = octave N+1. The manuals overlap, so some notes are on two keys
- **Virtual Piano style** (virtualpiano.net): 36 white keys in a line across all rows, black keys with Shift. Huge range, but playing chords with Shift is awkward and the layout isn't piano-shaped
- **Two contiguous manuals**: bottom rows play C3–E4, top rows continue at F4–C6

## Decision

**Two contiguous manuals, 37 keys (C3–C6).** In each manual a letter row is the white keys and the row above (offset half a key) is the black keys. The unmapped keys (1, 5, 8, =, F, K) fall exactly where a piano has no black key.

On screen, 22 white keys at a tappable minimum width (34 px) are wider than a phone. Below that width the keyboard **scrolls sideways** (starting centered on middle C) instead of shrinking further, and keys use `touch-action: pan-x` so a swipe scrolls.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Tracker layout | Duplicate notes; two keys light up for one pitch |
| Virtual Piano layout | Shift-for-black-keys makes chords hard; not piano-shaped |
| Shrink 37 keys to fit 320 px | ~11 px keys are impossible to tap |
| Show fewer keys on phones | Two different instruments to build, test and document |

## Consequences

- ✅ Three octaves with no duplicates, playable with two hands, physically shaped like a piano
- ✅ The default split point (F4) falls exactly between the manuals: bottom rows left hand, top rows right hand
- ✅ Desktop shows the whole keyboard; phones get full-size keys
- ⚠️ Phone users scroll to reach the outer octaves
- ⚠️ Space and Shift are reserved for pedals, so the sostenuto pedal has no key
