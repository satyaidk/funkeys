import { describe, it, expect, vi } from 'vitest';
import { noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch/esm/toMidi';
import {
  overallProgress,
  TranscriberDeps,
  TranscriptionError,
  TranscriptionProgress,
  transcribeFile,
  WorkerLike,
} from './transcriber';
import { runTranscription, ModelRuntime } from './run-model';
import { DEFAULT_TRANSCRIPTION_SETTINGS, MODEL_SAMPLE_RATE } from './notes-from-frames';
import { TranscribeRequest, WorkerMessage } from './worker-protocol';
import { MAX_DURATION_SECONDS } from './audio-file';

/** A stand-in for the Web Worker: records what it's sent; the test plays its replies */
class FakeWorker implements WorkerLike {
  onmessage: WorkerLike['onmessage'] = null;
  onerror: WorkerLike['onerror'] = null;
  posted: Array<{ message: TranscribeRequest; transfer: Transferable[] }> = [];
  terminated = false;
  postMessage(message: TranscribeRequest, transfer: Transferable[]) {
    this.posted.push({ message, transfer });
  }
  terminate() {
    this.terminated = true;
  }
  reply(message: WorkerMessage) {
    this.onmessage?.({ data: message } as MessageEvent<WorkerMessage>);
  }
}

function setup(overrides: Partial<TranscriberDeps> = {}) {
  const worker = new FakeWorker();
  const deps: TranscriberDeps = {
    createWorker: () => worker,
    decode: vi.fn(async () => ({ samples: new Float32Array(MODEL_SAMPLE_RATE * 5), duration: 5, sampleRate: MODEL_SAMPLE_RATE })),
    readDuration: vi.fn(async () => 5),
    support: () => true,
    modelUrl: 'https://example.test/models/basic-pitch/model.json',
    ...overrides,
  };
  return { worker, deps };
}

const wav = () => new File([new Uint8Array(1000)], 'take.wav', { type: 'audio/wav' });

describe('transcribeFile', () => {
  it('decodes, runs the model in a worker and returns validated notes with the full duration', async () => {
    const { worker, deps } = setup();
    const progress: TranscriptionProgress[] = [];
    const result = transcribeFile(wav(), DEFAULT_TRANSCRIPTION_SETTINGS, { onProgress: (p) => progress.push(p) }, deps);

    await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
    const { message, transfer } = worker.posted[0];
    expect(message).toMatchObject({ type: 'transcribe', duration: 5, modelUrl: deps.modelUrl });
    expect(transfer).toEqual([message.samples.buffer]); // handed over, not copied

    worker.reply({ type: 'backend', name: 'webgl' });
    worker.reply({ type: 'progress', stage: 'analyzing', fraction: 0.5 });
    worker.reply({
      type: 'done',
      notes: [
        { id: 'b', midi: 64, startTime: 1, endTime: 2, velocity: 0.7 },
        { id: 'a', midi: 60, startTime: 0.5, endTime: 1, velocity: 0.9 },
        { id: 'bad', midi: 60, startTime: 3, endTime: 2, velocity: 1 }, // invalid: dropped
      ],
    });

    await expect(result).resolves.toMatchObject({
      duration: 5,
      fileName: 'take.wav',
      backend: 'webgl',
      dropped: 1,
      notes: [{ id: 'a' }, { id: 'b' }],
    });
    expect(worker.terminated).toBe(true);
    // Progress moves forward through the stages
    const fractions = progress.map((p) => p.fraction);
    expect(fractions).toEqual([...fractions].sort((a, b) => a - b));
    expect(progress.map((p) => p.stage)).toContain('analyzing');
  });

  it('rejects a file that is not audio without decoding it', async () => {
    const { deps } = setup();
    const pdf = new File([new Uint8Array(10)], 'score.pdf', { type: 'application/pdf' });
    await expect(transcribeFile(pdf, DEFAULT_TRANSCRIPTION_SETTINGS, {}, deps)).rejects.toMatchObject({ kind: 'invalid' });
    expect(deps.decode).not.toHaveBeenCalled();
  });

  it('rejects a recording that is too long from its header, before decoding it', async () => {
    const { deps } = setup({ readDuration: async () => MAX_DURATION_SECONDS + 60 });
    await expect(transcribeFile(wav(), DEFAULT_TRANSCRIPTION_SETTINGS, {}, deps)).rejects.toThrow(/limit is 10:00/);
    expect(deps.decode).not.toHaveBeenCalled();
  });

  it('checks the length again after decoding when the header did not say', async () => {
    const { deps } = setup({
      readDuration: async () => NaN,
      decode: async () => ({ samples: new Float32Array(10), duration: 0.1, sampleRate: MODEL_SAMPLE_RATE }),
    });
    await expect(transcribeFile(wav(), DEFAULT_TRANSCRIPTION_SETTINGS, {}, deps)).rejects.toThrow(/too short/);
  });

  it('explains a file the browser cannot decode', async () => {
    const { deps } = setup({ decode: async () => Promise.reject(new Error('This file couldn’t be decoded.')) });
    await expect(transcribeFile(wav(), DEFAULT_TRANSCRIPTION_SETTINGS, {}, deps)).rejects.toMatchObject({
      kind: 'decode',
      message: 'This file couldn’t be decoded.',
    });
  });

  it('reports an engine failure and stops the worker', async () => {
    const { worker, deps } = setup();
    const result = transcribeFile(wav(), DEFAULT_TRANSCRIPTION_SETTINGS, {}, deps);
    await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
    worker.reply({ type: 'error', message: 'The transcription engine failed: out of memory' });
    await expect(result).rejects.toMatchObject({ kind: 'engine', message: expect.stringMatching(/out of memory/) });
    expect(worker.terminated).toBe(true);
  });

  it('reports a worker that cannot start (e.g. its script failed to load)', async () => {
    const { worker, deps } = setup();
    const result = transcribeFile(wav(), DEFAULT_TRANSCRIPTION_SETTINGS, {}, deps);
    await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
    worker.onerror?.(new ErrorEvent('error'));
    await expect(result).rejects.toBeInstanceOf(TranscriptionError);
  });

  // Regression: a library error inside a timer once left the page waiting forever
  it('gives up when the worker goes silent', async () => {
    const { worker, deps } = setup({ stallTimeoutMs: 30 });
    const result = transcribeFile(wav(), DEFAULT_TRANSCRIPTION_SETTINGS, {}, deps);
    await expect(result).rejects.toMatchObject({ kind: 'engine', message: expect.stringMatching(/stopped responding/) });
    expect(worker.terminated).toBe(true);
  });

  it('cancels: terminates the worker and rejects as cancelled', async () => {
    const { worker, deps } = setup();
    const controller = new AbortController();
    const result = transcribeFile(wav(), DEFAULT_TRANSCRIPTION_SETTINGS, { signal: controller.signal }, deps);
    await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
    controller.abort();
    await expect(result).rejects.toMatchObject({ kind: 'cancelled' });
    expect(worker.terminated).toBe(true);
  });

  it('maps each stage onto its share of the progress bar', () => {
    expect(overallProgress('reading', 0)).toBe(0);
    expect(overallProgress('analyzing', 0)).toBeLessThan(overallProgress('analyzing', 1));
    expect(overallProgress('finding-notes', 1)).toBe(1);
    expect(overallProgress('decoding', 5)).toBe(overallProgress('decoding', 1));
  });
});

describe('runTranscription (inside the worker)', () => {
  it('loads the model, listens window by window and returns piano notes', async () => {
    // Two model windows of output: a C4 that starts in the first and rings into the second
    const window = (fill: (t: number, row: number[]) => void) =>
      Array.from({ length: 100 }, (_, t) => {
        const row = new Array<number>(88).fill(0.02);
        fill(t, row);
        return row;
      });
    const key = 60 - 21;
    const frames = [window((t, r) => t >= 10 && (r[key] = 0.85)), window((t, r) => t < 20 && (r[key] = 0.85))];
    const onsets = [window((t, r) => t === 10 && (r[key] = 0.95)), window(() => {})];

    const runtime: ModelRuntime = {
      prepare: async () => 'cpu',
      load: async () => ({
        evaluateModel: async (_audio, onComplete, onPercent) => {
          onPercent(0);
          onComplete(frames[0], onsets[0], []);
          onPercent(0.5);
          onComplete(frames[1], onsets[1], []);
          onPercent(1);
        },
      }),
      decoder: { outputToNotesPoly, noteFramesToTime },
    };
    const posted: WorkerMessage[] = [];
    const request: TranscribeRequest = {
      type: 'transcribe',
      samples: new Float32Array(10),
      duration: 3,
      settings: DEFAULT_TRANSCRIPTION_SETTINGS,
      modelUrl: 'x',
    };
    const notes = await runTranscription(request, runtime, (m) => posted.push(m));

    expect(notes).toHaveLength(1);
    expect(notes[0].midi).toBe(60);
    expect(notes[0].endTime - notes[0].startTime).toBeGreaterThan(1); // spans both windows (~110 frames)
    expect(posted[1]).toEqual({ type: 'backend', name: 'cpu' });
    expect(posted.filter((m) => m.type === 'progress').map((m) => m.type === 'progress' && m.stage)).toEqual(
      expect.arrayContaining(['loading-model', 'analyzing', 'finding-notes'])
    );
    expect(posted.at(-1)).toEqual({ type: 'done', notes });
  });
});
