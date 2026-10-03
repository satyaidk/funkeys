# Testing

The project has **76 automated tests** across 7 files. They run in about 5 seconds with `npm test`, and on every push via CI.

---

## 1. Why test?

- **Confidence to change code.** Refactor freely; if something breaks, a test tells you within seconds.
- **Bugs stay fixed.** Every bug found during development got a **regression test**, so it can't silently come back.
- **Documentation that can't go stale.** Tests show exactly how each piece is meant to behave.

## 2. Tools

| Tool | Role |
| --- | --- |
| [Vitest](https://vitest.dev) | Test runner: finds `*.test.ts(x)` files, runs them, reports results |
| [jsdom](https://github.com/jsdom/jsdom) | A simulated browser (DOM, events) running in Node |
| [React Testing Library](https://testing-library.com/docs/react-testing-library/intro) | Renders components and finds elements **the way users do** (by role, label, text) |
| [jest-dom](https://github.com/testing-library/jest-dom) | Readable matchers: `toBeInTheDocument()`, `toBeDisabled()`, `toHaveAttribute()` |
| `src/test/fake-web-audio.ts` | A hand-written fake `AudioContext` (jsdom has no audio) |

## 3. Running tests

```bash
npm test               # run everything once
npm run test:watch     # re-run affected tests as you save files
npx vitest run notes   # run only test files whose path matches "notes"
npm run validate       # lint + typecheck + test + build (what CI runs)
```

## 4. The testing pyramid

```
            ▲  fewer, slower, more realistic
           ╱ ╲
          ╱ E2E╲        (not yet: see roadmap: Playwright)
         ╱───────╲
        ╱Integration╲   PianoApp.test.tsx, usePiano.test.tsx
       ╱─────────────╲
      ╱     Unit       ╲ notes, dom, audio-engine, Piano, ControlPanel
     ╱───────────────────╲
            many, fast, focused
```

| File | Level | What it covers | Tests |
| --- | --- | --- | --- |
| `lib/notes.test.ts` | Unit | Frequency math, key mapping, octave shifting, colors | 10 |
| `lib/dom.test.ts` | Unit | `isTypingTarget` for every input type | 12 |
| `lib/audio-engine.test.ts` | Unit | Init, voices, envelope, release, cleanup, volume (with fake audio) | 17 |
| `components/piano/Piano.test.tsx` | Unit | Key rendering, labels, `aria-pressed`, pointer events | 8 |
| `components/controls/ControlPanel.test.tsx` | Unit | Volume, octave buttons and limits, sustain toggle | 8 |
| `hooks/usePiano.test.tsx` | Integration | Real keyboard events → state, through the real engine | 18 |
| `components/PianoApp.test.tsx` | Integration | The whole UI wired together | 3 |

## 5. Anatomy of a test

Every test follows **Arrange → Act → Assert**:

```ts
it('releases the right note even if Shift changed the character', () => {
  // Arrange: render the hook
  const { result } = renderHook(() => usePiano());

  // Act: press ";" then release while Shift turns it into ":"
  press(';', 'Semicolon');
  release(':', 'Semicolon', { shiftKey: true });

  // Assert: nothing is stuck
  expect(result.current.activeNoteIds.size).toBe(0);
});
```

Test names read as **sentences describing behavior** ("releases the right note even if…"), not implementation ("calls pressedKeys.delete"). That way tests survive refactors.

## 6. Testing the audio engine without audio: the fake `AudioContext`

jsdom has no Web Audio API. Instead of mocking every call with `vi.fn()`, `src/test/fake-web-audio.ts` implements a **small fake** with the same shape that **records** what happens:

```ts
class FakeAudioParam {
  value: number;
  events: ParamEvent[] = [];   // every setValueAtTime / ramp, in order
  linearRampToValueAtTime(value, time) { this.events.push({ type: 'linearRamp', value, time }); … }
}

class FakeOscillatorNode {
  startTime = null; stopTime = null;   // when start()/stop() were scheduled
  finish() { this.onended?.(); }       // test helper: simulate playback ending
}

class FakeAudioContext {
  currentTime = 0;                     // tests move the audio clock by hand
  oscillators = []; gainNodes = [];    // everything created, for assertions
}
```

Tests install it with `vi.stubGlobal('AudioContext', FakeAudioContext)` (via `installFakeAudioContext()`), and Vitest removes it after each test (`unstubGlobals: true`).

This makes precise assertions possible:

```ts
expect(gain.events).toEqual([
  { type: 'set',        value: 0,       time: 0 },
  { type: 'linearRamp', value: 1,       time: attack },
  { type: 'linearRamp', value: sustain, time: attack + decay },
]);
```

> **Fakes vs. mocks.** A *mock* (`vi.fn()`) checks "was this function called?". A *fake* is a simplified working implementation. Fakes make tests less brittle: they check *outcomes* (the envelope shape), not *call sequences*.

## 7. Testing components the way users use them

React Testing Library deliberately makes it hard to poke at component internals. You find elements by **accessible role and name**, which also checks that the UI is accessible:

```ts
screen.getByRole('button', { name: 'C#4' });        // uses aria-label
screen.getByLabelText('Volume');                    // uses <label htmlFor>
fireEvent.pointerDown(key('G4'), { button: 0 });
expect(onNoteStart).toHaveBeenCalledWith('G4');
```

If a test can't find a button by its name, a screen-reader user can't either.

## 8. Testing hooks

`renderHook` runs a hook inside a tiny test component and exposes its latest return value as `result.current`:

```ts
const { result } = renderHook(() => usePiano());
fireEvent.keyDown(window, { key: 'a', code: 'KeyA' });   // real event on window
expect(result.current.activeNoteIds).toEqual(new Set(['C4']));
```

`fireEvent` wraps the dispatch in `act()`, so React finishes re-rendering before the assertion. For direct calls, wrap them yourself: `act(() => result.current.onNoteStart('E4'))`.

## 9. Regression tests

Each bug fixed during development has a test named after the behavior it protects:

| Bug | Test |
| --- | --- |
| Replaying a note during its release left it stuck | `audio-engine.test.ts`: *can stop a note that was replayed during its release tail* |
| Releasing with Shift held left a note stuck | `usePiano.test.tsx`: *releases the right note even if Shift changed the character* |
| Volume slider focus silenced the keyboard | `usePiano.test.tsx`: *keeps playing while the volume slider is focused* |
| Ctrl+Z changed the octave | `usePiano.test.tsx`: *does not react to Ctrl+Z / Ctrl+X* |
| Turning sustain off cut held notes | `usePiano.test.tsx`: *does not cut notes that are still held…* |
| Hovering over a key stopped its note | `Piano.test.tsx`: *does not stop a note when the pointer just passes over the key* |

> **Verify your tests can fail.** A test that never fails proves nothing. After writing one, temporarily re-introduce the bug and watch it go red. (This was done for the hover regression test.)

## 10. Writing a new test: checklist

1. Create `thing.test.ts(x)` next to `thing.ts(x)`
2. Import from `vitest` explicitly: `import { describe, it, expect } from 'vitest'`
3. Using audio? Call `installFakeAudioContext()` in `beforeEach`
4. Arrange → Act → Assert, with one behavior per test
5. Name it as a sentence describing behavior
6. Make it fail once on purpose, then make it pass
7. Run `npm run validate` before committing

## 11. What's not tested (yet)

- **Real sound output.** You can't assert "it sounds like a piano"; that needs manual listening
- **Visual appearance** (colors, glow, layout): candidates for screenshot tests
- **Real browsers.** jsdom isn't Chrome. End-to-end tests with Playwright would cover this ([roadmap](./roadmap.md))
