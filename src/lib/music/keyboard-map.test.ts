import { describe, it, expect } from 'vitest';
import { generateNotes, getBlackKeys, getWhiteKeys, KEY_COUNT, KEYBOARD_MAP } from './keyboard-map';

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
