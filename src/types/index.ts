/**
 * @fileoverview Type definitions for the Keyboard Piano application.
 *
 * This module defines all TypeScript interfaces used across the app.
 * Centralizing types ensures type safety and makes the codebase
 * self-documenting — every data shape is defined in one place.
 */

// ─── Note Types ──────────────────────────────────────────────────────────────

/** Musical note names in the chromatic scale */
export type NoteName =
  | 'C' | 'C#' | 'D' | 'D#' | 'E'
  | 'F' | 'F#' | 'G' | 'G#'
  | 'A' | 'A#' | 'B';

/**
 * Represents a single piano note with all properties needed
 * for rendering, audio synthesis, and keyboard input.
 */
export interface Note {
  /** Note name (e.g., 'C', 'F#') */
  name: NoteName;
  /** Octave number (e.g., 4 for middle C) */
  octave: number;
  /** Frequency in Hz (e.g., 261.63 for C4) */
  frequency: number;
  /** Whether this is a black (sharp/flat) key */
  isBlack: boolean;
  /** Computer keyboard key that triggers this note (lowercase) */
  keyboardKey: string;
  /** Display label for the keyboard key (uppercase) */
  keyLabel: string;
  /** Unique identifier: noteName + octave (e.g., 'C4', 'F#5') */
  id: string;
}

// ─── Audio Types ─────────────────────────────────────────────────────────────

/**
 * ADSR Envelope parameters for shaping note dynamics.
 *
 * ADSR stands for Attack, Decay, Sustain, Release — the four phases
 * of a sound's volume over time. This is fundamental to making
 * synthesized sounds feel natural and musical.
 *
 * Volume ▲
 *   1.0  │    /\
 *        │   /  \
 *   S    │  /    \___________
 *        │ /                  \
 *   0.0  │/────────────────────\──► Time
 *         A    D    S         R
 */
export interface ADSREnvelope {
  /** Time (seconds) for volume to ramp from 0 to peak */
  attack: number;
  /** Time (seconds) for volume to decay from peak to sustain level */
  decay: number;
  /** Volume level held while key is pressed (0 to 1) */
  sustain: number;
  /** Time (seconds) for volume to fade to 0 after key release */
  release: number;
}

/**
 * Represents a currently playing note's Web Audio nodes.
 * Stored in the AudioEngine's active notes map for lifecycle management.
 */
export interface ActiveNote {
  /** Unique note identifier (e.g., 'C4') */
  noteId: string;
  /** Array of oscillator nodes (fundamental + harmonic overtones) */
  oscillators: OscillatorNode[];
  /** Gain node controlling per-note volume / ADSR envelope */
  gainNode: GainNode;
  /** Low-pass filter for tonal warmth */
  filterNode: BiquadFilterNode;
  /** AudioContext time when note started playing */
  startTime: number;
}

// ─── State Types ─────────────────────────────────────────────────────────────

/** Piano configuration state managed by the usePiano hook */
export interface PianoConfig {
  /** Master volume level (0 to 1) */
  volume: number;
  /** Octave shift from base octave (-2 to +2) */
  octaveShift: number;
  /** Whether sustain pedal is active (notes ring after release) */
  sustain: boolean;
}

// ─── Component Props ─────────────────────────────────────────────────────────

/** Props for the PianoKey component */
export interface PianoKeyProps {
  /** Note data for this key */
  note: Note;
  /** Whether this key is currently being played */
  isActive: boolean;
  /** Whether the note is still ringing from the sustain pedal after release */
  isSustained?: boolean;
  /** Called when the key is pressed (mouse/touch) */
  onNoteStart: (noteId: string) => void;
  /** Called when the key is released (mouse/touch) */
  onNoteStop: (noteId: string) => void;
}

/** Props for the Piano component */
export interface PianoProps {
  /** Array of all notes to display */
  notes: Note[];
  /** Set of currently active note IDs for visual feedback */
  activeNoteIds: Set<string>;
  /** Set of note IDs still ringing from the sustain pedal */
  sustainedNoteIds?: Set<string>;
  /** Called when a note starts playing */
  onNoteStart: (noteId: string) => void;
  /** Called when a note stops playing */
  onNoteStop: (noteId: string) => void;
}

/** Props for the ControlPanel component */
export interface ControlPanelProps {
  /** Current master volume (0 to 1) */
  volume: number;
  /** Current octave shift (-2 to +2) */
  octaveShift: number;
  /** Whether sustain is currently active */
  sustain: boolean;
  /** Volume change handler */
  onVolumeChange: (volume: number) => void;
  /** Octave shift handler */
  onOctaveChange: (shift: number) => void;
  /** Sustain toggle handler */
  onSustainToggle: () => void;
}
