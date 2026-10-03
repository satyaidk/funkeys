/**
 * @fileoverview React hook for the Notes page: pick a riff, loop it, stop it.
 *
 * Owns the page's settings (which riff, what speed) and drives a `Looper`,
 * which plays the riff's melody on the piano until stopped:
 *
 * ```
 * riffs.ts ─► parseSequence ─► Looper.play ─► piano.noteOn / noteOff (keys light up)
 * ```
 *
 * Notes go through the same `noteOn` as your fingers, so the voice, layer,
 * split, pedals and tuning all apply, and the recorder captures a loop if
 * you record while it plays.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Looper } from '@/lib/music/looper';
import { midiToNoteId } from '@/lib/music/notes';
import { Riff, RIFFS } from '@/lib/music/riffs';
import { parseSequence } from '@/lib/music/sequence';
import { AudioControls } from './useAudioEngine';
import { Performer } from './usePiano';

export interface UseLooperOptions {
  audio: AudioControls;
  /** Plays the notes: the piano */
  performer: Pick<Performer, 'noteOn' | 'noteOff'>;
  /** The keyboard's octave shift; loops follow it so they always light keys you can see */
  octaveShift: number;
  /** Song library (tests pass a small one) */
  riffs?: readonly Riff[];
}

export function useLooper({ audio, performer, octaveShift, riffs = RIFFS }: UseLooperOptions) {
  const [riffId, setRiffId] = useState(riffs[0].id);
  /** 1 = the song's own tempo */
  const [speed, setSpeedState] = useState(1);
  const [playing, setPlaying] = useState(false);

  // The looper's timers outlive renders, so they read the latest values from refs
  const performerRef = useRef(performer);
  const octaveShiftRef = useRef(octaveShift);
  useEffect(() => {
    performerRef.current = performer;
    octaveShiftRef.current = octaveShift;
  }, [performer, octaveShift]);

  /** Created on first use, in an event handler: building it during render would read refs */
  const looperRef = useRef<Looper | null>(null);
  const isLooping = () => looperRef.current?.playing ?? false;

  const findRiff = useCallback((id: string) => riffs.find((r) => r.id === id) ?? riffs[0], [riffs]);

  /** (Re)start the loop from its first note */
  const loop = useCallback(
    (id: string, atSpeed: number) => {
      looperRef.current ??= new Looper(
        {
          noteOn: (noteId) => performerRef.current.noteOn(noteId),
          noteOff: (noteId) => performerRef.current.noteOff(noteId),
        },
        (midi) => midiToNoteId(midi + 12 * octaveShiftRef.current)
      );
      const riff = findRiff(id);
      looperRef.current.play(parseSequence(riff.melody), riff.bpm * atSpeed);
    },
    [findRiff]
  );

  const start = useCallback(() => {
    audio.start(); // inside a click: satisfies the autoplay policy
    loop(riffId, speed);
    setPlaying(true);
  }, [audio, loop, riffId, speed]);

  const stop = useCallback(() => {
    looperRef.current?.stop();
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (isLooping()) stop();
    else start();
  }, [start, stop]);

  /** Choose a riff; if one is playing, switch to the new one right away */
  const select = useCallback(
    (id: string) => {
      setRiffId(id);
      if (isLooping()) loop(id, speed);
    },
    [loop, speed]
  );

  /** Change the speed; a playing loop restarts at the new tempo */
  const setSpeed = useCallback(
    (value: number) => {
      setSpeedState(value);
      if (isLooping()) loop(riffId, value);
    },
    [loop, riffId]
  );

  // Stop playing when the component unmounts
  useEffect(() => () => looperRef.current?.stop(), []);

  return {
    /** The song library */
    riffs,
    riffId,
    /** The selected riff */
    riff: findRiff(riffId),
    speed,
    playing,
    start,
    stop,
    toggle,
    select,
    setSpeed,
  };
}
