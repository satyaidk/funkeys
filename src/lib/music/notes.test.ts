import { describe, it, expect } from 'vitest';
import {
  getFrequency,
  getMidiNumber,
  getNoteColor,
  getNoteName,
  getOctave,
  midiToNoteId,
  noteIdToMidi,
} from './notes';

describe('MIDI numbers', () => {
  it('numbers middle C as 60 and A4 as 69', () => {
    expect(getMidiNumber('C', 4)).toBe(60);
    expect(getMidiNumber('A', 4)).toBe(69);
  });

  it('converts MIDI numbers back to names and octaves', () => {
    expect(getNoteName(61)).toBe('C#');
    expect(getOctave(60)).toBe(4);
    expect(getOctave(59)).toBe(3);
  });

  it('round-trips note ids', () => {
    for (let midi = 21; midi <= 108; midi++) {
      expect(noteIdToMidi(midiToNoteId(midi))).toBe(midi);
    }
    expect(midiToNoteId(61)).toBe('C#4');
  });

  it('rejects strings that are not note ids', () => {
    expect(noteIdToMidi('H4')).toBeNull();
    expect(noteIdToMidi('E#4')).toBeNull();
    expect(noteIdToMidi('C')).toBeNull();
  });
});

describe('getFrequency', () => {
  it('tunes A4 to the 440 Hz reference pitch', () => {
    expect(getFrequency('A', 4)).toBe(440);
  });

  it('calculates middle C', () => {
    expect(getFrequency('C', 4)).toBeCloseTo(261.63, 2);
  });

  it('doubles the frequency every octave', () => {
    expect(getFrequency('A', 5)).toBeCloseTo(880);
    expect(getFrequency('C', 5) / getFrequency('C', 4)).toBeCloseTo(2);
  });

  it('spaces semitones by the twelfth root of two', () => {
    expect(getFrequency('A#', 4) / getFrequency('A', 4)).toBeCloseTo(2 ** (1 / 12));
  });
});

describe('getNoteColor', () => {
  it('returns the rainbow color for a note', () => {
    expect(getNoteColor('C')).toBe('#ef4444');
    expect(getNoteColor('B')).toBe('#d946ef');
  });
});
