import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMetronome } from './useMetronome';
import { AudioControls } from './useAudioEngine';

/** Audio controls with a hand-driven clock */
function fakeAudio() {
  let now = 0;
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
    getCurrentTime: () => now,
  };
  return { audio, advance: (seconds: number) => (now += seconds) };
}

describe('useMetronome', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts the audio engine and books the first click', () => {
    const { audio } = fakeAudio();
    const { result } = renderHook(() => useMetronome(audio));
    act(() => result.current.start());

    expect(audio.start).toHaveBeenCalled();
    expect(audio.scheduleClick).toHaveBeenCalledWith(expect.any(Number), true);
    expect(result.current.running).toBe(true);
  });

  it('lights the beat when its click is heard', () => {
    const { audio } = fakeAudio();
    const { result } = renderHook(() => useMetronome(audio));
    act(() => result.current.start());
    expect(result.current.beat).toBeNull();

    act(() => vi.advanceTimersByTime(60)); // first click is 50ms ahead
    expect(result.current.beat).toBe(0);
  });

  it('stops and clears the beat light', () => {
    const { audio } = fakeAudio();
    const { result } = renderHook(() => useMetronome(audio));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(60));
    act(() => result.current.toggle());

    expect(result.current.running).toBe(false);
    expect(result.current.beat).toBeNull();
  });

  it('clamps the tempo and follows the time signature', () => {
    const { audio } = fakeAudio();
    const { result } = renderHook(() => useMetronome(audio));
    act(() => result.current.setBpm(500));
    expect(result.current.bpm).toBe(240);

    act(() => result.current.setTimeSignature('6/8'));
    expect(result.current.beatsPerBar).toBe(6);
    expect(result.current.accents).toEqual([0, 3]);
  });

  it('sets the tempo by tapping', () => {
    const { audio } = fakeAudio();
    const { result } = renderHook(() => useMetronome(audio));
    act(() => {
      result.current.tap();
      vi.advanceTimersByTime(500);
      result.current.tap();
      vi.advanceTimersByTime(500);
      result.current.tap();
    });
    expect(result.current.bpm).toBe(120);
  });

  it('sends its volume to the engine', () => {
    const { audio } = fakeAudio();
    const { result } = renderHook(() => useMetronome(audio));
    act(() => result.current.setVolume(0.3));
    expect(audio.setMetronomeVolume).toHaveBeenLastCalledWith(0.3);
  });
});
