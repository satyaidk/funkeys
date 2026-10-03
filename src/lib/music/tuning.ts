/**
 * @fileoverview Tuning: master pitch, transpose and temperaments.
 *
 * Turns a MIDI number into the frequency the instrument should sound,
 * following the three tuning functions found on digital pianos:
 *
 * 1. **Transpose**: shifts the pitch by semitones while the keys stay put
 *    (press C, hear D). Useful for accompanying a singer.
 * 2. **Master tuning**: sets the frequency of A4 (440 Hz is concert pitch;
 *    orchestras often use 442 Hz, Baroque ensembles 415 Hz).
 * 3. **Temperament**: how the 12 notes of the octave are spaced. Modern
 *    pianos use equal temperament, where every semitone is identical.
 *    Historical temperaments make some keys sound purer and others rougher,
 *    which is how Bach or Mozart would have heard their music.
 *
 * Temperaments are stored as cents above the root (100 cents = one equal
 * semitone). Values follow the standard ratios (e.g. a pure major third is
 * 5/4 = 386.31 cents); historical tables match those on Yamaha Clavinova and
 * Kawai pianos, which offer the same set.
 */

import { TemperamentId } from '@/types';
import { DEFAULT_REFERENCE_PITCH } from '../constants';

export interface Temperament {
  id: TemperamentId;
  name: string;
  description: string;
  /** Cents above the root for each of the 12 semitones (index 0 = root) */
  cents: readonly number[];
}

export const TEMPERAMENTS: readonly Temperament[] = [
  {
    id: 'equal',
    name: 'Equal',
    description: 'Every semitone identical. The modern standard: all keys sound the same.',
    cents: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100],
  },
  {
    id: 'pure-major',
    name: 'Pure major',
    description: 'Just intonation: perfectly pure chords in the chosen major key.',
    cents: [0, 111.731, 203.91, 315.641, 386.314, 498.045, 590.224, 701.955, 813.686, 884.359, 1017.596, 1088.269],
  },
  {
    id: 'pythagorean',
    name: 'Pythagorean',
    description: 'Built from pure fifths. Bright, medieval-sounding melodies.',
    cents: [0, 113.685, 203.91, 294.135, 407.82, 498.045, 611.73, 701.955, 815.64, 905.865, 996.09, 1109.775],
  },
  {
    id: 'meantone',
    name: 'Meantone',
    description: 'Quarter-comma meantone: sweet thirds, used in the Renaissance.',
    cents: [0, 76.049, 193.157, 310.265, 386.314, 503.422, 579.471, 696.578, 772.627, 889.735, 1006.843, 1082.892],
  },
  {
    id: 'werckmeister',
    name: 'Werckmeister III',
    description: 'A Baroque "well temperament": every key usable, each with its own color.',
    cents: [0, 90.225, 192.18, 294.135, 390.225, 498.045, 588.27, 696.09, 792.18, 888.27, 996.09, 1092.18],
  },
  {
    id: 'kirnberger',
    name: 'Kirnberger III',
    description: 'Another well temperament, devised by a student of J. S. Bach.',
    cents: [0, 90.225, 193.157, 294.135, 386.314, 498.045, 590.224, 696.578, 792.18, 889.735, 996.09, 1088.269],
  },
];

export function getTemperament(id: TemperamentId): Temperament {
  return TEMPERAMENTS.find((t) => t.id === id) ?? TEMPERAMENTS[0];
}

export interface Tuning {
  /** Frequency of A4 in Hz */
  referencePitch: number;
  temperament: TemperamentId;
  /** Pitch class the temperament is built on (0 = C … 11 = B) */
  temperamentRoot: number;
  /** Semitones to shift every note */
  transpose: number;
}

export const DEFAULT_TUNING: Tuning = {
  referencePitch: DEFAULT_REFERENCE_PITCH,
  temperament: 'equal',
  temperamentRoot: 0,
  transpose: 0,
};

const pitchClass = (n: number) => ((n % 12) + 12) % 12;

/**
 * How far (in cents) a note is from equal temperament.
 *
 * The temperament table is rotated so its root lands on `root`, then the
 * whole table is shifted so that **A always stays exactly at the reference
 * pitch**: changing temperament never changes what "A = 440" means.
 */
export function temperamentOffset(midi: number, temperament: TemperamentId, root: number): number {
  const { cents } = getTemperament(temperament);
  const deviation = (pc: number) => {
    const interval = pitchClass(pc - root);
    return cents[interval] - interval * 100;
  };
  return deviation(pitchClass(midi)) - deviation(9); // 9 = A
}

/**
 * Frequency (Hz) to sound for a key, after transpose, temperament and master tuning.
 *
 * Formula: f = A4 × 2^((midi + transpose − 69) / 12) × 2^(offset / 1200)
 *
 * @example midiToFrequency(69, DEFAULT_TUNING) // → 440
 */
export function midiToFrequency(midi: number, tuning: Tuning = DEFAULT_TUNING): number {
  const sounding = midi + tuning.transpose;
  const equal = tuning.referencePitch * Math.pow(2, (sounding - 69) / 12);
  const offset = temperamentOffset(sounding, tuning.temperament, tuning.temperamentRoot);
  return equal * Math.pow(2, offset / 1200);
}
