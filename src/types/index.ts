/**
 * @fileoverview Domain types shared across the Keyboard Piano.
 *
 * Shapes used by more than one layer (lib, hooks, components) live here.
 * Props that belong to a single component are declared next to that
 * component instead.
 */

// ─── Notes ───────────────────────────────────────────────────────────────────

/** Musical note names in the chromatic scale */
export type NoteName =
  | 'C' | 'C#' | 'D' | 'D#' | 'E'
  | 'F' | 'F#' | 'G' | 'G#'
  | 'A' | 'A#' | 'B';

/** Which half of the computer keyboard plays a key */
export type Manual = 'lower' | 'upper';

/**
 * One key on the on-screen keyboard: its pitch, the computer key that
 * plays it, and how to draw it.
 */
export interface Note {
  /** Unique identifier: note name + octave (e.g. 'C4', 'F#5') */
  id: string;
  /** Note name (e.g. 'C', 'F#') */
  name: NoteName;
  /** Octave number (4 = the middle C octave) */
  octave: number;
  /** MIDI note number (60 = middle C, 69 = A4) */
  midi: number;
  /** Whether this is a black (sharp) key */
  isBlack: boolean;
  /** Physical computer key that plays it (`KeyboardEvent.code`, e.g. 'KeyQ') */
  code: string;
  /** Label printed on the key for a US QWERTY layout (e.g. 'Q') */
  keyLabel: string;
  /** Bottom two keyboard rows (lower) or top two rows (upper) */
  manual: Manual;
}

// ─── Sound settings ──────────────────────────────────────────────────────────

/** Instrument sounds ("voices"), each defined in `lib/audio/voices.ts` */
export type VoiceId =
  | 'grand'
  | 'bright'
  | 'electric'
  | 'harpsichord'
  | 'organ'
  | 'strings'
  | 'vibraphone'
  | 'celesta';

/**
 * - single: one voice across the keyboard
 * - layer:  two voices stacked on every key (a.k.a. "dual")
 * - split:  a different voice for the left-hand zone
 */
export type KeyboardMode = 'single' | 'layer' | 'split';

export type ReverbType = 'off' | 'room' | 'hall' | 'cathedral';

/** Tone control: cut or boost the high frequencies */
export type Brilliance = 'mellow' | 'normal' | 'bright';

/** How strongly playing force maps to loudness, as on digital pianos */
export type TouchCurve = 'light' | 'medium' | 'heavy' | 'fixed';

/** Tuning systems; see `lib/music/tuning.ts` */
export type TemperamentId =
  | 'equal'
  | 'pure-major'
  | 'pythagorean'
  | 'meantone'
  | 'werckmeister'
  | 'kirnberger';

/** Every user-adjustable setting of the instrument */
export interface PianoSettings {
  /** Master volume (0–1) */
  volume: number;
  /** Octave shift of the whole keyboard (−2…+2) */
  octaveShift: number;
  /** Pitch shift in semitones without moving the keys (−12…+12) */
  transpose: number;
  /** Frequency of A4 in Hz (415.3–466.2) */
  referencePitch: number;
  temperament: TemperamentId;
  /** Key the temperament is centered on, as a pitch class (0 = C … 11 = B) */
  temperamentRoot: number;
  /** Main voice */
  voice: VoiceId;
  mode: KeyboardMode;
  /** Second voice in layer mode */
  layerVoice: VoiceId;
  /** Layer mix: 0 = main voice only, 0.5 = equal, 1 = layer voice only */
  layerBalance: number;
  /** Left-hand voice in split mode */
  splitVoice: VoiceId;
  /** Split position as a key index (0 = lowest key); keys below it use `splitVoice` */
  splitIndex: number;
  reverb: ReverbType;
  /** Reverb amount (0–1) */
  reverbLevel: number;
  brilliance: Brilliance;
  touch: TouchCurve;
}

// ─── Pedals ──────────────────────────────────────────────────────────────────

/** The three pedals of a grand piano, left to right */
export type PedalName = 'soft' | 'sostenuto' | 'sustain';

export type PedalState = Record<PedalName, boolean>;

// ─── Audio ───────────────────────────────────────────────────────────────────

/** One voice to sound for a note, with its share of the volume */
export interface VoiceLayer {
  voice: VoiceId;
  gain: number;
}

/** Everything the audio engine needs to start a note */
export interface PlayNoteOptions {
  /** Voices to sound together (one in single mode, two in layer mode) */
  voices: VoiceLayer[];
  /** Playing strength after the touch curve (0–1) */
  velocity: number;
  /** Sounding MIDI number, used for stereo position and pitch-dependent decay */
  midi: number;
  /** Soft pedal (una corda) held: quieter and darker */
  soft?: boolean;
}

// ─── Recorder ────────────────────────────────────────────────────────────────

export type RecorderStatus = 'idle' | 'recording' | 'playing';

/** A single event in a recorded performance, timed from the start in ms */
export type PerformanceEvent =
  | { time: number; type: 'noteOn'; noteId: string; velocity: number }
  | { time: number; type: 'noteOff'; noteId: string }
  | { time: number; type: 'pedal'; pedal: PedalName; down: boolean };

/** A performance event before it has been timestamped by the recorder */
export type PerformanceAction =
  | { type: 'noteOn'; noteId: string; velocity: number }
  | { type: 'noteOff'; noteId: string }
  | { type: 'pedal'; pedal: PedalName; down: boolean };
