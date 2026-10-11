import { describe, it, expect } from 'vitest';
import {
  beatsToSeconds,
  compareNotes,
  DEFAULT_NOTE_VELOCITY,
  editNote,
  MIN_NOTE_DURATION,
  notesEndTime,
  pitchRange,
  sanitizeNoteEvents,
  secondsToBeats,
  sequenceToNoteEvents,
  sortNotes,
  uniqueNoteId,
} from './note-events';
import { parseSequence } from './sequence';
import { PianoNoteEvent } from '@/types';

const note = (id: string, midi: number, startTime: number, endTime: number, velocity = 0.8): PianoNoteEvent => ({
  id,
  midi,
  startTime,
  endTime,
  velocity,
});

describe('beats ⇄ seconds', () => {
  it('converts at the tempo: one beat at 120 BPM is half a second', () => {
    expect(beatsToSeconds(1, 120)).toBe(0.5);
    expect(beatsToSeconds(3, 60)).toBe(3);
    expect(secondsToBeats(1.5, 120)).toBe(3);
  });

  it('round-trips', () => {
    for (const bpm of [47, 96, 133]) expect(secondsToBeats(beatsToSeconds(7.25, bpm), bpm)).toBeCloseTo(7.25, 10);
  });
});

describe('sequenceToNoteEvents', () => {
  it('times each note in seconds, keeping rests and chords', () => {
    const notes = sequenceToNoteEvents(parseSequence('C4+E4/4 R/4 G4/2'), 120);
    expect(notes.map((n) => [n.midi, n.startTime, n.endTime])).toEqual([
      [60, 0, 0.5],
      [64, 0, 0.5], // chord: same start
      [67, 1, 2], // after a quarter rest
    ]);
    expect(notes.every((n) => n.velocity === DEFAULT_NOTE_VELOCITY)).toBe(true);
    expect(new Set(notes.map((n) => n.id)).size).toBe(3);
  });

  it('shortens each note by the gate so repeated notes strike again', () => {
    const [first, second] = sequenceToNoteEvents(parseSequence('A4/4 A4/4'), 60, { gate: 0.9 });
    expect(first.endTime).toBeCloseTo(0.9);
    expect(second.startTime).toBe(1);
  });
});

describe('queries', () => {
  const notes = [note('b', 67, 1, 2), note('a', 60, 0, 3.5), note('c', 64, 1, 1.5)];

  it('sorts by start time, then pitch', () => {
    expect(sortNotes(notes).map((n) => n.id)).toEqual(['a', 'c', 'b']);
    expect(compareNotes(notes[0], notes[0])).toBe(0);
  });

  it('finds where the last note ends, even when an earlier note rings longest', () => {
    expect(notesEndTime(notes)).toBe(3.5);
    expect(notesEndTime([])).toBe(0);
  });

  it('reports the pitch range', () => {
    expect(pitchRange(notes)).toEqual({ low: 60, high: 67 });
    expect(pitchRange([])).toBeNull();
  });

  it('makes ids that are not taken', () => {
    expect(uniqueNoteId([note('note-1', 60, 0, 1)])).toBe('note-2');
    expect(uniqueNoteId([])).toBe('note-0');
  });
});

describe('sanitizeNoteEvents', () => {
  it('keeps valid notes, sorted', () => {
    const { notes, dropped } = sanitizeNoteEvents([note('x', 64, 2, 3), note('y', 60, 0, 1)]);
    expect(notes.map((n) => n.id)).toEqual(['y', 'x']);
    expect(dropped).toBe(0);
  });

  it('rejects entries that are not notes', () => {
    const { notes, dropped } = sanitizeNoteEvents([
      null,
      'C4',
      { midi: 60 },
      { midi: NaN, startTime: 0, endTime: 1 },
      { midi: 60, startTime: 0, endTime: Infinity },
      { midi: 200, startTime: 0, endTime: 1 },
      { midi: 60, startTime: 2, endTime: 1 }, // ends before it starts
      { midi: 60, startTime: 0, endTime: 1 },
    ]);
    expect(notes).toHaveLength(1);
    expect(dropped).toBe(7);
  });

  it('repairs what it can: rounding, clamping, defaults and duplicate ids', () => {
    const { notes } = sanitizeNoteEvents([
      { id: 'a', midi: 60.4, startTime: -0.5, endTime: 1, velocity: 3 },
      { id: 'a', midi: 62, startTime: 1, endTime: 2 },
    ]);
    expect(notes[0]).toEqual({ id: 'a', midi: 60, startTime: 0, endTime: 1, velocity: 1 });
    expect(notes[1].id).not.toBe('a');
    expect(notes[1].velocity).toBe(DEFAULT_NOTE_VELOCITY);
  });

  it('returns nothing for something that is not a list', () => {
    expect(sanitizeNoteEvents({ notes: [] })).toEqual({ notes: [], dropped: 0 });
  });
});

describe('editNote', () => {
  const original = note('n', 60, 1, 2);

  it('changes pitch, start, length and velocity', () => {
    expect(editNote(original, { midi: 62 })).toMatchObject({ midi: 62, startTime: 1, endTime: 2 });
    expect(editNote(original, { duration: 0.25 })).toMatchObject({ startTime: 1, endTime: 1.25 });
    expect(editNote(original, { velocity: 0.3 }).velocity).toBe(0.3);
  });

  it('keeps the length when the note moves', () => {
    expect(editNote(original, { startTime: 4 })).toMatchObject({ startTime: 4, endTime: 5 });
  });

  it('keeps the note valid', () => {
    expect(editNote(original, { midi: 130 }).midi).toBe(108);
    expect(editNote(original, { midi: 2 }).midi).toBe(21);
    expect(editNote(original, { startTime: -3 }).startTime).toBe(0);
    const tiny = editNote(original, { duration: 0 });
    expect(tiny.endTime - tiny.startTime).toBeCloseTo(MIN_NOTE_DURATION);
    expect(editNote(original, { velocity: -1 }).velocity).toBe(0);
  });

  it('does not change the original', () => {
    editNote(original, { midi: 70 });
    expect(original.midi).toBe(60);
  });
});
