/**
 * @fileoverview A raised rubber "pad" button, the basic control of the panel.
 *
 * Mouse clicks don't move focus (so Space stays the sustain pedal after
 * clicking a control); keyboard Tab focus works as usual.
 */

import { ComponentProps } from 'react';

export const preventMouseFocus = (e: React.MouseEvent) => e.preventDefault();

/** All native button props, including `ref` (a regular prop in React 19) */
interface PadButtonProps extends ComponentProps<'button'> {
  /** Lit/selected state: a warmer surface (pair with a Led) */
  active?: boolean;
}

export const PAD_BASE =
  'relative rounded-lg border transition-[background-color,border-color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-35';

export const PAD_IDLE =
  'border-white/[0.06] bg-linear-to-b from-[#36323d] to-[#2a2730] shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_2px_0_rgb(0_0_0/0.5)] hover:from-[#3d3845] hover:to-[#2f2b35]';

export const PAD_ACTIVE =
  'border-[rgb(255_181_71/0.28)] bg-linear-to-b from-[#3e3529] to-[#2d2820] shadow-[inset_0_1px_0_rgb(255_215_160/0.1),0_1px_0_rgb(0_0_0/0.5)]';

export default function PadButton({
  active = false,
  className = '',
  type = 'button',
  onMouseDown,
  ...props
}: PadButtonProps) {
  return (
    <button
      type={type}
      onMouseDown={onMouseDown ?? preventMouseFocus}
      className={`${PAD_BASE} ${active ? PAD_ACTIVE : PAD_IDLE} ${className}`}
      {...props}
    />
  );
}
