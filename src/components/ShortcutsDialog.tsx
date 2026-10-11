/**
 * @fileoverview Every way to play and control the piano, in one dialog.
 *
 * A native `<dialog>` opened with showModal(): it traps focus, closes on
 * Esc, and returns focus to the button that opened it. Key presses inside
 * it don't reach the piano, so typing here never plays notes.
 */

'use client';

import { useEffect, useRef } from 'react';
import { Note } from '@/types';
import KeyGuide from './KeyGuide';

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
  notes: Note[];
}

const TOUCH_TIPS = [
  ['Tap a key', 'plays it; press nearer the front edge to play louder'],
  ['Several fingers', 'play a chord'],
  ['Slide along the keys', 'plays each one (a glissando)'],
  ['− / +', 'move the keyboard down or up an octave'],
  ['The strip above the keys', 'shows the whole keyboard on small screens: drag it, or use ‹ ›, to move'],
  ['Pedals', 'tap to hold, tap again to lift'],
] as const;

export default function ShortcutsDialog({ open, onClose, notes }: ShortcutsDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  // Keep key presses inside the dialog away from the piano's window listeners
  const stop = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape') e.stopPropagation();
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onKeyDown={stop}
      onKeyUp={stop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // a click on the backdrop
      }}
      aria-labelledby="shortcuts-title"
      className="m-auto max-h-[min(90dvh,48rem)] w-[min(100%-1.5rem,60rem)] overflow-y-auto rounded-2xl border border-white/10 bg-panel p-0 text-ink shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)] backdrop:bg-black/65 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex flex-col gap-6 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="shortcuts-title" className="text-xl font-semibold">
              How to play
            </h2>
            <p className="mt-1 text-sm text-ink-muted">Computer keyboard, mouse or touch: they all work together.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-ink-muted hover:bg-white/[0.06] hover:text-ink"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <section aria-labelledby="keys-heading" className="flex flex-col gap-3">
          <h3 id="keys-heading" className="text-sm font-medium text-ink">
            Computer keyboard
          </h3>
          <KeyGuide notes={notes} />
          <p className="text-xs text-ink-faint">
            Keys are matched by position, so the layout works on AZERTY, QWERTZ and other keyboards too. Notes don’t play
            while you type in a text field.
          </p>
        </section>

        <section aria-labelledby="touch-heading" className="flex flex-col gap-3">
          <h3 id="touch-heading" className="text-sm font-medium text-ink">
            Mouse and touch
          </h3>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            {TOUCH_TIPS.map(([term, text]) => (
              <div key={term} className="contents">
                <dt className="text-ink">{term}</dt>
                <dd className="text-ink-muted">{text}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </dialog>
  );
}
