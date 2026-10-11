/**
 * @fileoverview Which piano key each finger (or the mouse) is on.
 *
 * Touch screens report every finger as a separate *pointer* with its own
 * id. To play chords and glissandos (sliding along the keys), the keyboard
 * remembers which key each pointer is on and, as pointers move, works out
 * which notes to start and stop.
 *
 * Two fingers can rest on the same key. The note starts with the first and
 * stops only when the last one lifts, so lifting one finger never cuts a
 * note another finger is still holding.
 *
 * Like `NoteTracker`, this is a pure state machine: it returns what to do
 * and never touches the DOM or audio, so it's easy to test.
 */

export interface PointerChange {
  /** Note to start, if the pointer arrived on a key nobody else holds */
  start: string | null;
  /** Note to stop, if the pointer left a key nobody else holds */
  stop: string | null;
}

const NO_CHANGE: PointerChange = { start: null, stop: null };

export class PointerTracker {
  /** Pointer id → the key it's on (null: down, but between or off the keys) */
  private pointers = new Map<number, string | null>();
  /** Note id → how many pointers hold it */
  private holders = new Map<string, number>();

  /** Is this pointer pressing (it went down on a key and hasn't lifted)? */
  has(pointerId: number): boolean {
    return this.pointers.has(pointerId);
  }

  /** Number of pointers pressing right now */
  get size(): number {
    return this.pointers.size;
  }

  /**
   * A pointer went down on, or moved onto, a key (`null`: onto no key).
   * Moving within the same key changes nothing.
   */
  move(pointerId: number, noteId: string | null): PointerChange {
    const previous = this.pointers.has(pointerId) ? this.pointers.get(pointerId)! : null;
    if (this.pointers.has(pointerId) && previous === noteId) return NO_CHANGE;

    this.pointers.set(pointerId, noteId);
    const stop = previous !== null && this.drop(previous) ? previous : null;
    const start = noteId !== null && this.hold(noteId) ? noteId : null;
    return { start, stop };
  }

  /** A pointer lifted or was cancelled. @returns the note to stop, if any */
  release(pointerId: number): string | null {
    if (!this.pointers.has(pointerId)) return null;
    const noteId = this.pointers.get(pointerId)!;
    this.pointers.delete(pointerId);
    return noteId !== null && this.drop(noteId) ? noteId : null;
  }

  /** Lift every pointer (window lost focus, tab hidden). @returns notes to stop */
  releaseAll(): string[] {
    const notes = [...this.holders.keys()];
    this.pointers.clear();
    this.holders.clear();
    return notes;
  }

  /** @returns true if this is the first pointer on the note */
  private hold(noteId: string): boolean {
    const count = this.holders.get(noteId) ?? 0;
    this.holders.set(noteId, count + 1);
    return count === 0;
  }

  /** @returns true if no pointer is left on the note */
  private drop(noteId: string): boolean {
    const count = (this.holders.get(noteId) ?? 1) - 1;
    if (count <= 0) {
      this.holders.delete(noteId);
      return true;
    }
    this.holders.set(noteId, count);
    return false;
  }
}
