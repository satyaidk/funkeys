/**
 * @fileoverview Application-wide constants for the Keyboard Piano.
 *
 * All magic numbers and configuration values are centralized here.
 * This makes the app easy to tune and prevents scattered literals.
 * Per-instrument sound recipes live in `audio/voices.ts`.
 */

// ─── Piano Range ─────────────────────────────────────────────────────────────

/** Octave of the lowest key (the keyboard spans C3 → C6 with no octave shift) */
export const BASE_OCTAVE = 3;

/** Minimum allowed octave shift (2 octaves down: C1 → C4) */
export const MIN_OCTAVE_SHIFT = -2;

/** Maximum allowed octave shift (2 octaves up: C5 → C8, the top of a grand piano) */
export const MAX_OCTAVE_SHIFT = 2;

// ─── Tuning ──────────────────────────────────────────────────────────────────

/** Concert pitch: the frequency of A4 in Hz */
export const DEFAULT_REFERENCE_PITCH = 440;

/**
 * Master tuning range for A4, matching digital pianos such as the Roland
 * FP-30X (415.3–466.2 Hz in 0.1 Hz steps). 415.3 Hz is "Baroque pitch",
 * a semitone below modern concert pitch.
 */
export const MIN_REFERENCE_PITCH = 415.3;
export const MAX_REFERENCE_PITCH = 466.2;
export const REFERENCE_PITCH_STEP = 0.1;

/** Transpose range in semitones (±1 octave) */
export const MAX_TRANSPOSE = 12;

// ─── Audio ───────────────────────────────────────────────────────────────────

/** Default master volume (0 to 1) */
export const DEFAULT_VOLUME = 0.7;

/**
 * Maximum number of voices sounding at once. When exceeded, the oldest voice
 * is faded out ("voice stealing"), as on hardware digital pianos.
 */
export const MAX_POLYPHONY = 64;

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
  threshold: -14,
  knee: 8,
  ratio: 4,
  attack: 0.003,
  release: 0.25,
} as const;

/** Velocity used for computer-keyboard presses (keys can't sense how hard you press) */
export const KEYBOARD_VELOCITY = 0.72;

/** How far the soft pedal (una corda) lowers velocity and darkens the tone */
export const SOFT_PEDAL = {
  velocityScale: 0.65,
  brightnessScale: 0.55,
} as const;

/** Stereo width: low notes pan left, high notes right, like sitting at the bench */
export const STEREO_SPREAD = 0.5;

// ─── Effects ─────────────────────────────────────────────────────────────────

/**
 * Reverb rooms. The impulse response is generated as decaying noise:
 * `duration` is the tail length in seconds, `decay` how steeply it fades,
 * `preDelay` the gap before the first reflections.
 */
export const REVERB_PRESETS = {
  room: { duration: 0.9, decay: 3.5, preDelay: 0.004 },
  hall: { duration: 2.4, decay: 2.6, preDelay: 0.018 },
  cathedral: { duration: 5.2, decay: 1.9, preDelay: 0.035 },
} as const;

export const DEFAULT_REVERB_LEVEL = 0.28;

/** Brilliance: a high-shelf EQ boost or cut (dB) above `BRILLIANCE_FREQUENCY` */
export const BRILLIANCE_GAIN_DB = {
  mellow: -7,
  normal: 0,
  bright: 6,
} as const;

export const BRILLIANCE_FREQUENCY = 3200;

// ─── Metronome ───────────────────────────────────────────────────────────────

export const MIN_BPM = 30;
export const MAX_BPM = 240;
export const DEFAULT_BPM = 96;

/** How often the scheduler wakes up (ms) and how far ahead it books clicks (s) */
export const METRONOME_LOOKAHEAD_MS = 25;
export const METRONOME_SCHEDULE_AHEAD = 0.12;

/** Taps further apart than this (ms) start a new tap-tempo measurement */
export const TAP_TEMPO_RESET_MS = 2000;

// ─── Looper (Notes page) ─────────────────────────────────────────────────────

/** Playback speeds for practice; 1 is the song's own tempo */
export const LOOP_SPEEDS = [0.5, 0.75, 1, 1.25] as const;

/**
 * Share of each note's written length that it actually sounds (a sequencer's
 * "gate"). The short gap before the next note lets a repeated note strike
 * again instead of blurring into one long note.
 */
export const LOOP_GATE = 0.9;

/** How long (ms) before a pass ends the looper books the next one */
export const LOOP_SCHEDULE_AHEAD_MS = 100;

/**
 * If the looper falls further behind than this (ms), e.g. while the tab was
 * in the background, it restarts the pass from now instead of playing every
 * missed note at once.
 */
export const LOOP_MAX_LATE_MS = 250;

// ─── Key Dimensions ──────────────────────────────────────────────────────────

/** Maximum white key width in px (used on wide screens) */
export const WHITE_KEY_WIDTH = 58;

/**
 * Minimum white key width in px. Below the width needed to fit every key,
 * the keyboard scrolls sideways instead of shrinking further, so keys stay
 * big enough to tap.
 */
export const MIN_WHITE_KEY_WIDTH = 34;

/** Maximum white key height in px */
export const WHITE_KEY_HEIGHT = 224;

/** Minimum white key height in px */
export const MIN_WHITE_KEY_HEIGHT = 168;

/** Black key width relative to a white key */
export const BLACK_KEY_WIDTH_RATIO = 0.6;

/** Black key height relative to a white key */
export const BLACK_KEY_HEIGHT_RATIO = 0.63;

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
