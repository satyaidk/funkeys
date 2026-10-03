# Part 2: Core library (`src/lib/`)

The `lib/` folder is **plain TypeScript with no React**. It holds the "business logic": music math, sound synthesis and small helpers. Because it doesn't depend on React, it's the easiest code to test and reuse.

| File | Responsibility |
| --- | --- |
| [`constants.ts`](#constantsts) | Every tunable number in one place |
| [`notes.ts`](#notests) | Frequencies, keyboard mapping, note generation |
| [`audio-engine.ts`](#audio-enginets) | Sound synthesis with the Web Audio API |
| [`dom.ts`](#domts) | "Is the user typing in a text field?" helper |

---

## `constants.ts`

### Purpose

Collects all **magic numbers** (values that would otherwise be unexplained literals in the code) into named, documented constants.

### Code explained

| Group | Constants | Used by |
| --- | --- | --- |
| Piano range | `BASE_OCTAVE = 4`, `MIN_OCTAVE_SHIFT = -2`, `MAX_OCTAVE_SHIFT = 2` | `notes.ts`, `usePiano`, `ControlPanel` |
| Audio | `DEFAULT_VOLUME`, `DEFAULT_ENVELOPE`, `HARMONIC_RATIOS`, `HARMONIC_AMPLITUDES`, `HARMONIC_GAIN`, `FILTER_CUTOFF`, `FILTER_Q`, `QUICK_RELEASE`, `COMPRESSOR` | `audio-engine.ts` |
| Key size | `WHITE_KEY_WIDTH`, `MIN_WHITE_KEY_WIDTH`, `WHITE_KEY_HEIGHT`, `MIN_WHITE_KEY_HEIGHT`, `BLACK_KEY_WIDTH_RATIO`, `BLACK_KEY_HEIGHT_RATIO` | `Piano`, `PianoKey` |
| Colors | `NOTE_COLORS` (12 note names → hex) | `notes.ts` → UI |

### `as const`

```ts
export const DEFAULT_ENVELOPE = { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.8 } as const;
export const HARMONIC_RATIOS = [1, 2, 3, 4, 5, 6] as const;
```

`as const` makes the value **deeply read-only** and gives it the narrowest type (`readonly [1, 2, 3, 4, 5, 6]` instead of `number[]`). Nobody can accidentally do `HARMONIC_RATIOS.push(7)`.

### Why it's built this way

When you want to tweak the sound or sizing, you edit one file instead of hunting through the code. Named constants also explain *intent*: `QUICK_RELEASE` says more than `0.015`.

### 🧪 Try it yourself

Change `DEFAULT_ENVELOPE.release` to `3`. Notes now ring for 3 seconds after release, like a cathedral. Try `attack: 0.5` for a slow "string pad" swell.

---

## `notes.ts`

### Purpose

The **music theory** module: calculates frequencies, defines which computer key plays which note, and builds the list of `Note` objects for the current octave.

### Code explained

#### `CHROMATIC_SCALE`

The 12 note names in order. A note's index in this array (C = 0 … B = 11) is used in the frequency formula.

#### `KEYBOARD_NOTE_MAP`

```ts
{ key: 'a', label: 'A', note: 'C',  octaveOffset: 0 },
{ key: 'w', label: 'W', note: 'C#', octaveOffset: 0 },
// …
{ key: ';', label: ';', note: 'E',  octaveOffset: 1 },
```

The 17 keys in **piano order** (low to high). That order matters: `Piano.tsx` relies on it to lay out keys left to right and to work out where each black key goes. `octaveOffset: 1` puts the last five keys in the next octave up.

#### `getFrequency(noteName, octave)`

```ts
const midiNumber = (octave + 1) * 12 + noteIndex;
return 440 * Math.pow(2, (midiNumber - 69) / 12);
```

Converts a note to a MIDI number, then to Hz using equal temperament with A4 = 440 Hz. Fully derived in [Music theory §4–5](../concepts/music-theory.md#4-midi-numbers-turning-notes-into-integers).

#### `generateNotes(octaveShift = 0)`

```ts
return KEYBOARD_NOTE_MAP.map(({ key, label, note, octaveOffset }) => {
  const octave = BASE_OCTAVE + octaveShift + octaveOffset;
  return { name: note, octave, frequency: getFrequency(note, octave),
           isBlack: note.includes('#'), keyboardKey: key, keyLabel: label,
           id: `${note}${octave}` };
});
```

Turns the static map into full `Note` objects. It's a **pure function**: same input, same output, no side effects. That makes it trivial to test and safe to memoize with `useMemo`.

#### Helpers

- `getNoteColor(name)` looks up the rainbow color, falling back to white
- `getWhiteKeys(notes)` / `getBlackKeys(notes)` filter by `isBlack`

### Why it's built this way

The keyboard layout is **data, not code**. To change which keys play which notes, edit the array; no logic changes. This is a **data-driven design**.

### 🧪 Try it yourself

Add a key: `{ key: "'", label: "'", note: 'F', octaveOffset: 1 }` at the end of the map. The keyboard grows to F5 and the layout adjusts automatically, because nothing is hard-coded to 17 keys. Then update the test in `notes.test.ts` that expects 17 notes. (That's the tests doing their job!)

---

## `audio-engine.ts`

### Purpose

Generates piano sound with the Web Audio API. It's a **class** that owns the `AudioContext`, builds a voice for each note, and fades notes out when released. **Read [Web Audio concepts](../concepts/web-audio.md) first.** This section assumes you know what oscillators, gains and ADSR are.

### Where it fits

```
useAudioEngine (hook) ──► AudioEngine (class) ──► Web Audio API
```

React never touches audio nodes directly. The hook calls a small public API:

| Method | What it does |
| --- | --- |
| `init()` | Creates the context and master chain (first call only), resumes if suspended |
| `playNote(id, freq)` | Builds and starts a voice |
| `stopNote(id, immediate?)` | Fades a voice out (0.8s, or 15ms if `immediate`) |
| `stopAllNotes()` | Quickly fades every held note |
| `setVolume(v)` | Sets master volume (works even before `init`) |
| `isNotePlaying(id)` | Is this note currently held? |
| `destroy()` | Stops everything and closes the context |

### Code explained

#### Private state

```ts
private context: AudioContext | null = null;
private masterGain: GainNode | null = null;
private activeNotes: Map<string, ActiveNote> = new Map();
private envelope: ADSREnvelope = { ...DEFAULT_ENVELOPE };
private volume: number = DEFAULT_VOLUME;
```

`private` means only the class can touch these, an **encapsulation** boundary. `activeNotes` is a `Map` keyed by note id ('C4'), which gives fast lookup on release.

#### `init()`

```ts
if (typeof window === 'undefined') return;   // running on the server: do nothing
if (!this.context) {
  const AudioContextCtor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!AudioContextCtor) return;               // very old browser: fail silently
  this.context = new AudioContextCtor();
  // compressor → speakers, master gain → compressor
}
if (this.context.state !== 'running') this.context.resume().catch(() => {});
```

- `??` (nullish coalescing) falls back to Safari's prefixed constructor
- It's **idempotent**: calling it many times is safe, and it only builds once
- It's **synchronous on purpose**. Awaiting `resume()` caused stuck notes on quick taps ([ADR 0005](../decisions/0005-synchronous-audio-init.md))

#### `playNote(noteId, frequency)`

1. If this note is already held (e.g. clicked *and* typed), cut the old voice with a quick fade
2. Create the note's **gain node** and schedule attack → decay → sustain
3. Create a **low-pass filter**
4. For each harmonic ratio, create an **oscillator** at `frequency × ratio` and a **gain** at `amplitude × HARMONIC_GAIN`; connect osc → harmonic gain → note gain; start it
5. Connect note gain → filter → master gain
6. Store everything in `activeNotes`

Note `const context = this.context` at the top. Copying to a local constant lets TypeScript know it's not `null` inside the `forEach` callback, without needing `!` assertions.

#### `stopNote(noteId, immediate)`

```ts
this.activeNotes.delete(noteId);  // ① forget it right away
gainNode.gain.cancelScheduledValues(now);
gainNode.gain.setValueAtTime(this.getEnvelopeLevel(active, now), now);  // ② hold current level
gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);           // ③ fade out
oscillators.forEach((osc) => osc.stop(now + releaseTime + 0.05));      // ④ stop after fade
oscillators[0].onended = () => { /* disconnect all nodes */ };         // ⑤ free memory
```

- **① Delete immediately.** This fixes a race condition where a delayed cleanup deleted a *newer* voice for the same note, leaving it stuck on. See [Web Audio §9](../concepts/web-audio.md#9-voice-lifecycle-and-memory).
- **② Computed level.** Some browsers don't update `gain.value` during a ramp, so the engine calculates where the envelope is (`getEnvelopeLevel`).
- **④ +0.05s** stops the oscillators just *after* the fade reaches zero, so there's no click.
- **⑤ Cleanup on `ended`.** Disconnected nodes can be garbage-collected.

#### `getEnvelopeLevel(note, time)`

A tiny piece of math that answers "what volume has the ADSR envelope reached at this time?":

```ts
if (elapsed < attack) return elapsed / attack;                                   // rising
if (elapsed < attack + decay) return 1 - (1 - sustain) * ((elapsed - attack) / decay); // falling
return sustain;                                                                   // holding
```

It's linear interpolation, matching the `linearRampToValueAtTime` ramps that were scheduled.

#### `setVolume(volume)`

Clamps to 0–1, **stores it**, and if the context exists glides the master gain there with `setTargetAtTime`. Storing it fixes a bug where moving the slider *before* the first note had no effect.

### Why it's built this way

- **A class, not a hook.** Audio objects have their own lifecycle that has nothing to do with React renders. A class keeps that logic framework-independent and testable with a fake `AudioContext`.
- **Small public API.** Callers can't misuse internals they can't see.
- **Defensive by default.** Every method no-ops safely if the context doesn't exist.

### 🧪 Try it yourself

1. In `playNote`, change `osc.type = index === 0 ? 'triangle' : 'sine'` to `'square'` for all oscillators. Retro game sound! Undo.
2. Lower `FILTER_CUTOFF` to `800` in constants. The piano sounds muffled, like it's behind a door.
3. Delete the line `this.activeNotes.delete(noteId);` in `stopNote` and run `npm test`. A test fails and tells you why. Restore it.

---

## `dom.ts`

### Purpose

One helper, `isTypingTarget(target)`, which answers: *is this keyboard event coming from somewhere the user is typing text?* Both keyboard hooks use it to decide whether to ignore a key.

### Code explained

```ts
const NON_TEXT_INPUT_TYPES = new Set(['range', 'checkbox', 'radio', 'button', /* … */]);

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
  return false;
}
```

`instanceof` checks act as **type guards**: after `target instanceof HTMLInputElement`, TypeScript knows `target.type` exists.

### Why it's built this way

The original check was "is the target any `<input>`?". That included the volume slider (`<input type="range">`), so after dragging the slider, **the keyboard stopped playing notes** until you clicked elsewhere. The fix is to block only *text* entry. Pulling the check into one shared, tested function means both hooks get the same correct behavior.

### 🧪 Try it yourself

Add `<input placeholder="type here" />` to `PianoApp.tsx`. Typing in it plays nothing; clicking outside and typing plays notes. Remove it when done.
