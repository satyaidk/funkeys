/**
 * @fileoverview Piano controls: master volume, octave shift and sustain.
 *
 * Every control mirrors a keyboard shortcut handled in usePiano:
 * - Z / X → octave down / up
 * - Space → toggle sustain
 *
 * Buttons don't take focus on mouse click. Otherwise, after clicking
 * "Octave +", pressing Space would re-activate that button instead of
 * toggling sustain. Keyboard (Tab) focus still works normally.
 */

'use client';

import { motion } from 'framer-motion';
import { ControlPanelProps } from '@/types';
import { BASE_OCTAVE, MIN_OCTAVE_SHIFT, MAX_OCTAVE_SHIFT } from '@/lib/constants';

/** Keep focus where it was when a control is clicked with the mouse */
const preventMouseFocus = (e: React.MouseEvent) => e.preventDefault();

const PANEL_CLASS =
  'flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm';
const LABEL_CLASS = 'text-[11px] font-semibold uppercase tracking-widest text-gray-400';
const KBD_CLASS =
  'rounded border border-white/15 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-gray-300';
const STEP_BUTTON_CLASS =
  'flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-lg leading-none text-gray-100 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white/10';

export default function ControlPanel({
  volume,
  octaveShift,
  sustain,
  onVolumeChange,
  onOctaveChange,
  onSustainToggle,
}: ControlPanelProps) {
  const volumePercent = Math.round(volume * 100);
  const startOctave = BASE_OCTAVE + octaveShift;
  const shiftLabel = octaveShift > 0 ? `+${octaveShift}` : `${octaveShift}`;

  return (
    <section
      aria-label="Piano controls"
      className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3"
    >
      {/* ── Volume (full width on phones) ───────────────────────────── */}
      <div className={`${PANEL_CLASS} col-span-2 sm:col-span-1`}>
        <div className="flex items-center justify-between">
          <label htmlFor="volume" className={LABEL_CLASS}>
            Volume
          </label>
          <span className="font-mono text-xs text-gray-300">{volumePercent}%</span>
        </div>
        <input
          id="volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          aria-valuetext={`${volumePercent}%`}
          className="h-8 w-full cursor-pointer accent-pink-400"
        />
      </div>

      {/* ── Octave ─────────────────────────────────────────────────── */}
      <div className={PANEL_CLASS}>
        <div className="flex items-center justify-between">
          <span id="octave-label" className={LABEL_CLASS}>
            Octave
          </span>
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <kbd className={KBD_CLASS}>Z</kbd>
            <kbd className={KBD_CLASS}>X</kbd>
          </span>
        </div>
        <div className="flex items-center justify-between gap-2" role="group" aria-labelledby="octave-label">
          <button
            type="button"
            className={STEP_BUTTON_CLASS}
            onMouseDown={preventMouseFocus}
            onClick={() => onOctaveChange(octaveShift - 1)}
            disabled={octaveShift <= MIN_OCTAVE_SHIFT}
            aria-label="Octave down"
            aria-keyshortcuts="Z"
          >
            −
          </button>
          <output className="flex flex-col items-center leading-tight" aria-live="polite">
            <span className="font-mono text-base font-semibold text-gray-100">{shiftLabel}</span>
            <span className="whitespace-nowrap text-[10px] text-gray-400">starts at C{startOctave}</span>
          </output>
          <button
            type="button"
            className={STEP_BUTTON_CLASS}
            onMouseDown={preventMouseFocus}
            onClick={() => onOctaveChange(octaveShift + 1)}
            disabled={octaveShift >= MAX_OCTAVE_SHIFT}
            aria-label="Octave up"
            aria-keyshortcuts="X"
          >
            +
          </button>
        </div>
      </div>

      {/* ── Sustain ────────────────────────────────────────────────── */}
      <div className={PANEL_CLASS}>
        <div className="flex items-center justify-between">
          <span className={LABEL_CLASS}>Sustain</span>
          <kbd className={KBD_CLASS}>Space</kbd>
        </div>
        <button
          type="button"
          onMouseDown={preventMouseFocus}
          onClick={onSustainToggle}
          aria-pressed={sustain}
          aria-keyshortcuts="Space"
          className={`flex h-8 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-400 ${
            sustain
              ? 'border-pink-400/50 bg-pink-500/20 text-pink-200'
              : 'border-white/10 bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          <motion.span
            className="h-2 w-2 rounded-full"
            animate={{
              backgroundColor: sustain ? '#f472b6' : '#4b5563',
              boxShadow: sustain ? '0 0 8px #f472b6' : '0 0 0px rgba(0,0,0,0)',
            }}
            transition={{ duration: 0.2 }}
          />
          {sustain ? 'On' : 'Off'}
        </button>
      </div>
    </section>
  );
}
