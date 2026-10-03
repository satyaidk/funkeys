# Music theory for programmers

Just enough music theory to understand [`lib/music/`](../../src/lib/music/): notes, MIDI numbers, frequencies, the keyboard layout, and tuning. No musical background needed.

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

A **union type** instead of `string` means TypeScript rejects typos like `'H'` at compile time.

## 2. Octaves

After B the pattern starts again at C, higher. Each repetition is an **octave**, numbered: **C4** is "middle C", **C5** the next C up.

**Going up one octave doubles the frequency:** A3 = 220 Hz, A4 = 440 Hz, A5 = 880 Hz. That's why octave shift is easy: add 12 semitones and every frequency doubles.

## 3. Semitones and equal temperament

The step between neighboring notes (C → C#, E → F) is a **semitone**; an octave has 12. In **equal temperament** every semitone multiplies the frequency by the same ratio. Twelve equal steps must make 2, so:

```
ratio¹² = 2   →   ratio = ¹²√2 ≈ 1.05946
```

Musicians measure intervals in **cents**: 100 cents = one equal semitone, 1200 cents = one octave. Cents are logarithmic, so they add up the way intervals sound.

## 4. MIDI numbers: notes as integers

Each key gets an integer, its **MIDI number**:

```
midi = (octave + 1) × 12 + noteIndex        (C = 0, C# = 1 … B = 11)
```

| Note | MIDI |
| --- | --- |
| C4 (middle C) | 60 |
| A4 | 69 |
| C8 (top of a grand piano) | 108 |

`notes.ts` converts both ways: `getMidiNumber('C', 4) → 60`, `midiToNoteId(61) → 'C#4'`, `noteIdToMidi('C#4') → 61`. The app identifies notes by id (`'C#4'`) and does math on MIDI numbers.

## 5. The frequency formula

Start at A4 = 440 Hz and multiply by `2^(1/12)` once per semitone:

```
frequency = 440 × 2^((midi − 69) / 12)
```

**Example, C4:** `440 × 2^((60 − 69) / 12) = 440 × 2^(−0.75) ≈ 261.63 Hz`. Verified in `notes.test.ts` and `tuning.test.ts`.

## 6. Mapping the computer keyboard to 37 piano keys

The four letter and number rows become **two manuals** (keyboards). In each manual, a row of letters is the white keys and the row above, offset by half a key, is the black keys. That's exactly the geometry of a piano.

```
 Upper manual: F4 → C6
   2   3   4       6   7       9   0   -         ← black keys (number row)
 Q   W   E   R   T   Y   U   I   O   P   [   ]   ← white keys
 F4  G4  A4  B4  C5  D5  E5  F5  G5  A5  B5  C6

 Lower manual: C3 → E4
   S   D       G   H   J       L   ;             ← black keys (home row)
 Z   X   C   V   B   N   M   ,   .   /           ← white keys
 C3  D3  E3  F3  G3  A3  B3  C4  D4  E4
```

- The two manuals join without a gap: the lower ends at E4, the upper starts at F4.
- Keys **1, 5, 8, =, F, K** play nothing. They sit exactly where a piano has no black key (between E–F and B–C), so the gaps feel natural.
- That's **37 keys** (22 white, 15 black): three octaves plus one note, the size of a small portable keyboard.
- Octave shift (← / →) moves the whole range by up to two octaves each way, so you can reach C1 to C8.

Keys are matched by **physical position** (`KeyboardEvent.code`, e.g. `'KeyQ'`), so the layout keeps its shape on any keyboard. See [ADR 0006](../decisions/0006-map-notes-by-physical-key.md).

## 7. Transpose and master tuning

Two simple adjustments before the frequency formula:

```
sounding midi = key midi + transpose
frequency     = A4 × 2^((sounding midi − 69) / 12)
```

- **Transpose** adds semitones: with +2, pressing C sounds D.
- **Master tuning** replaces 440 with another A4 frequency (415.3–466.2 Hz).

## 8. Temperaments

Pure intervals come from simple frequency ratios: an octave is 2/1, a fifth 3/2, a major third 5/4. Twelve equal semitones can't hit all of them. The equal major third is 400 cents, while a pure 5/4 third is 386.3 cents, about 14 cents sharp. **Temperaments** are different compromises:

| Temperament | Idea | C→E (third) | C→G (fifth) |
| --- | --- | --- | --- |
| Equal | All semitones 100 cents | 400 | 700 |
| Pure major | Chords built from 5/4 and 3/2 | **386.3** | **702.0** |
| Pythagorean | Stack pure fifths (3/2) | 407.8 | **702.0** |
| Meantone (¼-comma) | Narrow the fifths to make thirds pure | **386.3** | 696.6 |
| Werckmeister III | Spread the compromise so every key works | 390.2 | 696.1 |
| Kirnberger III | Pure C–E third, mostly pure fifths | **386.3** | 696.6 |

`tuning.ts` stores each temperament as **cents above the root** for the 12 semitones, then:

1. **Rotates** the table to the chosen key (the "temperament key"): the interval from the root is `(pitchClass − root) mod 12`
2. Computes each note's **deviation** from equal temperament: `cents[interval] − interval × 100`
3. **Re-centers** so A has zero deviation, keeping A4 exactly at the master tuning in every temperament
4. Applies it: `frequency × 2^(deviation / 1200)`

```ts
export function temperamentOffset(midi, temperament, root) {
  const deviation = (pc) => {
    const interval = pitchClass(pc - root);
    return cents[interval] - interval * 100;
  };
  return deviation(pitchClass(midi)) - deviation(9); // 9 = A
}
```

The tests prove the theory: in pure major, `E4 / C4` is exactly `5/4`; in Pythagorean, `G4 / C4` is exactly `3/2`.

## 9. Colors

Each note name has a color, going around the rainbow from C (red) to B (fuchsia). Every C is red in every octave, so you start to recognize notes by color.

## Further reading

- [Wikipedia: Equal temperament](https://en.wikipedia.org/wiki/Equal_temperament)
- [Wikipedia: Piano key frequencies](https://en.wikipedia.org/wiki/Piano_key_frequencies)
- [Wikipedia: Werckmeister temperament](https://en.wikipedia.org/wiki/Werckmeister_temperament)
- [musictheory.net lessons](https://www.musictheory.net/lessons)
