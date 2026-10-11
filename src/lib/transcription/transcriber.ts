/**
 * @fileoverview Audio to Piano: transcribe a recording into piano notes.
 *
 * Runs entirely in the browser (ADR 0014): the recording never leaves the
 * device, there's no server, no upload limit and no API key.
 *
 * ```
 *  File ─► check type & size ─► read length from the header ─► decode to
 *  22 050 Hz mono ─► worker: Basic Pitch model ─► notes ─► validate ─► result
 * ```
 *
 * Progress comes in stages, each a share of the whole bar, and the job can
 * be cancelled at any point (the worker is terminated).
 */

import { PianoNoteEvent, PianoTranscription } from '@/types';
import { sanitizeNoteEvents } from '../music/note-events';
import { browserSupport, checkAudioFile, checkDuration, DecoderSupport } from './audio-file';
import { decodeForAnalysis, DecodedAudio, readDuration } from './decode';
import { TranscriptionSettings } from './notes-from-frames';
import { TranscribeRequest, TranscriptionStage, WorkerMessage } from './worker-protocol';

export type { TranscriptionStage } from './worker-protocol';

export const STAGE_LABELS: Record<TranscriptionStage, string> = {
  reading: 'Reading the file',
  decoding: 'Decoding the audio',
  'loading-model': 'Loading the transcription model',
  analyzing: 'Listening for notes',
  'finding-notes': 'Writing out the notes',
};

/** Share of the progress bar each stage covers (listening takes by far the longest) */
const STAGE_SPAN: Record<TranscriptionStage, [number, number]> = {
  reading: [0, 0.02],
  decoding: [0.02, 0.08],
  'loading-model': [0.08, 0.12],
  analyzing: [0.12, 0.9],
  'finding-notes': [0.9, 1],
};

/** Overall progress (0–1) from a stage and how far through it we are */
export function overallProgress(stage: TranscriptionStage, fraction: number): number {
  const [from, to] = STAGE_SPAN[stage];
  return from + (to - from) * Math.min(1, Math.max(0, fraction));
}

export interface TranscriptionProgress {
  stage: TranscriptionStage;
  /** Overall progress, 0–1 */
  fraction: number;
  /** Where the model runs, once known: 'webgl' (GPU) or 'cpu' */
  backend?: string;
}

export interface TranscriptionResult extends PianoTranscription {
  fileName: string;
  /** Where the model ran: 'webgl' (GPU) or 'cpu' */
  backend: string;
  /** Detected notes rejected as invalid (should be 0) */
  dropped: number;
}

export type TranscriptionErrorKind = 'invalid' | 'decode' | 'engine' | 'cancelled';

export class TranscriptionError extends Error {
  constructor(
    message: string,
    readonly kind: TranscriptionErrorKind
  ) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

/** The parts of a Worker used here (tests pass a fake) */
export interface WorkerLike {
  postMessage(message: TranscribeRequest, transfer: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<WorkerMessage>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export interface TranscriberDeps {
  createWorker(): WorkerLike;
  decode(data: ArrayBuffer): Promise<DecodedAudio>;
  readDuration(file: Blob): Promise<number>;
  support: DecoderSupport;
  /** Absolute URL of the model's model.json */
  modelUrl: string;
  /** Give up if the worker says nothing for this long (ms) */
  stallTimeoutMs?: number;
}

/**
 * The worker reports progress at least every few seconds, even on a slow
 * CPU (one model window is 2 s of audio). Silence this long means it hung.
 */
export const STALL_TIMEOUT_MS = 90_000;

/** Where the model is served from (see scripts/sync-basic-pitch-model.mjs) */
export const MODEL_PATH = '/models/basic-pitch/model.json';

/** The real browser implementations */
export function browserTranscriberDeps(): TranscriberDeps {
  return {
    createWorker: () =>
      new Worker(new URL('./transcription.worker.ts', import.meta.url), {
        type: 'module',
        name: 'funkeys-transcription',
      }) as unknown as WorkerLike,
    decode: decodeForAnalysis,
    readDuration,
    support: browserSupport(),
    modelUrl: new URL(MODEL_PATH, window.location.href).href,
  };
}

export interface TranscribeOptions {
  signal?: AbortSignal;
  onProgress?: (progress: TranscriptionProgress) => void;
}

const cancelled = () => new TranscriptionError('Transcription cancelled.', 'cancelled');

/**
 * Transcribe a piano recording.
 * @throws TranscriptionError with a message to show the user
 */
export async function transcribeFile(
  file: File,
  settings: TranscriptionSettings,
  { signal, onProgress }: TranscribeOptions = {},
  deps: TranscriberDeps = browserTranscriberDeps()
): Promise<TranscriptionResult> {
  let backendName: string | undefined;
  const report = (stage: TranscriptionStage, fraction: number, backend?: string) => {
    backendName = backend ?? backendName;
    onProgress?.({ stage, fraction: overallProgress(stage, fraction), backend: backendName });
  };
  const checkAbort = () => {
    if (signal?.aborted) throw cancelled();
  };

  const check = checkAudioFile(file, deps.support);
  if (!check.ok) throw new TranscriptionError(check.reason, 'invalid');

  // Reject a recording that's too long before decoding fills the memory
  report('reading', 0);
  const headerDuration = await deps.readDuration(file);
  if (Number.isFinite(headerDuration)) {
    const problem = checkDuration(headerDuration);
    if (problem) throw new TranscriptionError(problem, 'invalid');
  }
  checkAbort();
  const data = await file.arrayBuffer();
  report('reading', 1);
  checkAbort();

  report('decoding', 0);
  let audio: DecodedAudio;
  try {
    audio = await deps.decode(data);
  } catch (error) {
    throw new TranscriptionError((error as Error).message, 'decode');
  }
  const problem = checkDuration(audio.duration);
  if (problem) throw new TranscriptionError(problem, 'invalid');
  report('decoding', 1);
  checkAbort();

  const { notes: raw, backend } = await runWorker(
    deps,
    { type: 'transcribe', samples: audio.samples, duration: audio.duration, settings, modelUrl: deps.modelUrl },
    report,
    signal
  );

  // Never trust data crossing a boundary: validate the worker's notes too
  const { notes, dropped } = sanitizeNoteEvents(raw);
  return { duration: audio.duration, sampleRate: audio.sampleRate, notes, fileName: file.name, backend, dropped };
}

function runWorker(
  deps: TranscriberDeps,
  request: TranscribeRequest,
  report: (stage: TranscriptionStage, fraction: number, backend?: string) => void,
  signal?: AbortSignal
): Promise<{ notes: PianoNoteEvent[]; backend: string }> {
  return new Promise((resolve, reject) => {
    let worker: WorkerLike;
    try {
      worker = deps.createWorker();
    } catch {
      reject(new TranscriptionError('This browser can’t run the transcription engine (no Web Worker support).', 'engine'));
      return;
    }
    let backend = 'unknown';
    let lastHeard = Date.now();
    const stallMs = deps.stallTimeoutMs ?? STALL_TIMEOUT_MS;
    const watchdog = setInterval(() => {
      if (Date.now() - lastHeard < stallMs) return;
      finish();
      reject(new TranscriptionError('The transcription engine stopped responding. Try again, or try a shorter recording.', 'engine'));
    }, Math.min(5000, stallMs));

    const finish = () => {
      clearInterval(watchdog);
      worker.terminate(); // frees the model, its tensors and the GPU context
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      finish();
      reject(cancelled());
    };
    signal?.addEventListener('abort', onAbort);

    worker.onmessage = ({ data }) => {
      lastHeard = Date.now();
      switch (data.type) {
        case 'backend':
          backend = data.name;
          report('loading-model', 0.5, backend);
          break;
        case 'progress':
          report(data.stage, data.fraction);
          break;
        case 'done':
          finish();
          resolve({ notes: data.notes, backend });
          break;
        case 'error':
          finish();
          reject(new TranscriptionError(data.message, 'engine'));
          break;
      }
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      finish();
      reject(new TranscriptionError('The transcription engine couldn’t start. Check your connection and try again.', 'engine'));
    };

    // Hand the samples over without copying them (the page doesn't need them any more)
    worker.postMessage(request, [request.samples.buffer]);
  });
}
