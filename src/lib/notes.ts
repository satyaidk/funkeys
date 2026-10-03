/**
 * @fileoverview Note definitions, frequency calculations, and keyboard mapping.
 *
 * This module handles the music theory side of the app:
 * - Equal temperament frequency calculation
 * - Mapping computer keyboard keys to piano notes
 * - Generating note arrays for different octave ranges
 *
 * ## Equal Temperament Tuning
 * Modern pianos use "equal temperament" tuning where each semitone
 * is exactly the same frequency ratio apart: 2^(1/12) ≈ 1.05946.
 * This means each octave doubles in frequency (A4=440Hz, A5=880Hz).
 *
 * ## Keyboard Layout
 * The mapping mirrors a real piano's physical layout:
 * ```
 *   Black keys: | W | E |   | T | Y | U |   | O | P |
 *   White keys: | A | S | D | F | G | H | J | K | L | ; |
 *   Notes:        C   D   E   F   G   A   B   C   D   E
 * ```
 */

import { Note, NoteName } from '@/types';
import { BASE_OCTAVE, NOTE_COLORS } from './constants';

/** All 12 note names in chromatic order (C to B) */
const CHROMATIC_SCALE: NoteName[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

/**
 * Keyboard-to-note mapping definition.
 * Each entry maps a computer key to a musical note with its octave offset.
 *
 * - Lower keyboard row (A, S, D, F, G, H, J, K, L, ;) → white keys
 * - Upper keyboard row (W, E, T, Y, U, O, P) → black (sharp) keys
 * - octaveOffset 0 = base octave, 1 = one octave higher
 */
const KEYBOARD_NOTE_MAP: Array<{
  key: string;
  label: string;
  note: NoteName;
  octaveOffset: number;
}> = [
  // ─── First Octave (C to B) ─────────────────────────────
  { key: 'a', label: 'A', note: 'C',  octaveOffset: 0 },
  { key: 'w', label: 'W', note: 'C#', octaveOffset: 0 },
  { key: 's', label: 'S', note: 'D',  octaveOffset: 0 },
  { key: 'e', label: 'E', note: 'D#', octaveOffset: 0 },
  { key: 'd', label: 'D', note: 'E',  octaveOffset: 0 },
  { key: 'f', label: 'F', note: 'F',  octaveOffset: 0 },
  { key: 't', label: 'T', note: 'F#', octaveOffset: 0 },
  { key: 'g', label: 'G', note: 'G',  octaveOffset: 0 },
  { key: 'y', label: 'Y', note: 'G#', octaveOffset: 0 },
  { key: 'h', label: 'H', note: 'A',  octaveOffset: 0 },
  { key: 'u', label: 'U', note: 'A#', octaveOffset: 0 },
  { key: 'j', label: 'J', note: 'B',  octaveOffset: 0 },
  // ─── Second Octave (C to E) ────────────────────────────
  { key: 'k', label: 'K', note: 'C',  octaveOffset: 1 },
  { key: 'o', label: 'O', note: 'C#', octaveOffset: 1 },
  { key: 'l', label: 'L', note: 'D',  octaveOffset: 1 },
  { key: 'p', label: 'P', note: 'D#', octaveOffset: 1 },
  { key: ';', label: ';', note: 'E',  octaveOffset: 1 },
];

/**
 * Calculate the frequency of a note using equal temperament tuning.
 *
 * Formula: f = 440 × 2^((midiNumber - 69) / 12)
 *
 * Where MIDI number for a note is: (octave + 1) × 12 + noteIndex
 * A4 (MIDI 69) = 440 Hz is the tuning reference.
 *
 * @param noteName - Name of the note (e.g., 'C', 'F#')
 * @param octave   - Octave number (4 = middle C octave)
 * @returns Frequency in Hz
 *
 * @example
 * getFrequency('A', 4)  // → 440.00 Hz
 * getFrequency('C', 4)  // → 261.63 Hz
 * getFrequency('C', 5)  // → 523.25 Hz (one octave up = 2× frequency)
 */
export function getFrequency(noteName: NoteName, octave: number): number {
  const noteIndex = CHROMATIC_SCALE.indexOf(noteName);
  const midiNumber = (octave + 1) * 12 + noteIndex;
  return 440 * Math.pow(2, (midiNumber - 69) / 12);
}

/**
 * Generate the complete array of Note objects for the piano.
 *
 * Creates a note for each keyboard mapping, calculating frequencies
 * based on the current octave shift. The octave shift allows the user
 * to move the entire keyboard up or down in pitch.
 *
 * @param octaveShift - Number of octaves to shift from base (default 0)
 * @returns Array of Note objects with frequencies, colors, and key mappings
 */
export function generateNotes(octaveShift: number = 0): Note[] {
  return KEYBOARD_NOTE_MAP.map(({ key, label, note, octaveOffset }) => {
    const octave = BASE_OCTAVE + octaveShift + octaveOffset;
    return {
      name: note,
      octave,
      frequency: getFrequency(note, octave),
      isBlack: note.includes('#'),
      keyboardKey: key,
      keyLabel: label,
      id: `${note}${octave}`,
    };
  });
}

/**
 * Get the rainbow color assigned to a note name.
 *
 * @param noteName - Name of the note
 * @returns CSS color string (hex)
 */
export function getNoteColor(noteName: NoteName): string {
  return NOTE_COLORS[noteName] || '#ffffff';
}

/**
 * Filter to get only white (natural) keys from a notes array.
 * White keys: C, D, E, F, G, A, B
 */
export function getWhiteKeys(notes: Note[]): Note[] {
  return notes.filter((n) => !n.isBlack);
}

/**
 * Filter to get only black (sharp/flat) keys from a notes array.
 * Black keys: C#, D#, F#, G#, A#
 */
export function getBlackKeys(notes: Note[]): Note[] {
  return notes.filter((n) => n.isBlack);
}
