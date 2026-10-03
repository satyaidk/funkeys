/**
 * @fileoverview DOM helpers shared by the keyboard hooks.
 */

/** Input types that don't accept text — letter keys should still play notes */
const NON_TEXT_INPUT_TYPES = new Set([
  'range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image',
]);

/**
 * Whether a keyboard event target is somewhere the user is typing text.
 *
 * Piano shortcuts are suppressed only for text entry. Non-text controls such
 * as the volume slider stay usable, so focusing them doesn't silence the
 * keyboard.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }
  if (target instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(target.type);
  }
  return false;
}
