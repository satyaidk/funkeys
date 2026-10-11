import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSequencePlayer, usePlaybackPosition } from './useSequencePlayer';
import { AudioControls } from './useAudioEngine';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { PianoNoteEvent, PianoSettings } from '@/types';

const note = (id: string, midi: number, startTime: number, endTime: number, velocity = 0.8): PianoNoteEvent => ({
  id,
  midi,
  startTime,
  endTime,
  velocity,
});

/** Fake audio controls with a clock the test moves by hand */
function fakeAudio() {
  let now = 0;
  const scheduled: Array<{ frequency: number; start: number; end: number; velocity: number; cancel: ReturnType<typeof vi.fn> }> = [];
  const audio: AudioControls = {
    start: vi.fn(),
    playNote: vi.fn(),
    stopNote: vi.fn(),
    stopAllNotes: vi.fn(),
    setVolume: vi.fn(),
    setReverb: vi.fn(),
    setBrilliance: vi.fn(),
    setMetronomeVolume: vi.fn(),
    scheduleClick: vi.fn(),
    scheduleNote: vi.fn((frequency, options, start, end) => {
      const cancel = vi.fn();
      scheduled.push({ frequency, start, end, velocity: options.velocity, cancel });
      return { cancel };
    }),
    getCurrentTime: () => now,
  };
  /** Move the audio clock and the timers together */
  const advance = (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.025) {
      now += 0.025;
      act(() => vi.advanceTimersByTime(25));
    }
  };
  return { audio, scheduled, advance };
}

function setup(settings: PianoSettings = DEFAULT_SETTINGS, onStart?: (midis: number[]) => void) {
  const fake = fakeAudio();
  const settingsRef = { current: settings };
  const hook = renderHook(() => useSequencePlayer({ audio: fake.audio, settingsRef, onStart }));
  return { ...fake, ...hook, settingsRef };
}

const song = { kind: 'song' as const, id: 'test', title: 'Test' };
const melody = [note('a', 69, 0, 0.5), note('b', 72, 0.5, 1)];

describe('useSequencePlayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('plays loaded notes through the audio engine with the piano’s tuning', () => {
    const { result, scheduled, audio, advance } = setup();
    act(() => result.current.load(song, melody, 1));
    act(() => result.current.play());
    advance(0.6);

    expect(audio.start).toHaveBeenCalled(); // inside the click: autoplay policy
    expect(scheduled.map((s) => s.frequency)).toEqual([440, expect.closeTo(523.25, 1)]);
    expect(scheduled[0].velocity).toBe(0.8);
    expect(result.current.state).toBe('playing');
    expect(result.current.source).toEqual(song);
  });

  it('applies transpose and the current voice settings as each note is booked', () => {
    const { result, scheduled, settingsRef, advance } = setup();
    settingsRef.current = { ...DEFAULT_SETTINGS, transpose: 12 };
    act(() => result.current.load(song, melody, 1));
    act(() => result.current.play());
    advance(0.1);
    expect(scheduled[0].frequency).toBeCloseTo(880);
  });

  it('lights the keys of the notes sounding now, and clears them when stopped', () => {
    const { result, advance } = setup();
    act(() => result.current.load(song, [note('c', 60, 0, 1), note('e', 64, 0, 1)], 1));
    act(() => result.current.play());
    advance(0.2);
    expect(result.current.playingNoteIds).toEqual(new Set(['C4', 'E4']));

    act(() => result.current.stop());
    expect(result.current.playingNoteIds.size).toBe(0);
    expect(result.current.state).toBe('stopped');
  });

  it('pauses and resumes', () => {
    const { result, scheduled, advance } = setup();
    act(() => result.current.load(song, melody, 1));
    act(() => result.current.toggle());
    advance(0.2);
    act(() => result.current.toggle());
    expect(result.current.state).toBe('paused');
    expect(scheduled[0].cancel).toHaveBeenCalled();
    act(() => result.current.toggle());
    expect(result.current.state).toBe('playing');
  });

  it('loading another piece stops the one playing (never two at once)', () => {
    const { result, scheduled, advance } = setup();
    act(() => result.current.load(song, melody, 1));
    act(() => result.current.play());
    advance(0.2);
    act(() => result.current.load({ kind: 'transcription', title: 'Take' }, melody, 1));

    expect(result.current.state).toBe('stopped');
    expect(scheduled.every((s) => s.cancel.mock.calls.length > 0)).toBe(true);
    expect(result.current.source?.kind).toBe('transcription');
  });

  it('asks the keyboard to show the piece when it starts from the top', () => {
    const onStart = vi.fn();
    const { result } = setup(DEFAULT_SETTINGS, onStart);
    act(() => result.current.load(song, melody, 1));
    act(() => result.current.play());
    expect(onStart).toHaveBeenCalledWith([69, 72]);
  });

  it('seeks, sets speed and loop', () => {
    const { result } = setup();
    act(() => result.current.load(song, melody, 1, { loop: true }));
    expect(result.current.loop).toBe(true);
    act(() => result.current.seek(0.5));
    expect(result.current.getPosition()).toBe(0.5);
    act(() => result.current.setRate(0.5));
    expect(result.current.rate).toBe(0.5);
    act(() => result.current.setLoop(false));
    expect(result.current.loop).toBe(false);
  });

  it('keeps the full duration of a recording that ends in silence', () => {
    const { result } = setup();
    act(() => result.current.load({ kind: 'transcription', title: 'Take' }, melody, 300));
    expect(result.current.duration).toBe(300);
  });

  it('reports the playhead position each frame while playing', () => {
    const { result, advance } = setup();
    act(() => result.current.load(song, melody, 1));
    const position = renderHook(() => usePlaybackPosition(result.current));
    act(() => result.current.play());
    position.rerender();
    advance(0.5);
    position.rerender();
    expect(position.result.current).toBeGreaterThan(0.3);
  });

  it('stops playing when unmounted', () => {
    const { result, scheduled, unmount, advance } = setup();
    act(() => result.current.load(song, melody, 1));
    act(() => result.current.play());
    advance(0.1);
    unmount();
    expect(scheduled[0].cancel).toHaveBeenCalled();
  });
});
