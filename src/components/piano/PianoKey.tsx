/**
 * @fileoverview One piano key: ivory or ebony, lit in its note's color.
 *
 * **States**
 * - Idle: ivory (white keys) or ebony (black keys)
 * - Held (`isActive`): pressed down, lit in the note's rainbow color
 * - Ringing (`isSustained`, key up): a softer glow while a pedal holds the note
 *
 * **Input**
 * Pointer events cover mouse, touch and pen. Where you press sets the
 * velocity: nearer the front edge plays louder. `touch-action: pan-x`
 * lets phones scroll the keyboard sideways; a sideways swipe cancels the
 * press (pointercancel) instead of leaving a stuck note.
 *
 * **Accessibility**
 * Each key is a button labelled with its note ("C#4") and `aria-pressed`.
 * Keys are skipped in the Tab order: the computer keyboard already plays
 * every note without needing focus.
 *
 * **Performance**
 * Wrapped in React.memo: pressing one key re-renders only that key.
 */

'use client';

import { memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Note } from '@/types';
import { getNoteColor } from '@/lib/music/notes';
import { velocityFromPosition } from '@/lib/audio/dynamics';
import {
  WHITE_KEY_WIDTH,
  WHITE_KEY_HEIGHT,
  BLACK_KEY_WIDTH_RATIO,
  BLACK_KEY_HEIGHT_RATIO,
} from '@/lib/constants';

export interface PianoKeyProps {
  note: Note;
  /** Character printed on the key (the user's own layout when known) */
  label: string;
  /** Position on the keyboard, used to stagger the power-on sweep */
  index: number;
  isActive: boolean;
  isSustained?: boolean;
  onNoteOn: (noteId: string, velocity: number) => void;
  onNoteOff: (noteId: string) => void;
}

const WHITE_WIDTH = `var(--white-key-width, ${WHITE_KEY_WIDTH}px)`;
const WHITE_HEIGHT = `var(--white-key-height, ${WHITE_KEY_HEIGHT}px)`;
const BLACK_WIDTH = `var(--black-key-width, ${WHITE_KEY_WIDTH * BLACK_KEY_WIDTH_RATIO}px)`;
const BLACK_HEIGHT = `var(--black-key-height, ${WHITE_KEY_HEIGHT * BLACK_KEY_HEIGHT_RATIO}px)`;

const PRESS_SPRING = { type: 'spring', stiffness: 600, damping: 32 } as const;

const PianoKey = memo(function PianoKey({
  note,
  label,
  index,
  isActive,
  isSustained = false,
  onNoteOn,
  onNoteOff,
}: PianoKeyProps) {
  const color = getNoteColor(note.name);
  const isRinging = isSustained && !isActive;
  const lit = isActive || isRinging;

  /** Did *this pointer* press the key? Hovering past a key held on the keyboard mustn't stop it. */
  const pointerDownRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return; // right-click opens a menu that swallows pointerup
    e.preventDefault(); // no focus, no text selection
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.75;
    pointerDownRef.current = true;
    onNoteOn(note.id, velocityFromPosition(fraction));
  };

  const handlePointerRelease = () => {
    if (!pointerDownRef.current) return;
    pointerDownRef.current = false;
    onNoteOff(note.id);
  };

  const pointerHandlers = {
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerRelease,
    onPointerLeave: handlePointerRelease,
    onPointerCancel: handlePointerRelease,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(), // long-press menu on phones
  };

  /** Single power-on sweep, staggered left to right (CSS; disabled for reduced motion) */
  const chase = (
    <span
      aria-hidden="true"
      className="key-chase pointer-events-none absolute inset-0 rounded-b-[inherit]"
      style={{
        background: `linear-gradient(180deg, transparent 20%, ${color}bb)`,
        animationDelay: `${300 + index * 24}ms`,
      }}
    />
  );

  // ── Black key ───────────────────────────────────────────────────────
  if (note.isBlack) {
    return (
      <motion.button
        type="button"
        tabIndex={-1}
        aria-label={note.id}
        aria-pressed={isActive}
        className="absolute z-10 cursor-pointer select-none overflow-hidden rounded-b-[5px] touch-pan-x focus:outline-none"
        style={{
          width: BLACK_WIDTH,
          height: BLACK_HEIGHT,
          marginLeft: `calc(${BLACK_WIDTH} / -2)`,
          background: isActive
            ? `linear-gradient(180deg, ${color} 0%, ${color}cc 70%, ${color}88 100%)`
            : isRinging
              ? `linear-gradient(180deg, #2b2730 0%, ${color}66 100%)`
              : 'linear-gradient(180deg, #2c2831 0%, #18151c 62%, #0e0c11 100%)',
          boxShadow: isActive
            ? `0 0 22px ${color}aa, 0 0 44px ${color}44, inset 0 -3px 0 rgb(0 0 0 / 0.25)`
            : isRinging
              ? `0 0 14px ${color}55, inset 0 -5px 0 rgb(0 0 0 / 0.45)`
              : '0 4px 6px rgb(0 0 0 / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.12), inset 0 -6px 0 rgb(0 0 0 / 0.5)',
        }}
        animate={{ y: isActive ? 3 : 0, scaleY: isActive ? 0.985 : 1 }}
        transition={PRESS_SPRING}
        {...pointerHandlers}
      >
        {chase}
        <span
          className={`absolute bottom-2.5 left-1/2 -translate-x-1/2 text-[10px] font-medium ${
            isActive ? 'text-white' : 'text-ink-faint'
          }`}
        >
          {label}
        </span>
      </motion.button>
    );
  }

  // ── White key ───────────────────────────────────────────────────────
  const showName = note.name === 'C' || lit;

  return (
    <motion.button
      type="button"
      tabIndex={-1}
      aria-label={note.id}
      aria-pressed={isActive}
      className="relative flex shrink-0 cursor-pointer select-none flex-col items-center justify-end overflow-hidden rounded-b-[6px] pb-3 touch-pan-x focus:outline-none"
      style={{
        width: WHITE_WIDTH,
        height: WHITE_HEIGHT,
        background: isActive
          ? `linear-gradient(180deg, #fbf8f1 0%, ${color}55 55%, ${color}99 100%)`
          : isRinging
            ? `linear-gradient(180deg, #fbf8f1 0%, ${color}22 65%, ${color}44 100%)`
            : 'linear-gradient(180deg, #fbf8f1 0%, #f2ede2 72%, #e6dfcf 100%)',
        borderLeft: '1px solid rgb(0 0 0 / 0.18)',
        borderRight: '1px solid rgb(255 255 255 / 0.5)',
        boxShadow: isActive
          ? `0 0 26px ${color}88, inset 0 -3px 0 ${color}`
          : isRinging
            ? `0 0 16px ${color}44, inset 0 -6px 0 ${color}88`
            : 'inset 0 -7px 0 #d6cebb, 0 3px 4px rgb(0 0 0 / 0.35)',
      }}
      animate={{ y: isActive ? 4 : 0 }}
      transition={PRESS_SPRING}
      {...pointerHandlers}
    >
      {chase}

      <AnimatePresence>
        {showName && (
          <motion.span
            key="name"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="relative mb-1.5 text-[11px] font-semibold"
            style={{ color: lit ? color : '#9a9183' }}
          >
            {note.id}
          </motion.span>
        )}
      </AnimatePresence>

      <span
        className="relative flex h-5 min-w-5 items-center justify-center rounded-[4px] px-1 text-[11px] font-medium transition-colors duration-150"
        style={{
          backgroundColor: isActive ? `${color}33` : 'rgb(0 0 0 / 0.05)',
          color: isActive ? color : '#8d8577',
          boxShadow: `inset 0 0 0 1px ${isActive ? `${color}66` : 'rgb(0 0 0 / 0.1)'}`,
        }}
      >
        {label}
      </span>
    </motion.button>
  );
});

export default PianoKey;
