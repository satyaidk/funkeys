/**
 * @fileoverview A tiny text format for writing melodies, and its parser.
 *
 * Writing a melody as an array of objects is long and hard to check against
 * sheet music. Instead, each step is a short token: a pitch and a note value.
 *
 * ```
 *   E5/8      E5 for an eighth note
 *   A4/8.     a dotted eighth (1.5 × as long)
 *   G#3/8t    a triplet eighth (⅔ as long: three fit in a quarter note)
 *   R/4       a quarter-note rest
 *   C4+E4/2   a chord: C4 and E4 together for a half note
 *   |         a bar line, ignored (it's only there to help you read)
 * ```
 *
 * Note values follow sheet music: /1 whole, /2 half, /4 quarter, /8 eighth,
 * /16 sixteenth. Lengths come out in **beats**, where one beat is a quarter
 * note, so the tempo (BPM) alone decides how fast it plays.
 *
 * A melody is one line of notes where each step starts after the last. For
 * two hands (a bass note held under a moving melody), write each hand as
 * its own **part** and merge them with `parseParts`.
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

/**
 * Positions are counted in whole **ticks** (24 per beat) and only divided
 * into beats at the end. Every note value, dotted or triplet, is a whole
 * number of ticks (a dotted sixteenth is 9, a triplet eighth 8), so adding
 * them up is exact: three triplets make exactly one beat, never 0.9999….
 */
const TICKS_PER_BEAT = 24;

/** Ticks per note value: a whole note is 4 quarter-note beats */
const NOTE_TICKS: Record<string, number> = { '1': 96, '2': 48, '4': 24, '8': 12, '16': 6 };

/** pitch(es) or R, a slash, a note value, an optional dot or triplet mark */
const STEP = /^(R|[A-G]#?-?\d(?:\+[A-G]#?-?\d)*)\/(16|8|4|2|1)(\.|t)?$/;

/** How a dot or triplet mark changes a note's length: × 3/2 or × 2/3 */
const MODIFIERS: Record<string, [number, number]> = { '.': [3, 2], t: [2, 3] };

/**
 * Parse a melody written in the format above.
 * @throws Error naming the first token it can't read, so a typo is easy to find
 */
export function parseSequence(text: string): Sequence {
  const notes: SequenceNote[] = [];
  let tick = 0;

  for (const token of text.split(/\s+/)) {
    if (token === '' || token === '|') continue;

    const match = STEP.exec(token);
    if (!match) throw new Error(`Can't read "${token}" (expected something like "E5/8")`);
    const [, pitches, value, modifier] = match;
    const [times, per] = modifier ? MODIFIERS[modifier] : [1, 1];
    const ticks = (NOTE_TICKS[value] * times) / per;

    if (pitches !== 'R') {
      for (const pitch of pitches.split('+')) {
        const midi = noteIdToMidi(pitch);
        if (midi === null) throw new Error(`Can't read "${token}": unknown note "${pitch}"`);
        notes.push({ midi, start: tick / TICKS_PER_BEAT, length: ticks / TICKS_PER_BEAT });
      }
    }
    tick += ticks;
  }

  if (tick === 0) throw new Error('A sequence needs at least one note or rest');
  return { notes, beats: tick / TICKS_PER_BEAT };
}

/**
 * Parse several parts (e.g. right hand and left hand) that play together,
 * merged into one sequence. It lasts as long as its longest part.
 * @throws Error naming the part and token it can't read
 */
export function parseParts(parts: readonly string[]): Sequence {
  if (parts.length === 0) throw new Error('A piece needs at least one part');
  const parsed = parts.map((part, i) => {
    try {
      return parseSequence(part);
    } catch (error) {
      if (parts.length === 1) throw error;
      throw new Error(`Part ${i + 1}: ${(error as Error).message}`);
    }
  });
  return {
    notes: parsed.flatMap((p) => p.notes).sort((a, b) => a.start - b.start || a.midi - b.midi),
    beats: Math.max(...parsed.map((p) => p.beats)),
  };
}
