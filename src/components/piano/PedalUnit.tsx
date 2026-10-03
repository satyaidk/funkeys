/**
 * @fileoverview The three brass pedals of a grand piano, left to right.
 *
 * - **Soft (una corda)**: quieter, darker tone for new notes
 * - **Sostenuto**: keeps ringing only the notes held when it was pressed
 * - **Sustain (damper)**: keeps every released note ringing
 *
 * Clicking a pedal latches it (a mouse can't hold a pedal and play keys at
 * the same time); the keyboard shortcuts hold it only while pressed. Either
 * way, the pedal moves down so you can see its state.
 */

'use client';

import { motion } from 'framer-motion';
import { PedalName, PedalState } from '@/types';
import { preventMouseFocus } from '../ui/PadButton';

interface PedalUnitProps {
  pedals: PedalState;
  onToggle: (pedal: PedalName) => void;
}

const PEDALS: ReadonlyArray<{ id: PedalName; name: string; shortcut: string | null; description: string }> = [
  { id: 'soft', name: 'Soft', shortcut: 'Shift', description: 'Quieter, darker tone' },
  { id: 'sostenuto', name: 'Sostenuto', shortcut: null, description: 'Holds the notes you are holding' },
  { id: 'sustain', name: 'Sustain', shortcut: 'Space', description: 'Notes ring after you let go' },
];

export default function PedalUnit({ pedals, onToggle }: PedalUnitProps) {
  return (
    <div className="flex flex-col items-center">
      {/* Lyre: the wooden post that carries the pedals */}
      <div aria-hidden="true" className="h-5 w-16 bg-linear-to-b from-[#0d0b10] to-[#1a171e]" />
      <div
        role="group"
        aria-label="Pedals"
        className="flex items-start gap-5 rounded-2xl bg-linear-to-b from-[#1a171e] to-[#110f14] px-6 pb-4 pt-5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.05)] sm:gap-9 sm:px-10"
      >
        {PEDALS.map((pedal) => {
          const down = pedals[pedal.id];
          return (
            <button
              key={pedal.id}
              type="button"
              aria-pressed={down}
              aria-label={`${pedal.name} pedal`}
              title={pedal.description}
              onMouseDown={preventMouseFocus}
              onClick={() => onToggle(pedal.id)}
              className="group flex w-20 flex-col items-center gap-2.5 rounded-lg pt-1 sm:w-24"
            >
              <span className="relative flex h-[4.5rem] w-full items-start justify-center [perspective:260px]">
                {/* Shadow on the floor that tightens as the pedal goes down */}
                <motion.span
                  aria-hidden="true"
                  className="absolute bottom-0 h-2.5 w-11 rounded-full bg-black/60 blur-[4px]"
                  animate={{ scaleX: down ? 0.75 : 1, opacity: down ? 0.95 : 0.55 }}
                />
                {/* Brass tongue: narrow where it leaves the lyre, rounded at the toe */}
                <motion.span
                  aria-hidden="true"
                  className="relative block h-[3.75rem] w-9 origin-top rounded-t-[6px] rounded-b-[18px]"
                  style={{
                    background: down
                      ? 'linear-gradient(90deg, #6f5426 0%, #b18a45 50%, #6f5426 100%)'
                      : 'linear-gradient(90deg, #8a6a30 0%, var(--brass-light) 48%, var(--brass) 62%, #7c5f2b 100%)',
                    boxShadow: down
                      ? 'inset 0 3px 5px rgb(0 0 0 / 0.4), 0 0 16px rgb(255 181 71 / 0.35)'
                      : 'inset 0 1px 0 rgb(255 255 255 / 0.45), 0 3px 0 #5e4720',
                  }}
                  animate={{ y: down ? 5 : 0, rotateX: down ? 18 : 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                />
              </span>
              <span className={`text-sm transition-colors ${down ? 'text-led' : 'text-ink group-hover:text-white'}`}>
                {pedal.name}
              </span>
              {pedal.shortcut ? (
                <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-px font-sans text-[10px] text-ink-faint">
                  {pedal.shortcut}
                </kbd>
              ) : (
                <span className="py-px text-[10px] text-ink-faint">click to hold</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
