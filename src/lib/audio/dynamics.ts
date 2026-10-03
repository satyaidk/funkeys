/**
 * @fileoverview Dynamics: how playing strength becomes loudness.
 *
 * Real piano keys sense how *fast* you press them ("velocity"). Digital
 * pianos let you choose a **touch curve** that changes how much force is
 * needed to play loudly — a light curve suits a gentle touch, a heavy one
 * rewards a strong touch, and "fixed" plays every note at one level.
 *
 * In the browser:
 * - Computer keys can't sense force, so they send a fixed raw velocity.
 * - Mouse/touch use *where* on the key you press: nearer the front edge is
 *   stronger, like pressing a real key further from its pivot.
 */

import { TouchCurve } from '@/types';

export interface TouchOption {
  id: TouchCurve;
  name: string;
  description: string;
}

export const TOUCH_CURVES: readonly TouchOption[] = [
  { id: 'light', name: 'Light', description: 'Loud with little effort' },
  { id: 'medium', name: 'Medium', description: 'Balanced, like an acoustic piano' },
  { id: 'heavy', name: 'Heavy', description: 'Needs a firm touch to play loudly' },
  { id: 'fixed', name: 'Fixed', description: 'Every note at the same volume' },
];

/** Velocity used for every note when the touch curve is "fixed" */
export const FIXED_VELOCITY = 0.75;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Apply a touch curve to a raw velocity (0–1).
 *
 * Curves are power functions: an exponent below 1 lifts soft playing
 * (light), above 1 lowers it (heavy).
 */
export function applyTouchCurve(raw: number, curve: TouchCurve): number {
  const v = clamp(raw, 0, 1);
  switch (curve) {
    case 'light':
      return clamp(Math.pow(v, 0.55), 0.05, 1);
    case 'heavy':
      return clamp(Math.pow(v, 1.7), 0.05, 1);
    case 'fixed':
      return FIXED_VELOCITY;
    default:
      return clamp(v, 0.05, 1);
  }
}

/**
 * Raw velocity from where a key was pressed.
 *
 * @param fraction - Press position from the top (0) to the bottom (1) of the key
 */
export function velocityFromPosition(fraction: number): number {
  return 0.35 + 0.65 * clamp(fraction, 0, 1);
}

/**
 * Gain for a velocity. Perceived loudness isn't linear, so velocity is
 * curved, with a floor so the softest notes are still audible.
 */
export function velocityToGain(velocity: number): number {
  return 0.08 + 0.92 * Math.pow(clamp(velocity, 0, 1), 1.6);
}
