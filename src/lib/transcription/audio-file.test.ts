import { describe, it, expect } from 'vitest';
import {
  acceptAttribute,
  checkAudioFile,
  checkDuration,
  MAX_DURATION_SECONDS,
  MAX_FILE_BYTES,
  supportedFormats,
} from './audio-file';

const file = (name: string, type: string, size = 1000) => ({ name, type, size });

describe('checkAudioFile', () => {
  it('accepts WAV and MP3 by type or extension', () => {
    expect(checkAudioFile(file('take.wav', 'audio/wav'))).toMatchObject({ ok: true, format: { label: 'WAV' } });
    expect(checkAudioFile(file('take.mp3', ''))).toMatchObject({ ok: true, format: { label: 'MP3' } });
    expect(checkAudioFile(file('TAKE.MP3', 'audio/mpeg'))).toMatchObject({ ok: true });
    expect(checkAudioFile(file('x', 'audio/x-wav'))).toMatchObject({ ok: true });
  });

  it('rejects empty files', () => {
    expect(checkAudioFile(file('take.wav', 'audio/wav', 0))).toEqual({ ok: false, reason: 'This file is empty.' });
  });

  it('rejects files over the size limit, saying how big they are', () => {
    const check = checkAudioFile(file('take.wav', 'audio/wav', MAX_FILE_BYTES + 1));
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toMatch(/100 MB/);
  });

  it('rejects files that are not audio', () => {
    const check = checkAudioFile(file('notes.pdf', 'application/pdf'));
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toMatch(/WAV, MP3/);
  });

  it('rejects formats this browser cannot decode, suggesting WAV or MP3', () => {
    const noFlac = (type: string) => type !== 'audio/flac';
    const check = checkAudioFile(file('take.flac', 'audio/flac'), noFlac);
    expect(check).toEqual({ ok: false, reason: 'This browser can’t decode FLAC files. Try WAV or MP3.' });
  });
});

describe('supported formats', () => {
  it('always offers WAV and MP3, and the others only where the browser supports them', () => {
    expect(supportedFormats(() => false).map((f) => f.label)).toEqual(['WAV', 'MP3']);
    expect(supportedFormats(() => true)).toHaveLength(6);
  });

  it('builds the accept attribute from extensions and MIME types', () => {
    const accept = acceptAttribute(supportedFormats(() => false));
    expect(accept).toContain('.wav');
    expect(accept).toContain('audio/mpeg');
    expect(accept).not.toContain('.flac');
  });
});

describe('checkDuration', () => {
  it('accepts recordings up to the limit', () => {
    expect(checkDuration(5 * 60)).toBeNull();
    expect(checkDuration(MAX_DURATION_SECONDS)).toBeNull();
  });

  it('rejects silence, tiny clips and recordings that are too long', () => {
    expect(checkDuration(0)).toMatch(/no audio/);
    expect(checkDuration(NaN)).toMatch(/no audio/);
    expect(checkDuration(0.1)).toMatch(/too short/);
    expect(checkDuration(MAX_DURATION_SECONDS + 1)).toMatch(/10:01 long.*10:00/);
  });
});
