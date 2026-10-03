/**
 * @fileoverview A tiny text format for writing melodies, and its parser.
 *
 * Writing a melody as an array of objects is long and hard to check against
 * sheet music. Instead, each step is a short token: a pitch and a note value.
 *
 * ```
 *   E5/8      E5 for an eighth note
 *   A4/8.     a dotted eighth (1.5 × as long)
 *   R/4       a quarter-note rest
 *   C4+E4/2   a chord: C4 and E4 together for a half note
 *   |         a bar line, ignored (it's only there to help you read)
 * ```
 *
 * Note values follow sheet music: /1 whole, /2 half, /4 quarter, /8 eighth,
 * /16 sixteenth. Lengths come out in **beats**, where one beat is a quarter
 * note, so the tempo (BPM) alone decides how fast it plays.
 *
 * @example
 * parseSequence('C4/4 R/8 E4/8.')
 * // → { notes: [{ midi: 60, start: 0, length: 1 }, { midi: 64, start: 1.5, length: 0.75 }], beats: 2.25 }
 */

import { noteIdToMidi } from './notes';

/** One note of a parsed melody, timed in beats (quarter notes) */
export interface SequenceNote {
  midi: number;
  /** When it starts, in beats from the beginning */
  start: number;
  /** How long it lasts, in beats */
  length: number;
}

export interface Sequence {
  /** Every note in start order (a chord gives several notes with the same start) */
  notes: SequenceNote[];
  /** Total length in beats, rests included */
  beats: number;
}

/** Beats per note value: a whole note is 4 quarter-note beats */
const NOTE_VALUES: Record<string, number> = { '1': 4, '2': 2, '4': 1, '8': 0.5, '16': 0.25 };

/** pitch(es) or R, a slash, a note value, an optional dot */
const STEP = /^(R|[A-G]#?-?\d(?:\+[A-G]#?-?\d)*)\/(16|8|4|2|1)(\.?)$/;

/**
 * Parse a melody written in the format above.
 * @throws Error naming the first token it can't read, so a typo is easy to find
 */
export function parseSequence(text: string): Sequence {
  const notes: SequenceNote[] = [];
  let beat = 0;

  for (const token of text.split(/\s+/)) {
    if (token === '' || token === '|') continue;

    const match = STEP.exec(token);
    if (!match) throw new Error(`Can't read "${token}" (expected something like "E5/8")`);
    const [, pitches, value, dot] = match;
    const length = NOTE_VALUES[value] * (dot ? 1.5 : 1);

    if (pitches !== 'R') {
      for (const pitch of pitches.split('+')) {
        const midi = noteIdToMidi(pitch);
        if (midi === null) throw new Error(`Can't read "${token}": unknown note "${pitch}"`);
        notes.push({ midi, start: beat, length });
      }
    }
    beat += length;
  }

  if (beat === 0) throw new Error('A sequence needs at least one note or rest');
  return { notes, beats: beat };
}
