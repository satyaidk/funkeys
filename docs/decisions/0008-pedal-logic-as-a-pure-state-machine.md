# ADR 0008: Model pedal logic as a pure state machine (`NoteTracker`)

- **Status:** Accepted (refines [ADR 0002](./0002-refs-plus-state-for-note-tracking.md))
- **Area:** State (`lib/note-tracker.ts`, `hooks/usePiano.ts`)

## Context

With one sustain pedal, "is this note held or ringing?" fit in two `Set`s inside `usePiano`. Adding the **sostenuto** pedal multiplies the cases:

- Sostenuto catches only notes held *when it goes down*
- If sustain is down at that moment, sostenuto also catches the notes sustain is holding
- Lifting either pedal must stop only notes **no** pedal still holds, and never keys still pressed
- Pedals can be pressed and lifted in any order, by three sources (keyboard, screen, playback)

Mixing these rules with React state, refs and audio calls in one hook would be hard to read and harder to test.

## Decision

Move the rules into a **plain TypeScript class** with no React and no audio:

```ts
press(id): boolean
release(id): 'stop' | 'sustain' | 'ignore'
setSustain(down): string[]     // notes to stop
setSostenuto(down): string[]   // notes to stop
clearNotes(): void
```

Methods **return decisions**; `usePiano` carries them out (`audio.stopNote`) and mirrors the sets into React state. Separately, `usePiano` tracks **pedal sources** so a pedal stays down while any source holds it.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep the logic inline in `usePiano` | Every pedal edge case would need a rendered hook to test |
| `useReducer` | Pure, but audio side effects still need a home, and handlers can't read new state synchronously |
| A state-machine library (XState) | Powerful, but heavy for two pedals and three sets |

## Consequences

- ✅ 11 fast unit tests cover every pedal combination, including real-piano subtleties
- ✅ `usePiano` reads as orchestration: ask the tracker, act on the answer
- ✅ The "functional core, imperative shell" pattern: pure decisions inside, side effects at the edge
- ⚠️ One more file to learn; the tracker and React state must be synced (`syncNotes()`) after each change
