/**
 * @fileoverview Environment fix-ups for TensorFlow.js 3 inside a Web Worker.
 *
 * Imported first by the worker. TensorFlow.js 3.21 (the version Basic Pitch
 * depends on) waits for GPU results with `setTimeoutCustom`, which tests
 * `window && …`. A worker has no `window` at all, so that line throws a
 * ReferenceError inside a timer and the transcription hangs forever.
 * (TensorFlow.js 4 checks `typeof window` instead.)
 *
 * Declaring a global `window` whose value is `undefined` makes `window && …`
 * simply false, falling back to a plain setTimeout, while `typeof window`
 * still reads "undefined", so every other environment check is unchanged.
 */

const scope = globalThis as { window?: unknown };
if (!('window' in scope)) {
  Object.defineProperty(scope, 'window', { value: undefined, writable: true, configurable: true });
}

export {};
