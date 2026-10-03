/**
 * @fileoverview Note names, MIDI numbers and note ids.
 *
 * This module handles the naming side of music theory:
 * - Converting between note names ('C#4'), MIDI numbers (61) and ids
 * - Equal-temperament frequencies at A4 = 440 Hz (for reference and tests;
 *   the instrument itself tunes through `tuning.ts`)
 * - The rainbow color of each note name
 *
 * ## MIDI numbers
 * Every key on a piano has a MIDI number: middle C (C4) is 60, A4 is 69,
 * and each semitone adds 1. Doing math on integers is much easier than on
 * names, so the app converts to MIDI wherever it needs to calculate.
 */

import { NoteName } from '@/types';
import { NOTE_COLORS } from '../constants';

/** All 12 note names in chromatic order (C to B) */
export const CHROMATIC_SCALE: readonly NoteName[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

/** Friendlier names for display, e.g. in the transpose and temperament controls */
export const KEY_NAMES: readonly string[] = [
  'C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B',
];

/**
 * MIDI number of a note.
 *
 * Formula: (octave + 1) × 12 + position in the chromatic scale.
 *
 * @example getMidiNumber('C', 4) // → 60 (middle C)
 * @example getMidiNumber('A', 4) // → 69
 */
export function getMidiNumber(noteName: NoteName, octave: number): number {
  return (octave + 1) * 12 + CHROMATIC_SCALE.indexOf(noteName);
}

/** Note name of a MIDI number, e.g. 61 → 'C#' */
export function getNoteName(midi: number): NoteName {
  return CHROMATIC_SCALE[((midi % 12) + 12) % 12];
}

/** Octave of a MIDI number, e.g. 60 → 4 */
export function getOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/** Note id of a MIDI number, e.g. 61 → 'C#4' */
export function midiToNoteId(midi: number): string {
  return `${getNoteName(midi)}${getOctave(midi)}`;
}

/**
 * MIDI number of a note id, e.g. 'C#4' → 61.
 * Returns `null` for anything that isn't a valid note id.
 */
export function noteIdToMidi(noteId: string): number | null {
  const match = /^([A-G]#?)(-?\d+)$/.exec(noteId);
  if (!match) return null;
  const index = CHROMATIC_SCALE.indexOf(match[1] as NoteName);
  if (index === -1) return null;
  return getMidiNumber(match[1] as NoteName, Number(match[2]));
}

/**
 * Equal-temperament frequency at A4 = 440 Hz.
 *
 * Formula: f = 440 × 2^((midi − 69) / 12)
 *
 * @example getFrequency('A', 4) // → 440
 * @example getFrequency('C', 4) // → 261.63
 */
export function getFrequency(noteName: NoteName, octave: number): number {
  return 440 * Math.pow(2, (getMidiNumber(noteName, octave) - 69) / 12);
}

/** Rainbow color for a note name (falls back to white) */
export function getNoteColor(noteName: NoteName): string {
  return NOTE_COLORS[noteName] || '#ffffff';
}
