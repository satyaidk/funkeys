/**
 * @fileoverview Web Audio API engine for piano sound synthesis.
 *
 * ## Architecture
 * ```
 * For each note played:
 *
 *   Oscillator 1 (fundamental: triangle wave)  ──→ HarmonicGain 1 ──┐
 *   Oscillator 2 (2nd harmonic: sine wave)      ──→ HarmonicGain 2 ──┤
 *   Oscillator 3 (3rd harmonic: sine wave)      ──→ HarmonicGain 3 ──┤
 *   Oscillator 4 (4th harmonic: sine wave)      ──→ HarmonicGain 4 ──┼──→ NoteGain (ADSR)
 *   Oscillator 5 (5th harmonic: sine wave)      ──→ HarmonicGain 5 ──┤       │
 *   Oscillator 6 (6th harmonic: sine wave)      ──→ HarmonicGain 6 ──┘       │
 *                                                                              ▼
 *                                                                     BiquadFilter (low-pass)
 *                                                                              │
 *                                                                              ▼
 *                                                                     MasterGain (volume)
 *                                                                              │
 *                                                                              ▼
 *                                                                     Compressor (anti-clipping)
 *                                                                              │
 *                                                                              ▼
 *                                                                     AudioContext.destination
 *                                                                        (speakers)
 * ```
 *
 * ## Why Multiple Oscillators?
 * A real piano string vibrates at its fundamental frequency AND at
 * integer multiples (harmonics/overtones). A single oscillator sounds
 * flat and "synthetic". By layering 6 oscillators at harmonic ratios
 * (1×, 2×, 3×, 4×, 5×, 6×) with decreasing amplitudes, we create
 * a rich, warm tone that sounds much closer to a real piano.
 *
 * ## Why ADSR Envelope?
 * Without an envelope, notes would start and stop instantly — like
 * flipping a light switch. The ADSR envelope shapes the volume over
 * time: quick attack (hammer strike), gradual decay, sustained hold,
 * and smooth release (string dampening).
 */

import { ActiveNote, ADSREnvelope } from '@/types';
import {
  DEFAULT_ENVELOPE,
  DEFAULT_VOLUME,
  HARMONIC_RATIOS,
  HARMONIC_AMPLITUDES,
  HARMONIC_GAIN,
  FILTER_CUTOFF,
  FILTER_Q,
  QUICK_RELEASE,
  COMPRESSOR,
} from './constants';

/** Older Safari only exposes the prefixed constructor */
type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

export class AudioEngine {
  /** The Web Audio API context — the "master controller" for all audio */
  private context: AudioContext | null = null;

  /** Master gain node — controls overall volume for all notes */
  private masterGain: GainNode | null = null;

  /** Map of currently held (not yet released) notes, keyed by note ID (e.g., 'C4') */
  private activeNotes: Map<string, ActiveNote> = new Map();

  /** ADSR envelope settings */
  private envelope: ADSREnvelope = { ...DEFAULT_ENVELOPE };

  /** Master volume, remembered so it can be applied before the context exists */
  private volume: number = DEFAULT_VOLUME;

  /**
   * Initialize the AudioContext and master signal chain.
   *
   * IMPORTANT: Must be called after a user gesture (click, keypress).
   * Browsers block audio playback until the user interacts with the page
   * (autoplay policy). This is why we lazy-initialize on first interaction.
   *
   * This is synchronous on purpose: notes scheduled while the context is
   * still resuming simply start once it's running. Awaiting `resume()`
   * here would let a quick tap's key-up arrive before the note exists,
   * leaving the note stuck on.
   */
  init(): void {
    if (typeof window === 'undefined') return;

    if (!this.context) {
      const AudioContextCtor =
        window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioContextCtor) return;

      this.context = new AudioContextCtor();

      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = COMPRESSOR.threshold;
      compressor.knee.value = COMPRESSOR.knee;
      compressor.ratio.value = COMPRESSOR.ratio;
      compressor.attack.value = COMPRESSOR.attack;
      compressor.release.value = COMPRESSOR.release;
      compressor.connect(this.context.destination);

      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(compressor);
    }

    // Resume if the browser suspended the context (autoplay policy, tab switch, iOS interruption)
    if (this.context.state !== 'running') {
      this.context.resume().catch(() => {
        /* retried on the next interaction */
      });
    }
  }

  /**
   * Play a note by creating oscillators with harmonics and applying ADSR.
   *
   * Steps:
   * 1. Create a per-note GainNode for ADSR envelope control
   * 2. Apply Attack + Decay ramps to the gain
   * 3. Create a low-pass filter for warmth
   * 4. Create oscillators for fundamental + harmonic overtones
   * 5. Connect the signal chain and start oscillators
   * 6. Store in activeNotes map for later release
   *
   * @param noteId    - Unique identifier (e.g., 'C4')
   * @param frequency - Base frequency in Hz (e.g., 261.63 for C4)
   */
  playNote(noteId: string, frequency: number): void {
    const context = this.context;
    if (!context || !this.masterGain) return;

    // If this note is still held, cut it short first (prevent stacked duplicates)
    if (this.activeNotes.has(noteId)) {
      this.stopNote(noteId, true);
    }

    const now = context.currentTime;

    // ── Step 1: Create per-note gain for ADSR envelope ───────────────
    const gainNode = context.createGain();
    gainNode.gain.setValueAtTime(0, now);

    // ── Step 2: Apply ADSR Attack and Decay ──────────────────────────
    // Attack: silence → peak volume
    gainNode.gain.linearRampToValueAtTime(1.0, now + this.envelope.attack);
    // Decay: peak → sustain level
    gainNode.gain.linearRampToValueAtTime(
      this.envelope.sustain,
      now + this.envelope.attack + this.envelope.decay
    );

    // ── Step 3: Create low-pass filter ───────────────────────────────
    const filterNode = context.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(FILTER_CUTOFF, now);
    filterNode.Q.setValueAtTime(FILTER_Q, now);

    // ── Step 4: Create oscillators for harmonics ─────────────────────
    const oscillators: OscillatorNode[] = [];

    HARMONIC_RATIOS.forEach((ratio, index) => {
      const osc = context.createOscillator();
      const harmonicGain = context.createGain();

      // Set frequency to harmonic multiple of fundamental
      osc.frequency.setValueAtTime(frequency * ratio, now);

      // Set amplitude (each harmonic is progressively quieter)
      harmonicGain.gain.setValueAtTime(HARMONIC_AMPLITUDES[index] * HARMONIC_GAIN, now);

      // Fundamental uses triangle wave (warm), harmonics use sine (pure)
      osc.type = index === 0 ? 'triangle' : 'sine';

      // Connect: oscillator → harmonicGain → noteGain
      osc.connect(harmonicGain);
      harmonicGain.connect(gainNode);

      osc.start(now);
      oscillators.push(osc);
    });

    // ── Step 5: Connect signal chain ─────────────────────────────────
    // noteGain → filter → masterGain → compressor → speakers
    gainNode.connect(filterNode);
    filterNode.connect(this.masterGain);

    // ── Step 6: Store for later release ──────────────────────────────
    this.activeNotes.set(noteId, {
      noteId,
      oscillators,
      gainNode,
      filterNode,
      startTime: now,
    });
  }

  /**
   * Stop a playing note by applying the Release phase of the ADSR envelope.
   *
   * The note is removed from `activeNotes` right away, so pressing the same
   * key again during the release tail starts a fresh voice. (Previously a
   * delayed cleanup timer could delete the *new* voice, leaving it stuck on.)
   *
   * @param noteId    - ID of the note to stop
   * @param immediate - If true, fade out almost instantly instead of the full release
   */
  stopNote(noteId: string, immediate: boolean = false): void {
    const active = this.activeNotes.get(noteId);
    if (!active || !this.context) return;

    this.activeNotes.delete(noteId);

    const now = this.context.currentTime;
    const releaseTime = immediate ? QUICK_RELEASE : this.envelope.release;
    const { oscillators, gainNode, filterNode } = active;

    // Freeze the envelope at its current level, then ramp down to silence.
    // The level is computed rather than read from gain.value, which not
    // every browser updates while an automation ramp is running.
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(this.getEnvelopeLevel(active, now), now);
    gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);

    oscillators.forEach((osc) => {
      try { osc.stop(now + releaseTime + 0.05); } catch { /* already stopped */ }
    });

    // Free the audio graph once the voice has gone silent
    oscillators[0].onended = () => {
      oscillators.forEach((osc) => osc.disconnect());
      gainNode.disconnect();
      filterNode.disconnect();
    };
  }

  /** Quickly fade out every currently held note */
  stopAllNotes(): void {
    Array.from(this.activeNotes.keys()).forEach((noteId) => this.stopNote(noteId, true));
  }

  /**
   * Set the master volume level.
   * Safe to call before `init()` — the value is applied when the context is created.
   * @param volume - Volume from 0 (silent) to 1 (full)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.context) {
      // Short glide avoids "zipper" noise while dragging the slider
      this.masterGain.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.01);
    }
  }

  /** Check if a specific note is currently held */
  isNotePlaying(noteId: string): boolean {
    return this.activeNotes.has(noteId);
  }

  /** Clean up: stop all notes and close the AudioContext */
  destroy(): void {
    this.stopAllNotes();
    if (this.context) {
      this.context.close().catch(() => { /* already closed */ });
      this.context = null;
      this.masterGain = null;
    }
  }

  /** Envelope gain that a held (not yet released) note has reached at `time` */
  private getEnvelopeLevel(note: ActiveNote, time: number): number {
    const { attack, decay, sustain } = this.envelope;
    const elapsed = time - note.startTime;

    if (elapsed <= 0) return 0;
    if (elapsed < attack) return elapsed / attack;
    if (elapsed < attack + decay) {
      return 1 - (1 - sustain) * ((elapsed - attack) / decay);
    }
    return sustain;
  }
}
