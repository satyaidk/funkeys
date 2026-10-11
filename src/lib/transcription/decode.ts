/**
 * @fileoverview Turn an audio file into the samples the model analyzes.
 *
 * Basic Pitch listens to **mono audio at 22 050 Hz**. The browser decodes
 * the file (WAV, MP3…) with `decodeAudioData`; decoding into an
 * OfflineAudioContext running at 22 050 Hz resamples it on the way, which
 * also halves the memory a 44.1 kHz recording would take. The channels are
 * then averaged into one.
 *
 * The original recording is only read here: nothing is stored or uploaded.
 */

import { MODEL_SAMPLE_RATE } from './notes-from-frames';

export interface DecodedAudio {
  /** Mono samples at MODEL_SAMPLE_RATE */
  samples: Float32Array;
  /** Length of the recording in seconds */
  duration: number;
  sampleRate: number;
}

/** The parts of an AudioBuffer used here */
export interface AudioBufferLike {
  numberOfChannels: number;
  length: number;
  duration: number;
  getChannelData(channel: number): Float32Array;
}

/** Average every channel into one */
export function downmix(buffer: AudioBufferLike): Float32Array {
  const channels = buffer.numberOfChannels;
  if (channels === 1) return buffer.getChannelData(0).slice();
  const mono = new Float32Array(buffer.length);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < mono.length; i++) mono[i] += data[i] / channels;
  }
  return mono;
}

type WindowWithWebkitOffline = Window & { webkitOfflineAudioContext?: typeof OfflineAudioContext };

/**
 * Decode a file's bytes to mono samples at the model's rate.
 * @throws Error with a readable message if the browser can't decode it
 */
export async function decodeForAnalysis(data: ArrayBuffer): Promise<DecodedAudio> {
  const Offline = window.OfflineAudioContext ?? (window as WindowWithWebkitOffline).webkitOfflineAudioContext;
  if (!Offline) throw new Error('This browser can’t decode audio (no Web Audio support).');
  const context = new Offline(1, 1, MODEL_SAMPLE_RATE);

  let buffer: AudioBuffer;
  try {
    // Older Safari only supports the callback form
    buffer = await new Promise<AudioBuffer>((resolve, reject) => {
      const result = context.decodeAudioData(data, resolve, reject);
      if (result && typeof result.then === 'function') result.then(resolve, reject);
    });
  } catch {
    throw new Error('This file couldn’t be decoded. It may be damaged, or in a format this browser can’t read. Try WAV or MP3.');
  }
  return { samples: downmix(buffer), duration: buffer.duration, sampleRate: MODEL_SAMPLE_RATE };
}

/**
 * The length of an audio file from its header, without decoding it, so a
 * recording that's too long is rejected before it fills the memory.
 * @returns seconds, or NaN if the browser can't tell
 */
export function readDuration(file: Blob, timeoutMs = 8000): Promise<number> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
      resolve(NaN);
      return;
    }
    const url = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    const finish = (seconds: number) => {
      clearTimeout(timer);
      audio.removeAttribute('src');
      URL.revokeObjectURL(url);
      resolve(seconds);
    };
    const timer = setTimeout(() => finish(NaN), timeoutMs);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? audio.duration : NaN);
    audio.onerror = () => finish(NaN);
    audio.src = url;
  });
}
