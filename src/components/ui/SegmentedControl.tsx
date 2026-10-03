/**
 * @fileoverview Pick one of a few options: a row of linked buttons.
 *
 * Built as an accessible radio group: one Tab stop for the whole group,
 * arrow keys move the selection (the "roving tabindex" pattern), and the
 * highlight slides between options with a shared layout animation.
 */

'use client';

import { useId, useRef } from 'react';
import { motion } from 'framer-motion';
import Led from './Led';
import { preventMouseFocus } from './PadButton';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group */
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}

export default function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className = '',
}: SegmentedControlProps<T>) {
  const id = useId();
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const index = options.findIndex((o) => o.value === value);
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: options.length - 1,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = (moves[e.key] + options.length) % options.length;
    onChange(options[next].value);
    buttonsRef.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onKeyDown={handleKeyDown}
      className={`flex rounded-lg bg-panel-sunk p-1 shadow-[inset_0_1px_3px_rgb(0_0_0/0.65)] ${
        disabled ? 'pointer-events-none opacity-40' : ''
      } ${className}`}
    >
      {options.map((option, i) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonsRef.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onMouseDown={preventMouseFocus}
            onClick={() => onChange(option.value)}
            className={`relative flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
              checked ? 'text-ink' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {checked && (
              <motion.span
                layoutId={`${id}-thumb`}
                className="absolute inset-0 rounded-md bg-linear-to-b from-[#3e3529] to-[#2f2a22] shadow-[inset_0_1px_0_rgb(255_215_160/0.1),0_1px_2px_rgb(0_0_0/0.5)]"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              />
            )}
            <span className="relative flex items-center justify-center gap-2">
              <Led on={checked} />
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
