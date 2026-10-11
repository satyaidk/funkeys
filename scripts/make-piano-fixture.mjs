/**
 * Renders a short piano-like recording with KNOWN notes, for testing the
 * Audio to Piano transcription end to end.
 *
 *   node scripts/make-piano-fixture.mjs
 *
 * Writes e2e/fixtures/piano-fixture.wav (22.05 kHz mono, 16-bit) and
 * e2e/fixtures/piano-fixture.json (the notes that were played).
 *
 * The sound is additive synthesis (8 partials, stretched like piano strings,
 * a hammer click and a natural decay), not a real piano recording, so it
 * tests the pipeline with exact ground truth. Deterministic: same file every run.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 22050;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'e2e', 'fixtures');

// [midi, start s, end s, velocity]: a melody, a silence, chords, overlaps
const NOTES = [
  // C major scale up, eighth notes at 100 BPM
  [60, 0.2, 0.5], [62, 0.5, 0.8], [64, 0.8, 1.1], [65, 1.1, 1.4],
  [67, 1.4, 1.7], [69, 1.7, 2.0], [71, 2.0, 2.3], [72, 2.3, 3.0],
  // 1.5 s of silence, then three chords
  [48, 4.5, 5.6], [60, 4.5, 5.6], [64, 4.5, 5.6], [67, 4.5, 5.6],
  [53, 5.8, 6.9], [57, 5.8, 6.9], [60, 5.8, 6.9], [65, 5.8, 6.9],
  [55, 7.1, 8.2], [59, 7.1, 8.2], [62, 7.1, 8.2], [67, 7.1, 8.2],
  // A melody over a held bass note (overlap, different lengths)
  [43, 8.6, 10.6], [74, 8.6, 9.0], [72, 9.0, 9.4], [71, 9.4, 9.8], [67, 9.8, 10.6],
].map(([midi, start, end], i) => ({ id: `t${i}`, midi, startTime: start, endTime: end, velocity: 0.8 }));

const DURATION = 11.5;

/** Deterministic noise for the hammer click */
let seed = 1;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

const samples = new Float32Array(Math.ceil(DURATION * SAMPLE_RATE));
for (const note of NOTES) {
  const f = 440 * 2 ** ((note.midi - 69) / 12);
  const decay = 1.4 * 2 ** (-(note.midi - 60) / 24); // higher notes fade faster
  const start = Math.round(note.startTime * SAMPLE_RATE);
  const end = Math.round(note.endTime * SAMPLE_RATE);
  const release = Math.round(0.12 * SAMPLE_RATE);
  for (let i = start; i < Math.min(samples.length, end + release); i++) {
    const t = (i - start) / SAMPLE_RATE;
    let env = Math.min(1, t / 0.004) * Math.exp(-t / decay);
    if (i >= end) env *= 1 - (i - end) / release;
    let v = 0;
    for (let k = 1; k <= 8; k++) {
      const fk = f * k * Math.sqrt(1 + 0.0004 * k * k);
      if (fk > SAMPLE_RATE / 2) break;
      v += Math.sin(2 * Math.PI * fk * t) / k ** 1.3;
    }
    if (t < 0.02) v += random() * 0.3 * (1 - t / 0.02); // hammer
    samples[i] += v * env * note.velocity * 0.25;
  }
}

// Normalize to −3 dBFS and write a 16-bit PCM WAV
const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const gain = 0.707 / peak;
const data = Buffer.alloc(samples.length * 2);
samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * gain)) * 32767), i * 2));
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(SAMPLE_RATE, 24);
header.writeUInt32LE(SAMPLE_RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'piano-fixture.wav'), Buffer.concat([header, data]));
writeFileSync(join(out, 'piano-fixture.json'), JSON.stringify({ duration: DURATION, notes: NOTES }, null, 2) + '\n');
console.log(`Wrote ${NOTES.length} notes, ${DURATION} s → e2e/fixtures/piano-fixture.{wav,json}`);
