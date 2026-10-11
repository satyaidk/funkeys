# Testing

**448 unit and integration tests** across 38 files, running in about 15 seconds with `npm test`, plus a **Playwright end-to-end suite** that runs the real app in Chromium on a desktop and a phone-sized touch screen. Both run on every push via CI.

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
            ╱E2E╲          e2e/*.spec.ts: Playwright, real Chromium (desktop + phone)
           ╱─────╲
          ╱ Integ. ╲       PianoApp, usePiano, useRecorder, useMetronome, useSequencePlayer, transcriber
         ╱───────────╲
        ╱    Unit      ╲   lib/**, ui primitives, piano & console components
       ╱─────────────────╲
```

| File | Covers | Tests |
| --- | --- | --- |
| **lib/music** | | |
| `notes.test.ts` | MIDI ↔ id conversions, frequencies, colors | 9 |
| `keyboard-map.test.ts` | 37 keys; **the pitch of every key at every octave shift** (MIDI, name, frequency); white/black pattern; range; best-fit octave | 20 |
| `tuning.test.ts` | Master tuning, transpose, temperament invariants (pure 5/4 and 3/2) | 10 |
| `sequence.test.ts` | Melody format: note values, dots, **exact triplets**, rests, chords, bar lines, two-hand parts, error messages | 14 |
| `note-events.test.ts` | Beats ⇄ seconds, timing a melody, sorting, validation of untrusted notes, edits | 16 |
| `songs.test.ts` | Every song parses, stays on 88 keys and fills whole bars in every part; labels; search, filters, curated picks | 41 |
| `midi-file.test.ts` | Variable-length numbers, MIDI round trips (to a millisecond, five minutes long), running status, tempo | 8 |
| **lib/audio** | | |
| `voices.test.ts` | Every recipe valid; single/layer/split routing | 15 |
| `dynamics.test.ts` | Touch curves, position velocity, velocity → gain | 6 |
| `effects.test.ts` | Impulse responses: length, pre-delay, decay | 3 |
| `synth-voice.test.ts` | Partials, inharmonicity, velocity, soft pedal, FM, LFOs, noise, release, **cancel after a booked release**, cleanup | 21 |
| `audio-engine.test.ts` | Init, master chain, layers, polyphony, release, **scheduled notes**, reverb cache, brilliance, clicks | 26 |
| `metronome.test.ts` | Beat spacing, accents (4/4, 6/8), lookahead, tempo change, tap tempo | 12 |
| `sequence-player.test.ts` | Exact audio-clock times, chords, overlaps, a one-minute silence, a five-minute piece, pause/resume/seek/stop, speed, loop, no double booking | 28 |
| **lib/transcription** | | |
| `audio-file.test.ts` | Accepted types, size and length limits, browsers that can't decode a format | 9 |
| `notes-from-frames.test.ts` | Chunk plan; **chunked decoding equals one pass**; overtone cleanup; piano notes | 14 |
| `transcriber.test.ts` | Whole flow with a fake worker: progress, transfer, validation, errors, stalls, cancel; the worker's own steps | 11 |
| `editor.test.ts` | Select, edit, delete, add, undo/redo, history limit; the notes file format | 13 |
| `model-files.test.ts` | The served model matches the installed package byte for byte | 4 |
| **lib** | | |
| `note-tracker.test.ts` | Sustain and sostenuto rules, including combinations | 11 |
| `pointer-tracker.test.ts` | Fingers on keys: chords, glissando, sliding off, shared keys | 7 |
| `voicing.test.ts` | Frequency, transpose, split by keyboard position | 4 |
| `settings.test.ts` | Clamping, rounding, tuning grid, key wrap-around | 6 |
| `dom.test.ts` | Typing targets vs. non-text inputs; controls that use the arrows | 14 |
| `format.test.ts`, `favorites.test.ts` | Clock and size formats; saved favorites | 8 |
| **hooks** | | |
| `usePiano.test.tsx` | Keyboard play, both manuals, shortcuts (incl. the sostenuto key), sliders keep their arrows, pedals, hidden tab, layer/split, recorder events | 29 |
| `useRecorder.test.ts` | Record timing, playback, stop, clear | 8 |
| `useMetronome.test.ts` | Start, beat lights, tempo clamp, time signatures, tap | 6 |
| `useSequencePlayer.test.ts` | Playback through the engine with the piano's tuning, key lighting, one source at a time, position | 10 |
| **components** | | |
| `Piano.test.tsx` | 37 keys, labels, pointer input: **glissando, multi-finger chords**, cancel, blur, hidden tab, screen-reader activation, playback lighting, octave toolbar | 17 |
| `PedalUnit.test.tsx` | Order, pressed state, toggle | 4 |
| `Display.test.tsx` | LCD content per mode, tuning, notes, recorder, time format | 7 |
| `Transport.test.tsx` | Recorder buttons + tabs keyboard navigation, controlled tabs | 7 |
| `Knob.test.tsx` | ARIA, keyboard steps, drag, handled keys | 4 |
| `SegmentedControl.test.tsx` | Radio semantics, roving tabindex, arrows; RadioPads | 7 |
| `Stepper.test.tsx` | Single step, hold-to-repeat, keyboard activation, limits | 6 |
| `PianoApp.test.tsx` | Everything wired together: a song lighting keys on the audio clock, search, header links, octave buttons, shortcuts | 13 |

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
| **Fake clock object** implementing `MetronomeClock` / `PlaybackClock` | The metronome and sequence player schedulers, in isolation: the test moves the audio clock and the timers together |
| **`vi.useFakeTimers()`** + `vi.advanceTimersByTime(ms)` | Recorder playback, Stepper hold-to-repeat, beat lights, the player's 25 ms tick |

```ts
act(() => result.current.play(performer));
act(() => vi.advanceTimersByTime(100));
expect(performer.noteOn).toHaveBeenCalledWith('C4', 0.8);
```

The recorder uses `Date.now()` rather than `performance.now()` precisely so fake timers control it.

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
| Arrow keys on the focused tempo slider also moved the octave (native range inputs don't call `preventDefault`) | `usePiano`: *leaves the arrows to a focused slider* |
| Three triplets added up to 0.9999… beats | `sequence`: *makes a triplet two-thirds as long, three to a beat* |
| Changing speed during the first 50 ms skipped the opening notes | `sequence-player`: *keeps the first notes when the speed changes the instant playback starts* |
| A TensorFlow.js error inside the worker left the page waiting forever | `transcriber`: *gives up when the worker goes silent* |

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
- **Pixels.** Colors and visual polish; candidates for screenshot comparison tests (layout overflow *is* tested, below)
- **Other browsers.** The end-to-end suite runs Chromium only; Firefox and WebKit projects are a one-line addition each
- **Real piano recordings.** The transcription test uses a synthesized recording with known notes

## 13. End-to-end tests (Playwright)

Unit tests can't see layout, real touch events, the audio clock in a browser, a Web Worker or the transcription model. `e2e/*.spec.ts` runs the **production build** in Chromium, as two projects: a 1440 × 900 desktop and a 375 × 667 touch phone.

```bash
npm run build
npm run test:e2e                       # starts the server on port 3100 by itself
npx playwright test -g "chord"         # only tests whose name matches
npx playwright show-report             # after a failure: traces, screenshots
```

| Spec | Checks |
| --- | --- |
| `piano.spec.ts` | Computer-key notes and chords; mouse; **a three-finger touch chord** (several touch points through the DevTools protocol, which Playwright's one-finger `tap` can't do); glissando; octave buttons; the docked keyboard and minimap on a phone; **no sideways scrolling on any page at 320, 360, 375, 390, 430, 768, 1024 and 1440 px**; the shortcuts dialog |
| `playback.spec.ts` | A song lights its keys; **a full transcription** of `e2e/fixtures/piano-fixture.wav` with the real Basic Pitch model, scored against the notes that were played (recall ≥ 90%, precision ≥ 80%; it currently gets 25/25 and no false notes), played back and exported as MIDI; a non-audio file explained |

The fixture is **synthesized with known notes** by `npm run fixture:piano` (a scale, a silence, chords, a melody over a held bass), so the test has exact ground truth. It's not a real piano recording: real recordings will score lower.

CI runs the suite in its own job (`npx playwright install --with-deps chromium` first) and keeps the HTML report when it fails.
