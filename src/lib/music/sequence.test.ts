import { describe, it, expect } from 'vitest';
import { parseSequence } from './sequence';

describe('parseSequence', () => {
  it('reads pitches and note values, timed in quarter-note beats', () => {
    expect(parseSequence('C4/4 E4/8 G4/2')).toEqual({
      notes: [
        { midi: 60, start: 0, length: 1 },
        { midi: 64, start: 1, length: 0.5 },
        { midi: 67, start: 1.5, length: 2 },
      ],
      beats: 3.5,
    });
  });

  it('knows every note value from whole to sixteenth', () => {
    const { notes } = parseSequence('C4/1 C4/2 C4/4 C4/8 C4/16');
    expect(notes.map((n) => n.length)).toEqual([4, 2, 1, 0.5, 0.25]);
  });

  it('makes a dotted note half as long again', () => {
    expect(parseSequence('A4/8.').notes[0].length).toBe(0.75);
    expect(parseSequence('A4/4.').notes[0].length).toBe(1.5);
  });

  it('counts rests in the timing without adding notes', () => {
    const { notes, beats } = parseSequence('R/4 D5/8 R/8');
    expect(notes).toEqual([{ midi: 74, start: 1, length: 0.5 }]);
    expect(beats).toBe(2);
  });

  it('plays the notes of a chord together', () => {
    const { notes } = parseSequence('C4+E4+G4/2 A#3/4');
    expect(notes).toEqual([
      { midi: 60, start: 0, length: 2 },
      { midi: 64, start: 0, length: 2 },
      { midi: 67, start: 0, length: 2 },
      { midi: 58, start: 2, length: 1 },
    ]);
  });

  it('ignores bar lines and extra whitespace, including new lines', () => {
    const plain = parseSequence('C4/4 D4/4 E4/2');
    expect(parseSequence('\n  C4/4  D4/4 |\n  E4/2 |  ')).toEqual(plain);
  });

  it('names the token it cannot read', () => {
    expect(() => parseSequence('C4/4 C4/3')).toThrow('"C4/3"');
    expect(() => parseSequence('C4')).toThrow('"C4"');
    expect(() => parseSequence('Db4/4')).toThrow('"Db4/4"');
    expect(() => parseSequence('E#4/4')).toThrow('unknown note "E#4"');
  });

  it('rejects an empty melody', () => {
    expect(() => parseSequence('  | ')).toThrow();
  });
});
