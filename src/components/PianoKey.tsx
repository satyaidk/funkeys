/**
 * @fileoverview Individual piano key component with press animations.
 *
 * Each key renders differently based on whether it's white or black:
 *
 * **White keys**: up to 60px wide, 200px tall, light gradient background.
 * When active, they glow with the note's rainbow color.
 *
 * **Black keys**: 60% of a white key's width, 65% of its height, dark
 * gradient background. Positioned absolutely between white keys (handled
 * by parent Piano). When active, they illuminate with the note's color.
 *
 * Sizes come from CSS variables set by the parent Piano so the keyboard
 * can shrink to fit narrow screens (constants are the fallbacks).
 *
 * ## Animation Details
 * - Press: Key moves down 3-4px (translateY) + subtle scale reduction
 * - Spring physics: stiffness=500, damping=30 for snappy feel
 * - Glow: CSS box-shadow with note color creates the light effect
 * - Bottom indicator: Colored bar appears at the bottom of white keys
 * - Sustained: a softer glow while a released note rings via the pedal
 *
 * ## Accessibility
 * - Each key has an aria-label with note name and octave
 * - Keys are buttons, but skipped in the tab order — the mapped computer
 *   keys already play every note without needing focus
 * - Pointer events handle both mouse and touch input
 *
 * ## Performance
 * - Wrapped in React.memo to prevent unnecessary re-renders
 * - Only re-renders when isActive, isSustained or note props change
 */

'use client';

import { memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PianoKeyProps } from '@/types';
import { getNoteColor } from '@/lib/notes';
import {
  WHITE_KEY_WIDTH,
  WHITE_KEY_HEIGHT,
  BLACK_KEY_WIDTH_RATIO,
  BLACK_KEY_HEIGHT_RATIO,
} from '@/lib/constants';

const WHITE_WIDTH = `var(--white-key-width, ${WHITE_KEY_WIDTH}px)`;
const WHITE_HEIGHT = `var(--white-key-height, ${WHITE_KEY_HEIGHT}px)`;
const BLACK_WIDTH = `var(--black-key-width, ${WHITE_KEY_WIDTH * BLACK_KEY_WIDTH_RATIO}px)`;
const BLACK_HEIGHT = `var(--black-key-height, ${WHITE_KEY_HEIGHT * BLACK_KEY_HEIGHT_RATIO}px)`;

const PianoKey = memo(function PianoKey({
  note,
  isActive,
  isSustained = false,
  onNoteStart,
  onNoteStop,
}: PianoKeyProps) {
  const color = getNoteColor(note.name);
  /** Key is up but the note is still ringing from the sustain pedal */
  const isRinging = isSustained && !isActive;

  /**
   * Whether *this pointer* pressed the key. Without it, merely hovering
   * across a key that's held via the computer keyboard would stop the
   * note on pointerleave.
   */
  const pointerDownRef = useRef(false);

  // ── Pointer Event Handlers ──────────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent) => {
    // Primary button only — right-click opens a context menu that swallows pointerup
    if (e.button !== 0) return;
    e.preventDefault();
    pointerDownRef.current = true;
    onNoteStart(note.id);
  };

  const handlePointerRelease = () => {
    if (!pointerDownRef.current) return;
    pointerDownRef.current = false;
    onNoteStop(note.id);
  };

  const pointerHandlers = {
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerRelease,
    onPointerLeave: handlePointerRelease,
    onPointerCancel: handlePointerRelease,
    // Long-press on touch screens would otherwise open a context menu
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  // ── Black Key Rendering ─────────────────────────────────────────────

  if (note.isBlack) {
    return (
      <motion.button
        type="button"
        tabIndex={-1}
        className="absolute z-10 rounded-b-md cursor-pointer select-none touch-none focus:outline-none"
        style={{
          width: BLACK_WIDTH,
          height: BLACK_HEIGHT,
          marginLeft: `calc(${BLACK_WIDTH} / -2)`,
          background: isActive
            ? `linear-gradient(180deg, ${color}dd, ${color}88)`
            : isRinging
              ? `linear-gradient(180deg, #1a1a2e, ${color}55)`
              : 'linear-gradient(180deg, #1a1a2e, #16213e)',
          boxShadow: isActive
            ? `0 0 20px ${color}88, 0 0 40px ${color}44, inset 0 -2px 4px rgba(0,0,0,0.3)`
            : isRinging
              ? `0 0 14px ${color}55, inset 0 -2px 4px rgba(0,0,0,0.3)`
              : '0 4px 6px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.3)',
          border: `1px solid ${isActive || isRinging ? color + '88' : '#333'}`,
        }}
        animate={{
          y: isActive ? 3 : 0,
          scale: isActive ? 0.98 : 1,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        {...pointerHandlers}
        aria-label={`${note.name}${note.octave}`}
        aria-pressed={isActive}
      >
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-mono text-gray-400 opacity-70">
          {note.keyLabel}
        </span>
      </motion.button>
    );
  }

  // ── White Key Rendering ─────────────────────────────────────────────

  return (
    <motion.button
      type="button"
      tabIndex={-1}
      className="relative shrink-0 rounded-b-lg cursor-pointer select-none touch-none focus:outline-none flex flex-col items-center justify-end pb-3"
      style={{
        width: WHITE_WIDTH,
        height: WHITE_HEIGHT,
        background: isActive
          ? `linear-gradient(180deg, ${color}33, ${color}11)`
          : isRinging
            ? `linear-gradient(180deg, #ffffff, ${color}22)`
            : 'linear-gradient(180deg, #ffffff, #e8e8e8)',
        boxShadow: isActive
          ? `0 0 25px ${color}66, 0 0 50px ${color}22, inset 0 -3px 6px rgba(0,0,0,0.1)`
          : isRinging
            ? `0 0 16px ${color}44, inset 0 -3px 6px rgba(0,0,0,0.08)`
            : '0 4px 8px rgba(0,0,0,0.2), inset 0 -3px 6px rgba(0,0,0,0.08)',
        border: `1px solid ${isActive || isRinging ? color + '66' : '#d0d0d0'}`,
      }}
      animate={{
        y: isActive ? 4 : 0,
        scale: isActive ? 0.98 : 1,
      }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      {...pointerHandlers}
      aria-label={`${note.name}${note.octave}`}
      aria-pressed={isActive}
    >
      {/* Note name label */}
      <span
        className="text-xs font-semibold mb-1 transition-colors duration-150"
        style={{ color: isActive || isRinging ? color : '#999' }}
      >
        {note.name}{note.octave}
      </span>

      {/* Keyboard shortcut badge */}
      <span
        className="text-[11px] font-mono px-1.5 py-0.5 rounded transition-all duration-150"
        style={{
          backgroundColor: isActive ? color + '22' : '#f0f0f0',
          color: isActive ? color : '#aaa',
          border: `1px solid ${isActive ? color + '44' : '#ddd'}`,
        }}
      >
        {note.keyLabel}
      </span>

      {/* Glow bar at bottom: solid while held, dimmer while sustained */}
      <AnimatePresence>
        {(isActive || isRinging) && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-1 rounded-b-lg"
            style={{ backgroundColor: color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: isActive ? 1 : 0.5 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
});

export default PianoKey;
