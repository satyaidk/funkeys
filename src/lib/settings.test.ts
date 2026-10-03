import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';

describe('sanitizeSettings', () => {
  it('leaves valid settings unchanged', () => {
    expect(sanitizeSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it('clamps every number to its range', () => {
    const result = sanitizeSettings({
      ...DEFAULT_SETTINGS,
      volume: 3,
      octaveShift: 9,
      transpose: -40,
      referencePitch: 500,
      layerBalance: -1,
      splitIndex: 99,
      reverbLevel: 2,
    });
    expect(result).toMatchObject({
      volume: 1,
      octaveShift: 2,
      transpose: -12,
      referencePitch: 466.2,
      layerBalance: 0,
      splitIndex: 36,
      reverbLevel: 1,
    });
  });

  it('rounds to whole octaves and semitones', () => {
    const result = sanitizeSettings({ ...DEFAULT_SETTINGS, octaveShift: 1.4, transpose: 2.6 });
    expect(result.octaveShift).toBe(1);
    expect(result.transpose).toBe(3);
  });

  it('snaps the master tuning to 0.1 Hz steps', () => {
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, referencePitch: 440.1 + 0.000001 }).referencePitch).toBe(440.1);
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, referencePitch: 441.26 }).referencePitch).toBe(441.3);
  });

  it('wraps the temperament key around the octave', () => {
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, temperamentRoot: 14 }).temperamentRoot).toBe(2);
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, temperamentRoot: -1 }).temperamentRoot).toBe(11);
  });

  it('keeps at least one key on each side of the split', () => {
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, splitIndex: 0 }).splitIndex).toBe(1);
  });
});
