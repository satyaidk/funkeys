import { describe, it, expect } from 'vitest';
import { DEFAULT_TUNING, midiToFrequency, temperamentOffset, TEMPERAMENTS, Tuning } from './tuning';

const cents = (a: number, b: number) => 1200 * Math.log2(a / b);
const tuning = (overrides: Partial<Tuning>): Tuning => ({ ...DEFAULT_TUNING, ...overrides });

describe('midiToFrequency', () => {
  it('matches equal temperament at A4 = 440 by default', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(60)).toBeCloseTo(261.626, 2);
    expect(midiToFrequency(81)).toBeCloseTo(880);
  });

  it('follows the master tuning', () => {
    expect(midiToFrequency(69, tuning({ referencePitch: 442 }))).toBeCloseTo(442);
    expect(midiToFrequency(81, tuning({ referencePitch: 415.3 }))).toBeCloseTo(830.6);
  });

  it('transposes by semitones', () => {
    // Pressing C4 with transpose +2 sounds D4
    expect(midiToFrequency(60, tuning({ transpose: 2 }))).toBeCloseTo(midiToFrequency(62));
    expect(midiToFrequency(69, tuning({ transpose: -12 }))).toBeCloseTo(220);
  });
});

describe('temperaments', () => {
  it('defines 12 ascending steps starting at 0 for every temperament', () => {
    TEMPERAMENTS.forEach((t) => {
      expect(t.cents).toHaveLength(12);
      expect(t.cents[0]).toBe(0);
      t.cents.slice(1).forEach((c, i) => expect(c).toBeGreaterThan(t.cents[i]));
    });
  });

  it('keeps A at the reference pitch in every temperament and key', () => {
    TEMPERAMENTS.forEach((t) => {
      for (let root = 0; root < 12; root++) {
        expect(temperamentOffset(69, t.id, root)).toBeCloseTo(0);
      }
    });
  });

  it('makes the major third pure (5/4) in pure major', () => {
    const t = tuning({ temperament: 'pure-major', temperamentRoot: 0 });
    expect(midiToFrequency(64, t) / midiToFrequency(60, t)).toBeCloseTo(5 / 4, 5);
  });

  it('makes fifths pure (3/2) in Pythagorean tuning', () => {
    const t = tuning({ temperament: 'pythagorean', temperamentRoot: 0 });
    expect(midiToFrequency(67, t) / midiToFrequency(60, t)).toBeCloseTo(3 / 2, 5);
    expect(midiToFrequency(74, t) / midiToFrequency(67, t)).toBeCloseTo(3 / 2, 5);
  });

  it('rotates the temperament to the chosen key', () => {
    // In pure major on D, D → F# is a pure third
    const t = tuning({ temperament: 'pure-major', temperamentRoot: 2 });
    expect(midiToFrequency(66, t) / midiToFrequency(62, t)).toBeCloseTo(5 / 4, 5);
  });

  it('leaves equal temperament untouched', () => {
    for (let midi = 48; midi < 72; midi++) {
      expect(temperamentOffset(midi, 'equal', 5)).toBeCloseTo(0);
    }
  });

  it('moves notes by only a few cents in well temperaments', () => {
    const t = tuning({ temperament: 'werckmeister' });
    for (let midi = 60; midi < 72; midi++) {
      expect(Math.abs(cents(midiToFrequency(midi, t), midiToFrequency(midi)))).toBeLessThan(15);
    }
  });
});
