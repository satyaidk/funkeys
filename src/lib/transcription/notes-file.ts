/**
 * @fileoverview FunKeys' own file format for timed notes (.funkeys.json).
 *
 * Plain JSON, so it's easy to read, diff and generate:
 *
 * ```json
 * { "format": "funkeys-notes", "version": 1, "title": "My take",
 *   "duration": 12.5, "notes": [{ "midi": 60, "startTime": 0.5, "endTime": 1, "velocity": 0.8 }] }
 * ```
 *
 * Unlike MIDI it keeps the recording's full length (silence at the end
 * included) and FunKeys' note ids. Only the notes are saved: the original
 * audio stays on your device and is never part of the file.
 */

import { PianoNoteEvent } from '@/types';
import { notesEndTime, sanitizeNoteEvents } from '../music/note-events';

export const NOTES_FORMAT = 'funkeys-notes';
export const NOTES_FORMAT_VERSION = 1;

export interface NotesFile {
  title: string;
  /** Length in seconds (at least until the last note ends) */
  duration: number;
  notes: PianoNoteEvent[];
}

export function serializeNotes({ title, duration, notes }: NotesFile): string {
  return JSON.stringify(
    {
      format: NOTES_FORMAT,
      version: NOTES_FORMAT_VERSION,
      title,
      duration,
      notes: notes.map(({ id, midi, startTime, endTime, velocity }) => ({ id, midi, startTime, endTime, velocity })),
    },
    null,
    2
  );
}

export class NotesFileError extends Error {}

/**
 * Read a .funkeys.json file, validating every note.
 * @throws NotesFileError with a message to show the user
 */
export function parseNotes(text: string): NotesFile & { dropped: number } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new NotesFileError('This file isn’t valid JSON.');
  }
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.format !== NOTES_FORMAT) throw new NotesFileError('This isn’t a FunKeys notes file.');
  if (typeof d.version !== 'number' || d.version > NOTES_FORMAT_VERSION) {
    throw new NotesFileError('This notes file was made by a newer version of FunKeys.');
  }
  const { notes, dropped } = sanitizeNoteEvents(d.notes);
  const duration = Math.max(typeof d.duration === 'number' && Number.isFinite(d.duration) ? d.duration : 0, notesEndTime(notes));
  return { title: typeof d.title === 'string' ? d.title : 'Imported notes', duration, notes, dropped };
}
