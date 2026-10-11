/**
 * @fileoverview Messages between the page and the transcription worker.
 *
 * The model runs in a Web Worker so the page (and the piano) stays
 * responsive during the minutes a long recording can take.
 *
 * ```
 *  page ── transcribe { samples (transferred), settings, modelUrl } ──► worker
 *  page ◄── backend { name } · progress { stage, fraction } ────────── worker
 *  page ◄── done { notes } | error { message } ─────────────────────── worker
 * ```
 */

import { PianoNoteEvent } from '@/types';
import { TranscriptionSettings } from './notes-from-frames';

/** Steps of a transcription, in order */
export type TranscriptionStage = 'reading' | 'decoding' | 'loading-model' | 'analyzing' | 'finding-notes';

export interface TranscribeRequest {
  type: 'transcribe';
  /** Mono samples at 22 050 Hz */
  samples: Float32Array;
  duration: number;
  settings: TranscriptionSettings;
  /** Absolute URL of the model's model.json */
  modelUrl: string;
}

export type WorkerMessage =
  | { type: 'backend'; name: string }
  | { type: 'progress'; stage: TranscriptionStage; fraction: number }
  | { type: 'done'; notes: PianoNoteEvent[] }
  | { type: 'error'; message: string };
