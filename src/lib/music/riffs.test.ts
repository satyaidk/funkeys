import { describe, it, expect } from 'vitest';
import { beatsPerBar, getRiff, RIFFS } from './riffs';
import { parseSequence } from './sequence';
import { getMidiNumber } from './notes';
import { BASE_OCTAVE } from '../constants';

/** The keyboard with no octave shift: C3 → C6 */
const LOWEST_KEY = getMidiNumber('C', BASE_OCTAVE);
const HIGHEST_KEY = getMidiNumber('C', BASE_OCTAVE + 3);

describe('riff library', () => {
  it('has unique ids', () => {
    const ids = RIFFS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // One test per riff, so a typo names the song it's in
  it.each(RIFFS.map((r) => [r.title, r] as const))('%s parses, fits the keyboard and loops on a bar line', (_, riff) => {
    const { notes, beats } = parseSequence(riff.melody);

    expect(notes.length).toBeGreaterThan(0);
    expect(riff.bpm).toBeGreaterThan(0);
    notes.forEach((n) => {
      expect(n.midi).toBeGreaterThanOrEqual(LOWEST_KEY);
      expect(n.midi).toBeLessThanOrEqual(HIGHEST_KEY);
    });
    // A loop that ends mid-bar stumbles every time it comes round
    expect(beats % beatsPerBar(riff.timeSignature)).toBe(0);
  });

  it('includes the DJ Snake tracks and Tokyo Drift', () => {
    expect(getRiff('tokyo-drift').title).toBe('Tokyo Drift');
    expect(RIFFS.filter((r) => r.artist.includes('DJ Snake')).length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to the first riff for an unknown id', () => {
    expect(getRiff('nope')).toBe(RIFFS[0]);
  });

  it('measures bars in quarter-note beats', () => {
    expect(beatsPerBar('4/4')).toBe(4);
    expect(beatsPerBar('6/8')).toBe(3);
    expect(beatsPerBar('3/8')).toBe(1.5);
  });
});
