/**
 * @fileoverview A value with − and + buttons (transpose, tuning, split point, tempo).
 *
 * Holding a button down repeats the step, accelerating like the up/down
 * buttons on hardware: master tuning has 500 steps of 0.1 Hz, and nobody
 * wants to click 500 times.
 */

'use client';

import { useEffect, useRef } from 'react';
import PadButton from './PadButton';

interface StepperProps {
  /** Accessible name of the group */
  label: string;
  /** The value as shown, e.g. "+2" or "440.0 Hz" */
  valueText: string;
  onDecrement: () => void;
  onIncrement: () => void;
  canDecrement?: boolean;
  canIncrement?: boolean;
  decrementLabel: string;
  incrementLabel: string;
  /** Extra classes for the value readout */
  valueClassName?: string;
  /** Disable the whole control */
  disabled?: boolean;
}

const REPEAT_DELAY_MS = 380;
const REPEAT_INTERVAL_MS = 55;

function StepButton({
  label,
  onStep,
  disabled,
  children,
}: {
  label: string;
  onStep: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onStepRef = useRef(onStep);
  useEffect(() => {
    onStepRef.current = onStep;
  }, [onStep]);

  const stopRepeat = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const repeat = () => {
    onStepRef.current();
    timerRef.current = setTimeout(repeat, REPEAT_INTERVAL_MS);
  };

  useEffect(() => stopRepeat, []);
  // A button that becomes disabled mid-hold (limit reached) must stop repeating
  useEffect(() => {
    if (disabled) stopRepeat();
  }, [disabled]);

  return (
    <PadButton
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        onStep();
        timerRef.current = setTimeout(repeat, REPEAT_DELAY_MS);
      }}
      onPointerUp={stopRepeat}
      onPointerLeave={stopRepeat}
      onPointerCancel={stopRepeat}
      // Pointer presses are handled above; this catches keyboard activation (detail 0)
      onClick={(e) => {
        if (e.detail === 0) onStep();
      }}
      className="flex h-9 w-9 shrink-0 items-center justify-center text-lg leading-none text-ink"
    >
      {children}
    </PadButton>
  );
}

export default function Stepper({
  label,
  valueText,
  onDecrement,
  onIncrement,
  canDecrement = true,
  canIncrement = true,
  decrementLabel,
  incrementLabel,
  valueClassName = '',
  disabled = false,
}: StepperProps) {
  return (
    <div
      role="group"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={`flex items-center gap-2 ${disabled ? 'opacity-40' : ''}`}
    >
      <StepButton label={decrementLabel} onStep={onDecrement} disabled={disabled || !canDecrement}>
        −
      </StepButton>
      <output
        aria-live="polite"
        className={`min-w-[5.5rem] rounded-md bg-panel-sunk px-3 py-1.5 text-center tabular-nums text-ink shadow-[inset_0_1px_3px_rgb(0_0_0/0.6)] ${valueClassName}`}
      >
        {valueText}
      </output>
      <StepButton label={incrementLabel} onStep={onIncrement} disabled={disabled || !canIncrement}>
        +
      </StepButton>
    </div>
  );
}
