/**
 * @fileoverview From the model's output to piano notes.
 *
 * Basic Pitch (Spotify's transcription model) doesn't output notes. Every
 * ~11.6 ms (a *frame*: 256 samples at 22 050 Hz) it gives, for each of the
 * 88 keys, two probabilities:
 *
 * - **onsets**: how likely a note *starts* on this key now
 * - **frames**: how likely a note *is sounding* on this key now
 *
 * Its own `outputToNotesPoly` turns those matrices into notes: a peak in
 * `onsets` starts a note, which lasts while `frames` stays above a
 * threshold. This module adds what a long recording and a piano need:
 *
 * 1. **Chunks.** The library's decoder loops over the whole matrix again
 *    for every leftover blob of energy, so its cost grows much faster than
 *    the recording. Decoding ~30 s at a time keeps a five-minute piece
 *    fast. Each chunk is decoded with 4 s of context on both sides, and a
 *    note belongs to the chunk where it *starts*, so notes crossing a
 *    boundary are neither cut nor counted twice:
 *
 *    ```
 *       context |====== chunk 1 (keep) ======| context
 *                                    context |====== chunk 2 (keep) ======| …
 *    ```
 *
 * 2. **Overtones.** A struck piano string also sounds faintly an octave,
 *    a twelfth, two octaves… higher, and the model sometimes reports those
 *    as quiet extra notes. An optional cleanup drops a note that sits on
 *    such an interval above a note starting with it *and* is much weaker
 *    (a real octave played by the other hand is about as strong).
 *
 * 3. **Piano notes.** Times in seconds within the recording, a velocity
 *    from the model's confidence, the same key never sounding twice at
 *    once, sorted, with ids.
 */

import { PianoNoteEvent } from '@/types';
import { PIANO_HIGHEST_MIDI, PIANO_LOWEST_MIDI } from '../constants';

/** Analysis sample rate and frame size of Basic Pitch */
export const MODEL_SAMPLE_RATE = 22050;
export const FRAME_HOP = 256;
export const SECONDS_PER_FRAME = FRAME_HOP / MODEL_SAMPLE_RATE;

/** ≈ 30 s of frames per decoding chunk, with ≈ 4 s of context either side */
export const CHUNK_FRAMES = 2584;
export const CONTEXT_FRAMES = 344;

export interface TranscriptionSettings {
  /** How clearly a note must start to count (0–1). Lower finds more notes, and more mistakes. */
  onsetThreshold: number;
  /** How strong a note must stay to keep sounding (0–1). Lower makes notes longer. */
  frameThreshold: number;
  /** Shortest note to keep, in milliseconds */
  minNoteMs: number;
  /** Drop quiet notes that look like overtones of a louder note */
  removeOvertones: boolean;
}

/** Basic Pitch's own defaults for onsets and frames; a short minimum length suits fast piano passages */
export const DEFAULT_TRANSCRIPTION_SETTINGS: TranscriptionSettings = {
  onsetThreshold: 0.5,
  frameThreshold: 0.3,
  minNoteMs: 58,
  removeOvertones: true,
};

/** A note in model frames, as Basic Pitch's decoder returns it */
export interface FrameNote {
  startFrame: number;
  durationFrames: number;
  pitchMidi: number;
  amplitude: number;
}

/** A note in seconds, as Basic Pitch's `noteFramesToTime` returns it */
export interface TimedNote {
  startTimeSeconds: number;
  durationSeconds: number;
  pitchMidi: number;
  amplitude: number;
}

/** The two Basic Pitch functions used here (injected, so tests don't need the model) */
export interface NoteDecoder {
  outputToNotesPoly(
    frames: number[][],
    onsets: number[][],
    onsetThreshold: number,
    frameThreshold: number,
    minNoteFrames: number
  ): FrameNote[];
  noteFramesToTime(notes: FrameNote[]): TimedNote[];
}

export interface Chunk {
  /** Frames handed to the decoder, context included */
  from: number;
  to: number;
  /** Notes starting in [keepFrom, keepTo) belong to this chunk */
  keepFrom: number;
  keepTo: number;
}

/** Split `total` frames into chunks with context (a short last piece joins the one before) */
export function planChunks(total: number, chunk = CHUNK_FRAMES, context = CONTEXT_FRAMES): Chunk[] {
  const chunks: Chunk[] = [];
  for (let keepFrom = 0; keepFrom < total; ) {
    let keepTo = Math.min(total, keepFrom + chunk);
    if (total - keepTo < chunk / 4) keepTo = total;
    chunks.push({
      from: Math.max(0, keepFrom - context),
      to: Math.min(total, keepTo + context),
      keepFrom,
      keepTo,
    });
    keepFrom = keepTo;
  }
  return chunks;
}

export function msToFrames(ms: number): number {
  return Math.max(1, Math.round(ms / 1000 / SECONDS_PER_FRAME));
}

/**
 * Decode the model's frame and onset matrices into timed notes, chunk by chunk.
 * @param onProgress - Called after each chunk with the share done (0–1)
 */
export function decodeNotes(
  frames: number[][],
  onsets: number[][],
  settings: TranscriptionSettings,
  decoder: NoteDecoder,
  onProgress?: (fraction: number) => void,
  chunkFrames = CHUNK_FRAMES,
  contextFrames = CONTEXT_FRAMES
): TimedNote[] {
  const chunks = planChunks(Math.min(frames.length, onsets.length), chunkFrames, contextFrames);
  const minFrames = msToFrames(settings.minNoteMs);
  const found: FrameNote[] = [];

  chunks.forEach((chunk, i) => {
    const notes = decoder.outputToNotesPoly(
      frames.slice(chunk.from, chunk.to),
      onsets.slice(chunk.from, chunk.to),
      settings.onsetThreshold,
      settings.frameThreshold,
      minFrames
    );
    for (const note of notes) {
      const start = note.startFrame + chunk.from;
      if (start >= chunk.keepFrom && start < chunk.keepTo) found.push({ ...note, startFrame: start });
    }
    onProgress?.((i + 1) / chunks.length);
  });

  // Frame → seconds needs absolute frame numbers (the model's windows add a small offset)
  return decoder.noteFramesToTime(found);
}

/** Intervals (semitones) at which a piano string's overtones sound: octave, twelfth, two octaves… */
export const OVERTONE_INTERVALS: ReadonlySet<number> = new Set([12, 19, 24, 28, 31, 34, 36]);
/** An overtone starts at most this much before (s) or after its fundamental */
const OVERTONE_WINDOW = { before: 0.05, after: 0.1 };
/** …and is at most this strong relative to it */
const OVERTONE_RATIO = 0.6;

/** Drop quiet notes that sit an overtone interval above a stronger note starting with them */
export function removeOvertones(notes: readonly TimedNote[]): TimedNote[] {
  const sorted = [...notes].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  return sorted.filter((note, i) => {
    // Look at notes starting near this one (sorted by start, so scan outwards)
    for (const step of [-1, 1]) {
      for (let j = i + step; j >= 0 && j < sorted.length; j += step) {
        const other = sorted[j];
        const dt = note.startTimeSeconds - other.startTimeSeconds;
        if (dt > OVERTONE_WINDOW.after || dt < -OVERTONE_WINDOW.before) break;
        if (
          OVERTONE_INTERVALS.has(note.pitchMidi - other.pitchMidi) &&
          note.amplitude < other.amplitude * OVERTONE_RATIO
        ) {
          return false;
        }
      }
    }
    return true;
  });
}

/** Model confidence (≈ 0.3–1) → playing strength. Monotonic: a stronger detection plays louder. */
export function amplitudeToVelocity(amplitude: number): number {
  return Math.min(1, Math.max(0.2, 0.2 + 0.8 * (Number.isFinite(amplitude) ? amplitude : 0.5)));
}

/** Two detections of one key closer than this (s) are the same note */
const SAME_NOTE_WINDOW = 0.03;

/**
 * Timed notes → the app's piano notes: clipped to the recording, one
 * sounding note per key at a time, sorted, with ids.
 */
export function toPianoNotes(
  notes: readonly TimedNote[],
  duration: number,
  settings: Pick<TranscriptionSettings, 'removeOvertones'>
): PianoNoteEvent[] {
  const cleaned = settings.removeOvertones ? removeOvertones(notes) : [...notes];

  // Per key, in time order: merge double detections, and end a note when the key strikes again
  const byKey = cleaned
    .filter((n) => Number.isFinite(n.startTimeSeconds) && Number.isFinite(n.durationSeconds))
    .filter((n) => n.pitchMidi >= PIANO_LOWEST_MIDI && n.pitchMidi <= PIANO_HIGHEST_MIDI)
    .map((n) => ({
      midi: Math.round(n.pitchMidi),
      start: Math.max(0, n.startTimeSeconds),
      end: Math.min(duration, n.startTimeSeconds + Math.max(0, n.durationSeconds)),
      amplitude: n.amplitude,
    }))
    .filter((n) => n.end > n.start)
    .sort((a, b) => a.midi - b.midi || a.start - b.start);

  const kept: typeof byKey = [];
  for (const note of byKey) {
    const previous = kept.at(-1);
    if (previous && previous.midi === note.midi) {
      if (note.start - previous.start < SAME_NOTE_WINDOW) {
        previous.end = Math.max(previous.end, note.end);
        previous.amplitude = Math.max(previous.amplitude, note.amplitude);
        continue;
      }
      if (previous.end > note.start) previous.end = note.start;
    }
    kept.push({ ...note });
  }

  return kept
    .filter((n) => n.end > n.start)
    .sort((a, b) => a.start - b.start || a.midi - b.midi)
    .map((n, i) => ({
      id: `n${i}`,
      midi: n.midi,
      startTime: n.start,
      endTime: n.end,
      velocity: amplitudeToVelocity(n.amplitude),
    }));
}
