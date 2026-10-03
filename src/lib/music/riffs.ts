/**
 * @fileoverview The song library of the Notes page: famous riffs that loop.
 *
 * A **riff** is a short musical phrase that repeats, the hook you remember
 * from a song. Each one here is the melody only (one hand), written in the
 * text format from `sequence.ts`, and kept inside the keyboard's range
 * (C3–C6) so every note lights a key you can see and play along with.
 *
 * Adding a song is adding an entry: the tests check that every melody
 * parses, fits the keyboard and fills whole bars, so it loops cleanly.
 *
 * Transcriptions are simplified by ear and from public letter-note
 * arrangements; some are moved to another octave to fit the keyboard.
 */

/** Time signatures the library uses */
export type RiffTimeSignature = '4/4' | '6/8' | '3/8';

export interface Riff {
  /** Stable id, used as the React key and the selected value */
  id: string;
  title: string;
  artist: string;
  /** Original tempo in quarter-note beats per minute */
  bpm: number;
  timeSignature: RiffTimeSignature;
  /** The melody in `sequence.ts` format */
  melody: string;
}

export const RIFFS: readonly Riff[] = [
  {
    id: 'tokyo-drift',
    title: 'Tokyo Drift',
    artist: 'Teriyaki Boyz',
    bpm: 130,
    timeSignature: '4/4',
    // The 3 + 3 + 2 stab that drives the whole track
    melody: 'A#4/8. B4/8. D#5/8 A#4/4 A#4/4',
  },
  {
    id: 'lean-on',
    title: 'Lean On',
    artist: 'Major Lazer & DJ Snake',
    bpm: 98,
    timeSignature: '4/4',
    // The vocal-chop drop, an octave down; the second phrase answers the first
    melody: `
      A#4/4 C5/2 R/4         | D5/4 C5/8 G4/4. A#4/8 G4/8 | A#4/4 G4/8 G4/4 G4/4 F4/8 | A#4/4 G4/2.
      D5/4 C5/2 R/4          | D5/8 D5/8 C5/8 G4/4. A#4/8 G4/8 | A#4/4 G4/8 G4/4 G4/4 F4/8 | A#4/4 G4/2.
    `,
  },
  {
    id: 'taki-taki',
    title: 'Taki Taki',
    artist: 'DJ Snake',
    bpm: 96,
    timeSignature: '4/4',
    melody: 'C#5/16 C#5/8 E5/16 F#5/16 G#5/8 E5/16 F#5/8 F#5/16 G#5/16 C#5/8 B4/8',
  },
  {
    id: 'megalovania',
    title: 'Megalovania',
    artist: 'Toby Fox',
    bpm: 120,
    timeSignature: '4/4',
    // Same answer phrase over a bass note that steps down: D, C, B, B♭
    melody: `
      D4/16 D4/16 D5/8 A4/8. G#4/8 G4/8 F4/8 D4/16 F4/16 G4/16 |
      C4/16 C4/16 D5/8 A4/8. G#4/8 G4/8 F4/8 D4/16 F4/16 G4/16 |
      B3/16 B3/16 D5/8 A4/8. G#4/8 G4/8 F4/8 D4/16 F4/16 G4/16 |
      A#3/16 A#3/16 D5/8 A4/8. G#4/8 G4/8 F4/8 D4/16 F4/16 G4/16
    `,
  },
  {
    id: 'axel-f',
    title: 'Axel F',
    artist: 'Harold Faltermeyer',
    bpm: 117,
    timeSignature: '4/4',
    // The last F rings across the bar line, so bars 3–4 are written as one
    melody: `
      F4/4 G#4/8. F4/8 F4/16 A#4/8 F4/8 D#4/8 |
      F4/4 C5/8. F4/8 F4/16 C#5/8 C5/8 G#4/8 |
      F4/8 C5/8 F5/8 F4/16 D#4/8 D#4/16 C4/8 G4/8 F4/2. R/4.
    `,
  },
  {
    id: 'seven-nation-army',
    title: 'Seven Nation Army',
    artist: 'The White Stripes',
    bpm: 124,
    timeSignature: '4/4',
    // Played on guitar an octave lower
    melody: 'E4/4. E4/8 G4/8. E4/8. D4/8 | C4/2 B3/2',
  },
  {
    id: 'pirates',
    title: "He's a Pirate",
    artist: 'Klaus Badelt',
    bpm: 132,
    timeSignature: '6/8',
    melody: `
      A3/16 C4/16 D4/8 D4/8 D4/16 E4/16 F4/8 F4/8 | F4/16 G4/16 E4/8 E4/8 D4/16 C4/16 D4/4 |
      A3/16 C4/16 D4/8 D4/8 D4/16 E4/16 F4/8 F4/8 | F4/16 G4/16 E4/8 E4/8 D4/16 C4/16 D4/4 |
      A3/16 C4/16 D4/8 D4/8 D4/16 F4/16 G4/8 G4/8 | G4/16 A4/16 A#4/8 A#4/8 A4/16 G4/16 A4/8 D4/8 |
      D4/16 E4/16 F4/8 F4/8 G4/8 A4/8 D4/8 | D4/16 F4/16 E4/8 E4/8 F4/16 D4/16 E4/4
    `,
  },
  {
    id: 'fur-elise',
    title: 'Für Elise',
    artist: 'Beethoven',
    bpm: 75,
    timeSignature: '3/8',
    // Starts on the first full bar; the E5 D♯5 pickup closes the loop instead
    melody: `
      E5/16 D#5/16 E5/16 B4/16 D5/16 C5/16 | A4/8 R/16 C4/16 E4/16 A4/16 |
      B4/8 R/16 E4/16 G#4/16 B4/16 | C5/8 R/16 E4/16 E5/16 D#5/16 |
      E5/16 D#5/16 E5/16 B4/16 D5/16 C5/16 | A4/8 R/16 C4/16 E4/16 A4/16 |
      B4/8 R/16 E4/16 C5/16 B4/16 | A4/8 R/8 E5/16 D#5/16
    `,
  },
];

/** Look up a riff by id (falls back to the first one) */
export function getRiff(id: string): Riff {
  return RIFFS.find((r) => r.id === id) ?? RIFFS[0];
}

/** Length of one bar in quarter-note beats, e.g. '6/8' → 3 */
export function beatsPerBar(timeSignature: RiffTimeSignature): number {
  const [count, unit] = timeSignature.split('/').map(Number);
  return (count * 4) / unit;
}
