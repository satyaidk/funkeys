/**
 * @fileoverview React hook that turns computer-key presses into notes.
 *
 * Keys are matched by **physical position** (`KeyboardEvent.code`, e.g.
 * 'KeyQ'), never by the character typed. That way:
 * - Shift (the soft pedal) and Caps Lock can't change which note plays
 * - The piano layout keeps its shape on AZERTY, QWERTZ or Dvorak keyboards
 * - A key-up always stops exactly the note its key-down started, even if
 *   the octave changed in between
 *
 * It also handles real-world edge cases:
 * 1. **Key repeat**: holding a key fires repeated keydowns; they're ignored
 * 2. **Text fields**: no notes while typing in an input
 * 3. **Focus loss**: Alt+Tab while holding keys releases them (no stuck notes)
 * 4. **Shortcuts**: Ctrl/Alt/Cmd combinations are left to the browser
 * 5. **Handled keys**: events a control already handled (`defaultPrevented`) are skipped
 */

'use client';

import { useEffect, useRef } from 'react';
import { Note } from '@/types';
import { isTypingTarget } from '@/lib/dom';

interface UseKeyboardInputOptions {
  /** Notes on the keyboard right now */
  notes: Note[];
  /** A note's key went down */
  onNoteStart: (noteId: string) => void;
  /** A note's key came up */
  onNoteStop: (noteId: string) => void;
  /** Whether keyboard input is enabled (default: true) */
  enabled?: boolean;
}

export function useKeyboardInput({
  notes,
  onNoteStart,
  onNoteStop,
  enabled = true,
}: UseKeyboardInputOptions) {
  /**
   * Physical keys currently down → the note id each one started.
   * A ref (not state): only event handlers read it; it never affects rendering.
   */
  const pressedKeysRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!enabled) return;

    const pressedKeys = pressedKeysRef.current;
    const notesByCode = new Map(notes.map((note) => [note.code, note]));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target)) return;
      if (e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (pressedKeys.has(e.code)) return;

      const note = notesByCode.get(e.code);
      if (note) {
        e.preventDefault(); // e.g. "/" opens quick-find in Firefox
        pressedKeys.set(e.code, note.id);
        onNoteStart(note.id);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const noteId = pressedKeys.get(e.code);
      if (noteId) {
        pressedKeys.delete(e.code);
        onNoteStop(noteId);
      }
    };

    /** The browser never sends keyup for keys held while the window loses focus */
    const handleBlur = () => {
      pressedKeys.forEach((noteId) => onNoteStop(noteId));
      pressedKeys.clear();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled, notes, onNoteStart, onNoteStop]);
}
