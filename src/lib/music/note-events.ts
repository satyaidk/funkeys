/**
 * @fileoverview Timed notes in seconds: conversion, validation and editing.
 *
 * `PianoNoteEvent` (in `@/types`) is the shared timeline format. Songs are
 * written in **beats** (see `sequence.ts`) because sheet music is; audio
 * transcriptions arrive in **seconds** because recordings are. Everything
 * downstream (playback, the editor, MIDI export) works in seconds, so the
 * conversions live here, in one tested place:
 *
 * ```
 *   seconds = beats × 60 / bpm          beats = seconds × bpm / 60
 *   at 120 BPM: 1 beat = 0.5 s,  a 3-beat note = 1.5 s
 * ```
 *
 * Data from outside the app (an imported file, the transcription engine)
 * goes through `sanitizeNoteEvents` first, so a malformed note can never
 * reach the audio engine.
 */

import { PianoNoteEvent } from '@/types';
import { PIANO_HIGHEST_MIDI, PIANO_LOWEST_MIDI } from '../constants';
import { Sequence } from './sequence';

/** Shortest note the editor allows, in seconds */
export const MIN_NOTE_DURATION = 0.02;

/** Velocity for notes that don't say how hard they're played */
export const DEFAULT_NOTE_VELOCITY = 0.72;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// ── Beats ⇄ seconds ───────────────────────────────────────────────────────

/** Length in seconds of a number of beats at a tempo, e.g. 2 beats at 120 BPM → 1 s */
export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}

/** Number of beats in a length of time at a tempo, e.g. 1 s at 120 BPM → 2 beats */
export function secondsToBeats(seconds: number, bpm: number): number {
  return (seconds * bpm) / 60;
}

export interface SequenceTimingOptions {
  /**
   * Share of each note's written length that it sounds (default 1). Below 1
   * leaves a gap, so a repeated note strikes again instead of blurring.
   */
  gate?: number;
  velocity?: number;
  /** Prefix for the generated ids (default 'n') */
  idPrefix?: string;
}

/** Convert a parsed melody (beats) into timed notes (seconds) at a tempo */
export function sequenceToNoteEvents(
  sequence: Sequence,
  bpm: number,
  { gate = 1, velocity = DEFAULT_NOTE_VELOCITY, idPrefix = 'n' }: SequenceTimingOptions = {}
): PianoNoteEvent[] {
  return sequence.notes.map((note, i) => {
    const startTime = beatsToSeconds(note.start, bpm);
    return {
      id: `${idPrefix}${i}`,
      midi: note.midi,
      startTime,
      endTime: startTime + beatsToSeconds(note.length, bpm) * gate,
      velocity,
    };
  });
}

// ── Queries ───────────────────────────────────────────────────────────────

/** Order notes by start time, then pitch (low to high), then id */
export function compareNotes(a: PianoNoteEvent, b: PianoNoteEvent): number {
  return a.startTime - b.startTime || a.midi - b.midi || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** A sorted copy */
export function sortNotes(notes: readonly PianoNoteEvent[]): PianoNoteEvent[] {
  return [...notes].sort(compareNotes);
}

/** When the last note ends, in seconds (0 for no notes) */
export function notesEndTime(notes: readonly PianoNoteEvent[]): number {
  return notes.reduce((end, note) => Math.max(end, note.endTime), 0);
}

/** Lowest and highest pitch, or null for no notes */
export function pitchRange(notes: readonly PianoNoteEvent[]): { low: number; high: number } | null {
  if (notes.length === 0) return null;
  let low = Infinity;
  let high = -Infinity;
  for (const { midi } of notes) {
    low = Math.min(low, midi);
    high = Math.max(high, midi);
  }
  return { low, high };
}

/** An id not used by any of the notes, e.g. 'note-12' */
export function uniqueNoteId(notes: readonly PianoNoteEvent[], prefix = 'note-'): string {
  const used = new Set(notes.map((n) => n.id));
  let i = notes.length;
  while (used.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

// ── Validation ────────────────────────────────────────────────────────────

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export interface SanitizeResult {
  /** Valid notes, sorted, with unique ids */
  notes: PianoNoteEvent[];
  /** How many entries were rejected */
  dropped: number;
}

/**
 * Turn untrusted data into valid notes.
 *
 * Rejects anything that isn't a note: non-numbers, NaN/Infinity, MIDI
 * numbers outside 0–127, notes that end before they start. Repairs what
 * can be repaired: rounds MIDI numbers, clamps velocity to 0–1 (default
 * 0.72), moves a start before 0 to 0, and replaces missing or duplicate ids.
 */
export function sanitizeNoteEvents(raw: unknown): SanitizeResult {
  if (!Array.isArray(raw)) return { notes: [], dropped: 0 };

  const notes: PianoNoteEvent[] = [];
  const ids = new Set<string>();
  let dropped = 0;

  raw.forEach((entry, index) => {
    const e = (entry ?? {}) as Record<string, unknown>;
    if (!isFiniteNumber(e.midi) || !isFiniteNumber(e.startTime) || !isFiniteNumber(e.endTime)) {
      dropped++;
      return;
    }
    const midi = Math.round(e.midi);
    const startTime = Math.max(0, e.startTime);
    const endTime = e.endTime;
    if (midi < 0 || midi > 127 || endTime <= startTime) {
      dropped++;
      return;
    }
    let id = typeof e.id === 'string' && e.id !== '' ? e.id : `n${index}`;
    while (ids.has(id)) id = `${id}-${index}`;
    ids.add(id);
    const velocity = isFiniteNumber(e.velocity) ? clamp(e.velocity, 0, 1) : DEFAULT_NOTE_VELOCITY;
    notes.push({ id, midi, startTime, endTime, velocity });
  });

  return { notes: notes.sort(compareNotes), dropped };
}

// ── Editing ───────────────────────────────────────────────────────────────

/** What the editor may change about a note */
export type NoteEdit = Partial<Pick<PianoNoteEvent, 'midi' | 'startTime' | 'velocity'>> & {
  /** New length in seconds (the end moves; the start stays) */
  duration?: number;
};

/**
 * Apply an edit, keeping the note valid: pitch within the 88 keys, start
 * at or after 0, at least MIN_NOTE_DURATION long, velocity 0–1. Moving the
 * start keeps the note's length.
 */
export function editNote(note: PianoNoteEvent, edit: NoteEdit): PianoNoteEvent {
  const duration = Math.max(MIN_NOTE_DURATION, edit.duration ?? note.endTime - note.startTime);
  const startTime = Math.max(0, edit.startTime ?? note.startTime);
  return {
    ...note,
    midi: clamp(Math.round(edit.midi ?? note.midi), PIANO_LOWEST_MIDI, PIANO_HIGHEST_MIDI),
    startTime,
    endTime: startTime + duration,
    velocity: clamp(edit.velocity ?? note.velocity, 0, 1),
  };
}
