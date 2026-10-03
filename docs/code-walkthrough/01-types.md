# Part 1: Types (`src/types/index.ts`)

## Purpose

Defines the **shape of every piece of data shared between layers**: notes, settings, pedals, audio requests and recorded events. It contains no runtime code; TypeScript erases it at build time.

## Where it fits

```
types/index.ts  ◄── imported by lib/, hooks/, components/
```

**Convention:** shapes used by more than one layer live here. Props used by a single component (e.g. `PianoKeyProps`) are declared next to that component.

## Code explained

### Notes

```ts
export type NoteName = 'C' | 'C#' | … | 'B';   // union: only these 12 strings are valid
export type Manual = 'lower' | 'upper';

export interface Note {
  id: string;        // 'F#4': used as the key in sets, maps, aria-labels
  name: NoteName;
  octave: number;
  midi: number;      // 66: for math (tuning, voice routing)
  isBlack: boolean;
  code: string;      // 'Digit2': the physical computer key (KeyboardEvent.code)
  keyLabel: string;  // '2': default label (replaced by the real layout when known)
  manual: Manual;    // which pair of keyboard rows plays it
}
```

`id` and `midi` describe the same note in two ways: ids are readable and stable keys; MIDI numbers are for arithmetic.

### Sound settings

```ts
export type VoiceId = 'grand' | 'bright' | 'electric' | 'harpsichord' | 'organ' | 'strings' | 'vibraphone' | 'celesta';
export type KeyboardMode = 'single' | 'layer' | 'split';
export type ReverbType = 'off' | 'room' | 'hall' | 'cathedral';
export type Brilliance = 'mellow' | 'normal' | 'bright';
export type TouchCurve = 'light' | 'medium' | 'heavy' | 'fixed';
export type TemperamentId = 'equal' | 'pure-major' | 'pythagorean' | 'meantone' | 'werckmeister' | 'kirnberger';
```

Every option is a **string-literal union**, so a typo like `'cathedrall'` is a compile error, and `switch` statements can be checked for completeness.

`PianoSettings` gathers every adjustable value: volume, octave shift, transpose, reference pitch, temperament and its root, voice, mode, layer voice and balance, split voice and split index, reverb and level, brilliance, touch. One object means one source of truth, one validation function (`sanitizeSettings`), and one `updateSettings(patch)` entry point.

### Pedals

```ts
export type PedalName = 'soft' | 'sostenuto' | 'sustain';
export type PedalState = Record<PedalName, boolean>;   // { soft: false, sostenuto: false, sustain: true }
```

`Record<K, V>` builds an object type with exactly those keys.

### Audio requests

```ts
export interface VoiceLayer { voice: VoiceId; gain: number }
export interface PlayNoteOptions { voices: VoiceLayer[]; velocity: number; midi: number; soft?: boolean }
```

What `usePiano` hands the engine: *which* voices (one, or two in layer mode), how hard, which pitch, soft pedal or not.

### Recorder events: a discriminated union

```ts
export type PerformanceEvent =
  | { time: number; type: 'noteOn'; noteId: string; velocity: number }
  | { time: number; type: 'noteOff'; noteId: string }
  | { time: number; type: 'pedal'; pedal: PedalName; down: boolean };
```

The `type` field **discriminates** the union. After `if (event.type === 'noteOn')`, TypeScript knows `event.velocity` exists. `PerformanceAction` is the same without `time` (what `usePiano` emits before the recorder timestamps it).

## Why it's built this way

- **One place for data shapes.** Change `Note` and the compiler lists every file to update.
- **Unions over strings and booleans.** `mode: 'single' | 'layer' | 'split'` is clearer and safer than two booleans `isLayer`/`isSplit`, which allow the impossible state "both".
- **Discriminated unions model events.** A standard pattern for messages, actions and events in TypeScript codebases.

## 🧪 Try it yourself

1. Add `'choir'` to `VoiceId` and run `npm run typecheck`. Nothing breaks yet, but `voices.test.ts` will fail ("defines 8 voices") once you add a recipe. Add one in `voices.ts` (see [Part 3](./03-audio.md)).
2. Remove `velocity` from the `noteOn` event type and read the errors in `useRecorder.ts`.
