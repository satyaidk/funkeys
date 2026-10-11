/**
 * @fileoverview Standard MIDI Files: write timed notes out, read them back in.
 *
 * A .mid file is a small binary format every music program understands:
 *
 * ```
 *  "MThd" header: format, number of tracks, ticks per quarter note
 *  "MTrk" track:  events, each preceded by the time since the previous one
 *                 (in ticks, as a variable-length number)
 *                   note on  0x9n pitch velocity   (n = channel)
 *                   note off 0x8n pitch velocity
 *                   meta     0xFF type length data (tempo, name, end of track)
 * ```
 *
 * Time in a MIDI file is counted in **ticks**: at 480 ticks per quarter
 * note and 120 BPM, a second is 960 ticks, so a note's time survives the
 * round trip to within about a millisecond.
 *
 * Variable-length numbers store 7 bits per byte, high bit set on every byte
 * but the last: 0x40 → 40, 200 → 81 48, 100 000 → 86 8D 20.
 */

import { PianoNoteEvent } from '@/types';
import { compareNotes } from './note-events';

/** Ticks per quarter note */
export const PPQ = 480;
/** Tempo written to the file. Times are in seconds, so any tempo works; 120 BPM is the convention. */
export const EXPORT_BPM = 120;

const TICKS_PER_SECOND = (PPQ * EXPORT_BPM) / 60;

/** Encode a number as a MIDI variable-length quantity */
export function encodeVarLen(value: number): number[] {
  let v = Math.max(0, Math.floor(value));
  const bytes = [v & 0x7f];
  while ((v >>= 7) > 0) bytes.unshift((v & 0x7f) | 0x80);
  return bytes;
}

const text = (s: string) => Array.from(new TextEncoder().encode(s));
const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u16 = (n: number) => [(n >>> 8) & 0xff, n & 0xff];

export interface MidiWriteOptions {
  /** Track name stored in the file */
  name?: string;
}

/**
 * Write notes as a format-0 MIDI file (one track, channel 1, acoustic grand).
 * A note that would overlap the next strike of the same key is ended at
 * that strike, which is how a piano key behaves.
 */
export function writeMidiFile(notes: readonly PianoNoteEvent[], { name = 'FunKeys' }: MidiWriteOptions = {}): Uint8Array {
  // Per key, end a note where the same key strikes again (MIDI can't overlap one key)
  const sorted = [...notes].sort((a, b) => a.midi - b.midi || a.startTime - b.startTime);
  const timed = sorted.map((note, i) => {
    const next = sorted[i + 1];
    const end = next && next.midi === note.midi ? Math.min(note.endTime, next.startTime) : note.endTime;
    const on = Math.round(note.startTime * TICKS_PER_SECOND);
    return {
      midi: Math.min(127, Math.max(0, Math.round(note.midi))),
      on,
      off: Math.max(on + 1, Math.round(end * TICKS_PER_SECOND)),
      velocity: Math.min(127, Math.max(1, Math.round(note.velocity * 127))),
    };
  });

  // Note-offs before note-ons at the same tick, so a repeated key strikes again
  const events = timed
    .flatMap((n) => [
      { tick: n.on, order: 1, bytes: [0x90, n.midi, n.velocity] },
      { tick: n.off, order: 0, bytes: [0x80, n.midi, 0x40] },
    ])
    .sort((a, b) => a.tick - b.tick || a.order - b.order || a.bytes[1] - b.bytes[1]);

  const microsecondsPerQuarter = Math.round(60_000_000 / EXPORT_BPM);
  const nameBytes = text(name);
  const track: number[] = [
    0x00, 0xff, 0x03, ...encodeVarLen(nameBytes.length), ...nameBytes, // track name
    0x00, 0xff, 0x51, 0x03, (microsecondsPerQuarter >> 16) & 0xff, (microsecondsPerQuarter >> 8) & 0xff, microsecondsPerQuarter & 0xff,
    0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08, // 4/4
    0x00, 0xc0, 0x00, // program 1: acoustic grand piano
  ];
  let last = 0;
  for (const event of events) {
    track.push(...encodeVarLen(event.tick - last), ...event.bytes);
    last = event.tick;
  }
  track.push(0x00, 0xff, 0x2f, 0x00); // end of track

  return new Uint8Array([
    ...text('MThd'), ...u32(6), ...u16(0), ...u16(1), ...u16(PPQ),
    ...text('MTrk'), ...u32(track.length), ...track,
  ]);
}

export class MidiParseError extends Error {}

/**
 * Read the notes of a MIDI file (format 0 or 1, every track and channel),
 * following tempo changes, as timed notes in seconds.
 * @throws MidiParseError if the bytes aren't a MIDI file
 */
export function readMidiFile(bytes: Uint8Array): { notes: Omit<PianoNoteEvent, 'id'>[]; duration: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (bytes.length < 14 || tag(0) !== 'MThd') throw new MidiParseError('This isn’t a MIDI file.');

  const headerLength = view.getUint32(4);
  const trackCount = view.getUint16(10);
  const division = view.getUint16(12);
  if (division & 0x8000) throw new MidiParseError('SMPTE-timed MIDI files aren’t supported.');

  type Raw = { tick: number; kind: 'on' | 'off' | 'tempo'; channel: number; key: number; velocity: number; tempo: number };
  const events: Raw[] = [];
  let pos = 8 + headerLength;

  for (let t = 0; t < trackCount && pos + 8 <= bytes.length; t++) {
    if (tag(pos) !== 'MTrk') throw new MidiParseError('This MIDI file is damaged (missing track).');
    const end = Math.min(bytes.length, pos + 8 + view.getUint32(pos + 4));
    pos += 8;
    let tick = 0;
    let status = 0;
    const varLen = () => {
      let value = 0;
      for (let i = 0; i < 4 && pos < end; i++) {
        const b = bytes[pos++];
        value = (value << 7) | (b & 0x7f);
        if (!(b & 0x80)) break;
      }
      return value;
    };
    while (pos < end) {
      tick += varLen();
      let byte = bytes[pos];
      if (byte & 0x80) {
        pos++;
      } else {
        byte = status; // running status: reuse the last status byte
      }
      if (byte === 0xff) {
        const type = bytes[pos++];
        const length = varLen();
        if (type === 0x51 && length === 3) {
          const tempo = (bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2];
          events.push({ tick, kind: 'tempo', channel: 0, key: 0, velocity: 0, tempo });
        }
        pos += length;
        if (type === 0x2f) break;
        continue;
      }
      if (byte === 0xf0 || byte === 0xf7) {
        pos += varLen(); // system exclusive: skip
        continue;
      }
      status = byte;
      const kind = byte & 0xf0;
      const channel = byte & 0x0f;
      const data1 = bytes[pos++];
      const data2 = kind === 0xc0 || kind === 0xd0 ? 0 : bytes[pos++];
      if (kind === 0x90 && data2 > 0) events.push({ tick, kind: 'on', channel, key: data1, velocity: data2, tempo: 0 });
      else if (kind === 0x80 || (kind === 0x90 && data2 === 0)) {
        events.push({ tick, kind: 'off', channel, key: data1, velocity: 0, tempo: 0 });
      }
    }
    pos = end;
  }

  // Ticks → seconds, following the tempo map (default 120 BPM)
  events.sort((a, b) => a.tick - b.tick || (a.kind === 'tempo' ? -1 : 0) - (b.kind === 'tempo' ? -1 : 0));
  let tempo = 500_000;
  let tempoTick = 0;
  let tempoSeconds = 0;
  const seconds = (tick: number) => tempoSeconds + ((tick - tempoTick) * tempo) / (division * 1_000_000);

  const open = new Map<string, Array<{ start: number; velocity: number }>>();
  const notes: Omit<PianoNoteEvent, 'id'>[] = [];
  let duration = 0;
  for (const e of events) {
    const at = seconds(e.tick);
    duration = Math.max(duration, at);
    if (e.kind === 'tempo') {
      tempoSeconds = at;
      tempoTick = e.tick;
      tempo = e.tempo;
      continue;
    }
    const id = `${e.channel}:${e.key}`;
    if (e.kind === 'on') {
      const stack = open.get(id) ?? [];
      stack.push({ start: at, velocity: e.velocity / 127 });
      open.set(id, stack);
    } else {
      const started = open.get(id)?.shift();
      if (started && at > started.start) {
        notes.push({ midi: e.key, startTime: started.start, endTime: at, velocity: started.velocity });
      }
    }
  }
  const sorted = notes
    .map((n, i) => ({ ...n, id: String(i) }))
    .sort(compareNotes)
    .map(({ midi, startTime, endTime, velocity }) => ({ midi, startTime, endTime, velocity }));
  return { notes: sorted, duration };
}
