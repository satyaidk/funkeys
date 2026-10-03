import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLooper, UseLooperOptions } from './useLooper';
import { AudioControls } from './useAudioEngine';
import { Riff } from '@/lib/music/riffs';

/** At 120 BPM a beat is 500 ms */
const RIFFS: readonly Riff[] = [
  { id: 'up', title: 'Up', artist: 'Test', bpm: 120, timeSignature: '4/4', melody: 'C4/4 E4/4 G4/2' },
  { id: 'down', title: 'Down', artist: 'Test', bpm: 120, timeSignature: '4/4', melody: 'G4/4 E4/4 C4/2' },
];

const fakeAudio = (): AudioControls => ({
  start: vi.fn(),
  playNote: vi.fn(),
  stopNote: vi.fn(),
  stopAllNotes: vi.fn(),
  setVolume: vi.fn(),
  setReverb: vi.fn(),
  setBrilliance: vi.fn(),
  setMetronomeVolume: vi.fn(),
  scheduleClick: vi.fn(),
  getCurrentTime: () => 0,
});

function renderLooper(octaveShift = 0) {
  const audio = fakeAudio();
  const performer = { noteOn: vi.fn(), noteOff: vi.fn() };
  const hook = renderHook((props: Pick<UseLooperOptions, 'octaveShift'>) =>
    useLooper({ audio, performer, riffs: RIFFS, ...props }), { initialProps: { octaveShift } }
  );
  return { ...hook, audio, performer };
}

describe('useLooper', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts the audio engine and plays the selected riff on the piano', () => {
    const { result, audio, performer } = renderLooper();
    expect(result.current.riff.id).toBe('up');

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(0));

    expect(audio.start).toHaveBeenCalled();
    expect(performer.noteOn).toHaveBeenCalledWith('C4');
    expect(result.current.playing).toBe(true);
  });

  it('keeps looping until stopped', () => {
    const { result, performer } = renderLooper();
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(4000)); // two passes of 2 s

    expect(performer.noteOn.mock.calls.map(([id]) => id)).toEqual(['C4', 'E4', 'G4', 'C4', 'E4', 'G4', 'C4']);
  });

  it('stops, lifting the note it was holding', () => {
    const { result, performer } = renderLooper();
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(600)); // E4 is down
    act(() => result.current.toggle());
    act(() => vi.advanceTimersByTime(5000));

    expect(performer.noteOff).toHaveBeenLastCalledWith('E4');
    expect(performer.noteOn).toHaveBeenCalledTimes(2);
    expect(result.current.playing).toBe(false);
  });

  it('switches straight to another riff while playing', () => {
    const { result, performer } = renderLooper();
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.select('down'));
    act(() => vi.advanceTimersByTime(0));

    expect(result.current.riffId).toBe('down');
    expect(performer.noteOn).toHaveBeenLastCalledWith('G4');
  });

  it('only selects a riff when stopped', () => {
    const { result, performer } = renderLooper();
    act(() => result.current.select('down'));
    act(() => vi.advanceTimersByTime(1000));

    expect(result.current.riff.title).toBe('Down');
    expect(performer.noteOn).not.toHaveBeenCalled();
  });

  it('plays slower at a lower speed', () => {
    const { result, performer } = renderLooper();
    act(() => result.current.setSpeed(0.5));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(999)); // a beat now lasts 1 s

    expect(result.current.speed).toBe(0.5);
    expect(performer.noteOn.mock.calls.map(([id]) => id)).toEqual(['C4']);
  });

  it('follows the octave shift so the notes light keys you can see', () => {
    const { result, rerender, performer } = renderLooper(1);
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(0));
    expect(performer.noteOn).toHaveBeenLastCalledWith('C5');

    rerender({ octaveShift: -1 });
    act(() => vi.advanceTimersByTime(500));
    expect(performer.noteOn).toHaveBeenLastCalledWith('E3');
  });

  it('stops playing when unmounted', () => {
    const { result, unmount, performer } = renderLooper();
    act(() => result.current.start());
    unmount();
    act(() => vi.advanceTimersByTime(5000));

    expect(performer.noteOn).not.toHaveBeenCalled();
  });
});
