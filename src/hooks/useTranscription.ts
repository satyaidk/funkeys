/**
 * @fileoverview React hook for the Audio to Piano page: transcribe a
 * recording (or open a MIDI / FunKeys notes file), edit the notes, play them.
 *
 * Lives in `PianoApp`, not in the page component, so a transcription (and
 * your edits) survive switching to another tab, and a long transcription
 * keeps running while you do.
 *
 * ```
 *  file ─► transcribeFile (worker) ─► editor (undo/redo) ─► sequence player
 *                                         │  every edit ────────┘ (carries on playing)
 * ```
 *
 * The recording itself is only kept (in memory) to run it again with other
 * settings; nothing is saved or uploaded.
 */

'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { EMPTY_EDITOR, editorReducer } from '@/lib/transcription/editor';
import {
  TranscriptionError,
  TranscriptionProgress,
  transcribeFile,
} from '@/lib/transcription/transcriber';
import { DEFAULT_TRANSCRIPTION_SETTINGS, TranscriptionSettings } from '@/lib/transcription/notes-from-frames';
import { readMidiFile, MidiParseError } from '@/lib/music/midi-file';
import { parseNotes, NotesFileError } from '@/lib/transcription/notes-file';
import { sanitizeNoteEvents } from '@/lib/music/note-events';
import { SequencePlayerControls } from './useSequencePlayer';

export type TranscriptionStatus = 'idle' | 'working' | 'ready' | 'error';

export interface TranscriptionInfo {
  /** Shown as the piece's title */
  title: string;
  /** Where the notes came from */
  origin: 'audio' | 'midi' | 'notes';
  /** 'webgl' (GPU) or 'cpu', for audio transcriptions */
  backend?: string;
}

const isMidi = (file: File) => /\.(mid|midi)$/i.test(file.name) || file.type === 'audio/midi';
const isNotesFile = (file: File) => /\.json$/i.test(file.name) || file.type === 'application/json';

export function useTranscription(player: SequencePlayerControls) {
  const [status, setStatus] = useState<TranscriptionStatus>('idle');
  const [progress, setProgress] = useState<TranscriptionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<TranscriptionInfo | null>(null);
  const [settings, setSettings] = useState<TranscriptionSettings>(DEFAULT_TRANSCRIPTION_SETTINGS);
  const [editor, dispatch] = useReducer(editorReducer, EMPTY_EDITOR);

  const abortRef = useRef<AbortController | null>(null);
  /** The last recording, kept in memory only so it can be run again with other settings */
  const fileRef = useRef<File | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  const isLoaded = player.source?.kind === 'transcription';

  /** Show notes in the editor and load them into the transport */
  const show = useCallback(
    (title: string, notes: Parameters<typeof player.load>[1], duration: number, next: TranscriptionInfo) => {
      dispatch({ type: 'load', notes: [...notes], duration });
      player.load({ kind: 'transcription', title }, notes, duration, { loop: false });
      setInfo(next);
      setStatus('ready');
      setError(null);
      setProgress(null);
    },
    [player]
  );

  const fail = useCallback((message: string) => {
    setError(message);
    setStatus('error');
    setProgress(null);
  }, []);

  /** Transcribe a recording */
  const transcribe = useCallback(
    async (file: File, withSettings: TranscriptionSettings = settings) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      fileRef.current = file;
      setCanRetry(true);
      setStatus('working');
      setError(null);
      setProgress({ stage: 'reading', fraction: 0 });
      try {
        const result = await transcribeFile(file, withSettings, { signal: controller.signal, onProgress: setProgress });
        if (abortRef.current !== controller) return; // a newer job took over
        show(result.fileName, result.notes, result.duration, { title: result.fileName, origin: 'audio', backend: result.backend });
      } catch (e) {
        if (abortRef.current !== controller) return;
        if (e instanceof TranscriptionError && e.kind === 'cancelled') {
          setStatus(editor.notes.length > 0 ? 'ready' : 'idle');
          setProgress(null);
          return;
        }
        fail(e instanceof Error ? e.message : 'Something went wrong while transcribing.');
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [settings, show, fail, editor.notes.length]
  );

  /** Open any supported file: a recording, a MIDI file or a FunKeys notes file */
  const open = useCallback(
    async (file: File) => {
      try {
        if (isMidi(file)) {
          const { notes, duration } = readMidiFile(new Uint8Array(await file.arrayBuffer()));
          const { notes: valid } = sanitizeNoteEvents(notes.map((n, i) => ({ ...n, id: `m${i}` })));
          if (valid.length === 0) throw new MidiParseError('This MIDI file has no notes.');
          fileRef.current = null;
          setCanRetry(false);
          show(file.name, valid, duration, { title: file.name, origin: 'midi' });
          return;
        }
        if (isNotesFile(file)) {
          const parsed = parseNotes(await file.text());
          fileRef.current = null;
          setCanRetry(false);
          show(parsed.title, parsed.notes, parsed.duration, { title: parsed.title, origin: 'notes' });
          return;
        }
      } catch (e) {
        fail(e instanceof MidiParseError || e instanceof NotesFileError ? e.message : 'This file couldn’t be read.');
        return;
      }
      await transcribe(file);
    },
    [show, fail, transcribe]
  );

  /** Run the last recording again (e.g. with other settings) */
  const retry = useCallback(() => {
    if (fileRef.current) void transcribe(fileRef.current);
  }, [transcribe]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  /** Back to the start: forget the notes and the recording */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    fileRef.current = null;
    setCanRetry(false);
    if (player.source?.kind === 'transcription') player.clear();
    dispatch({ type: 'load', notes: [], duration: 0 });
    setInfo(null);
    setError(null);
    setProgress(null);
    setStatus('idle');
  }, [player]);

  /** Play the notes, loading them into the transport first if a song was playing */
  const play = useCallback(() => {
    if (!isLoaded) player.load({ kind: 'transcription', title: info?.title ?? 'Transcription' }, editor.notes, editor.duration);
    player.play();
  }, [isLoaded, player, info, editor.notes, editor.duration]);

  // Edits go straight to the transport, which carries on from the same place
  const { update } = player;
  useEffect(() => {
    if (isLoaded && status === 'ready') update(editor.notes, editor.duration);
  }, [editor.notes, editor.duration, isLoaded, status, update]);

  // Stop a running job when the app unmounts
  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    status,
    progress,
    error,
    info,
    settings,
    setSettings,
    editor,
    dispatch,
    /** Is the transport holding these notes? */
    isLoaded,
    canRetry,
    open,
    transcribe,
    retry,
    cancel,
    reset,
    play,
  };
}

export type TranscriptionControls = ReturnType<typeof useTranscription>;
