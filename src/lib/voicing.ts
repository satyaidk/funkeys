/**
 * @fileoverview How the instrument sounds a pitch with the current settings.
 *
 * One function used by everything that makes a note: your fingers
 * (`usePiano.noteOn`) and playback of songs and transcriptions
 * (`useSequencePlayer`). So voice, layer/split, transpose, master tuning
 * and temperament apply the same way whoever is playing.
 *
 * ```
 *   midi + settings ─► voices (single / layer / split)
 *                    ─► frequency (transpose, temperament, A4)
 *                    ─► sounding midi (for stereo position and decay)
 * ```
 */

import { PianoSettings, PlayNoteOptions } from '@/types';
import { BASE_OCTAVE } from './constants';
import { getMidiNumber } from './music/notes';
import { midiToFrequency } from './music/tuning';
import { resolveVoices } from './audio/voices';

export interface Voicing {
  /** Fundamental frequency in Hz */
  frequency: number;
  options: PlayNoteOptions;
}

/**
 * @param midi     - Written pitch (before transpose)
 * @param velocity - Playing strength after any touch curve (0–1)
 * @param soft     - Soft pedal held
 */
export function voiceNote(midi: number, settings: PianoSettings, velocity: number, soft = false): Voicing {
  // Split mode decides by position on the keyboard: count keys from its lowest C
  const lowestKeyMidi = getMidiNumber('C', BASE_OCTAVE + settings.octaveShift);
  return {
    frequency: midiToFrequency(midi, settings),
    options: {
      voices: resolveVoices(settings, midi - lowestKeyMidi),
      velocity,
      midi: midi + settings.transpose,
      soft,
    },
  };
}
