/**
 * @fileoverview Default instrument settings and validation.
 *
 * Every settings change goes through `sanitizeSettings`, so a bad value
 * (a transpose of 40, a volume of −1, a fractional octave) can never reach
 * the audio engine, whatever the source: a control, a shortcut or a test.
 */

import { PianoSettings } from '@/types';
import {
  DEFAULT_REFERENCE_PITCH,
  DEFAULT_REVERB_LEVEL,
  DEFAULT_VOLUME,
  MAX_OCTAVE_SHIFT,
  MAX_REFERENCE_PITCH,
  MAX_TRANSPOSE,
  MIN_OCTAVE_SHIFT,
  MIN_REFERENCE_PITCH,
  REFERENCE_PITCH_STEP,
} from './constants';
import { KEY_COUNT } from './music/keyboard-map';

export const DEFAULT_SETTINGS: PianoSettings = {
  volume: DEFAULT_VOLUME,
  octaveShift: 0,
  transpose: 0,
  referencePitch: DEFAULT_REFERENCE_PITCH,
  temperament: 'equal',
  temperamentRoot: 0,
  voice: 'grand',
  mode: 'single',
  layerVoice: 'strings',
  layerBalance: 0.5,
  splitVoice: 'electric',
  // Split between the two keyboard rows: lower manual (left hand) / upper manual (right hand)
  splitIndex: 17,
  reverb: 'hall',
  reverbLevel: DEFAULT_REVERB_LEVEL,
  brilliance: 'normal',
  touch: 'medium',
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Return a copy of the settings with every number clamped to its valid range */
export function sanitizeSettings(settings: PianoSettings): PianoSettings {
  const pitchSteps = Math.round(settings.referencePitch / REFERENCE_PITCH_STEP);
  return {
    ...settings,
    volume: clamp(settings.volume, 0, 1),
    octaveShift: clamp(Math.round(settings.octaveShift), MIN_OCTAVE_SHIFT, MAX_OCTAVE_SHIFT),
    transpose: clamp(Math.round(settings.transpose), -MAX_TRANSPOSE, MAX_TRANSPOSE),
    // Round to the 0.1 Hz grid (and strip floating-point noise like 440.10000000000002)
    referencePitch: clamp(
      Number((pitchSteps * REFERENCE_PITCH_STEP).toFixed(1)),
      MIN_REFERENCE_PITCH,
      MAX_REFERENCE_PITCH
    ),
    temperamentRoot: ((Math.round(settings.temperamentRoot) % 12) + 12) % 12,
    layerBalance: clamp(settings.layerBalance, 0, 1),
    splitIndex: clamp(Math.round(settings.splitIndex), 1, KEY_COUNT - 1),
    reverbLevel: clamp(settings.reverbLevel, 0, 1),
  };
}
