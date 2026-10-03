/**
 * @fileoverview Maps the computer keyboard onto a 37-key piano (C3 → C6).
 *
 * The four letter/number rows form two "manuals" that copy a piano's shape:
 * each pair of rows is a strip of white keys with black keys in the row
 * above, offset by half a key — exactly where black keys sit on a piano.
 *
 * ```
 *   Upper manual (F4 → C6)
 *    2 3 4   6 7   9 0 -        ← black keys
 *   Q W E R T Y U I O P [ ]     ← white keys
 *
 *   Lower manual (C3 → E4)
 *    S D   G H J   L ;          ← black keys
 *   Z X C V B N M , . /         ← white keys
 * ```
 *
 * The unmapped keys (1, 5, 8, =, F, K) fall where a piano has no black key
 * (between E–F and B–C), so the gaps feel natural under the fingers.
 *
 * Keys are identified by `KeyboardEvent.code` — the *physical* position —
 * so Shift, Caps Lock and non-QWERTY layouts can't change which note a key
 * plays. See ADR 0006.
 */

import { Manual, Note, NoteName } from '@/types';
import { BASE_OCTAVE } from '../constants';
import { getMidiNumber } from './notes';

interface KeyMapping {
  /** `KeyboardEvent.code` of the physical key */
  code: string;
  /** Label on a US QWERTY keyboard */
  label: string;
  note: NoteName;
  /** Octaves above BASE_OCTAVE */
  octaveOffset: number;
  manual: Manual;
}

/** Shorthand used to keep the table below readable */
const key = (
  code: string,
  label: string,
  note: NoteName,
  octaveOffset: number,
  manual: Manual
): KeyMapping => ({ code, label, note, octaveOffset, manual });

/** All 37 keys in piano order, lowest first */
export const KEYBOARD_MAP: readonly KeyMapping[] = [
  // ─── Lower manual: Z-row white keys, A-row black keys ───────────────────
  key('KeyZ', 'Z', 'C', 0, 'lower'),
  key('KeyS', 'S', 'C#', 0, 'lower'),
  key('KeyX', 'X', 'D', 0, 'lower'),
  key('KeyD', 'D', 'D#', 0, 'lower'),
  key('KeyC', 'C', 'E', 0, 'lower'),
  key('KeyV', 'V', 'F', 0, 'lower'),
  key('KeyG', 'G', 'F#', 0, 'lower'),
  key('KeyB', 'B', 'G', 0, 'lower'),
  key('KeyH', 'H', 'G#', 0, 'lower'),
  key('KeyN', 'N', 'A', 0, 'lower'),
  key('KeyJ', 'J', 'A#', 0, 'lower'),
  key('KeyM', 'M', 'B', 0, 'lower'),
  key('Comma', ',', 'C', 1, 'lower'),
  key('KeyL', 'L', 'C#', 1, 'lower'),
  key('Period', '.', 'D', 1, 'lower'),
  key('Semicolon', ';', 'D#', 1, 'lower'),
  key('Slash', '/', 'E', 1, 'lower'),
  // ─── Upper manual: Q-row white keys, number-row black keys ──────────────
  key('KeyQ', 'Q', 'F', 1, 'upper'),
  key('Digit2', '2', 'F#', 1, 'upper'),
  key('KeyW', 'W', 'G', 1, 'upper'),
  key('Digit3', '3', 'G#', 1, 'upper'),
  key('KeyE', 'E', 'A', 1, 'upper'),
  key('Digit4', '4', 'A#', 1, 'upper'),
  key('KeyR', 'R', 'B', 1, 'upper'),
  key('KeyT', 'T', 'C', 2, 'upper'),
  key('Digit6', '6', 'C#', 2, 'upper'),
  key('KeyY', 'Y', 'D', 2, 'upper'),
  key('Digit7', '7', 'D#', 2, 'upper'),
  key('KeyU', 'U', 'E', 2, 'upper'),
  key('KeyI', 'I', 'F', 2, 'upper'),
  key('Digit9', '9', 'F#', 2, 'upper'),
  key('KeyO', 'O', 'G', 2, 'upper'),
  key('Digit0', '0', 'G#', 2, 'upper'),
  key('KeyP', 'P', 'A', 2, 'upper'),
  key('Minus', '-', 'A#', 2, 'upper'),
  key('BracketLeft', '[', 'B', 2, 'upper'),
  key('BracketRight', ']', 'C', 3, 'upper'),
];

/** Number of keys on the on-screen keyboard */
export const KEY_COUNT = KEYBOARD_MAP.length;

/**
 * Build the Note objects for the current octave shift.
 *
 * Pure function: the same shift always gives the same notes, so the result
 * can be memoized with `useMemo`.
 *
 * @param octaveShift - Whole octaves to move the keyboard (default 0 → C3–C6)
 */
export function generateNotes(octaveShift: number = 0): Note[] {
  return KEYBOARD_MAP.map(({ code, label, note, octaveOffset, manual }) => {
    const octave = BASE_OCTAVE + octaveShift + octaveOffset;
    return {
      id: `${note}${octave}`,
      name: note,
      octave,
      midi: getMidiNumber(note, octave),
      isBlack: note.includes('#'),
      code,
      keyLabel: label,
      manual,
    };
  });
}

/** Filter to only white (natural) keys */
export function getWhiteKeys(notes: Note[]): Note[] {
  return notes.filter((n) => !n.isBlack);
}

/** Filter to only black (sharp) keys */
export function getBlackKeys(notes: Note[]): Note[] {
  return notes.filter((n) => n.isBlack);
}
