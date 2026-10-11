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

/**
 * Whether a keyboard event target uses the arrow keys itself: range
 * sliders (tempo, seek bar) and widgets with a slider or spin-button role.
 *
 * Native range inputs move on arrow keys without calling preventDefault(),
 * so the piano's arrow shortcuts (octave, transpose) must check for them.
 */
export function isAdjustableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement && target.type === 'range') return true;
  const role = target.getAttribute('role');
  return role === 'slider' || role === 'spinbutton';
}
