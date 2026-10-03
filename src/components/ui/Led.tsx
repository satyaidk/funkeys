/**
 * @fileoverview A small indicator light, like the LEDs on a digital piano's buttons.
 * Purely visual: the control it sits in carries the accessible state.
 */

interface LedProps {
  on: boolean;
  /** Amber for normal state, red for recording */
  tone?: 'amber' | 'red';
  blink?: boolean;
  className?: string;
}

const COLORS = { amber: 'var(--led)', red: 'var(--rec)' };

export default function Led({ on, tone = 'amber', blink = false, className = '' }: LedProps) {
  const color = COLORS[tone];
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-[background-color,box-shadow] duration-150 ${
        on && blink ? 'led-blink' : ''
      } ${className}`}
      style={{
        backgroundColor: on ? color : 'rgb(255 255 255 / 0.1)',
        boxShadow: on ? `0 0 7px ${color}, 0 0 2px ${color}` : 'inset 0 1px 1px rgb(0 0 0 / 0.6)',
      }}
    />
  );
}
