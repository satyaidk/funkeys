/**
 * @fileoverview Effects: reverb rooms and brilliance (tone).
 *
 * **Reverb** simulates the space the piano is played in. A ConvolverNode
 * blends the dry sound with an *impulse response* — a recording of how a
 * room answers a single clap. Instead of shipping recordings, we generate
 * one: random noise that fades out over the room's length. That's a good
 * approximation of the dense, decaying reflections of a real hall.
 *
 * **Brilliance** is a tone control found on most digital pianos: a high-shelf
 * EQ that cuts (mellow) or boosts (bright) the upper frequencies.
 */

import { Brilliance, ReverbType } from '@/types';

export interface ReverbOption {
  id: ReverbType;
  name: string;
}

export const REVERB_OPTIONS: readonly ReverbOption[] = [
  { id: 'off', name: 'Off' },
  { id: 'room', name: 'Room' },
  { id: 'hall', name: 'Concert hall' },
  { id: 'cathedral', name: 'Cathedral' },
];

export interface BrillianceOption {
  id: Brilliance;
  name: string;
}

export const BRILLIANCE_OPTIONS: readonly BrillianceOption[] = [
  { id: 'mellow', name: 'Mellow' },
  { id: 'normal', name: 'Normal' },
  { id: 'bright', name: 'Bright' },
];

/** Shape of a room in REVERB_PRESETS */
export interface ReverbPreset {
  /** Tail length in seconds */
  readonly duration: number;
  /** How steeply the tail fades (higher = faster) */
  readonly decay: number;
  /** Silence before the first reflections, in seconds */
  readonly preDelay: number;
}

/**
 * Generate a stereo impulse response for a reverb room.
 *
 * Each sample is random noise scaled by `(1 − t)^decay`, where t runs from 0
 * to 1 across the tail. Left and right channels get independent noise, which
 * makes the reverb sound wide.
 *
 * @param random - Injectable random source (tests pass a deterministic one)
 */
export function createImpulseResponse(
  context: BaseAudioContext,
  preset: ReverbPreset,
  random: () => number = Math.random
): AudioBuffer {
  const rate = context.sampleRate;
  const preDelay = Math.floor(rate * preset.preDelay);
  const length = preDelay + Math.floor(rate * preset.duration);
  const buffer = context.createBuffer(2, length, rate);

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = preDelay; i < length; i++) {
      const t = (i - preDelay) / (length - preDelay);
      data[i] = (random() * 2 - 1) * Math.pow(1 - t, preset.decay);
    }
  }
  return buffer;
}
