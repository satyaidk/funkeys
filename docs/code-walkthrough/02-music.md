# Part 2: Music (`src/lib/music/`)

Plain TypeScript for the music-theory side: naming notes, laying out the keyboard, tuning, and the song loops of the Notes page. No React, no audio. Background reading: [Music theory for programmers](../concepts/music-theory.md).

| File | Responsibility |
| --- | --- |
| [`notes.ts`](#notests) | Note names ↔ MIDI numbers ↔ ids, equal-temperament frequency, colors |
| [`keyboard-map.ts`](#keyboard-mapts) | The 37-key layout on the computer keyboard |
| [`tuning.ts`](#tuningts) | Transpose, master tuning, temperaments → frequency |
| [`sequence.ts`](#sequencets) | A text format for melodies (`E5/8 D#5/8`) and its parser |
| [`riffs.ts`](#riffsts) | The song library: famous riffs for the Notes page |
| [`looper.ts`](#looperts) | Plays a melody on the piano over and over, without drifting |

---

## `notes.ts`

### Purpose

Converts between the three ways the app names a note: **name + octave** (`'C#', 4`), **MIDI number** (`61`) and **id** (`'C#4'`).

### Code explained

```ts
export function getMidiNumber(noteName: NoteName, octave: number): number {
  return (octave + 1) * 12 + CHROMATIC_SCALE.indexOf(noteName);
}

export function midiToNoteId(midi: number): string {
  return `${getNoteName(midi)}${getOctave(midi)}`;     // 61 → 'C#4'
}

export function noteIdToMidi(noteId: string): number | null {
  const match = /^([A-G]#?)(-?\d+)$/.exec(noteId);     // 'C#4' → ['C#4', 'C#', '4']
  …
}
```

- `getNoteName` uses `((midi % 12) + 12) % 12`. JavaScript's `%` can return negative numbers (`-1 % 12 === -1`); adding 12 and taking `%` again always gives 0–11.
- `noteIdToMidi` returns `null` for invalid input (`'H4'`, `'E#4'`) instead of throwing. Callers check it, and `usePiano.noteOn` simply ignores bad ids.
- `KEY_NAMES` holds display names with proper symbols (`'C♯'`, `'E♭'`) for the tuning controls.
- `getFrequency(name, octave)` is equal temperament at A4 = 440, kept for reference and tests. The instrument tunes through `tuning.ts`.

### 🧪 Try it yourself

Open `notes.test.ts`, add `expect(midiToNoteId(21)).toBe('A0')` (the lowest key on a grand piano) and run `npm run test:watch`. Then try `midiToNoteId(108)`: what's the highest key?

---

## `keyboard-map.ts`

### Purpose

Maps four rows of the computer keyboard onto **37 piano keys (C3–C6)** as two "manuals", copying a piano's geometry. See [ADR 0010](../decisions/0010-two-manual-37-key-layout.md).

### Code explained

```ts
const key = (code, label, note, octaveOffset, manual) => ({ code, label, note, octaveOffset, manual });

export const KEYBOARD_MAP = [
  key('KeyZ', 'Z', 'C', 0, 'lower'),
  key('KeyS', 'S', 'C#', 0, 'lower'),
  …
  key('KeyQ', 'Q', 'F', 1, 'upper'),
  key('Digit2', '2', 'F#', 1, 'upper'),
  …
  key('BracketRight', ']', 'C', 3, 'upper'),
];
```

- **`code`** is `KeyboardEvent.code`, the physical key position, so Shift, Caps Lock and AZERTY layouts don't change which note plays ([ADR 0006](../decisions/0006-map-notes-by-physical-key.md)).
- The table is in **piano order**, low to high. `Piano.tsx` relies on that to lay out keys and position black keys.
- A tiny `key()` helper keeps 37 rows readable. Data-heavy code benefits from compact, aligned tables.

```ts
export function generateNotes(octaveShift = 0): Note[] {
  return KEYBOARD_MAP.map(({ code, label, note, octaveOffset, manual }) => {
    const octave = BASE_OCTAVE + octaveShift + octaveOffset;
    return { id: `${note}${octave}`, name: note, octave, midi: getMidiNumber(note, octave),
             isBlack: note.includes('#'), code, keyLabel: label, manual };
  });
}
```

A **pure function**: same input, same output. That's why `usePiano` can memoize it with `useMemo`.

### Why it's built this way

The layout is **data, not logic**. To remap keys, edit the table. Nothing else assumes "37": `KEY_COUNT`, `Piano`'s CSS math and `sanitizeSettings` all derive from the table length.

### 🧪 Try it yourself

Add `key('Quote', "'", 'F', 1, 'lower')` after the `Slash` row. Two keys now play F4 (`'` and `Q`). The tests will catch the duplicate (`"spans C3 to C6 with no gaps or duplicates"`). That's the test suite protecting the layout's rules. Undo it.

---

## `tuning.ts`

### Purpose

Turns a key's MIDI number into the **frequency to play**, applying the three tuning functions of a digital piano: transpose, master tuning and temperament.

### Code explained

```ts
export const TEMPERAMENTS: readonly Temperament[] = [
  { id: 'equal', name: 'Equal', description: '…', cents: [0, 100, 200, …, 1100] },
  { id: 'pure-major', name: 'Pure major', …, cents: [0, 111.731, 203.91, 315.641, 386.314, …] },
  …
];
```

Each temperament is **cents above its root** for the 12 semitones (cited values from the standard ratios and historical tables).

```ts
export function temperamentOffset(midi, temperament, root): number {
  const { cents } = getTemperament(temperament);
  const deviation = (pc: number) => {
    const interval = pitchClass(pc - root);   // rotate to the chosen key
    return cents[interval] - interval * 100;   // distance from equal temperament
  };
  return deviation(pitchClass(midi)) - deviation(9);   // keep A at the reference pitch
}

export function midiToFrequency(midi, tuning = DEFAULT_TUNING): number {
  const sounding = midi + tuning.transpose;
  const equal = tuning.referencePitch * Math.pow(2, (sounding - 69) / 12);
  return equal * Math.pow(2, temperamentOffset(sounding, tuning.temperament, tuning.temperamentRoot) / 1200);
}
```

- **Rotation** makes "Werckmeister in G" possible: the table is applied relative to G.
- **Re-centering on A** means changing temperament never changes what "A = 440" means. That's an explicit, tested invariant.
- `PianoSettings` contains all four `Tuning` fields, so `midiToFrequency(midi, settings)` works directly. TypeScript's structural typing accepts any object with the right fields.

### Why it's built this way

The tuning math is the most "domain-heavy" code in the project, so it's isolated in a pure module with tests that check **musical facts**: pure major thirds are exactly 5/4, Pythagorean fifths exactly 3/2, and A stays fixed in every temperament and key.

### 🧪 Try it yourself

Add a temperament: **Young (1799)** with cents `[0, 93.9, 195.8, 297.8, 391.7, 499.9, 591.9, 697.9, 795.8, 893.8, 999.8, 1091.8]`. Add `'young'` to `TemperamentId` in `types/index.ts`, then add the entry to `TEMPERAMENTS`. It appears on the Tuning page automatically, and the tests for ascending cents and "A stays fixed" cover it with no new test code.

---

## `sequence.ts`

### Purpose

Lets a melody be written the way it looks on sheet music, as short tokens, instead of a long array of objects.

### Code explained

```
E5/8      E5 for an eighth note        R/4       a quarter-note rest
A4/8.     a dotted eighth (×1.5)       C4+E4/2   a chord, for a half note
|         a bar line (ignored, only there to help you read)
```

`parseSequence` walks the tokens with one regular expression and keeps a running `beat` counter:

```ts
const STEP = /^(R|[A-G]#?-?\d(?:\+[A-G]#?-?\d)*)\/(16|8|4|2|1)(\.?)$/;
//            rest or pitch(+pitch…)       note value      dot

const length = NOTE_VALUES[value] * (dot ? 1.5 : 1);   // '8' → 0.5 beats
for (const pitch of pitches.split('+')) notes.push({ midi, start: beat, length });
beat += length;
```

Times come out in **beats** (one beat = a quarter note), not milliseconds, so the same melody plays at any tempo: `ms = beats × 60000 / bpm`.

### Why it's built this way

- **A tiny domain-specific language.** Each riff is one readable string you can check against a score, and a typo throws an error naming the exact token (`Can't read "C4/3"`).
- **Sharps only** (`D#`, not `Eb`), matching the app's note ids, so one regex and `noteIdToMidi` cover everything.

---

## `riffs.ts`

### Purpose

The song library behind the **Notes** tab: each riff is a title, artist, original tempo, time signature and a melody string.

```ts
{
  id: 'tokyo-drift',
  title: 'Tokyo Drift',
  artist: 'Teriyaki Boyz',
  bpm: 130,
  timeSignature: '4/4',
  melody: 'A#4/8. B4/8. D#5/8 A#4/4 A#4/4',   // the 3 + 3 + 2 stab
},
```

`beatsPerBar('6/8')` converts a time signature to quarter-note beats (6 × 4 / 8 = 3).

### Why it's built this way

It's **data, not code**, like the voice recipes ([ADR 0009](../decisions/0009-data-driven-voice-recipes.md)): the UI lists whatever is in `RIFFS`. The tests do the checking a reviewer would otherwise have to do by ear, once per song: it parses, every note lies in C3–C6 (so it lights a visible key), and the total length is a whole number of bars (a loop that ends mid-bar stumbles each time round).

---

## `looper.ts`

### Purpose

Plays a parsed melody **on a target** (the piano's `noteOn`/`noteOff`) again and again until stopped, like a loop pedal. See [ADR 0012](../decisions/0012-loop-riffs-through-the-piano.md).

### Code explained

```ts
private bookPass(passStart: number): void {
  for (const note of sequence.notes) {
    const gate = note.length * this.msPerBeat * LOOP_GATE;               // sound for 90%
    this.at(passStart + note.start * this.msPerBeat, () => this.press(note.midi, gate));
  }
  const nextPass = passStart + sequence.beats * this.msPerBeat;
  this.at(nextPass - LOOP_SCHEDULE_AHEAD_MS, () => this.bookPass(nextPass));
}
```

- **`at(time)` takes an absolute time**, so every note is measured from the same timeline. If one timer fires 20 ms late, only that note is late: the next one is still booked from `passStart`, not from "whenever the last one happened". That's why the loop never drifts.
- **Gate:** releasing at 90% leaves a short gap, so `A#4 A#4` is heard as two notes.
- **`held` map:** remembers which *press* holds each key. If a key is pressed again before its release timer fires, the old timer sees a newer press and leaves the key alone.
- **`noteIdFor`:** a function passed in to choose the key for each note. The hook uses it to follow the octave shift.
- If timers fall more than 250 ms behind (a background tab), the pass restarts from now instead of firing every missed note at once.

### Why it's built this way

Same split as the metronome: a plain class with the timing rules (8 tests with fake timers, no React), and a thin hook on top. It plays through the piano, not straight into the audio engine, so the keys light up and every setting applies.

### 🧪 Try it yourself

1. Add a riff: write the melody string, add the entry to `RIFFS`, run `npx vitest run riffs`. The tests tell you if a bar is a sixteenth short.
2. Add **ties** to the format: `F4/2~F4/8` for one note lasting both values. Write the parser test first, then use it to put a bar line inside Axel F's long last note (it's written across two bars today).
