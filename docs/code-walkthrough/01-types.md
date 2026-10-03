# Part 1: Types (`src/types/index.ts`)

## Purpose

Defines the **shape of every piece of data** in the app: notes, audio voices, configuration and component props. Every other layer imports from here, so this is the best place to start reading.

## Where it fits

```
types/index.ts  ◄── imported by lib/, hooks/, components/
```

It contains **no runtime code**. TypeScript erases types at build time, so this file adds zero bytes to the JavaScript bundle.

## Code explained

### `NoteName`: a union type

```ts
export type NoteName = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
```

A **union of string literals**: a `NoteName` can only be one of these 12 exact strings. `getNoteColor('H')` is a compile error. Using plain `string` would allow any typo.

### `Note`: everything about one key

```ts
export interface Note {
  name: NoteName;      // 'C', 'F#'…
  octave: number;      // 4 for middle C
  frequency: number;   // Hz, e.g. 261.63
  isBlack: boolean;    // sharp keys are black
  keyboardKey: string; // computer key that plays it: 'a'
  keyLabel: string;    // what to print on the key: 'A'
  id: string;          // unique: 'C4', 'F#5'
}
```

One object holds everything each layer needs: the audio engine uses `frequency`, the keyboard hook uses `keyboardKey`, the UI uses `isBlack`, `keyLabel` and `name`. `id` (name + octave) is the key used everywhere to identify a note, in sets, maps and React `key`s.

### `ADSREnvelope`

The four numbers that shape a note's volume over time (attack, decay, sustain, release). Explained in [Web Audio concepts §5](../concepts/web-audio.md#5-the-adsr-envelope-how-volume-changes-over-time).

### `ActiveNote`: a playing voice

```ts
export interface ActiveNote {
  noteId: string;
  oscillators: OscillatorNode[];  // the 6 harmonic oscillators
  gainNode: GainNode;             // ADSR envelope
  filterNode: BiquadFilterNode;
  startTime: number;              // audio clock time it started
}
```

The engine keeps one per held note so it can release it later. `OscillatorNode`, `GainNode` etc. are **built-in DOM types** that TypeScript provides from the `"dom"` library in `tsconfig.json`.

### `PianoConfig`

User settings: `volume` (0–1), `octaveShift` (−2…+2), `sustain` (on/off).

### Component props

`PianoKeyProps`, `PianoProps` and `ControlPanelProps` describe each component's inputs. Two are optional (`?`):

```ts
isSustained?: boolean;           // PianoKeyProps
sustainedNoteIds?: Set<string>;  // PianoProps
```

Optional props let the component be used without them (the component supplies a default), which keeps the API easy to use and tests short.

## Why it's built this way

- **One source of truth for data shapes.** If `Note` changes, TypeScript points at every file that needs updating.
- **Types as documentation.** The JSDoc comment on each field shows up when you hover in VS Code.
- **`interface` for objects, `type` for unions.** A common convention: interfaces describe object shapes and can be extended; type aliases are needed for unions.

> **Note:** `NowPlayingProps` lives inside `NowPlaying.tsx` instead of here. Props used by only one component can stay with it; shared shapes go in `types/`. Both approaches are common. What matters is being consistent and deliberate.

## 🧪 Try it yourself

1. Add a `velocity: number` field to `Note`. Run `npm run typecheck`. TypeScript lists every place that creates a `Note` and now fails (just `generateNotes`). That's TypeScript guiding a refactor.
2. Change `octave: number` to `octave: string` and read the errors. Then undo.
