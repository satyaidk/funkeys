# ADR 0015: On phones, dock the keyboard and navigate it with a minimap

- **Status:** Accepted (amends [ADR 0010](./0010-two-manual-37-key-layout.md))
- **Area:** Layout and input (`components/PianoApp.tsx`, `piano/Piano.tsx`, `piano/KeyboardMinimap.tsx`, `lib/pointer-tracker.ts`, `app/globals.css`)

## Context

ADR 0010 kept 37 full-size keys on phones by letting the keyboard **scroll sideways** with `touch-action: pan-x`. Measuring the result on phones showed four problems:

1. **Swipes played notes.** A sideways swipe to scroll first pressed the key under the finger, then the browser cancelled it: a stray note every time
2. **No glissando, and fragile chords.** Each key handled its own pointer; sliding across keys couldn't play them
3. **The keys were far away.** On a 375 × 667 phone they started about 1,060 px down the page; in landscape, two screens down. Touch users also had no way to change octave (only ← →)
4. **The keys scrolled away** whenever you browsed the song list or a transcription, exactly when you want to watch them light up

## Decision

- **Swipes on the keys always play.** The keys get `touch-action: none` (and only the keys: the rest of the page scrolls normally). One pointer handler on the keyboard captures each pointer, finds the key under it with `elementFromPoint` as it moves (glissando), and tracks each finger by pointer id in `PointerTracker` (chords). Release, cancel, window blur and hiding the tab all stop the notes.
- **A minimap moves the view.** When the keys don't fit, a miniature of all 37 keys shows the visible part; drag or tap it, or use ‹ ›, to move. Notes sounding off-screen light up in it too. It's a `slider` with arrow-key support.
- **On-screen octave controls** with the current range (e.g. "C3–C6") for every device.
- **Dock the keyboard on phones.** Below 768 px wide, or under 500 px tall (landscape), the keyboard is moved to the end of the page and made `position: sticky; bottom: 0`: it sits at the bottom of the screen, always in reach, while everything else scrolls above it. On tablets and desktops at least 700 px tall it's pinned at the top instead. Both are Tailwind custom variants (`dock`, `pin`) defined once in `globals.css`.
- **Key size stays playable:** white keys never go below 40 px wide (≈ an octave visible on a 375 px phone), and keys are at most 40% of the screen height so landscape phones keep room above them.
- **Scrolled-into-view content stays visible:** the keyboard's height is published as `--keyboard-height` and used as `scroll-padding`, so a focused control or a link target never lands behind it.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep sideways scrolling on the keys | Stray notes on every swipe; no glissando |
| A separate phone keyboard (an absolute octave window) | Two keyboards to build, test and document, with a different range from the computer-key layout |
| `position: fixed` for the dock | Needs manual padding for the page and breaks when the keyboard height changes; sticky does both by itself |
| Hide the control panel on phones | Loses the LCD (what's sounding, the voice, tuning) |

## Consequences

- ✅ Measured with Playwright: no horizontal scrolling on any page at 320, 360, 375, 390, 430, 768, 1024 and 1440 px; the whole keyboard on the first screen in portrait and landscape
- ✅ Three-finger chords and glissandos work on touch screens (tested with real touch events through the DevTools protocol)
- ✅ The keys stay visible while browsing songs or editing a transcription, on phones and desktops
- ⚠️ On phones the keyboard comes last in the visual order but stays second in the DOM, so screen readers and Tab follow the source order
- ⚠️ The docked keyboard takes about 40% of a portrait phone screen; content scrolls in the rest
- ⚠️ A finger resting on the keys can't scroll the page; scroll above them
