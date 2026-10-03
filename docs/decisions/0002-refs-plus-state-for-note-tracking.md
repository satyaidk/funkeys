# ADR 0002: Track held notes in refs, mirrored to state for rendering

- **Status:** Accepted, refined by [ADR 0008](./0008-pedal-logic-as-a-pure-state-machine.md) (the note sets now live in a `NoteTracker`)
- **Area:** State management (`src/hooks/usePiano.ts`)

## Context

`usePiano` must know, at any instant, which notes are **held** and which are **sustained**, for two different consumers:

1. **Event handlers** (key down/up, pointer, sustain toggle, octave change) need the *current* value **synchronously** to make decisions like "is C4 already held? then ignore this second press"
2. **The UI** needs to **re-render** when the sets change, so keys light up

React `useState` alone doesn't fit (1): a state update isn't visible until the next render, and handlers created in an earlier render see **stale** values (the "stale closure" problem). Events can arrive faster than renders: a key-up can follow a key-down within the same frame.

The first implementation also performed side effects (`stopAllNotes()`) **inside a `setState` updater function**. React may call updaters twice in Strict Mode, so they must be pure.

## Decision

Keep the **source of truth in refs** (`heldRef`, `sustainedRef`, `sustainRef`) and **mirror** them into state with one helper:

```ts
const syncNoteState = useCallback(() => {
  setActiveNoteIds(new Set(heldRef.current));
  setSustainedNoteIds(new Set(sustainedRef.current));
}, []);
```

Handlers read and write refs, perform side effects (audio) directly, then call `syncNoteState()`.

## Alternatives considered

| Option | Why not |
| --- | --- |
| `useState` only | Stale reads in handlers; decisions based on outdated data cause stuck or double notes |
| `useReducer` | Clean for pure state transitions, but audio side effects can't live in a reducer, and handlers still can't read the new state synchronously |
| External store (Zustand, Redux) | Solves it, but adds a dependency and concepts for three small sets |
| Refs only, with a manual "force update" | Works, but hides *what* the UI depends on; mirrored state is explicit |

## Consequences

- ✅ Handlers always see the latest values, with no stale closures
- ✅ Side effects happen in event handlers, not in updater functions (Strict Mode safe)
- ✅ The UI gets normal, immutable `Set` state, which works with `React.memo` comparisons
- ⚠️ Two representations must be kept in sync; the rule is **"mutate refs, then call `syncNoteState()`"**, and it's followed in every handler
- ⚠️ Slightly more code than plain `useState`; the trade-off is documented here and in code comments
