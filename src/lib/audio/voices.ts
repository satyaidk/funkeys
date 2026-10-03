/**
 * @fileoverview Instrument voices: data-driven sound recipes.
 *
 * Each voice describes *how* to synthesize an instrument — which partials
 * (sine/saw waves at multiples of the note's frequency) to stack, how the
 * volume and tone change over time, and optional extras such as FM
 * modulation (electric piano bell), vibrato/tremolo, or a burst of noise for
 * the hammer or pluck. `synth-voice.ts` turns a recipe into Web Audio nodes.
 *
 * Adding a new instrument means adding an object here — no engine changes.
 *
 * ```
 *  partials ─► note envelope ─► (tremolo) ─► tone filter ─► stereo pan ─► out
 *     ▲  ▲
 *     │  └─ vibrato LFO (pitch wobble)
 *     └──── FM modulator (bell-like attack)
 * ```
 */

import { KeyboardMode, VoiceId, VoiceLayer } from '@/types';

export interface PartialSpec {
  /** Frequency as a multiple of the note's fundamental */
  ratio: number;
  /** Relative loudness */
  gain: number;
  /** Wave shape (default 'sine') */
  type?: OscillatorType;
  /** Fixed detune in cents (used to thicken strings) */
  detune?: number;
}

export interface VoiceDefinition {
  id: VoiceId;
  name: string;
  /** Short description shown under the name */
  description: string;
  partials: PartialSpec[];
  /**
   * Piano strings are stiff, so their upper partials run slightly sharp.
   * Partial n sounds at n × f × √(1 + B·n²), where B is this coefficient.
   */
  inharmonicity?: number;
  /** Attack/decay times in seconds; sustain is a level (0–1); release in seconds */
  envelope: { attack: number; decay: number; sustain: number; release: number };
  /**
   * Time constant (s) of the natural fade while a key is held, measured at
   * middle C. Higher notes fade faster. Omit for sounds that hold steady.
   */
  holdDecay?: number;
  filter: {
    /** Low-pass cutoff (Hz) at the softest velocity */
    cutoff: number;
    q: number;
    /** Extra cutoff (Hz) at full velocity: harder playing sounds brighter */
    velocity: number;
    /** Time constant (s) for the tone to mellow while the note rings */
    decay?: number;
  };
  /** Frequency modulation: a modulator wobbling the pitch at audio rate */
  fm?: { ratio: number; index: number; decay: number };
  /** Low-frequency oscillator: vibrato (pitch, depth in cents) or tremolo (volume, depth 0–1) */
  lfo?: { kind: 'vibrato' | 'tremolo'; rate: number; depth: number; delay?: number };
  /** Short filtered noise burst for the hammer strike or quill pluck */
  attackNoise?: { gain: number; frequency: number; duration: number };
  /** Loudness trim so every voice feels equally loud */
  gain: number;
}

export const VOICES: readonly VoiceDefinition[] = [
  {
    id: 'grand',
    name: 'Concert grand',
    description: 'Warm, full grand piano',
    partials: [1, 0.62, 0.4, 0.27, 0.17, 0.11, 0.07, 0.045].map((gain, i) => ({ ratio: i + 1, gain })),
    inharmonicity: 0.00035,
    envelope: { attack: 0.003, decay: 0.28, sustain: 0.55, release: 0.32 },
    holdDecay: 3.8,
    filter: { cutoff: 1300, q: 0.6, velocity: 6500, decay: 1.6 },
    attackNoise: { gain: 0.1, frequency: 2600, duration: 0.03 },
    gain: 0.5,
  },
  {
    id: 'bright',
    name: 'Bright grand',
    description: 'Crisp pop and rock piano',
    partials: [1, 0.78, 0.58, 0.45, 0.33, 0.24, 0.17, 0.12].map((gain, i) => ({ ratio: i + 1, gain })),
    inharmonicity: 0.0004,
    envelope: { attack: 0.002, decay: 0.22, sustain: 0.5, release: 0.28 },
    holdDecay: 3.2,
    filter: { cutoff: 2400, q: 0.7, velocity: 8000, decay: 2.2 },
    attackNoise: { gain: 0.14, frequency: 3400, duration: 0.025 },
    gain: 0.42,
  },
  {
    id: 'electric',
    name: 'Electric piano',
    description: 'Bell-like tines with tremolo',
    partials: [{ ratio: 1, gain: 1 }],
    envelope: { attack: 0.002, decay: 0.45, sustain: 0.6, release: 0.35 },
    holdDecay: 2.8,
    filter: { cutoff: 2600, q: 0.5, velocity: 4000 },
    fm: { ratio: 1, index: 1.8, decay: 0.9 },
    lfo: { kind: 'tremolo', rate: 4.8, depth: 0.22 },
    gain: 0.72,
  },
  {
    id: 'harpsichord',
    name: 'Harpsichord',
    description: 'Plucked Baroque keyboard',
    partials: [
      { ratio: 1, gain: 1, type: 'sawtooth' },
      { ratio: 2, gain: 0.35, type: 'sawtooth' },
    ],
    envelope: { attack: 0.001, decay: 0.08, sustain: 0.5, release: 0.12 },
    holdDecay: 1.4,
    filter: { cutoff: 3800, q: 1.2, velocity: 2500, decay: 0.9 },
    attackNoise: { gain: 0.18, frequency: 5000, duration: 0.015 },
    gain: 0.3,
  },
  {
    id: 'organ',
    name: 'Drawbar organ',
    description: 'Steady jazz organ with vibrato',
    // Drawbars: 16', 8', 5⅓', 4', 2⅔', 2'
    partials: [
      { ratio: 0.5, gain: 0.55 },
      { ratio: 1, gain: 1 },
      { ratio: 1.5, gain: 0.45 },
      { ratio: 2, gain: 0.6 },
      { ratio: 3, gain: 0.3 },
      { ratio: 4, gain: 0.35 },
    ],
    envelope: { attack: 0.008, decay: 0.05, sustain: 1, release: 0.07 },
    filter: { cutoff: 7000, q: 0.5, velocity: 0 },
    lfo: { kind: 'vibrato', rate: 6.4, depth: 7 },
    gain: 0.3,
  },
  {
    id: 'strings',
    name: 'String ensemble',
    description: 'Slow-blooming orchestral strings',
    partials: [
      { ratio: 1, gain: 1, type: 'sawtooth', detune: -7 },
      { ratio: 1, gain: 1, type: 'sawtooth', detune: 7 },
      { ratio: 2, gain: 0.25, type: 'sawtooth' },
    ],
    envelope: { attack: 0.28, decay: 0.3, sustain: 0.85, release: 0.8 },
    filter: { cutoff: 1800, q: 0.7, velocity: 2200 },
    lfo: { kind: 'vibrato', rate: 5.4, depth: 9, delay: 0.35 },
    gain: 0.2,
  },
  {
    id: 'vibraphone',
    name: 'Vibraphone',
    description: 'Metal bars with motor tremolo',
    partials: [
      { ratio: 1, gain: 1 },
      { ratio: 4, gain: 0.28 },
      { ratio: 10, gain: 0.06 },
    ],
    envelope: { attack: 0.002, decay: 0.5, sustain: 0.5, release: 0.55 },
    holdDecay: 4.5,
    filter: { cutoff: 6000, q: 0.5, velocity: 2000 },
    lfo: { kind: 'tremolo', rate: 5.6, depth: 0.45 },
    gain: 0.6,
  },
  {
    id: 'celesta',
    name: 'Celesta',
    description: 'Sparkling music-box bells',
    partials: [
      { ratio: 1, gain: 1 },
      { ratio: 2, gain: 0.35 },
      { ratio: 4.1, gain: 0.2 },
      { ratio: 6.7, gain: 0.06 },
    ],
    envelope: { attack: 0.001, decay: 0.18, sustain: 0.45, release: 0.45 },
    holdDecay: 1.6,
    filter: { cutoff: 7000, q: 0.5, velocity: 2000 },
    attackNoise: { gain: 0.05, frequency: 6000, duration: 0.01 },
    gain: 0.6,
  },
];

export function getVoice(id: VoiceId): VoiceDefinition {
  return VOICES.find((v) => v.id === id) ?? VOICES[0];
}

/** The settings that decide which voices a key plays */
export interface VoiceRouting {
  voice: VoiceId;
  mode: KeyboardMode;
  layerVoice: VoiceId;
  layerBalance: number;
  splitVoice: VoiceId;
  splitIndex: number;
}

/**
 * Decide which voices a key should sound.
 *
 * - **single**: the main voice
 * - **layer**: main + layer voice; balance 0.5 plays both at full level,
 *   moving toward either end fades the other voice out
 * - **split**: keys left of the split point use the split voice
 *
 * @param keyIndex - Position of the key on the keyboard (0 = lowest key)
 */
export function resolveVoices(routing: VoiceRouting, keyIndex: number): VoiceLayer[] {
  if (routing.mode === 'split' && keyIndex < routing.splitIndex) {
    return [{ voice: routing.splitVoice, gain: 1 }];
  }
  if (routing.mode === 'layer') {
    const b = Math.max(0, Math.min(1, routing.layerBalance));
    return [
      { voice: routing.voice, gain: Math.min(1, 2 * (1 - b)) },
      { voice: routing.layerVoice, gain: Math.min(1, 2 * b) },
    ].filter((layer) => layer.gain > 0);
  }
  return [{ voice: routing.voice, gain: 1 }];
}
