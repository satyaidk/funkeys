import { describe, it, expect } from 'vitest';
import { encodeVarLen, MidiParseError, PPQ, readMidiFile, writeMidiFile } from './midi-file';
import { PianoNoteEvent } from '@/types';

const note = (id: string, midi: number, startTime: number, endTime: number, velocity = 0.8): PianoNoteEvent => ({
  id,
  midi,
  startTime,
  endTime,
  velocity,
});

const ascii = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));

describe('encodeVarLen', () => {
  it('encodes 7 bits per byte, high bit on all but the last', () => {
    expect(encodeVarLen(0)).toEqual([0x00]);
    expect(encodeVarLen(0x40)).toEqual([0x40]);
    expect(encodeVarLen(127)).toEqual([0x7f]);
    expect(encodeVarLen(128)).toEqual([0x81, 0x00]);
    expect(encodeVarLen(200)).toEqual([0x81, 0x48]);
    expect(encodeVarLen(100_000)).toEqual([0x86, 0x8d, 0x20]);
  });
});

describe('writeMidiFile', () => {
  it('writes a format-0 file with one track at 480 ticks per quarter note', () => {
    const bytes = writeMidiFile([note('a', 60, 0, 1)]);
    expect(ascii(bytes, 0)).toBe('MThd');
    expect([...bytes.subarray(8, 14)]).toEqual([0, 0, 0, 1, PPQ >> 8, PPQ & 0xff]);
    expect(ascii(bytes, 14)).toBe('MTrk');
    expect([...bytes.subarray(-4)]).toEqual([0x00, 0xff, 0x2f, 0x00]); // end of track
  });

  it('round-trips notes: pitch, timing (to a millisecond), velocity, chords and rests', () => {
    const notes = [
      note('a', 60, 0, 0.5, 1),
      note('b', 64, 0, 0.5, 0.5), // chord
      note('c', 67, 2.25, 2.3125, 0.3), // after a rest, short
      note('d', 21, 3, 7.5), // lowest key, long
      note('e', 108, 7, 7.5),
    ];
    const { notes: back, duration } = readMidiFile(writeMidiFile(notes));
    expect(back).toHaveLength(5);
    back.forEach((n, i) => {
      expect(n.midi).toBe(notes[i].midi);
      expect(n.startTime).toBeCloseTo(notes[i].startTime, 3);
      expect(n.endTime).toBeCloseTo(notes[i].endTime, 3);
      expect(n.velocity).toBeCloseTo(notes[i].velocity, 1);
    });
    expect(duration).toBeCloseTo(7.5, 3);
  });

  it('keeps a five-minute transcription’s timeline', () => {
    const notes = Array.from({ length: 600 }, (_, i) => note(`n${i}`, 48 + (i % 36), i * 0.5, i * 0.5 + 0.4));
    const { notes: back } = readMidiFile(writeMidiFile(notes));
    expect(back).toHaveLength(600);
    expect(back.at(-1)!.startTime).toBeCloseTo(299.5, 3);
  });

  it('ends a note where the same key strikes again, and orders the off before the on', () => {
    const { notes } = readMidiFile(writeMidiFile([note('a', 60, 0, 2), note('b', 60, 1, 1.5)]));
    expect(notes.map((n) => [n.startTime, n.endTime])).toEqual([
      [0, 1],
      [1, 1.5],
    ]);
  });

  it('never writes a zero-length note or a silent note-on', () => {
    const { notes } = readMidiFile(writeMidiFile([note('a', 60, 1, 1.0001, 0)]));
    expect(notes).toHaveLength(1);
    expect(notes[0].endTime).toBeGreaterThan(notes[0].startTime);
    expect(notes[0].velocity).toBeGreaterThan(0);
  });
});

describe('readMidiFile', () => {
  it('follows running status, note-on with velocity 0 as note-off, and tempo changes', () => {
    // One track at 480 PPQ: tempo 60 BPM; C4 on, (running status) E4 on; both off after a quarter
    const track = [
      0x00, 0xff, 0x51, 0x03, 0x0f, 0x42, 0x40, // 1 000 000 µs per quarter = 60 BPM
      0x00, 0x90, 60, 100,
      0x00, 64, 90, // running status
      0x83, 0x60, 60, 0, // 480 ticks later: note-on velocity 0 = off
      0x00, 64, 0,
      0x00, 0xff, 0x2f, 0x00,
    ];
    const file = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0,
      0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, track.length, ...track,
    ]);
    const { notes } = readMidiFile(file);
    expect(notes.map((n) => [n.midi, n.startTime, n.endTime])).toEqual([
      [60, 0, 1],
      [64, 0, 1],
    ]);
  });

  it('rejects files that are not MIDI', () => {
    expect(() => readMidiFile(new TextEncoder().encode('not a midi file'))).toThrow(MidiParseError);
  });
});
