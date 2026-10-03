/**
 * @fileoverview A minimal fake of the Web Audio API for tests.
 *
 * jsdom (the simulated browser used by Vitest) has no audio support, so
 * `new AudioContext()` would throw. This fake implements just the parts the
 * AudioEngine uses and *records* what happens — which nodes were created,
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
  type: 'set' | 'linearRamp' | 'target' | 'cancel';
  value?: number;
  time: number;
}

export class FakeAudioParam {
  value: number;
  events: ParamEvent[] = [];

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
  connections = new Set<FakeAudioNode>();
  disconnected = false;

  connect(destination: FakeAudioNode) {
    this.connections.add(destination);
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
}

export class FakeDynamicsCompressorNode extends FakeAudioNode {
  threshold = new FakeAudioParam(-24);
  knee = new FakeAudioParam(30);
  ratio = new FakeAudioParam(12);
  attack = new FakeAudioParam(0.003);
  release = new FakeAudioParam(0.25);
}

export class FakeOscillatorNode extends FakeAudioNode {
  type = 'sine';
  frequency = new FakeAudioParam(440);
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

export class FakeAudioContext {
  /** Every context constructed since the fake was installed */
  static instances: FakeAudioContext[] = [];

  /** Seconds on the audio clock — tests move it forward manually */
  currentTime = 0;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  destination = new FakeAudioNode();

  gainNodes: FakeGainNode[] = [];
  oscillators: FakeOscillatorNode[] = [];
  filters: FakeBiquadFilterNode[] = [];
  compressors: FakeDynamicsCompressorNode[] = [];

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

  createDynamicsCompressor() {
    const node = new FakeDynamicsCompressorNode();
    this.compressors.push(node);
    return node;
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
