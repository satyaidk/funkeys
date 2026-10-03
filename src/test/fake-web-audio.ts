/**
 * @fileoverview A minimal fake of the Web Audio API for tests.
 *
 * jsdom (the simulated browser used by Vitest) has no audio support, so
 * `new AudioContext()` would throw. This fake implements just the parts the
 * audio engine uses and *records* what happens — which nodes were created,
 * how they were connected, and every value scheduled on an AudioParam — so
 * tests can assert on the engine's behavior without producing sound.
 *
 * Usage:
 * ```ts
 * beforeEach(() => installFakeAudioContext());
 * // ...exercise code that creates an AudioContext...
 * const ctx = latestAudioContext();
 * ```
 */

import { vi } from 'vitest';

/** One call recorded on an AudioParam */
export interface ParamEvent {
  type: 'set' | 'linearRamp' | 'exponentialRamp' | 'target' | 'cancel';
  value?: number;
  time: number;
}

export class FakeAudioParam {
  value: number;
  events: ParamEvent[] = [];
  /** Nodes connected to this param (modulation, e.g. LFO → detune) */
  inputs = new Set<FakeAudioNode>();

  constructor(defaultValue: number) {
    this.value = defaultValue;
  }

  setValueAtTime(value: number, time: number) {
    this.events.push({ type: 'set', value, time });
    this.value = value;
    return this;
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: 'linearRamp', value, time });
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: 'exponentialRamp', value, time });
    return this;
  }

  setTargetAtTime(value: number, time: number) {
    this.events.push({ type: 'target', value, time });
    this.value = value;
    return this;
  }

  cancelScheduledValues(time: number) {
    this.events.push({ type: 'cancel', time });
    return this;
  }
}

export class FakeAudioNode {
  connections = new Set<FakeAudioNode | FakeAudioParam>();
  disconnected = false;

  connect<T extends FakeAudioNode | FakeAudioParam>(destination: T): T {
    this.connections.add(destination);
    if (destination instanceof FakeAudioParam) destination.inputs.add(this);
    return destination;
  }

  disconnect() {
    this.connections.clear();
    this.disconnected = true;
  }
}

export class FakeGainNode extends FakeAudioNode {
  gain = new FakeAudioParam(1);
}

export class FakeBiquadFilterNode extends FakeAudioNode {
  type = 'lowpass';
  frequency = new FakeAudioParam(350);
  Q = new FakeAudioParam(1);
  gain = new FakeAudioParam(0);
}

export class FakeStereoPannerNode extends FakeAudioNode {
  pan = new FakeAudioParam(0);
}

export class FakeConvolverNode extends FakeAudioNode {
  buffer: FakeAudioBuffer | null = null;
}

export class FakeDynamicsCompressorNode extends FakeAudioNode {
  threshold = new FakeAudioParam(-24);
  knee = new FakeAudioParam(30);
  ratio = new FakeAudioParam(12);
  attack = new FakeAudioParam(0.003);
  release = new FakeAudioParam(0.25);
}

export class FakeAudioBuffer {
  private channels: Float32Array[];

  constructor(
    public numberOfChannels: number,
    public length: number,
    public sampleRate: number
  ) {
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }

  getChannelData(channel: number) {
    return this.channels[channel];
  }
}

/** Shared start/stop bookkeeping for oscillators and buffer sources */
class FakeScheduledSource extends FakeAudioNode {
  startTime: number | null = null;
  stopTime: number | null = null;
  onended: (() => void) | null = null;

  start(time = 0) {
    this.startTime = time;
  }

  stop(time = 0) {
    this.stopTime = time;
  }

  /** Test helper: simulate the browser firing `ended` once playback stops */
  finish() {
    this.onended?.();
  }
}

export class FakeOscillatorNode extends FakeScheduledSource {
  type = 'sine';
  frequency = new FakeAudioParam(440);
  detune = new FakeAudioParam(0);
}

export class FakeAudioBufferSourceNode extends FakeScheduledSource {
  buffer: FakeAudioBuffer | null = null;
}

export class FakeAudioContext {
  /** Every context constructed since the fake was installed */
  static instances: FakeAudioContext[] = [];

  /** Seconds on the audio clock — tests move it forward manually */
  currentTime = 0;
  sampleRate = 8000; // small, so generated buffers stay cheap in tests
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  destination = new FakeAudioNode();

  gainNodes: FakeGainNode[] = [];
  oscillators: FakeOscillatorNode[] = [];
  filters: FakeBiquadFilterNode[] = [];
  panners: FakeStereoPannerNode[] = [];
  convolvers: FakeConvolverNode[] = [];
  compressors: FakeDynamicsCompressorNode[] = [];
  bufferSources: FakeAudioBufferSourceNode[] = [];
  buffers: FakeAudioBuffer[] = [];

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createGain() {
    const node = new FakeGainNode();
    this.gainNodes.push(node);
    return node;
  }

  createOscillator() {
    const node = new FakeOscillatorNode();
    this.oscillators.push(node);
    return node;
  }

  createBiquadFilter() {
    const node = new FakeBiquadFilterNode();
    this.filters.push(node);
    return node;
  }

  createStereoPanner() {
    const node = new FakeStereoPannerNode();
    this.panners.push(node);
    return node;
  }

  createConvolver() {
    const node = new FakeConvolverNode();
    this.convolvers.push(node);
    return node;
  }

  createDynamicsCompressor() {
    const node = new FakeDynamicsCompressorNode();
    this.compressors.push(node);
    return node;
  }

  createBufferSource() {
    const node = new FakeAudioBufferSourceNode();
    this.bufferSources.push(node);
    return node;
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    const buffer = new FakeAudioBuffer(channels, length, sampleRate);
    this.buffers.push(buffer);
    return buffer;
  }

  resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });

  close = vi.fn(() => {
    this.state = 'closed';
    return Promise.resolve();
  });
}

/** Replace the global AudioContext with the fake (undone automatically after each test) */
export function installFakeAudioContext() {
  FakeAudioContext.instances = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
}

/** The most recently created fake context (throws if none exists yet) */
export function latestAudioContext(): FakeAudioContext {
  const ctx = FakeAudioContext.instances.at(-1);
  if (!ctx) throw new Error('No AudioContext has been created');
  return ctx;
}

/** Oscillators that are not LFOs or FM modulators, i.e. connected to a gain node */
export function partialOscillators(ctx: FakeAudioContext): FakeOscillatorNode[] {
  return ctx.oscillators.filter((osc) =>
    [...osc.connections].some((c) => c instanceof FakeGainNode && ![...c.connections].some((d) => d instanceof FakeAudioParam))
  );
}
