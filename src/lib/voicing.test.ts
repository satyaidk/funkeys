import { describe, it, expect } from 'vitest';
import { voiceNote } from './voicing';
import { DEFAULT_SETTINGS } from './settings';

describe('voiceNote', () => {
  it('sounds A4 at 440 Hz with the main voice', () => {
    const { frequency, options } = voiceNote(69, DEFAULT_SETTINGS, 0.8);
    expect(frequency).toBe(440);
    expect(options).toEqual({ voices: [{ voice: 'grand', gain: 1 }], velocity: 0.8, midi: 69, soft: false });
  });

  it('applies transpose to the pitch it sounds', () => {
    const { frequency, options } = voiceNote(69, { ...DEFAULT_SETTINGS, transpose: 12 }, 0.8);
    expect(frequency).toBeCloseTo(880);
    expect(options.midi).toBe(81);
  });

  it('uses the left-hand voice below the split point, counted from the keyboard’s lowest key', () => {
    const split = { ...DEFAULT_SETTINGS, mode: 'split' as const, splitVoice: 'organ' as const, splitIndex: 12 };
    expect(voiceNote(55, split, 1).options.voices).toEqual([{ voice: 'organ', gain: 1 }]); // G3: key 7
    expect(voiceNote(64, split, 1).options.voices).toEqual([{ voice: 'grand', gain: 1 }]); // E4: key 16
    // Shifting the keyboard up an octave moves the split with it
    expect(voiceNote(64, { ...split, octaveShift: 1 }, 1).options.voices).toEqual([{ voice: 'organ', gain: 1 }]);
  });

  it('passes the soft pedal through', () => {
    expect(voiceNote(60, DEFAULT_SETTINGS, 0.5, true).options.soft).toBe(true);
  });
});
