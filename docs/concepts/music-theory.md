# Music theory for programmers

Just enough music theory to understand [`src/lib/notes.ts`](../../src/lib/notes.ts). No musical background needed.

---

## 1. The 12 notes

Western music uses **12 notes** that repeat over and over, low to high:

```
C  C#  D  D#  E  F  F#  G  G#  A  A#  B  | C  C#  D …
└──────────────── one octave ───────────┘  (repeats, higher)
```

- The 7 "plain" notes (**C D E F G A B**) are the **white keys** (*naturals*).
- The 5 notes with `#` ("sharp") are the **black keys**.
- There's no black key between **E–F** and **B–C**. That's why black keys come in groups of 2 and 3.

In code ([`types/index.ts`](../../src/types/index.ts)):

```ts
export type NoteName = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
```

Using a **union type** instead of `string` means TypeScript rejects typos like `'H'` or `'Cb'` at compile time.

## 2. Octaves

After B, the pattern starts again at C, but higher. Each repetition is an **octave**, numbered so we can tell them apart: **C4** is "middle C", **C5** is the next C up.

The magic property: **going up one octave doubles the frequency.**

| Note | Frequency |
| --- | --- |
| A3 | 220 Hz |
| A4 | 440 Hz |
| A5 | 880 Hz |

That's why octave shift in the app is simple. `generateNotes(1)` adds 1 to every octave number, and every frequency doubles.

## 3. Semitones and equal temperament

The distance between two neighboring notes (C → C#, or E → F) is a **semitone**. An octave has 12 semitones, and the frequency doubles over those 12 steps.

Modern pianos use **equal temperament**: every semitone multiplies the frequency by the same ratio. Since 12 equal steps must multiply to 2:

```
ratio¹² = 2   →   ratio = ¹²√2 = 2^(1/12) ≈ 1.05946
```

So every semitone up is about **5.9% higher** in frequency.

## 4. MIDI numbers: turning notes into integers

To do math on notes, we give each one a single integer, its **MIDI number** (a standard used by all digital instruments):

```
midi = (octave + 1) × 12 + noteIndex
```

where `noteIndex` is the position in the chromatic scale (C = 0, C# = 1 … B = 11).

| Note | octave | noteIndex | MIDI |
| --- | --- | --- | --- |
| C4 | 4 | 0 | (4+1)×12 + 0 = **60** |
| A4 | 4 | 9 | (4+1)×12 + 9 = **69** |
| C5 | 5 | 0 | **72** |

A4 (MIDI 69) is tuned to exactly **440 Hz**, the worldwide reference pitch.

## 5. The frequency formula

Combine the two ideas: start at A4 = 440 Hz and multiply by `2^(1/12)` once per semitone away:

```
frequency = 440 × 2^((midi − 69) / 12)
```

That's exactly `getFrequency()`:

```ts
export function getFrequency(noteName: NoteName, octave: number): number {
  const noteIndex = CHROMATIC_SCALE.indexOf(noteName);
  const midiNumber = (octave + 1) * 12 + noteIndex;
  return 440 * Math.pow(2, (midiNumber - 69) / 12);
}
```

**Worked example: C4**

```
midi = 60
frequency = 440 × 2^((60 − 69) / 12) = 440 × 2^(−0.75) ≈ 261.63 Hz ✅
```

These values are verified in [`notes.test.ts`](../../src/lib/notes.test.ts).

## 6. Mapping a computer keyboard to a piano

The layout mirrors a real piano: the **home row** is the white keys, and the **row above** is the black keys, placed in the gaps where black keys actually sit.

```
 Computer:    W   E       T   Y   U       O   P
 Piano:      C#  D#      F#  G#  A#      C#  D#
           ┌──┬█┬──┬█┬──┬──┬█┬──┬█┬──┬█┬──┬──┬█┬──┬█┬──┐
 Computer: │A │ │S │ │D │F │ │G │ │H │ │J │K │ │L │ │; │
 Piano:    │C │ │D │ │E │F │ │G │ │A │ │B │C │ │D │ │E │
           └──┴─┴──┴─┴──┴──┴─┴──┴─┴──┴─┴──┴──┴─┴──┴─┴──┘
                       octave 4                octave 5
```

Notice: there's **no key at R or I**, because there's no black key between E–F or B–C on a real piano. The keyboard mapping copies the gaps.

That's 17 keys: 10 white (C4 to E5) and 7 black. Each entry in `KEYBOARD_NOTE_MAP` has an `octaveOffset` (0 or 1), so the second C is one octave higher than the first.

## 7. Colors

Each of the 12 note names gets its own color, going around the rainbow from C (red) to B (fuchsia). This is called **chromesthesia-inspired** coloring: every C is red in every octave, so you start to recognize notes by color.

## Further reading

- [Wikipedia: Equal temperament](https://en.wikipedia.org/wiki/Equal_temperament)
- [Wikipedia: Piano key frequencies](https://en.wikipedia.org/wiki/Piano_key_frequencies)
- [musictheory.net lessons](https://www.musictheory.net/lessons)
