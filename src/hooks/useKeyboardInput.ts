/**
 * @fileoverview React hook for handling keyboard input.
 *
 * This hook listens for keyboard events and maps physical key presses
 * to piano note callbacks. It handles several edge cases:
 *
 * 1. **Key repeat prevention**: When you hold a key, the browser fires
 *    `keydown` repeatedly. We track pressed keys and ignore repeat events.
 *
 * 2. **Text field exclusion**: Keyboard shortcuts are disabled when
 *    the user is typing in a text field (prevents notes playing while
 *    typing). Non-text controls like the volume slider don't block play.
 *
 * 3. **Focus loss handling**: When the browser window loses focus
 *    (e.g., Alt+Tab), all held notes are released to prevent stuck notes.
 *
 * 4. **Modifier key exclusion**: Ctrl+, Alt+, and Meta+ combinations
 *    are ignored to avoid interfering with browser shortcuts.
 *
 * 5. **Reliable release**: Each physical key (`KeyboardEvent.code`)
 *    remembers the note it started, so the right note stops on key-up even
 *    if Shift changed the character (`;` → `:`) or the octave changed
 *    while the key was held.
 *
 * ## Usage
 * ```tsx
 * useKeyboardInput({
 *   notes,
 *   onNoteStart: (id, freq) => audioEngine.playNote(id, freq),
 *   onNoteStop: (id) => audioEngine.stopNote(id),
 * });
 * ```
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { Note } from '@/types';
import { isTypingTarget } from '@/lib/dom';

interface UseKeyboardInputOptions {
  /** Array of notes available for playing */
  notes: Note[];
  /** Callback when a key is pressed — starts a note */
  onNoteStart: (noteId: string, frequency: number) => void;
  /** Callback when a key is released — stops a note */
  onNoteStop: (noteId: string) => void;
  /** Whether keyboard input is enabled (default: true) */
  enabled?: boolean;
}

/** Stable identifier for the physical key (falls back to the character on virtual keyboards) */
function getPhysicalKey(e: KeyboardEvent): string {
  return e.code || e.key.toLowerCase();
}

export function useKeyboardInput({
  notes,
  onNoteStart,
  onNoteStop,
  enabled = true,
}: UseKeyboardInputOptions) {
  /**
   * Currently pressed physical keys → the note ID each one started.
   * Using a ref (not state) because we don't need re-renders on key press.
   */
  const pressedKeysRef = useRef<Map<string, string>>(new Map());

  /** Look up a Note by its keyboard key */
  const findNoteByKey = useCallback(
    (key: string): Note | undefined => {
      return notes.find((n) => n.keyboardKey === key.toLowerCase());
    },
    [notes]
  );

  useEffect(() => {
    if (!enabled) return;

    const pressedKeys = pressedKeysRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in form fields
      if (isTypingTarget(e.target)) return;

      // Ignore held keys (browser fires keydown repeatedly)
      if (e.repeat) return;

      // Ignore modifier combos (Ctrl+C, Alt+Tab, etc.)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const physicalKey = getPhysicalKey(e);

      // Skip if this key is already pressed
      if (pressedKeys.has(physicalKey)) return;

      const note = findNoteByKey(e.key);
      if (note) {
        e.preventDefault(); // Prevent default browser behavior
        pressedKeys.set(physicalKey, note.id);
        onNoteStart(note.id, note.frequency);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const physicalKey = getPhysicalKey(e);
      const noteId = pressedKeys.get(physicalKey);
      if (noteId) {
        pressedKeys.delete(physicalKey);
        onNoteStop(noteId);
      }
    };

    /**
     * Release all notes when window loses focus.
     * Prevents "stuck" notes if user Alt+Tabs while holding keys.
     */
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
  }, [enabled, findNoteByKey, onNoteStart, onNoteStop]);
}
