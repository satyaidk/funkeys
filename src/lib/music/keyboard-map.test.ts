import { describe, it, expect } from 'vitest';
import {
  bestOctaveShift,
  generateNotes,
  getBlackKeys,
  getWhiteKeys,
  KEY_COUNT,
  KEYBOARD_MAP,
  keyboardRange,
  keyboardRangeLabel,
} from './keyboard-map';
import { getMidiNumber, noteIdToMidi } from './notes';
import { midiToFrequency } from './tuning';
import { MAX_OCTAVE_SHIFT, MIN_OCTAVE_SHIFT } from '../constants';

describe('keyboard map', () => {
  it('maps 37 keys: 22 white and 15 black', () => {
    const notes = generateNotes();
    expect(KEY_COUNT).toBe(37);
    expect(getWhiteKeys(notes)).toHaveLength(22);
    expect(getBlackKeys(notes)).toHaveLength(15);
  });

  it('spans C3 to C6 with no gaps or duplicates', () => {
    const notes = generateNotes();
    expect(notes[0].id).toBe('C3');
    expect(notes.at(-1)?.id).toBe('C6');
    notes.forEach((note, i) => expect(note.midi).toBe(notes[0].midi + i));
  });

  it('uses every physical key once', () => {
    const codes = KEYBOARD_MAP.map((k) => k.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('puts the lower manual on the Z/A rows and the upper on the Q/number rows', () => {
    const byCode = Object.fromEntries(generateNotes().map((n) => [n.code, n]));
    expect(byCode.KeyZ.id).toBe('C3');
    expect(byCode.KeyS.id).toBe('C#3');
    expect(byCode.Slash.id).toBe('E4');
    expect(byCode.KeyQ.id).toBe('F4');
    expect(byCode.Digit2.id).toBe('F#4');
    expect(byCode.BracketRight.id).toBe('C6');
    expect(byCode.KeyZ.manual).toBe('lower');
    expect(byCode.KeyQ.manual).toBe('upper');
  });

  it('leaves keys unmapped where a piano has no black key', () => {
    const codes = new Set(KEYBOARD_MAP.map((k) => k.code));
    ['Digit1', 'Digit5', 'Digit8', 'Equal', 'KeyF', 'KeyK'].forEach((code) => {
      expect(codes.has(code)).toBe(false);
    });
  });

  it('marks sharps as black keys', () => {
    generateNotes().forEach((note) => expect(note.isBlack).toBe(note.name.includes('#')));
  });

  it('shifts every note by whole octaves', () => {
    expect(generateNotes(1)[0].id).toBe('C4');
    expect(generateNotes(-2)[0].id).toBe('C1');
    expect(generateNotes(2).at(-1)?.id).toBe('C8');
  });
});

describe('pitch of every key', () => {
  const shifts = Array.from({ length: MAX_OCTAVE_SHIFT - MIN_OCTAVE_SHIFT + 1 }, (_, i) => MIN_OCTAVE_SHIFT + i);

  it.each(shifts)('gives each key the right MIDI number, name and frequency at octave shift %i', (shift) => {
    generateNotes(shift).forEach((note) => {
      // The id, name/octave and MIDI number all describe the same pitch
      expect(noteIdToMidi(note.id)).toBe(note.midi);
      expect(note.midi).toBe(getMidiNumber(note.name, note.octave));
      // …and the instrument sounds exactly that pitch in equal temperament at A4 = 440 Hz
      expect(midiToFrequency(note.midi)).toBeCloseTo(440 * 2 ** ((note.midi - 69) / 12), 6);
    });
  });

  it('plays A4 at 440 Hz from the E key (upper manual)', () => {
    const a4 = generateNotes().find((n) => n.code === 'KeyE')!;
    expect(a4.id).toBe('A4');
    expect(midiToFrequency(a4.midi)).toBe(440);
  });

  it('follows the piano pattern of white and black keys', () => {
    // C C# D D# E | F F# G G# A A# B: black keys never sit between E–F or B–C
    const pattern = [false, true, false, true, false, false, true, false, true, false, true, false];
    generateNotes().forEach((note) => expect(note.isBlack).toBe(pattern[note.midi % 12]));
  });

  it('puts every black key on the boundary between two white keys a semitone either side', () => {
    const notes = generateNotes();
    notes.forEach((note, i) => {
      if (!note.isBlack) return;
      expect(notes[i - 1].isBlack).toBe(false);
      expect(notes[i + 1].isBlack).toBe(false);
      expect(notes[i + 1].midi - notes[i - 1].midi).toBe(2);
    });
  });
});

describe('keyboard range', () => {
  it('reports the lowest and highest key for an octave shift', () => {
    expect(keyboardRange(0)).toEqual({ low: 48, high: 84 });
    expect(keyboardRangeLabel(0)).toBe('C3–C6');
    expect(keyboardRangeLabel(-2)).toBe('C1–C4');
    expect(keyboardRangeLabel(2)).toBe('C5–C8');
  });
});

describe('bestOctaveShift', () => {
  it('keeps the current shift when the piece already fits', () => {
    expect(bestOctaveShift([60, 64, 67], 0)).toBe(0);
  });

  it('moves the keyboard to where most of the notes are', () => {
    expect(bestOctaveShift([96, 100, 103, 108], 0)).toBe(2); // C7–C8: needs C5–C8
    expect(bestOctaveShift([28, 31, 33], 0)).toBe(-2); // E1–A1
  });

  it('prefers the shift nearest the current one on a tie', () => {
    // Two notes, one each side: shifts 0 and 1 both fit both; stay at 1
    expect(bestOctaveShift([62, 70], 1)).toBe(1);
  });

  it('keeps the current shift for an empty piece', () => {
    expect(bestOctaveShift([], -1)).toBe(-1);
  });
});
