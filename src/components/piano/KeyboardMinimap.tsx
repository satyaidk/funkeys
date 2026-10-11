/**
 * @fileoverview A miniature of the whole keyboard, for finding your way on
 * narrow screens.
 *
 * On a phone only about an octave of keys fits at a playable size. The
 * keys themselves don't scroll when swiped (a swipe on the keys is a
 * glissando), so this strip is how you move along the keyboard:
 *
 * ```
 *  ‹  ▕▏▕█▏▕█▏▕▏▕█▏[▕█▏▕█▏▕▏▕▏]▕█▏▕▏ …  ›
 *                   └ the part you can see ┘
 * ```
 *
 * - **Drag or tap** the strip to move the view there
 * - **‹ ›** step one octave at a time
 * - Keys light up in the strip too, so you can see notes sounding off-screen
 *
 * Exposed as a `slider` ("Keyboard position") with arrow-key support.
 */

'use client';

import { useMemo } from 'react';
import { Note } from '@/types';
import { getNoteColor } from '@/lib/music/notes';
import PadButton from '../ui/PadButton';

export interface KeyboardView {
  /** Left edge of the visible part, as a fraction of the keyboard's width (0–1) */
  start: number;
  /** Right edge (0–1) */
  end: number;
}

interface KeyboardMinimapProps {
  notes: Note[];
  view: KeyboardView;
  litNoteIds: ReadonlySet<string>;
  /** Move the view so its center is at this fraction of the keyboard (0–1) */
  onScrollTo: (center: number) => void;
  /** Move the view one octave left or right */
  onStep: (direction: -1 | 1) => void;
  className?: string;
}

/** Height of the drawing in SVG units; each white key is 1 unit wide */
const HEIGHT = 5;

export default function KeyboardMinimap({ notes, view, litNoteIds, onScrollTo, onStep, className = '' }: KeyboardMinimapProps) {
  const { whites, blacks } = useMemo(() => {
    const whites: Note[] = [];
    const blacks: Array<{ note: Note; x: number }> = [];
    notes.forEach((note) => {
      if (note.isBlack) blacks.push({ note, x: whites.length });
      else whites.push(note);
    });
    return { whites, blacks };
  }, [notes]);

  const count = whites.length;
  const first = whites[Math.min(count - 1, Math.max(0, Math.round(view.start * count)))];
  const last = whites[Math.min(count - 1, Math.max(0, Math.round(view.end * count) - 1))];
  const center = (view.start + view.end) / 2;

  /** Fraction of the strip under the pointer */
  const fractionAt = (e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return rect.width > 0 ? Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) : center;
  };

  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      <PadButton
        aria-label="Show lower keys"
        disabled={view.start <= 0.001}
        onClick={() => onStep(-1)}
        className="flex h-9 w-9 shrink-0 items-center justify-center text-lg leading-none text-ink"
      >
        ‹
      </PadButton>

      <div
        role="slider"
        tabIndex={0}
        aria-label="Keyboard position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(center * 100)}
        aria-valuetext={`Showing ${first.id} to ${last.id}`}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault(); // keep ← → from also shifting the octave
          onStep(e.key === 'ArrowLeft' ? -1 : 1);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* not supported: dragging still works while over the strip */
          }
          onScrollTo(fractionAt(e));
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) onScrollTo(fractionAt(e));
        }}
        className="relative h-9 min-w-0 flex-1 cursor-pointer touch-none select-none rounded-md bg-[#0c0a0e] p-1 shadow-[inset_0_1px_3px_rgb(0_0_0/0.8)]"
      >
        <svg
          viewBox={`0 0 ${count} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          aria-hidden="true"
        >
          {whites.map((note, i) => (
            <rect
              key={note.code}
              x={i + 0.04}
              y={0}
              width={0.92}
              height={HEIGHT}
              rx={0.12}
              fill={litNoteIds.has(note.id) ? getNoteColor(note.name) : '#e9e3d6'}
            />
          ))}
          {blacks.map(({ note, x }) => (
            <rect
              key={note.code}
              x={x - 0.3}
              y={0}
              width={0.6}
              height={HEIGHT * 0.6}
              rx={0.08}
              fill={litNoteIds.has(note.id) ? getNoteColor(note.name) : '#1c1820'}
            />
          ))}
          {/* The visible window */}
          <rect
            x={view.start * count}
            y={0.1}
            width={Math.max(0.5, (view.end - view.start) * count)}
            height={HEIGHT - 0.2}
            fill="rgb(255 181 71 / 0.16)"
            stroke="var(--led)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            rx={0.2}
          />
        </svg>
      </div>

      <PadButton
        aria-label="Show higher keys"
        disabled={view.end >= 0.999}
        onClick={() => onStep(1)}
        className="flex h-9 w-9 shrink-0 items-center justify-center text-lg leading-none text-ink"
      >
        ›
      </PadButton>
    </div>
  );
}
