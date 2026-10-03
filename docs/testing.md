# Testing

**257 automated tests** across 27 files, running in about 15 seconds with `npm test`, and on every push via CI.

---

## 1. Why test?

- **Confidence to change code.** Refactor freely; a test tells you within seconds if something broke.
- **Bugs stay fixed.** Every bug found during development has a **regression test**.
- **Living documentation.** Tests state exactly how each piece should behave, and unlike docs they can't go stale.

## 2. Tools

| Tool | Role |
| --- | --- |
| [Vitest](https://vitest.dev) | Test runner |
| [jsdom](https://github.com/jsdom/jsdom) | Simulated browser (DOM, events) in Node |
| [React Testing Library](https://testing-library.com/docs/react-testing-library/intro) | Render components and query them **the way users do** (role, label, text) |
| [jest-dom](https://github.com/testing-library/jest-dom) | Readable matchers: `toBeInTheDocument()`, `toBeDisabled()`, `toHaveAttribute()` |
| `src/test/fake-web-audio.ts` | A hand-written fake Web Audio API (jsdom has none) |

## 3. Running tests

```bash
npm test                 # everything once
npm run test:watch       # re-run as you save
npx vitest run tuning    # only files whose path matches "tuning"
npx vitest run -t "sostenuto"   # only tests whose name matches
npm run validate         # lint + typecheck + test + build (what CI runs)
```

## 4. What's tested where

```
              ▲  fewer, slower, more realistic
             ╱ ╲
            ╱E2E╲          (next: Playwright, see roadmap)
           ╱─────╲
          ╱ Integ. ╲       PianoApp, usePiano, useRecorder, useMetronome, useLooper
         ╱───────────╲
        ╱    Unit      ╲   lib/**, ui primitives, piano & console components
       ╱─────────────────╲
```

| File | Covers | Tests |
| --- | --- | --- |
| **lib/music** | | |
| `notes.test.ts` | MIDI ↔ id conversions, frequencies, colors | 9 |
| `keyboard-map.test.ts` | 37 keys, contiguous C3–C6, unique codes, black-key gaps, octave shift | 7 |
| `tuning.test.ts` | Master tuning, transpose, temperament invariants (pure 5/4 and 3/2) | 10 |
| `sequence.test.ts` | Melody format: note values, dots, rests, chords, bar lines, error messages | 8 |
| `riffs.test.ts` | Every riff parses, fits C3–C6 and fills whole bars; lookup, bar lengths | 12 |
| `looper.test.ts` | Note timing and gate, looping, no drift after a late timer, recovery, stop, re-strikes | 8 |
| **lib/audio** | | |
| `voices.test.ts` | Every recipe valid; single/layer/split routing | 15 |
| `dynamics.test.ts` | Touch curves, position velocity, velocity → gain | 6 |
| `effects.test.ts` | Impulse responses: length, pre-delay, decay | 3 |
| `synth-voice.test.ts` | Partials, inharmonicity, velocity, soft pedal, FM, LFOs, noise, release, cleanup | 17 |
| `audio-engine.test.ts` | Init, master chain, layers, polyphony, release, reverb cache, brilliance, clicks | 21 |
| `metronome.test.ts` | Beat spacing, accents (4/4, 6/8), lookahead, tempo change, tap tempo | 12 |
| **lib** | | |
| `note-tracker.test.ts` | Sustain and sostenuto rules, including combinations | 11 |
| `settings.test.ts` | Clamping, rounding, tuning grid, key wrap-around | 6 |
| `dom.test.ts` | Typing targets vs. non-text inputs | 12 |
| **hooks** | | |
| `usePiano.test.tsx` | Keyboard play, both manuals, shortcuts, pedals, layer/split, recorder events | 26 |
| `useRecorder.test.ts` | Record timing, playback, stop, clear | 8 |
| `useMetronome.test.ts` | Start, beat lights, tempo clamp, time signatures, tap | 6 |
| `useLooper.test.ts` | Start, loop, stop, switching riffs, speed, octave shift, unmount | 8 |
| **components** | | |
| `Piano.test.tsx` | 37 keys, labels (incl. layout map), pointer input, split labels | 9 |
| `PedalUnit.test.tsx` | Order, pressed state, toggle | 4 |
| `Display.test.tsx` | LCD content per mode, tuning, notes, recorder, time format | 7 |
| `Transport.test.tsx` | Recorder buttons + tabs keyboard navigation | 6 |
| `Knob.test.tsx` | ARIA, keyboard steps, drag, handled keys | 4 |
| `SegmentedControl.test.tsx` | Radio semantics, roving tabindex, arrows; RadioPads | 7 |
| `Stepper.test.tsx` | Single step, hold-to-repeat, keyboard activation, limits | 6 |
| `PianoApp.test.tsx` | Everything wired together, including a Notes loop | 9 |

## 5. Anatomy of a test

**Arrange → Act → Assert**, named as a sentence about behavior:

```ts
it('holds only the notes that were down when it was pressed', () => {
  tracker.press('C3');               // Arrange
  tracker.setSostenuto(true);
  tracker.press('E4');

  expect(tracker.release('C3')).toBe('sustain');   // Act + Assert
  expect(tracker.release('E4')).toBe('stop');
});
```

## 6. Testing audio without speakers: the fake `AudioContext`

`fake-web-audio.ts` implements just enough of the Web Audio API and **records** what happens:

```ts
class FakeAudioParam { value; events: ParamEvent[]; inputs: Set<FakeAudioNode>; … }   // every ramp, and modulators
class FakeOscillatorNode { frequency; detune; startTime; stopTime; finish() }          // finish() simulates "ended"
class FakeAudioContext { currentTime = 0; oscillators = []; gainNodes = []; panners = []; convolvers = []; buffers = []; … }
```

Tests install it with `installFakeAudioContext()`; Vitest removes it after each test (`unstubGlobals: true`). That makes precise assertions possible:

```ts
// The FM modulator is wired into the carrier's frequency
expect(carrier.frequency.inputs.size).toBe(1);

// Release fades from where the envelope actually is
expect(hold.value).toBeLessThan(peak);
expect(events.at(-1)).toEqual({ type: 'linearRamp', value: 0, time: 0.45 });
```

> **Fakes vs. mocks:** a mock (`vi.fn()`) checks "was this called?"; a fake is a simplified working implementation. Fakes let tests check **outcomes** (the audio graph's shape) rather than call sequences, so they survive refactors.

## 7. Controlling time

Three techniques keep time-based code deterministic:

| Technique | Used for |
| --- | --- |
| **Fake audio clock**: set `ctx.currentTime` by hand | Envelopes, releases, the polyphony limit |
| **Fake clock object** implementing `MetronomeClock` | The metronome scheduler, in isolation |
| **`vi.useFakeTimers()`** + `vi.advanceTimersByTime(ms)` | Recorder playback, the looper, Stepper hold-to-repeat, beat lights |
| **`vi.setSystemTime()`** mid-test | Simulating a busy main thread: timers fire late, and the looper must stay on its timeline |

```ts
act(() => result.current.play(performer));
act(() => vi.advanceTimersByTime(100));
expect(performer.noteOn).toHaveBeenCalledWith('C4', 0.8);
```

The recorder and the looper use `Date.now()` rather than `performance.now()` precisely so fake timers control it.

> **Fake-timer detail:** a zero-delay `setTimeout` created *inside* another timer runs 1 ms later under fake timers. Assert on behavior ("one fresh start, not a burst") rather than on that exact millisecond.

## 8. Testing components like a user

Query by **role and accessible name**. If a test can't find the control, a screen-reader user can't either:

```ts
screen.getByRole('slider', { name: 'Master volume' });
screen.getByRole('radio', { name: /Harpsichord/ });
screen.getByRole('button', { name: 'Sustain pedal' });
screen.getByRole('group', { name: 'Display' });
```

### Animated UI: wait for it

Tab pages cross-fade (`AnimatePresence mode="wait"`): the next page mounts after the previous one fades out. Those tests use **`findBy…`** queries, which retry until the element appears:

```ts
fireEvent.click(tab('Tuning'));
fireEvent.click(await screen.findByRole('button', { name: 'Transpose up a semitone' }));
```

## 9. Testing hooks

```ts
const renderPiano = () => renderHook(() => usePiano({ audio: useAudioEngine() }));
const { result } = renderPiano();
fireEvent.keyDown(window, { code: 'KeyQ' });            // a real event on window
expect(result.current.activeNoteIds).toEqual(new Set(['F4']));
```

Hooks that take dependencies are easy to isolate. `useMetronome` gets a hand-made `AudioControls` with a controllable clock.

## 10. Regression tests

| Bug | Test |
| --- | --- |
| A note replayed during its release got stuck | `audio-engine`: *can stop a note that was replayed during its release tail* |
| Shift changed which note a key played | `usePiano`: *plays the same note with Shift held (the soft pedal)* |
| Hovering a key stopped a note held on the keyboard | `Piano`: *does not stop a note when the pointer just passes over the key* |
| Ctrl+arrows changed the octave | `usePiano`: *leaves Ctrl+arrow combinations to the browser* |
| Lifting sustain cut notes still held | `usePiano` / `note-tracker`: *does not cut notes that are still held…* |
| Arrow keys on a focused control also moved the octave | `Knob`: *marks handled keys so global shortcuts ignore them* + `usePiano`: *skips keys a focused control already handled* |

> **Verify tests can fail.** After writing a test, break the code on purpose and watch it go red. For example, removing the sostenuto check in `NoteTracker.isPedalHolding` makes four tests fail.

## 11. Checklist for a new test

1. Create `thing.test.ts(x)` next to `thing.ts(x)`
2. Import from `vitest` explicitly
3. Audio? `installFakeAudioContext()` in `beforeEach`. Time? Fake timers or a fake clock
4. One behavior per test, named as a sentence
5. Make it fail once on purpose
6. `npm run validate` before committing

## 12. What isn't tested (yet)

- **How it sounds.** Synthesis quality needs ears
- **Pixels.** Colors and layout; candidates for screenshot tests
- **Real browsers.** jsdom isn't Chrome; Playwright E2E tests would cover this ([roadmap](./roadmap.md))
