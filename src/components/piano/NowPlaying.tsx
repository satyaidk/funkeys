/**
 * @fileoverview "Now playing" readout — one colored chip per sounding note.
 *
 * Held notes show a solid chip; notes still ringing from the sustain pedal
 * show a dimmer one. The row has a fixed height so the keyboard below it
 * doesn't jump when notes start and stop.
 */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Note } from '@/types';
import { getNoteColor } from '@/lib/notes';

interface NowPlayingProps {
  /** All notes on the keyboard, in low → high order */
  notes: Note[];
  /** Notes whose key is currently held */
  activeNoteIds: Set<string>;
  /** Notes released while sustain is on, still ringing */
  sustainedNoteIds: Set<string>;
}

export default function NowPlaying({ notes, activeNoteIds, sustainedNoteIds }: NowPlayingProps) {
  const soundingNotes = notes.filter(
    (n) => activeNoteIds.has(n.id) || sustainedNoteIds.has(n.id)
  );

  return (
    <div
      className="flex h-8 flex-wrap items-center justify-center gap-1.5"
      aria-live="polite"
      aria-label="Now playing"
    >
      {soundingNotes.length === 0 && (
        <span className="text-sm text-gray-500">Play a note…</span>
      )}

      <AnimatePresence initial={false}>
        {soundingNotes.map((note) => {
          const color = getNoteColor(note.name);
          const held = activeNoteIds.has(note.id);
          return (
            <motion.span
              key={note.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: held ? 1 : 0.7, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold"
              style={{
                color,
                borderColor: `${color}66`,
                backgroundColor: `${color}${held ? '26' : '12'}`,
              }}
            >
              {note.id}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
