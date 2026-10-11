/**
 * @fileoverview Web Worker entry: runs Spotify's Basic Pitch model off the
 * main thread.
 *
 * Loaded only when someone transcribes a recording, so TensorFlow.js
 * (about a megabyte of code) never slows down the piano itself. Each
 * transcription gets a fresh worker, which is terminated afterwards (or
 * when cancelled): that frees every tensor and the GPU context at once.
 */

// Must come first: makes TensorFlow.js 3 work inside a worker (see the file)
import './worker-shims';
import * as tf from '@tensorflow/tfjs';
import { BasicPitch, noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch';
import { ModelRuntime, runTranscription } from './run-model';
import { TranscribeRequest, WorkerMessage } from './worker-protocol';

/** The worker's global scope, typed for what's used here */
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<TranscribeRequest>) => void) | null;
  postMessage(message: WorkerMessage): void;
  addEventListener(type: 'error' | 'unhandledrejection', listener: (event: ErrorEvent & PromiseRejectionEvent) => void): void;
};

/** Report anything that escapes (a failure inside a library timer) instead of hanging silently */
const reportFailure = (detail: unknown) => {
  const message = detail instanceof Error ? detail.message : String(detail ?? 'unknown error');
  scope.postMessage({ type: 'error', message: `The transcription engine failed: ${message}` });
};
scope.addEventListener('error', (event) => reportFailure(event.error ?? event.message));
scope.addEventListener('unhandledrejection', (event) => reportFailure(event.reason));

const runtime: ModelRuntime = {
  async prepare() {
    // WebGL runs the network on the GPU (via OffscreenCanvas); the CPU works everywhere but is much slower
    for (const backend of ['webgl', 'cpu']) {
      try {
        if (await tf.setBackend(backend)) {
          await tf.ready();
          return backend;
        }
      } catch {
        /* not available here: try the next one */
      }
    }
    return tf.getBackend();
  },
  async load(modelUrl) {
    const basicPitch = new BasicPitch(modelUrl);
    await basicPitch.model; // fetch and compile now, so errors surface here
    return basicPitch;
  },
  decoder: { outputToNotesPoly, noteFramesToTime },
};

scope.onmessage = (event) => {
  if (event.data?.type !== 'transcribe') return;
  runTranscription(event.data, runtime, (message) => scope.postMessage(message)).catch(reportFailure);
};
