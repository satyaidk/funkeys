/**
 * @fileoverview Which audio files the Audio to Piano page accepts, and why not.
 *
 * Decoding is done by the browser (`decodeAudioData`), so what can be read
 * depends on the browser: WAV and MP3 work everywhere; OGG, FLAC, M4A/AAC
 * and WebM work in most. `canPlayType` asks the browser before decoding,
 * so the user gets a clear message instead of a cryptic failure.
 *
 * Limits keep the work inside what a phone or laptop can hold in memory:
 * the whole recording is decoded at once, then analyzed.
 */

import { formatBytes, formatSeconds } from '../format';

/** Largest file accepted */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

/** Longest recording accepted (10 minutes) */
export const MAX_DURATION_SECONDS = 10 * 60;

/** Shortest recording worth analyzing */
export const MIN_DURATION_SECONDS = 0.5;

export interface AudioFormat {
  label: string;
  extensions: readonly string[];
  mimeTypes: readonly string[];
  /** MIME type to ask `canPlayType` about */
  probe: string;
}

export const AUDIO_FORMATS: readonly AudioFormat[] = [
  { label: 'WAV', extensions: ['wav', 'wave'], mimeTypes: ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'], probe: 'audio/wav' },
  { label: 'MP3', extensions: ['mp3'], mimeTypes: ['audio/mpeg', 'audio/mp3'], probe: 'audio/mpeg' },
  { label: 'OGG', extensions: ['ogg', 'oga', 'opus'], mimeTypes: ['audio/ogg', 'audio/opus'], probe: 'audio/ogg' },
  { label: 'FLAC', extensions: ['flac'], mimeTypes: ['audio/flac', 'audio/x-flac'], probe: 'audio/flac' },
  { label: 'M4A', extensions: ['m4a', 'aac', 'mp4'], mimeTypes: ['audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/m4a'], probe: 'audio/mp4' },
  { label: 'WebM', extensions: ['webm'], mimeTypes: ['audio/webm'], probe: 'audio/webm' },
];

/** Does this browser say it can decode a MIME type? */
export type DecoderSupport = (mimeType: string) => boolean;

/** The browser's own answer, from an `<audio>` element ("maybe"/"probably" count as yes) */
export function browserSupport(): DecoderSupport {
  if (typeof document === 'undefined') return () => true;
  const audio = document.createElement('audio');
  return (type) => (typeof audio.canPlayType === 'function' ? audio.canPlayType(type) !== '' : true);
}

/** Formats this browser can decode */
export function supportedFormats(support: DecoderSupport = () => true): AudioFormat[] {
  return AUDIO_FORMATS.filter((f) => f.label === 'WAV' || f.label === 'MP3' || support(f.probe));
}

/** Value for `<input type="file" accept>` */
export function acceptAttribute(formats: readonly AudioFormat[]): string {
  return formats.flatMap((f) => [...f.extensions.map((e) => `.${e}`), ...f.mimeTypes]).join(',');
}

export type FileCheck = { ok: true; format: AudioFormat } | { ok: false; reason: string };

const listFormats = (formats: readonly AudioFormat[]) => formats.map((f) => f.label).join(', ');

/** Check a file before reading it: size, type, and whether this browser can decode it */
export function checkAudioFile(
  file: { name: string; type: string; size: number },
  support: DecoderSupport = () => true
): FileCheck {
  if (file.size === 0) return { ok: false, reason: 'This file is empty.' };
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: `This file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)}: try a shorter or compressed (MP3) recording.`,
    };
  }

  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  const type = file.type.toLowerCase().split(';')[0].trim();
  const format = AUDIO_FORMATS.find((f) => f.mimeTypes.includes(type) || f.extensions.includes(extension));
  if (!format) {
    return { ok: false, reason: `That isn’t an audio file this page can read. Use ${listFormats(supportedFormats(support))}.` };
  }
  if (!supportedFormats(support).includes(format)) {
    return { ok: false, reason: `This browser can’t decode ${format.label} files. Try WAV or MP3.` };
  }
  return { ok: true, format };
}

/** Check the recording's length. @returns a message, or null if it's fine */
export function checkDuration(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'This recording has no audio.';
  if (seconds < MIN_DURATION_SECONDS) return 'This recording is too short to analyze.';
  if (seconds > MAX_DURATION_SECONDS) {
    return `This recording is ${formatSeconds(seconds)} long. The limit is ${formatSeconds(MAX_DURATION_SECONDS)}: trim it and try again.`;
  }
  return null;
}
