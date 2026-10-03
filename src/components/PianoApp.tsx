/**
 * @fileoverview Client-side piano application.
 *
 * Owns the piano state via `usePiano()` and wires it to the controls,
 * the "now playing" readout and the keyboard. Kept separate from the page
 * so the page itself can stay a Server Component.
 */

'use client';

import { motion } from 'framer-motion';
import { usePiano } from '@/hooks/usePiano';
import ControlPanel from './controls/ControlPanel';
import NowPlaying from './piano/NowPlaying';
import Piano from './piano/Piano';

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

      <NowPlaying
        notes={notes}
        activeNoteIds={activeNoteIds}
        sustainedNoteIds={sustainedNoteIds}
      />

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
