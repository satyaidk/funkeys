/**
 * @fileoverview Application-wide constants for the Keyboard Piano.
 *
 * All magic numbers and configuration values are centralized here.
 * This makes the app easy to tune and prevents scattered literals.
 */

// ─── Piano Range ─────────────────────────────────────────────────────────────

/** Base octave for the piano (4 = middle C octave) */
export const BASE_OCTAVE = 4;

/** Minimum allowed octave shift (2 octaves down from base) */
export const MIN_OCTAVE_SHIFT = -2;

/** Maximum allowed octave shift (2 octaves up from base) */
export const MAX_OCTAVE_SHIFT = 2;

// ─── Audio Defaults ──────────────────────────────────────────────────────────

/** Default master volume (0 to 1) */
export const DEFAULT_VOLUME = 0.7;

/**
 * Default ADSR envelope values for a piano-like sound.
 *
 * - Fast attack (5ms): Piano hammers strike strings instantly
 * - Medium decay (300ms): Initial brightness fades quickly
 * - Low sustain (20%): Held notes ring softly
 * - Long release (800ms): Notes fade naturally after key release
 */
export const DEFAULT_ENVELOPE = {
  attack: 0.005,
  decay: 0.3,
  sustain: 0.2,
  release: 0.8,
} as const;

// ─── Harmonic Overtones ──────────────────────────────────────────────────────

/**
 * Harmonic frequency ratios relative to the fundamental.
 *
 * A real piano string vibrates at multiple frequencies simultaneously:
 * - 1× = fundamental (the "note" you hear)
 * - 2× = first overtone (one octave up)
 * - 3× = second overtone (octave + fifth)
 * - 4× = third overtone (two octaves up)
 * - 5× = fourth overtone
 * - 6× = fifth overtone
 *
 * These overtones create the rich, complex timbre of a piano.
 */
export const HARMONIC_RATIOS = [1, 2, 3, 4, 5, 6] as const;

/**
 * Relative amplitude for each harmonic (energy decreases with frequency).
 * Higher harmonics are quieter, creating a natural, warm tone.
 */
export const HARMONIC_AMPLITUDES = [1.0, 0.5, 0.25, 0.125, 0.0625, 0.03] as const;

// ─── Filter Settings ─────────────────────────────────────────────────────────

/** Low-pass filter cutoff frequency in Hz (removes harsh high frequencies) */
export const FILTER_CUTOFF = 5000;

/** Filter Q factor (resonance — higher = more pronounced cutoff) */
export const FILTER_Q = 1;

/** Per-note gain applied to each harmonic (keeps a single note well below clipping) */
export const HARMONIC_GAIN = 0.15;

/**
 * Fade time (seconds) used when a voice must be cut short — re-triggering a
 * held note or stopping everything. Short enough to feel instant, long
 * enough to avoid an audible click.
 */
export const QUICK_RELEASE = 0.015;

/**
 * Master bus compressor settings. Prevents clipping/distortion when several
 * notes are played at once (each voice adds to the total signal level).
 */
export const COMPRESSOR = {
  threshold: -12,
  knee: 6,
  ratio: 4,
  attack: 0.003,
  release: 0.25,
} as const;

// ─── Key Dimensions ──────────────────────────────────────────────────────────

/** Maximum white key width in px (used on wide screens) */
export const WHITE_KEY_WIDTH = 60;

/** Minimum white key width in px (keyboard shrinks to fit narrow screens) */
export const MIN_WHITE_KEY_WIDTH = 26;

/** Maximum white key height in px */
export const WHITE_KEY_HEIGHT = 200;

/** Minimum white key height in px */
export const MIN_WHITE_KEY_HEIGHT = 140;

/** Black key width relative to a white key */
export const BLACK_KEY_WIDTH_RATIO = 0.6;

/** Black key height relative to a white key */
export const BLACK_KEY_HEIGHT_RATIO = 0.65;

// ─── Note Colors ─────────────────────────────────────────────────────────────

/**
 * Color assigned to each note name for visual feedback.
 * Creates a rainbow spectrum across the chromatic scale:
 * C(red) → D(orange) → E(yellow) → F(green) → G(cyan) → A(indigo) → B(pink)
 */
export const NOTE_COLORS: Record<string, string> = {
  'C':  '#ef4444',  // Red
  'C#': '#f97316',  // Orange
  'D':  '#f59e0b',  // Amber
  'D#': '#eab308',  // Yellow
  'E':  '#84cc16',  // Lime
  'F':  '#22c55e',  // Green
  'F#': '#14b8a6',  // Teal
  'G':  '#06b6d4',  // Cyan
  'G#': '#3b82f6',  // Blue
  'A':  '#6366f1',  // Indigo
  'A#': '#8b5cf6',  // Violet
  'B':  '#d946ef',  // Fuchsia
};
