import { describe, it, expect } from 'vitest';
import { EMPTY_EDITOR, editorReducer, EditorAction, EditorState, HISTORY_LIMIT } from './editor';
import { parseNotes, serializeNotes, NotesFileError } from './notes-file';
import { PianoNoteEvent } from '@/types';

const note = (id: string, midi: number, startTime: number, endTime: number): PianoNoteEvent => ({
  id,
  midi,
  startTime,
  endTime,
  velocity: 0.8,
});

const run = (actions: EditorAction[], state: EditorState = EMPTY_EDITOR) => actions.reduce(editorReducer, state);
const loaded = () =>
  run([{ type: 'load', notes: [note('b', 64, 1, 2), note('a', 60, 0, 1), note('c', 67, 2, 3)], duration: 10 }]);

describe('editorReducer', () => {
  it('loads notes sorted, with a fresh history', () => {
    const state = loaded();
    expect(state.notes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(state).toMatchObject({ duration: 10, selectedId: null, past: [], future: [] });
  });

  it('selects only notes that exist', () => {
    expect(run([{ type: 'select', id: 'b' }], loaded()).selectedId).toBe('b');
    expect(run([{ type: 'select', id: 'zzz' }], loaded()).selectedId).toBeNull();
  });

  it('changes a note’s pitch, start, length and velocity, keeping it valid', () => {
    const state = run(
      [
        { type: 'edit', id: 'a', edit: { midi: 62 } },
        { type: 'edit', id: 'a', edit: { startTime: 4 } },
        { type: 'edit', id: 'a', edit: { duration: 0.25 } },
        { type: 'edit', id: 'a', edit: { velocity: 2 } },
      ],
      loaded()
    );
    const a = state.notes.find((n) => n.id === 'a')!;
    expect(a).toEqual({ id: 'a', midi: 62, startTime: 4, endTime: 4.25, velocity: 1 });
    expect(state.notes.at(-1)!.id).toBe('a'); // re-sorted by its new start
    expect(state.selectedId).toBe('a');
  });

  it('deletes a note and selects the next one', () => {
    const state = run([{ type: 'delete', id: 'b' }], loaded());
    expect(state.notes.map((n) => n.id)).toEqual(['a', 'c']);
    expect(state.selectedId).toBe('c');
    expect(run([{ type: 'delete', id: 'c' }], loaded()).selectedId).toBe('b');
  });

  it('adds a missing note with a fresh id and selects it', () => {
    const state = run([{ type: 'add', midi: 72, startTime: 5 }], loaded());
    const added = state.notes.find((n) => n.id === state.selectedId)!;
    expect(added).toMatchObject({ midi: 72, startTime: 5, endTime: 5.5 });
    expect(state.notes).toHaveLength(4);
  });

  it('keeps added notes on the piano', () => {
    const state = run([{ type: 'add', midi: 200, startTime: -1 }], loaded());
    const added = state.notes.find((n) => n.id === state.selectedId)!;
    expect(added).toMatchObject({ midi: 108, startTime: 0 });
  });

  it('undoes and redoes every change', () => {
    const edited = run([{ type: 'delete', id: 'a' }, { type: 'edit', id: 'b', edit: { midi: 65 } }], loaded());
    const once = run([{ type: 'undo' }], edited);
    expect(once.notes.find((n) => n.id === 'b')!.midi).toBe(64);
    const twice = run([{ type: 'undo' }], once);
    expect(twice.notes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(run([{ type: 'undo' }], twice)).toBe(twice); // nothing left to undo

    const redone = run([{ type: 'redo' }, { type: 'redo' }], twice);
    expect(redone.notes).toEqual(edited.notes);
    expect(run([{ type: 'redo' }], redone)).toBe(redone);
  });

  it('forgets the redo steps after a new change', () => {
    const state = run([{ type: 'delete', id: 'a' }, { type: 'undo' }, { type: 'delete', id: 'c' }], loaded());
    expect(state.future).toEqual([]);
  });

  it('limits the undo history', () => {
    const actions: EditorAction[] = Array.from({ length: HISTORY_LIMIT + 20 }, (_, i) => ({
      type: 'edit',
      id: 'a',
      edit: { velocity: (i % 10) / 10 },
    }));
    expect(run(actions, loaded()).past).toHaveLength(HISTORY_LIMIT);
  });

  it('ignores edits to notes that are gone', () => {
    const state = loaded();
    expect(editorReducer(state, { type: 'edit', id: 'zzz', edit: { midi: 1 } })).toBe(state);
    expect(editorReducer(state, { type: 'delete', id: 'zzz' })).toBe(state);
  });
});

describe('notes file', () => {
  const file = { title: 'Take 1', duration: 12, notes: [note('a', 60, 0, 1), note('b', 64, 1, 2)] };

  it('round-trips title, full duration and notes', () => {
    expect(parseNotes(serializeNotes(file))).toEqual({ ...file, dropped: 0 });
  });

  it('validates notes and keeps the duration at least to the last note', () => {
    const text = JSON.stringify({
      format: 'funkeys-notes',
      version: 1,
      notes: [{ midi: 60, startTime: 0, endTime: 30 }, { midi: 'x' }],
    });
    const parsed = parseNotes(text);
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.dropped).toBe(1);
    expect(parsed.duration).toBe(30);
    expect(parsed.title).toBe('Imported notes');
  });

  it('rejects other files with a clear message', () => {
    expect(() => parseNotes('{oops')).toThrow(NotesFileError);
    expect(() => parseNotes('{"format":"something-else"}')).toThrow('This isn’t a FunKeys notes file.');
    expect(() => parseNotes('{"format":"funkeys-notes","version":99}')).toThrow(/newer version/);
  });
});
