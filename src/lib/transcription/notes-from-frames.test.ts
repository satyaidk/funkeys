import { describe, it, expect, vi } from 'vitest';
// Basic Pitch's real decoder (plain TypeScript, no model needed)
import { noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch/esm/toMidi';
import {
  amplitudeToVelocity,
  decodeNotes,
  DEFAULT_TRANSCRIPTION_SETTINGS,
  msToFrames,
  NoteDecoder,
  planChunks,
  removeOvertones,
  TimedNote,
  toPianoNotes,
} from './notes-from-frames';

const decoder: NoteDecoder = { outputToNotesPoly, noteFramesToTime };

/**
 * Build the model's two matrices by hand: each note is a clear onset peak
 * followed by steady activation on its key until it ends.
 */
function matrices(total: number, notes: Array<[midi: number, start: number, end: number, strength?: number]>) {
  const frames = Array.from({ length: total }, () => new Array<number>(88).fill(0.02));
  const onsets = Array.from({ length: total }, () => new Array<number>(88).fill(0));
  for (const [midi, start, end, strength = 0.85] of notes) {
    const key = midi - 21;
    for (let t = start; t < end; t++) frames[t][key] = strength;
    onsets[start][key] = 0.95;
    if (start > 0) onsets[start - 1][key] = 0.3;
    onsets[start + 1][key] = 0.3;
  }
  return { frames, onsets };
}

const timed = (pitchMidi: number, start: number, duration: number, amplitude = 0.8): TimedNote => ({
  pitchMidi,
  startTimeSeconds: start,
  durationSeconds: duration,
  amplitude,
});

describe('planChunks', () => {
  it('covers every frame exactly once, with context on both sides', () => {
    const chunks = planChunks(960, 300, 40);
    expect(chunks.map((c) => [c.keepFrom, c.keepTo])).toEqual([
      [0, 300],
      [300, 600],
      [600, 960], // a 60-frame tail (under a quarter chunk) joins the last chunk
    ]);
    expect(chunks[0]).toMatchObject({ from: 0, to: 340 });
    expect(chunks[1]).toMatchObject({ from: 260, to: 640 });
    expect(chunks[2]).toMatchObject({ from: 560, to: 960 });
    // A longer tail gets its own chunk
    expect(planChunks(1000, 300, 40)).toHaveLength(4);
  });

  it('uses one chunk for a short recording and none for nothing', () => {
    expect(planChunks(100, 300, 40)).toEqual([{ from: 0, to: 100, keepFrom: 0, keepTo: 100 }]);
    expect(planChunks(0)).toEqual([]);
  });
});

describe('decodeNotes', () => {
  const settings = { ...DEFAULT_TRANSCRIPTION_SETTINGS, minNoteMs: 50 };
  // Notes placed across the chunk boundaries at 200 and 400, plus a chord and a silence
  const piece = matrices(600, [
    [60, 10, 60],
    [64, 10, 60],
    [67, 10, 60], // a chord
    [72, 190, 230], // starts just before a boundary, ends after it
    [55, 200, 260], // starts exactly on a boundary
    [62, 395, 440],
    [69, 520, 580], // after a long silence
  ]);

  it('finds every note, chord and pitch, at its frame', () => {
    const notes = decodeNotes(piece.frames, piece.onsets, settings, decoder);
    expect(notes.map((n) => n.pitchMidi).sort()).toEqual([55, 60, 62, 64, 67, 69, 72]);
  });

  it('gives the same notes in chunks as in one pass: nothing cut or doubled at a boundary', () => {
    const whole = decodeNotes(piece.frames, piece.onsets, settings, decoder, undefined, 10_000, 0);
    const chunked = decodeNotes(piece.frames, piece.onsets, settings, decoder, undefined, 200, 80);
    const key = (n: TimedNote) => `${n.pitchMidi}@${n.startTimeSeconds.toFixed(4)}+${n.durationSeconds.toFixed(4)}`;
    expect(chunked.map(key).sort()).toEqual(whole.map(key).sort());
  });

  it('reports progress after each chunk', () => {
    const onProgress = vi.fn();
    decodeNotes(piece.frames, piece.onsets, settings, decoder, onProgress, 200, 80);
    expect(onProgress.mock.calls.map(([f]) => f)).toEqual([1 / 3, 2 / 3, 1]);
  });

  it('converts the minimum note length from milliseconds to frames', () => {
    expect(msToFrames(58)).toBe(5);
    expect(msToFrames(0)).toBe(1);
  });
});

describe('removeOvertones', () => {
  it('drops weak notes an octave, twelfth or more above a note starting with them', () => {
    const notes = [
      timed(60, 1.0, 1, 0.85),
      timed(72, 1.02, 0.5, 0.34), // octave
      timed(79, 1.05, 0.5, 0.33), // twelfth
      timed(88, 0.99, 0.5, 0.3), // two octaves and a major third
    ];
    expect(removeOvertones(notes).map((n) => n.pitchMidi)).toEqual([60]);
  });

  it('keeps real octaves, which are about as strong', () => {
    const notes = [timed(48, 1, 1, 0.8), timed(60, 1, 1, 0.7)];
    expect(removeOvertones(notes)).toHaveLength(2);
  });

  it('keeps weak notes at other intervals, or starting at another time', () => {
    const notes = [timed(60, 1, 1, 0.9), timed(64, 1, 1, 0.3), timed(72, 2, 1, 0.3)];
    expect(removeOvertones(notes)).toHaveLength(3);
  });
});

describe('toPianoNotes', () => {
  it('converts to piano notes in seconds, sorted, with ids and velocities', () => {
    const notes = toPianoNotes([timed(64, 1, 0.5, 0.5), timed(60, 0.5, 1, 0.9)], 10, { removeOvertones: false });
    expect(notes).toEqual([
      { id: 'n0', midi: 60, startTime: 0.5, endTime: 1.5, velocity: amplitudeToVelocity(0.9) },
      { id: 'n1', midi: 64, startTime: 1, endTime: 1.5, velocity: amplitudeToVelocity(0.5) },
    ]);
  });

  it('keeps notes inside the recording', () => {
    const [note] = toPianoNotes([timed(60, 9.5, 2)], 10, { removeOvertones: false });
    expect(note.endTime).toBe(10);
    expect(toPianoNotes([timed(60, 11, 1)], 10, { removeOvertones: false })).toEqual([]);
  });

  it('merges two detections of one strike, and ends a note when its key strikes again', () => {
    const notes = toPianoNotes(
      [timed(60, 1, 0.5, 0.6), timed(60, 1.01, 0.8, 0.8), timed(62, 1, 2), timed(62, 2, 1)],
      10,
      { removeOvertones: false }
    );
    const c = notes.filter((n) => n.midi === 60);
    expect(c).toHaveLength(1);
    expect(c[0].endTime).toBeCloseTo(1.81);
    const d = notes.filter((n) => n.midi === 62);
    expect(d.map((n) => [n.startTime, n.endTime])).toEqual([
      [1, 2],
      [2, 3],
    ]);
  });

  it('drops pitches outside the 88 keys and broken values', () => {
    const notes = toPianoNotes([timed(10, 1, 1), timed(60, NaN, 1), timed(60, 1, 1)], 10, { removeOvertones: false });
    expect(notes).toHaveLength(1);
  });

  it('maps model confidence to a velocity, louder for stronger detections', () => {
    expect(amplitudeToVelocity(0.3)).toBeLessThan(amplitudeToVelocity(0.9));
    expect(amplitudeToVelocity(5)).toBe(1);
    expect(amplitudeToVelocity(NaN)).toBeCloseTo(0.6);
  });
});
