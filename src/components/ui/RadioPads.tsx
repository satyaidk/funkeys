/**
 * @fileoverview A grid of pad buttons where exactly one is selected.
 *
 * Used for voices and temperaments: each option shows an LED, a name and an
 * optional description. Same keyboard model as SegmentedControl (one Tab
 * stop, arrow keys move the selection).
 */

'use client';

import { useRef } from 'react';
import Led from './Led';
import PadButton from './PadButton';

export interface PadOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface RadioPadsProps<T extends string> {
  label: string;
  options: readonly PadOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Grid classes, e.g. "grid-cols-2 lg:grid-cols-4" */
  columns: string;
  /** Compact pads show only the name */
  compact?: boolean;
  disabled?: boolean;
}

export default function RadioPads<T extends string>({
  label,
  options,
  value,
  onChange,
  columns,
  compact = false,
  disabled = false,
}: RadioPadsProps<T>) {
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
      className={`grid gap-2 ${columns}`}
    >
      {options.map((option, i) => {
        const checked = option.value === value;
        return (
          <PadButton
            key={option.value}
            ref={(el) => {
              buttonsRef.current[i] = el;
            }}
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            active={checked}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={compact ? 'px-3 py-2 text-left' : 'px-3.5 py-3 text-left'}
          >
            <span className="flex items-center gap-2">
              <Led on={checked} />
              <span
                className={`font-medium ${compact ? 'truncate text-sm' : 'text-[0.95rem] leading-snug'} ${
                  checked ? 'text-ink' : 'text-ink/85'
                }`}
              >
                {option.label}
              </span>
            </span>
            {!compact && option.description && (
              <span className="mt-1 block pl-3.5 text-xs leading-snug text-ink-muted">{option.description}</span>
            )}
          </PadButton>
        );
      })}
    </div>
  );
}
