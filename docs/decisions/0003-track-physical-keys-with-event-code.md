# ADR 0003: Match key releases by physical key (`event.code`)

- **Status:** Superseded by [ADR 0006](./0006-map-notes-by-physical-key.md)
- **Area:** Input (`src/hooks/useKeyboardInput.ts`)

## Context

Keyboard events expose two identifiers:

- `event.key`: the **character** produced (`";"`, or `":"` with Shift)
- `event.code`: the **physical key** (`"Semicolon"`, regardless of modifiers)

The original implementation used `event.key` for both press and release: on key-up, look up the note for `event.key` and stop it. Two bugs followed:

1. **Shift changes the character.** Press `;` (E5), hold Shift, release: `event.key` is `":"`, which maps to no note, so E5 never stops.
2. **The mapping changes while held.** Hold `A` (C4), press `X` (octave up, `A` now means C5), release `A`: the lookup finds C5 and stops the wrong note.

## Decision

- On **key down**, use `event.key` to choose the note (so the label printed on the key is what you press), and record `event.code → noteId` in a `Map`
- On **key up**, look up `event.code` in that map and stop **exactly the note that key started**
- Fall back to `event.key` if `event.code` is empty (some virtual/mobile keyboards)

## Alternatives considered

| Option | Why not |
| --- | --- |
| `event.key` for press and release (original) | Both bugs above |
| `event.code` for press *and* release | Layout-independent, but on AZERTY/Dvorak keyboards the key labelled "A" isn't `KeyA`, so the on-screen labels would be wrong |
| Ignore Shift entirely | Fixes bug 1 but not bug 2 |

## Consequences

- ✅ A released key always stops the note it started, whatever modifiers or octave changes happened in between
- ✅ On-screen labels match the characters users type on any layout
- ✅ Both bugs have regression tests in `usePiano.test.tsx`
- ⚠️ Slightly more state (a `Map` instead of a `Set`)
