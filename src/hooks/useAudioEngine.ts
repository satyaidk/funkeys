/**
 * @fileoverview React hook for managing the AudioEngine lifecycle.
 *
 * Wraps the AudioEngine class in React's lifecycle:
 * - Lazy creation: the engine object is created on first use, and its
 *   AudioContext only on the first user gesture (browser autoplay policy)
 * - Stable API: the returned object keeps the same identity across renders,
 *   so it's safe to use as an effect dependency
 * - Cleanup: the AudioContext is closed on unmount
 *
 * ## Usage
 * ```tsx
 * const audio = useAudioEngine();
 * audio.playNote('C4', 261.63, { voices: [{ voice: 'grand', gain: 1 }], velocity: 0.8, midi: 60 });
 * audio.stopNote('C4');
 * ```
 */

'use client';

import { useRef, useEffect, useMemo } from 'react';
import { AudioEngine } from '@/lib/audio/audio-engine';
import { Brilliance, PlayNoteOptions, ReverbType } from '@/types';

/** Everything the rest of the app may ask of the audio layer */
export interface AudioControls {
  /** Create/resume the AudioContext. Call from a user gesture. */
  start(): void;
  playNote(noteId: string, frequency: number, options: PlayNoteOptions): void;
  stopNote(noteId: string): void;
  stopAllNotes(): void;
  setVolume(volume: number): void;
  setReverb(type: ReverbType, level: number): void;
  setBrilliance(brilliance: Brilliance): void;
  setMetronomeVolume(volume: number): void;
  scheduleClick(time: number, accent: boolean): void;
  /** Audio-clock time in seconds */
  getCurrentTime(): number;
}

export function useAudioEngine(): AudioControls {
  /** Ref persists the engine across re-renders without triggering them */
  const engineRef = useRef<AudioEngine | null>(null);

  // Cleanup: close the AudioContext on unmount. Clearing the ref means a
  // remount (Strict Mode, Fast Refresh) gets a fresh engine instead of a
  // closed one; the settings effects in usePiano re-apply their values.
  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  return useMemo<AudioControls>(() => {
    /** Get the engine, creating it on first use (cheap: no AudioContext yet) */
    const engine = () => (engineRef.current ??= new AudioEngine());

    return {
      start: () => engine().init(),
      playNote: (noteId, frequency, options) => {
        const e = engine();
        e.init();
        e.playNote(noteId, frequency, options);
      },
      stopNote: (noteId) => engineRef.current?.stopNote(noteId),
      stopAllNotes: () => engineRef.current?.stopAllNotes(),
      setVolume: (volume) => engine().setVolume(volume),
      setReverb: (type, level) => engine().setReverb(type, level),
      setBrilliance: (brilliance) => engine().setBrilliance(brilliance),
      setMetronomeVolume: (volume) => engine().setMetronomeVolume(volume),
      scheduleClick: (time, accent) => engineRef.current?.scheduleClick(time, accent),
      getCurrentTime: () => engineRef.current?.currentTime ?? 0,
    };
  }, []);
}
