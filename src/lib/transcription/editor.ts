/**
 * @fileoverview The note editor's state: a reducer with undo and redo.
 *
 * Automatic transcription is an estimate, so every note can be fixed:
 * select it, change its pitch, start, length or velocity, delete it, or
 * add one the model missed. Every change is a pure function of
 * (state, action), so it's easy to test, and undo is just keeping the
 * previous note lists.
 *
 * ```
 *   past: [v1, v2]   notes: v3   future: [v4]
 *         undo ◄──────────────────────► redo
 * ```
 */

import { PianoNoteEvent } from '@/types';
import { compareNotes, editNote, MIN_NOTE_DURATION, NoteEdit, uniqueNoteId } from '../music/note-events';
import { PIANO_HIGHEST_MIDI, PIANO_LOWEST_MIDI } from '../constants';

/** How many steps of undo to keep */
export const HISTORY_LIMIT = 100;

export interface EditorState {
  notes: PianoNoteEvent[];
  /** Length of the recording in seconds */
  duration: number;
  selectedId: string | null;
  past: PianoNoteEvent[][];
  future: PianoNoteEvent[][];
}

export type EditorAction =
  | { type: 'load'; notes: PianoNoteEvent[]; duration: number }
  | { type: 'select'; id: string | null }
  | { type: 'edit'; id: string; edit: NoteEdit }
  | { type: 'delete'; id: string }
  | { type: 'add'; midi: number; startTime: number; duration?: number; velocity?: number }
  | { type: 'undo' }
  | { type: 'redo' };

export const EMPTY_EDITOR: EditorState = { notes: [], duration: 0, selectedId: null, past: [], future: [] };

/** Record a new version of the notes, making it undoable */
function commit(state: EditorState, notes: PianoNoteEvent[], selectedId: string | null): EditorState {
  return {
    ...state,
    notes: notes.sort(compareNotes),
    selectedId,
    past: [...state.past, state.notes].slice(-HISTORY_LIMIT),
    future: [],
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'load':
      return { ...EMPTY_EDITOR, notes: [...action.notes].sort(compareNotes), duration: action.duration };

    case 'select':
      return { ...state, selectedId: action.id && state.notes.some((n) => n.id === action.id) ? action.id : null };

    case 'edit': {
      const index = state.notes.findIndex((n) => n.id === action.id);
      if (index === -1) return state;
      const edited = editNote(state.notes[index], action.edit);
      const notes = [...state.notes];
      notes[index] = edited;
      return commit(state, notes, action.id);
    }

    case 'delete': {
      const index = state.notes.findIndex((n) => n.id === action.id);
      if (index === -1) return state;
      const notes = state.notes.filter((n) => n.id !== action.id);
      // Select the next note, so you can keep deleting wrong notes in a row
      const next = notes[Math.min(index, notes.length - 1)]?.id ?? null;
      return commit(state, notes, next);
    }

    case 'add': {
      const id = uniqueNoteId(state.notes, 'added-');
      const startTime = Math.max(0, action.startTime);
      const note: PianoNoteEvent = {
        id,
        midi: Math.min(PIANO_HIGHEST_MIDI, Math.max(PIANO_LOWEST_MIDI, Math.round(action.midi))),
        startTime,
        endTime: startTime + Math.max(MIN_NOTE_DURATION, action.duration ?? 0.5),
        velocity: action.velocity ?? 0.75,
      };
      return commit(state, [...state.notes, note], id);
    }

    case 'undo': {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...state,
        notes: previous,
        past: state.past.slice(0, -1),
        future: [state.notes, ...state.future],
        selectedId: previous.some((n) => n.id === state.selectedId) ? state.selectedId : null,
      };
    }

    case 'redo': {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return {
        ...state,
        notes: next,
        past: [...state.past, state.notes],
        future: rest,
        selectedId: next.some((n) => n.id === state.selectedId) ? state.selectedId : null,
      };
    }
  }
}
