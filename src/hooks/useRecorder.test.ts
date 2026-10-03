import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecorder } from './useRecorder';
import { Performer } from './usePiano';

const fakePerformer = (): Performer => ({
  noteOn: vi.fn(),
  noteOff: vi.fn(),
  setPedal: vi.fn(),
  releaseAll: vi.fn(),
});

describe('useRecorder', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Record C4 for 300ms with the sustain pedal, stopping at 1s */
  function recordPhrase() {
    const hook = renderHook(() => useRecorder());
    act(() => hook.result.current.record());
    act(() => {
      vi.advanceTimersByTime(100);
      hook.result.current.capture({ type: 'noteOn', noteId: 'C4', velocity: 0.8 });
      vi.advanceTimersByTime(100);
      hook.result.current.capture({ type: 'pedal', pedal: 'sustain', down: true });
      vi.advanceTimersByTime(200);
      hook.result.current.capture({ type: 'noteOff', noteId: 'C4' });
      vi.advanceTimersByTime(600);
    });
    act(() => hook.result.current.stop());
    return hook;
  }

  it('records note and pedal events with their timing', () => {
    const { result } = recordPhrase();
    expect(result.current.status).toBe('idle');
    expect(result.current.duration).toBe(1000);
    expect(result.current.hasRecording).toBe(true);
  });

  it('ignores events when not recording', () => {
    const { result } = renderHook(() => useRecorder());
    act(() => result.current.capture({ type: 'noteOn', noteId: 'C4', velocity: 1 }));
    expect(result.current.hasRecording).toBe(false);
  });

  it('shows elapsed time while recording', () => {
    const { result } = renderHook(() => useRecorder());
    act(() => result.current.record());
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.status).toBe('recording');
    expect(result.current.elapsed).toBe(500);
  });

  it('plays the events back at the recorded times', () => {
    const { result } = recordPhrase();
    const performer = fakePerformer();
    act(() => result.current.play(performer));
    expect(result.current.status).toBe('playing');

    act(() => vi.advanceTimersByTime(100));
    expect(performer.noteOn).toHaveBeenCalledWith('C4', 0.8);
    expect(performer.setPedal).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(100));
    expect(performer.setPedal).toHaveBeenCalledWith('sustain', true, 'playback');

    act(() => vi.advanceTimersByTime(200));
    expect(performer.noteOff).toHaveBeenCalledWith('C4');
  });

  it('returns to idle at the end and lifts what playback held', () => {
    const { result } = recordPhrase();
    const performer = fakePerformer();
    act(() => result.current.play(performer));
    act(() => vi.advanceTimersByTime(1100));

    expect(result.current.status).toBe('idle');
    expect(performer.setPedal).toHaveBeenCalledWith('sustain', false, 'playback');
    expect(performer.releaseAll).toHaveBeenCalled();
  });

  it('stops playback early on stop()', () => {
    const { result } = recordPhrase();
    const performer = fakePerformer();
    act(() => result.current.play(performer));
    act(() => result.current.stop());
    act(() => vi.advanceTimersByTime(1000));

    expect(performer.noteOn).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('does nothing when asked to play an empty recording', () => {
    const { result } = renderHook(() => useRecorder());
    act(() => result.current.play(fakePerformer()));
    expect(result.current.status).toBe('idle');
  });

  it('clears the recording', () => {
    const { result } = recordPhrase();
    act(() => result.current.clear());
    expect(result.current.hasRecording).toBe(false);
  });
});
