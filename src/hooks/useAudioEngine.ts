/**
 * @fileoverview React hook for managing the AudioEngine lifecycle.
 *
 * This hook wraps the AudioEngine class in React's lifecycle:
 * - Lazy initialization: AudioContext is created on first user interaction
 *   (required by browser autoplay policy)
 * - Stable callbacks: All returned functions maintain referential identity
 *   across re-renders (via useCallback)
 * - Cleanup: AudioContext is properly closed on component unmount
 *
 * ## Usage
 * ```tsx
 * const { playNote, stopNote, setVolume } = useAudioEngine();
 *
 * // Play middle C
 * playNote('C4', 261.63);
 *
 * // Stop it
 * stopNote('C4');
 * ```
 */

'use client';

import { useRef, useEffect, useCallback } from 'react';
import { AudioEngine } from '@/lib/audio-engine';
import { DEFAULT_VOLUME } from '@/lib/constants';

export function useAudioEngine() {
  /** Ref persists the engine instance across re-renders without triggering them */
  const engineRef = useRef<AudioEngine | null>(null);
  /** Last requested volume, re-applied if the engine is recreated (e.g. after Fast Refresh) */
  const volumeRef = useRef(DEFAULT_VOLUME);

  /**
   * Get the engine, creating it on first use.
   * Constructing the engine is cheap — the AudioContext itself is only
   * created by `init()`, which runs inside a user gesture.
   */
  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
      engineRef.current.setVolume(volumeRef.current);
    }
    return engineRef.current;
  }, []);

  /** Play a note (auto-initializes audio engine on first call) */
  const playNote = useCallback(
    (noteId: string, frequency: number) => {
      const engine = getEngine();
      engine.init();
      engine.playNote(noteId, frequency);
    },
    [getEngine]
  );

  /** Stop a note with release envelope */
  const stopNote = useCallback((noteId: string) => {
    engineRef.current?.stopNote(noteId);
  }, []);

  /** Stop all currently playing notes */
  const stopAllNotes = useCallback(() => {
    engineRef.current?.stopAllNotes();
  }, []);

  /** Set master volume (0 to 1) — remembered even before audio starts */
  const setVolume = useCallback(
    (volume: number) => {
      volumeRef.current = volume;
      getEngine().setVolume(volume);
    },
    [getEngine]
  );

  // Cleanup: destroy audio engine when component unmounts. The ref is
  // cleared so a remount (Strict Mode, Fast Refresh) gets a fresh engine
  // instead of one whose AudioContext has been closed.
  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  return { playNote, stopNote, stopAllNotes, setVolume };
}
