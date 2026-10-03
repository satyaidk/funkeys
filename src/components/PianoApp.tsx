/**
 * @fileoverview Client-side piano application.
 *
 * Owns the piano state via `usePiano()` and wires it to the controls,
 * the keyboard and a "now playing" readout. Kept separate from the page
 * so the page itself can stay a Server Component.
 */

'use client';

import { motion } from 'framer-motion';
import { usePiano } from '@/hooks/usePiano';
import { getNoteColor } from '@/lib/notes';
import ControlPanel from './ControlPanel';
import Piano from './Piano';

export default function PianoApp() {
  const {
    notes,
    activeNoteIds,
    sustainedNoteIds,
    config,
    onNoteStart,
    onNoteStop,
    onVolumeChange,
    onOctaveChange,
    onSustainToggle,
  } = usePiano();

  /** Sounding notes in keyboard order (low → high) */
  const soundingNotes = notes.filter(
    (n) => activeNoteIds.has(n.id) || sustainedNoteIds.has(n.id)
  );

  return (
    <motion.main
      className="flex w-full flex-1 flex-col items-center gap-6 px-4 pb-10 pt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
    >
      <ControlPanel
        volume={config.volume}
        octaveShift={config.octaveShift}
        sustain={config.sustain}
        onVolumeChange={onVolumeChange}
        onOctaveChange={onOctaveChange}
        onSustainToggle={onSustainToggle}
      />

      {/* Now playing — fixed height so the keyboard doesn't jump */}
      <div
        className="flex h-8 flex-wrap items-center justify-center gap-1.5"
        aria-live="polite"
        aria-label="Now playing"
      >
        {soundingNotes.length === 0 ? (
          <span className="text-sm text-gray-500">Play a note…</span>
        ) : (
          soundingNotes.map((note) => {
            const color = getNoteColor(note.name);
            const held = activeNoteIds.has(note.id);
            return (
              <span
                key={note.id}
                className="rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold"
                style={{
                  color,
                  borderColor: `${color}66`,
                  backgroundColor: `${color}${held ? '26' : '12'}`,
                  opacity: held ? 1 : 0.7,
                }}
              >
                {note.id}
              </span>
            );
          })
        )}
      </div>

      <Piano
        notes={notes}
        activeNoteIds={activeNoteIds}
        sustainedNoteIds={sustainedNoteIds}
        onNoteStart={onNoteStart}
        onNoteStop={onNoteStop}
      />

      <p className="max-w-xl text-center text-xs leading-relaxed text-gray-500">
        Use the <span className="text-gray-300">A–;</span> row for white keys and{' '}
        <span className="text-gray-300">W E T Y U O P</span> for black keys. You can also
        click or tap the keys.
      </p>
    </motion.main>
  );
}
