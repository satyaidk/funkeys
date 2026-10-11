/**
 * @fileoverview React hook for the one playback transport: songs from the
 * Notes library and audio transcriptions.
 *
 * Wraps a `SequencePlayer` (audio-clock scheduling, ADR 0013):
 *
 * ```
 * notes (seconds) ─► SequencePlayer ─► voiceNote(settings) ─► AudioEngine.scheduleNote
 *                          │
 *                          └─► soundingNotes() ─► requestAnimationFrame ─► playingNoteIds (keys light)
 * ```
 *
 * - **One source at a time.** Loading a song stops a transcription and vice
 *   versa, so two pieces can never play over each other
 * - **Same sound as your fingers.** Each note goes through `voiceNote`, so
 *   the voice, layer/split and tuning settings apply
 * - **Keys light on time.** Notes are booked slightly ahead; the lights are
 *   driven by animation frames that compare the audio clock with each
 *   note's start and end, so they match what you hear
 * - **Re-renders only on change.** The playhead position isn't React state
 *   here; components that show it read `getPosition()` each frame
 *   (`usePlaybackPosition`), so the whole app doesn't re-render 60 times a
 *   second
 */

'use client';

import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PianoNoteEvent, PianoSettings } from '@/types';
import { PlaybackState, SequencePlayer } from '@/lib/audio/sequence-player';
import { midiToNoteId } from '@/lib/music/notes';
import { voiceNote } from '@/lib/voicing';
import { SEQUENCE_SCHEDULE_AHEAD, SEQUENCE_SCHEDULE_AHEAD_HIDDEN } from '@/lib/constants';
import { AudioControls } from './useAudioEngine';

/** What's loaded in the transport */
export type PlaybackSource =
  | { kind: 'song'; id: string; title: string }
  | { kind: 'transcription'; title: string };

export interface UseSequencePlayerOptions {
  audio: AudioControls;
  /** The piano's latest settings (voice, tuning…), read when each note is booked */
  settingsRef: RefObject<PianoSettings>;
  /** Called with the pitches when playback starts, so the keyboard can move to show them */
  onStart?: (midis: number[]) => void;
}

const EMPTY: ReadonlySet<string> = new Set();

/** requestAnimationFrame, or a 60 fps timer where there isn't one (tests, old browsers) */
const nextFrame = (callback: () => void): (() => void) => {
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(callback, 16);
  return () => clearTimeout(id);
};

export function useSequencePlayer({ audio, settingsRef, onStart }: UseSequencePlayerOptions) {
  const [state, setState] = useState<PlaybackState>('stopped');
  const [source, setSource] = useState<PlaybackSource | null>(null);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);
  const [loop, setLoopState] = useState(false);
  /** Keys sounding from playback right now */
  const [playingNoteIds, setPlayingNoteIds] = useState<ReadonlySet<string>>(EMPTY);
  /** Bumped when the position jumps while not playing (seek, stop, load) */
  const [revision, setRevision] = useState(0);
  const bump = () => setRevision((r) => r + 1);

  const notesRef = useRef<readonly PianoNoteEvent[]>([]);
  const onStartRef = useRef(onStart);
  useEffect(() => {
    onStartRef.current = onStart;
  }, [onStart]);

  /** Created on first use, in an event handler (building it during render would read refs) */
  const playerRef = useRef<SequencePlayer | null>(null);
  const getPlayer = useCallback((): SequencePlayer => {
    playerRef.current ??= new SequencePlayer(
      {
        get currentTime() {
          return audio.getCurrentTime();
        },
      },
      {
        scheduleNote: (note, start, end) => {
          const { frequency, options } = voiceNote(note.midi, settingsRef.current, note.velocity);
          return audio.scheduleNote(frequency, options, start, end);
        },
      },
      {
        onStateChange: (next) => {
          setState(next);
          if (next !== 'playing') {
            setPlayingNoteIds(EMPTY);
            setRevision((r) => r + 1);
          }
        },
        // Browsers slow background timers to ~1/s: book further ahead while hidden
        scheduleAhead: () =>
          typeof document !== 'undefined' && document.visibilityState === 'hidden'
            ? SEQUENCE_SCHEDULE_AHEAD_HIDDEN
            : SEQUENCE_SCHEDULE_AHEAD,
      }
    );
    return playerRef.current;
  }, [audio, settingsRef]);

  // ── Key lighting, one check per animation frame while playing ─────────
  useEffect(() => {
    if (state !== 'playing') return;
    let lastKey = '';
    let cancel = () => {};
    const frame = () => {
      const player = playerRef.current;
      if (!player) return;
      const ids = player.soundingNotes().map((b) => midiToNoteId(b.note.midi));
      const key = [...new Set(ids)].sort().join(' ');
      if (key !== lastKey) {
        lastKey = key;
        setPlayingNoteIds(ids.length ? new Set(ids) : EMPTY);
      }
      cancel = nextFrame(frame);
    };
    cancel = nextFrame(frame);
    return () => cancel();
  }, [state]);

  // ── Transport ──────────────────────────────────────────────────────────

  /** Load a piece, replacing whatever was loaded (and stopping it) */
  const load = useCallback(
    (next: PlaybackSource, notes: readonly PianoNoteEvent[], length: number, options: { loop?: boolean } = {}) => {
      const player = getPlayer();
      player.stop();
      notesRef.current = notes;
      player.load(notes, length);
      if (options.loop !== undefined) {
        player.setLoop(options.loop);
        setLoopState(options.loop);
      }
      setSource(next);
      setDuration(player.duration);
      bump();
    },
    [getPlayer]
  );

  /** Swap in edited notes for the loaded piece; playback carries on from the same place */
  const update = useCallback(
    (notes: readonly PianoNoteEvent[], length: number) => {
      const player = getPlayer();
      notesRef.current = notes;
      player.load(notes, length);
      setDuration(player.duration);
      bump();
    },
    [getPlayer]
  );

  const play = useCallback(() => {
    audio.start(); // inside a click: satisfies the browser's autoplay policy
    const player = getPlayer();
    if (player.state === 'stopped') onStartRef.current?.(notesRef.current.map((n) => n.midi));
    player.play();
  }, [audio, getPlayer]);

  const pause = useCallback(() => playerRef.current?.pause(), []);

  const toggle = useCallback(() => {
    if (playerRef.current?.state === 'playing') playerRef.current.pause();
    else play();
  }, [play]);

  const stop = useCallback(() => playerRef.current?.stop(), []);

  const seek = useCallback(
    (position: number) => {
      getPlayer().seek(position);
      bump();
    },
    [getPlayer]
  );

  const setRate = useCallback(
    (value: number) => {
      const player = getPlayer();
      player.setRate(value);
      setRateState(player.rate);
    },
    [getPlayer]
  );

  const setLoop = useCallback(
    (value: boolean) => {
      getPlayer().setLoop(value);
      setLoopState(value);
    },
    [getPlayer]
  );

  /** Unload everything (e.g. the transcription was discarded) */
  const clear = useCallback(() => {
    playerRef.current?.stop();
    playerRef.current?.load([], 0);
    notesRef.current = [];
    setSource(null);
    setDuration(0);
    bump();
  }, []);

  /** Playhead position in seconds, for components that redraw every frame */
  const getPosition = useCallback(() => playerRef.current?.position ?? 0, []);

  // Stop playing when the app unmounts
  useEffect(() => () => playerRef.current?.dispose(), []);

  return useMemo(
    () => ({
      state,
      source,
      duration,
      rate,
      loop,
      playingNoteIds,
      /** Changes whenever the position jumps while not playing */
      revision,
      load,
      update,
      play,
      pause,
      toggle,
      stop,
      seek,
      setRate,
      setLoop,
      clear,
      getPosition,
    }),
    [state, source, duration, rate, loop, playingNoteIds, revision, load, update, play, pause, toggle, stop, seek, setRate, setLoop, clear, getPosition]
  );
}

export type SequencePlayerControls = ReturnType<typeof useSequencePlayer>;

/**
 * The playhead position, updated every animation frame while playing (and
 * on demand otherwise). Use it only in the small components that show the
 * position, so only they re-render.
 */
export function usePlaybackPosition(
  player: Pick<SequencePlayerControls, 'state' | 'getPosition' | 'revision'>
): number {
  const { state, getPosition, revision } = player;
  const [position, setPosition] = useState(0);

  useEffect(() => {
    let cancel = () => {};
    const frame = () => {
      setPosition(getPosition());
      if (state === 'playing') cancel = nextFrame(frame);
    };
    cancel = nextFrame(frame);
    return () => cancel();
  }, [state, getPosition, revision]);

  return position;
}
