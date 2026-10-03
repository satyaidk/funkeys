import { describe, it, expect } from 'vitest';
import {
  getFrequency,
  generateNotes,
  getNoteColor,
  getWhiteKeys,
  getBlackKeys,
} from './notes';

describe('getFrequency', () => {
  it('tunes A4 to the 440 Hz reference pitch', () => {
    expect(getFrequency('A', 4)).toBe(440);
  });

  it('calculates middle C', () => {
    expect(getFrequency('C', 4)).toBeCloseTo(261.63, 2);
  });

  it('doubles the frequency every octave', () => {
    expect(getFrequency('A', 5)).toBeCloseTo(880);
    expect(getFrequency('A', 3)).toBeCloseTo(220);
    expect(getFrequency('C', 5) / getFrequency('C', 4)).toBeCloseTo(2);
  });

  it('spaces semitones by the twelfth root of two', () => {
    expect(getFrequency('A#', 4) / getFrequency('A', 4)).toBeCloseTo(2 ** (1 / 12));
  });
});

describe('generateNotes', () => {
  it('maps 17 keys: 10 white and 7 black', () => {
    const notes = generateNotes();
    expect(notes).toHaveLength(17);
    expect(getWhiteKeys(notes)).toHaveLength(10);
    expect(getBlackKeys(notes)).toHaveLength(7);
  });

  it('spans C4 to E5 by default', () => {
    const notes = generateNotes();
    expect(notes[0].id).toBe('C4');
    expect(notes.at(-1)?.id).toBe('E5');
  });

  it('maps the home row to white keys and the top row to black keys', () => {
    const byKey = Object.fromEntries(generateNotes().map((n) => [n.keyboardKey, n]));
    expect(byKey['a'].id).toBe('C4');
    expect(byKey['w'].id).toBe('C#4');
    expect(byKey['w'].isBlack).toBe(true);
    expect(byKey[';'].id).toBe('E5');
  });

  it('gives every note a unique id and key', () => {
    const notes = generateNotes();
    expect(new Set(notes.map((n) => n.id)).size).toBe(notes.length);
    expect(new Set(notes.map((n) => n.keyboardKey)).size).toBe(notes.length);
  });

  it('shifts every note by whole octaves', () => {
    const up = generateNotes(1);
    expect(up[0].id).toBe('C5');
    expect(up[0].frequency).toBeCloseTo(generateNotes()[0].frequency * 2);

    expect(generateNotes(-2)[0].id).toBe('C2');
  });
});

describe('getNoteColor', () => {
  it('returns the rainbow color for a note', () => {
    expect(getNoteColor('C')).toBe('#ef4444');
    expect(getNoteColor('B')).toBe('#d946ef');
  });
});
