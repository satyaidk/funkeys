/**
 * @fileoverview The work done inside the transcription worker.
 *
 * Kept apart from the worker entry file (which wires `self.onmessage` and
 * imports TensorFlow.js) so it can be tested with a fake model.
 *
 * ```
 *  prepare backend (WebGL GPU, else CPU) ─► load model ─► run it over the
 *  audio, window by window (frames + onsets) ─► decode notes in chunks ─►
 *  piano notes
 * ```
 */

import { PianoNoteEvent } from '@/types';
import { decodeNotes, NoteDecoder, toPianoNotes } from './notes-from-frames';
import { TranscribeRequest, WorkerMessage } from './worker-protocol';

/** The Basic Pitch model object: runs the network over audio */
export interface PitchModel {
  evaluateModel(
    audio: Float32Array,
    onComplete: (frames: number[][], onsets: number[][], contours: number[][]) => void,
    onPercent: (percent: number) => void
  ): Promise<void>;
}

/** What the worker needs from TensorFlow.js and Basic Pitch */
export interface ModelRuntime {
  /** Pick the fastest backend that works here. @returns its name */
  prepare(): Promise<string>;
  load(modelUrl: string): Promise<PitchModel>;
  decoder: NoteDecoder;
}

/** Run a transcription request, reporting progress through `post` */
export async function runTranscription(
  request: TranscribeRequest,
  runtime: ModelRuntime,
  post: (message: WorkerMessage) => void
): Promise<PianoNoteEvent[]> {
  post({ type: 'progress', stage: 'loading-model', fraction: 0 });
  post({ type: 'backend', name: await runtime.prepare() });
  const model = await runtime.load(request.modelUrl);
  post({ type: 'progress', stage: 'loading-model', fraction: 1 });

  // The model's output for every frame; the third output (pitch bends) isn't needed for a piano
  const frames: number[][] = [];
  const onsets: number[][] = [];
  let reported = -1;
  await model.evaluateModel(
    request.samples,
    (f, o) => {
      for (const row of f) frames.push(row);
      for (const row of o) onsets.push(row);
    },
    (percent) => {
      // Throttle: one message per percent is plenty
      if (percent - reported >= 0.01 || percent >= 1) {
        reported = percent;
        post({ type: 'progress', stage: 'analyzing', fraction: percent });
      }
    }
  );

  post({ type: 'progress', stage: 'finding-notes', fraction: 0 });
  const timed = decodeNotes(frames, onsets, request.settings, runtime.decoder, (fraction) =>
    post({ type: 'progress', stage: 'finding-notes', fraction })
  );
  const notes = toPianoNotes(timed, request.duration, request.settings);
  post({ type: 'done', notes });
  return notes;
}
