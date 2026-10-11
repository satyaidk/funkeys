/**
 * @fileoverview A row of filter chips where exactly one is selected.
 *
 * Same keyboard model as SegmentedControl (one Tab stop, arrow keys move
 * the selection). On narrow screens the row scrolls sideways instead of
 * wrapping onto several lines, the usual pattern for filters on phones.
 */

'use client';

import { useRef } from 'react';
import { preventMouseFocus } from './PadButton';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipGroupProps<T extends string> {
  label: string;
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export default function ChipGroup<T extends string>({ label, options, value, onChange, className = '' }: ChipGroupProps<T>) {
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
    buttonsRef.current[next]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={`scroll-rail -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 md:flex-wrap md:overflow-visible ${className}`}
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
            onMouseDown={preventMouseFocus}
            onClick={() => onChange(option.value)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors ${
              checked
                ? 'border-[rgb(255_181_71/0.45)] bg-[rgb(255_181_71/0.14)] text-ink'
                : 'border-white/[0.08] bg-white/[0.03] text-ink-muted hover:border-white/20 hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
