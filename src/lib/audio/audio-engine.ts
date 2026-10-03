/**
 * @fileoverview Web Audio API engine: owns the audio graph and every voice.
 *
 * ## Signal flow
 * ```
 *  voice ─┐
 *  voice ─┼─► voice bus ─► brilliance (high-shelf EQ) ─┬──────────────► master ─► compressor ─► 🔊
 *  voice ─┘                                            └─► reverb send ─► convolver ─┘   ▲
 *                                                                                      │
 *  metronome clicks ─► metronome gain ─────────────────────────────────────────────────┘
 * ```
 *
 * - Each note creates one voice per layer (see `synth-voice.ts`)
 * - Voices are tracked per note id so they can be released on key-up
 * - A polyphony limit fades out the oldest voices when too many are sounding
 * - Settings (volume, reverb, brilliance) can be set before the context
 *   exists; they're applied when it's created on the first user gesture
 */

import { Brilliance, PlayNoteOptions, ReverbType } from '@/types';
import {
  BRILLIANCE_FREQUENCY,
  BRILLIANCE_GAIN_DB,
  COMPRESSOR,
  DEFAULT_REVERB_LEVEL,
  DEFAULT_VOLUME,
  MAX_POLYPHONY,
  QUICK_RELEASE,
  REVERB_PRESETS,
} from '../constants';
import { createImpulseResponse } from './effects';
import { createVoice, SynthVoice } from './synth-voice';
import { getVoice } from './voices';

/** Older Safari only exposes the prefixed constructor */
type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class AudioEngine {
  private context: AudioContext | null = null;
  private voiceBus: GainNode | null = null;
  private brillianceFilter: BiquadFilterNode | null = null;
  private reverbSend: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private masterGain: GainNode | null = null;
  private metronomeGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private impulseCache = new Map<ReverbType, AudioBuffer>();

  /** Voices of each held note, keyed by note id ('C4') */
  private activeNotes = new Map<string, SynthVoice[]>();
  /** Every voice still producing sound (held or releasing), oldest first */
  private liveVoices: SynthVoice[] = [];

  private volume = DEFAULT_VOLUME;
  private reverb: ReverbType = 'hall';
  private reverbLevel = DEFAULT_REVERB_LEVEL;
  private brilliance: Brilliance = 'normal';
  private metronomeVolume = 0.6;

  /**
   * Create the AudioContext and master signal chain (first call only), and
   * resume the context if the browser suspended it.
   *
   * Must run inside a user gesture (autoplay policy). Synchronous on purpose:
   * awaiting `resume()` could let a quick key-up arrive before the note
   * exists, leaving it stuck on (ADR 0005).
   */
  init(): void {
    if (typeof window === 'undefined') return;

    if (!this.context) {
      const AudioContextCtor =
        window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioContextCtor) return;

      const ctx = new AudioContextCtor();
      this.context = ctx;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = COMPRESSOR.threshold;
      compressor.knee.value = COMPRESSOR.knee;
      compressor.ratio.value = COMPRESSOR.ratio;
      compressor.attack.value = COMPRESSOR.attack;
      compressor.release.value = COMPRESSOR.release;
      compressor.connect(ctx.destination);

      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(compressor);

      this.brillianceFilter = ctx.createBiquadFilter();
      this.brillianceFilter.type = 'highshelf';
      this.brillianceFilter.frequency.value = BRILLIANCE_FREQUENCY;
      this.brillianceFilter.gain.value = BRILLIANCE_GAIN_DB[this.brilliance];
      this.brillianceFilter.connect(this.masterGain);

      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0; // faded up by applyReverb()
      this.convolver = ctx.createConvolver();
      this.brillianceFilter.connect(this.reverbSend);
      this.reverbSend.connect(this.convolver);
      this.convolver.connect(this.masterGain);

      this.voiceBus = ctx.createGain();
      this.voiceBus.connect(this.brillianceFilter);

      this.metronomeGain = ctx.createGain();
      this.metronomeGain.gain.value = this.metronomeVolume;
      this.metronomeGain.connect(this.masterGain);

      this.noiseBuffer = this.createNoiseBuffer(ctx);
      this.applyReverb();
    }

    // Resume if suspended (autoplay policy, tab switch, iOS interruption)
    if (this.context.state !== 'running') {
      this.context.resume().catch(() => {
        /* retried on the next interaction */
      });
    }
  }

  /** Audio-clock time in seconds (0 before init) */
  get currentTime(): number {
    return this.context?.currentTime ?? 0;
  }

  /**
   * Start a note: one voice per layer, all tracked under `noteId`.
   *
   * @param noteId    - Unique identifier (e.g. 'C4')
   * @param frequency - Fundamental frequency in Hz (already tuned/transposed)
   */
  playNote(noteId: string, frequency: number, options: PlayNoteOptions): void {
    const context = this.context;
    if (!context || !this.voiceBus) return;

    // If this note is still held, cut it short first (prevent stacked duplicates)
    if (this.activeNotes.has(noteId)) {
      this.stopNote(noteId, true);
    }

    const now = context.currentTime;
    const voices = options.voices.map((layer) => {
      const voice = createVoice(context, this.voiceBus!, getVoice(layer.voice), {
        frequency,
        velocity: options.velocity,
        midi: options.midi,
        gain: layer.gain,
        soft: options.soft ?? false,
        startTime: now,
        noiseBuffer: this.noiseBuffer,
      });
      voice.onEnded = () => this.forgetVoice(voice);
      return voice;
    });

    this.activeNotes.set(noteId, voices);
    this.liveVoices.push(...voices);
    this.enforcePolyphony(now);
  }

  /**
   * Release a held note.
   *
   * The note is forgotten right away, so pressing the same key again during
   * the release tail starts a fresh voice instead of fighting over the old one.
   *
   * @param immediate - Fade out almost instantly instead of the voice's release time
   */
  stopNote(noteId: string, immediate: boolean = false): void {
    const voices = this.activeNotes.get(noteId);
    if (!voices || !this.context) return;

    this.activeNotes.delete(noteId);
    const now = this.context.currentTime;
    voices.forEach((voice) => voice.release(now, immediate ? QUICK_RELEASE : undefined));
  }

  /** Quickly fade out every held note */
  stopAllNotes(): void {
    Array.from(this.activeNotes.keys()).forEach((noteId) => this.stopNote(noteId, true));
  }

  /** Check if a note is currently held */
  isNotePlaying(noteId: string): boolean {
    return this.activeNotes.has(noteId);
  }

  /** Number of voices still producing sound (held or fading) */
  get voiceCount(): number {
    return this.liveVoices.length;
  }

  /** Master volume (0–1). Safe before init. */
  setVolume(volume: number): void {
    this.volume = clamp01(volume);
    if (this.masterGain && this.context) {
      // Short glide avoids "zipper" noise while dragging the control
      this.masterGain.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.01);
    }
  }

  /** Reverb room and amount (0–1). Safe before init. */
  setReverb(type: ReverbType, level: number): void {
    this.reverb = type;
    this.reverbLevel = clamp01(level);
    this.applyReverb();
  }

  /** Tone control. Safe before init. */
  setBrilliance(brilliance: Brilliance): void {
    this.brilliance = brilliance;
    if (this.brillianceFilter && this.context) {
      this.brillianceFilter.gain.setTargetAtTime(
        BRILLIANCE_GAIN_DB[brilliance],
        this.context.currentTime,
        0.02
      );
    }
  }

  /** Metronome click volume (0–1). Safe before init. */
  setMetronomeVolume(volume: number): void {
    this.metronomeVolume = clamp01(volume);
    if (this.metronomeGain && this.context) {
      this.metronomeGain.gain.setTargetAtTime(this.metronomeVolume, this.context.currentTime, 0.01);
    }
  }

  /**
   * Schedule a metronome click at an exact audio-clock time.
   * Accented clicks (the first beat of a bar) are higher and louder.
   */
  scheduleClick(time: number, accent: boolean): void {
    const context = this.context;
    if (!context || !this.metronomeGain) return;

    const osc = context.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(accent ? 1760 : 1175, time);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(accent ? 1 : 0.6, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

    osc.connect(gain);
    gain.connect(this.metronomeGain);
    osc.start(time);
    osc.stop(time + 0.07);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /** Stop everything and close the AudioContext */
  destroy(): void {
    this.stopAllNotes();
    if (this.context) {
      this.context.close().catch(() => { /* already closed */ });
      this.context = null;
      this.voiceBus = null;
      this.masterGain = null;
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────

  /** Fade out the oldest voices while more than MAX_POLYPHONY are sounding */
  private enforcePolyphony(now: number): void {
    while (this.liveVoices.length > MAX_POLYPHONY) {
      const oldest = this.liveVoices.shift()!;
      oldest.release(now, QUICK_RELEASE);
    }
  }

  private forgetVoice(voice: SynthVoice): void {
    const index = this.liveVoices.indexOf(voice);
    if (index !== -1) this.liveVoices.splice(index, 1);
  }

  private applyReverb(): void {
    if (!this.context || !this.reverbSend || !this.convolver) return;
    const now = this.context.currentTime;

    if (this.reverb === 'off') {
      this.reverbSend.gain.setTargetAtTime(0, now, 0.02);
      return;
    }

    // Impulse responses are generated once per room and reused
    let impulse = this.impulseCache.get(this.reverb);
    if (!impulse) {
      impulse = createImpulseResponse(this.context, REVERB_PRESETS[this.reverb]);
      this.impulseCache.set(this.reverb, impulse);
    }
    if (this.convolver.buffer !== impulse) this.convolver.buffer = impulse;
    this.reverbSend.gain.setTargetAtTime(this.reverbLevel, now, 0.02);
  }

  /** Half a second of white noise, shared by every hammer/pluck transient */
  private createNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}
