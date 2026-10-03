# ADR 0006: Map notes by physical key (`event.code`), with layout-aware labels

- **Status:** Accepted (supersedes [ADR 0003](./0003-track-physical-keys-with-event-code.md))
- **Area:** Input (`lib/music/keyboard-map.ts`, `hooks/useKeyboardInput.ts`, `hooks/useKeyboardLabels.ts`)

## Context

ADR 0003 chose notes by `event.key` (the character typed) and released them by `event.code`. Two new requirements broke that:

1. **The number row is now the upper manual's black keys.** With **Shift as the soft pedal**, Shift+2 types `@`, so `event.key` would no longer find F#4.
2. **37 keys across four rows** turn the keyboard into a physical instrument whose *shape* matters more than its letters. On AZERTY, matching by character would scramble that shape.

## Decision

- Map every note to a **physical key code** (`'KeyQ'`, `'Digit2'`, `'BracketRight'`) for both press and release
- Display labels from the **Keyboard Map API** (`navigator.keyboard.getLayoutMap()`) where available, so an AZERTY user sees "A" on the key in the Q position. Fall back to US QWERTY labels elsewhere
- Keep the code → started-note map so a key-up always stops the note its key-down started

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep `event.key` (ADR 0003) | Breaks with Shift held (soft pedal) on the number row |
| `event.code` with fixed QWERTY labels | Correct behavior, but wrong labels on other layouts |
| Let users pick a layout from a menu | More UI and more to maintain; the browser already knows the layout |

## Consequences

- ✅ Shift, Caps Lock and keyboard layout never change which note plays
- ✅ The two-manual piano shape survives on every layout
- ✅ Chrome/Edge show the user's real key labels; others show QWERTY (progressive enhancement)
- ⚠️ In browsers without the Keyboard Map API, non-QWERTY users see QWERTY labels
- 🧪 Regression test: "plays the same note with Shift held (the soft pedal)"
