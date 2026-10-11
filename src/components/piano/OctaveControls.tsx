/**
 * @fileoverview Octave down / up buttons with the keyboard's current range.
 *
 * The computer keyboard has ← and → for this; these buttons give touch
 * users the same control, right next to the keys.
 */

'use client';

import { keyboardRangeLabel } from '@/lib/music/keyboard-map';
import PadButton from '../ui/PadButton';

export interface OctaveControlsProps {
  /** Current octave shift */
  shift: number;
  min: number;
  max: number;
  onChange: (shift: number) => void;
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default function OctaveControls({ shift, min, max, onChange }: OctaveControlsProps) {
  return (
    <div role="group" aria-label="Octave" className="flex shrink-0 items-center gap-1.5">
      <PadButton
        aria-label="Octave down"
        disabled={shift <= min}
        onClick={() => onChange(shift - 1)}
        className="flex h-9 w-8 items-center justify-center text-lg leading-none text-ink min-[360px]:w-9"
      >
        −
      </PadButton>
      <output
        aria-live="polite"
        aria-label="Keyboard range"
        className="flex h-9 min-w-[4.75rem] flex-col items-center justify-center rounded-md bg-panel-sunk px-1.5 leading-none shadow-[inset_0_1px_3px_rgb(0_0_0/0.6)] min-[360px]:min-w-[5.75rem] min-[360px]:px-2"
      >
        <span className="text-[13px] tabular-nums text-ink">{keyboardRangeLabel(shift)}</span>
        <span className="mt-0.5 text-[10px] text-ink-faint">Octave {signed(shift)}</span>
      </output>
      <PadButton
        aria-label="Octave up"
        disabled={shift >= max}
        onClick={() => onChange(shift + 1)}
        className="flex h-9 w-8 items-center justify-center text-lg leading-none text-ink min-[360px]:w-9"
      >
        +
      </PadButton>
    </div>
  );
}
