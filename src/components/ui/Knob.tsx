/**
 * @fileoverview A rotary knob, like the volume dial on a digital piano.
 *
 * - **Drag** up/down to turn it (pointer capture keeps the drag going even
 *   if the pointer leaves the knob)
 * - **Keyboard**: arrows step, Page Up/Down take big steps, Home/End jump
 * - Exposed to assistive technology as a standard `slider`
 *
 * The amber arc shows the value; the knob body rotates through 270°.
 */

'use client';

import { useRef } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Human-readable value, e.g. "70%" */
  format?: (value: number) => string;
  /** Diameter in px */
  size?: number;
}

const START_ANGLE = -135;
const END_ANGLE = 135;
/** Pixels of vertical drag to sweep the full range */
const DRAG_RANGE_PX = 160;

/** SVG arc path on a 100×100 viewBox between two angles (0° = up) */
function arcPath(from: number, to: number, radius = 44): string {
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${50 + radius * Math.cos(rad)} ${50 + radius * Math.sin(rad)}`;
  };
  const largeArc = to - from > 180 ? 1 : 0;
  return `M ${point(from)} A ${radius} ${radius} 0 ${largeArc} 1 ${point(to)}`;
}

export default function Knob({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => String(v),
  size = 72,
}: KnobProps) {
  const dragRef = useRef<{ y: number; value: number } | null>(null);

  const decimals = (String(step).split('.')[1] ?? '').length;
  const snap = (v: number) =>
    Number(Math.min(max, Math.max(min, Math.round(v / step) * step)).toFixed(decimals));

  const fraction = (value - min) / (max - min);
  const angle = START_ANGLE + fraction * (END_ANGLE - START_ANGLE);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault(); // no focus on click; no text selection while dragging
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { y: e.clientY, value };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = ((drag.y - e.clientY) / DRAG_RANGE_PX) * (max - min);
    onChange(snap(drag.value + delta));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const big = step * 10;
    const next: Record<string, number> = {
      ArrowUp: value + step,
      ArrowRight: value + step,
      ArrowDown: value - step,
      ArrowLeft: value - step,
      PageUp: value + big,
      PageDown: value - big,
      Home: min,
      End: max,
    };
    if (!(e.key in next)) return;
    e.preventDefault(); // also tells the global shortcuts this key is taken
    onChange(snap(next[e.key]));
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className="relative shrink-0 cursor-ns-resize touch-none select-none rounded-full"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 overflow-visible" aria-hidden="true">
        <path d={arcPath(START_ANGLE, END_ANGLE)} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="5" strokeLinecap="round" />
        {fraction > 0.001 && (
          <path
            d={arcPath(START_ANGLE, angle)}
            fill="none"
            stroke="var(--led)"
            strokeWidth="5"
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 3px rgb(255 181 71 / 0.6))' }}
          />
        )}
      </svg>

      {/* Knurled knob body */}
      <div
        className="absolute inset-[17%] rounded-full shadow-[0_5px_10px_rgb(0_0_0/0.6),inset_0_1px_0_rgb(255_255_255/0.14)]"
        style={{
          background:
            'repeating-conic-gradient(rgb(255 255 255 / 0.06) 0deg 5deg, transparent 5deg 10deg), radial-gradient(circle at 35% 28%, #57515f, #26232b 72%)',
        }}
      >
        <div className="absolute inset-0 transition-transform duration-75" style={{ transform: `rotate(${angle}deg)` }}>
          <span className="absolute left-1/2 top-[9%] h-[30%] w-[3px] -translate-x-1/2 rounded-full bg-ivory shadow-[0_0_4px_rgb(255_255_255/0.4)]" />
        </div>
      </div>
    </div>
  );
}
