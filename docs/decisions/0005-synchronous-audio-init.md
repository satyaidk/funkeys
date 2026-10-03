# ADR 0005: Initialize audio synchronously instead of awaiting `resume()`

- **Status:** Accepted
- **Area:** Audio (`src/lib/audio-engine.ts`, `src/hooks/useAudioEngine.ts`)

## Context

Browsers' **autoplay policy** keeps an `AudioContext` suspended until a user gesture. The engine is created on the first key press, and `ctx.resume()` returns a `Promise`.

The original `playNote` was `async` and **awaited** initialization before creating the note:

```ts
const playNote = async (id, freq) => {
  await ensureInitialized();   // awaits ctx.resume()
  engine.playNote(id, freq);
};
```

On a quick tap during the first interaction:

```
t=0ms   keydown → playNote → awaiting resume…
t=40ms  keyup   → stopNote("C4") → not in the map yet → nothing happens
t=60ms  resume resolves → engine.playNote("C4") → 🔊 never released (stuck note)
```

Any `await` between "user starts a note" and "note is registered" creates this race.

## Decision

Make `init()` and `playNote()` **synchronous**:

- Create the context and nodes immediately
- Call `ctx.resume()` **without awaiting** (errors are caught and ignored; the next interaction retries)
- Register the note in `activeNotes` in the same tick as the key press

Web Audio allows scheduling on a suspended context: the nodes simply start producing sound once it resumes, a few milliseconds later.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep `await`, track "pending stops" to apply after init | More state and edge cases for no user-visible benefit |
| "Click to enable audio" overlay | Extra friction before you can play; still needs the same care afterwards |
| Pre-create the context on page load | Starts suspended anyway; browsers warn about it |

## Consequences

- ✅ Press and release are always handled in order, so quick taps never stick
- ✅ Simpler API: no Promises leak into React handlers
- ⚠️ The very first note may start a few milliseconds late while the context resumes (not noticeable)
- ⚠️ If `resume()` is rejected, the first note is silent; the next interaction retries
