/**
 * @fileoverview Main orchestrator hook for the piano.
 *
 * Combines keyboard input, the pedal state machine, voice routing, tuning
 * and the audio engine into one interface. Components call `usePiano()` and
 * get everything they need to render and play.
 *
 * ## Responsibilities
 * - Notes for the current octave, and which are held or ringing
 * - Settings (voice, mode, tuning, effects, touch), always validated
 * - The three pedals, from the keyboard, the screen or a recording
 * - Turning a key press into sound: voices → frequency → velocity → engine
 * - Control shortcuts: ←/→ octave, ↑/↓ transpose, Space sustain, Shift soft
 *
 * ## Data flow
 * ```
 * key / pointer / playback ─► noteOn(id) ─► NoteTracker.press ─► audio.playNote
 *                                                             └► onPerformanceAction (recorder)
 * key up                   ─► noteOff(id) ─► NoteTracker.release ─► 'stop' → audio.stopNote
 *                                                                  'sustain' → keeps ringing
 * pedal up                 ─► NoteTracker.setSustain(false) ─► notes to stop ─► audio.stopNote
 * ```
 */

'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { PedalName, PedalState, PerformanceAction, PianoSettings } from '@/types';
import { generateNotes } from '@/lib/music/keyboard-map';
import { getMidiNumber, noteIdToMidi } from '@/lib/music/notes';
import { midiToFrequency } from '@/lib/music/tuning';
import { resolveVoices } from '@/lib/audio/voices';
import { applyTouchCurve } from '@/lib/audio/dynamics';
import { NoteTracker } from '@/lib/note-tracker';
import { DEFAULT_SETTINGS, sanitizeSettings } from '@/lib/settings';
import { isTypingTarget } from '@/lib/dom';
import { BASE_OCTAVE, KEYBOARD_VELOCITY } from '@/lib/constants';
import { AudioControls } from './useAudioEngine';
import { useKeyboardInput } from './useKeyboardInput';

/** Who is holding a pedal down. A pedal is down while any source holds it. */
export type PedalSource = 'keyboard' | 'screen' | 'playback';

const PEDALS_UP: PedalState = { soft: false, sostenuto: false, sustain: false };

export interface UsePianoOptions {
  audio: AudioControls;
  /** Receives every note and pedal action (used by the recorder) */
  onPerformanceAction?: (action: PerformanceAction) => void;
}

export function usePiano({ audio, onPerformanceAction }: UsePianoOptions) {
  // ── State ──────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<PianoSettings>(DEFAULT_SETTINGS);
  const [pedals, setPedals] = useState<PedalState>(PEDALS_UP);
  /** Notes whose key is down (keyboard, pointer or playback) */
  const [activeNoteIds, setActiveNoteIds] = useState<ReadonlySet<string>>(() => new Set());
  /** Notes whose key is up but a pedal keeps ringing */
  const [sustainedNoteIds, setSustainedNoteIds] = useState<ReadonlySet<string>>(() => new Set());

  // Refs mirror state so event handlers always read the latest values
  // synchronously (see ADR 0002). Rule: mutate the ref, then sync to state.
  const [tracker] = useState(() => new NoteTracker());
  const settingsRef = useRef(settings);
  const pedalsRef = useRef(pedals);
  const pedalSourcesRef = useRef<Record<PedalName, Set<PedalSource>>>({
    soft: new Set(),
    sostenuto: new Set(),
    sustain: new Set(),
  });
  const onActionRef = useRef(onPerformanceAction);
  useEffect(() => {
    onActionRef.current = onPerformanceAction;
  }, [onPerformanceAction]);

  const notes = useMemo(() => generateNotes(settings.octaveShift), [settings.octaveShift]);

  // ── Keep the engine in sync with sound settings ───────────────────────
  useEffect(() => audio.setVolume(settings.volume), [audio, settings.volume]);
  useEffect(
    () => audio.setReverb(settings.reverb, settings.reverbLevel),
    [audio, settings.reverb, settings.reverbLevel]
  );
  useEffect(() => audio.setBrilliance(settings.brilliance), [audio, settings.brilliance]);

  /** Publish the tracker's sets to React state so the UI re-renders */
  const syncNotes = useCallback(() => {
    setActiveNoteIds(new Set(tracker.heldIds));
    setSustainedNoteIds(new Set(tracker.ringingIds));
  }, [tracker]);

  // ── Notes ──────────────────────────────────────────────────────────────

  /**
   * Start a note by id.
   * @param rawVelocity - Playing strength before the touch curve (0–1)
   */
  const noteOn = useCallback(
    (noteId: string, rawVelocity: number = KEYBOARD_VELOCITY) => {
      const midi = noteIdToMidi(noteId);
      if (midi === null || !tracker.press(noteId)) return;

      const s = settingsRef.current;
      const lowestKeyMidi = getMidiNumber('C', BASE_OCTAVE + s.octaveShift);
      audio.playNote(noteId, midiToFrequency(midi, s), {
        voices: resolveVoices(s, midi - lowestKeyMidi),
        velocity: applyTouchCurve(rawVelocity, s.touch),
        midi: midi + s.transpose,
        soft: pedalsRef.current.soft,
      });
      onActionRef.current?.({ type: 'noteOn', noteId, velocity: rawVelocity });
      syncNotes();
    },
    [audio, tracker, syncNotes]
  );

  /** Release a note by id (it may keep ringing if a pedal holds it) */
  const noteOff = useCallback(
    (noteId: string) => {
      const outcome = tracker.release(noteId);
      if (outcome === 'ignore') return;
      if (outcome === 'stop') audio.stopNote(noteId);
      onActionRef.current?.({ type: 'noteOff', noteId });
      syncNotes();
    },
    [audio, tracker, syncNotes]
  );

  /** Silence everything ("all notes off"). Pedal positions are kept. */
  const releaseAll = useCallback(() => {
    audio.stopAllNotes();
    tracker.clearNotes();
    syncNotes();
  }, [audio, tracker, syncNotes]);

  useKeyboardInput({ notes, onNoteStart: noteOn, onNoteStop: noteOff });

  // ── Pedals ─────────────────────────────────────────────────────────────

  /** Press or lift a pedal on behalf of one source */
  const setPedal = useCallback(
    (pedal: PedalName, down: boolean, source: PedalSource = 'screen') => {
      const sources = pedalSourcesRef.current[pedal];
      const wasDown = sources.size > 0;
      if (down) sources.add(source);
      else sources.delete(source);
      const isDown = sources.size > 0;
      if (wasDown === isDown) return;

      pedalsRef.current = { ...pedalsRef.current, [pedal]: isDown };
      setPedals(pedalsRef.current);

      const toStop =
        pedal === 'sustain'
          ? tracker.setSustain(isDown)
          : pedal === 'sostenuto'
            ? tracker.setSostenuto(isDown)
            : []; // the soft pedal changes tone, applied to new notes
      toStop.forEach((noteId) => audio.stopNote(noteId));

      onActionRef.current?.({ type: 'pedal', pedal, down: isDown });
      syncNotes();
    },
    [audio, tracker, syncNotes]
  );

  /** On-screen pedals latch: click to press, click again to lift */
  const togglePedal = useCallback(
    (pedal: PedalName) => {
      setPedal(pedal, !pedalSourcesRef.current[pedal].has('screen'), 'screen');
    },
    [setPedal]
  );

  // ── Settings ───────────────────────────────────────────────────────────

  /** Change any settings. Values are validated; an octave change silences held notes. */
  const updateSettings = useCallback(
    (patch: Partial<PianoSettings>) => {
      const previous = settingsRef.current;
      const next = sanitizeSettings({ ...previous, ...patch });
      if (next.octaveShift !== previous.octaveShift) releaseAll();
      settingsRef.current = next;
      setSettings(next);
    },
    [releaseAll]
  );

  // ── Keyboard shortcuts for controls ────────────────────────────────────

  useEffect(() => {
    const ignore = (e: KeyboardEvent) =>
      e.defaultPrevented || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (ignore(e)) return;
      const s = settingsRef.current;

      switch (e.code) {
        case 'ArrowLeft':
        case 'ArrowRight':
          e.preventDefault();
          if (!e.repeat) updateSettings({ octaveShift: s.octaveShift + (e.code === 'ArrowRight' ? 1 : -1) });
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault();
          if (!e.repeat) updateSettings({ transpose: s.transpose + (e.code === 'ArrowUp' ? 1 : -1) });
          break;
        case 'Space':
          // A keyboard-focused button uses Space to activate itself
          if (e.target instanceof HTMLButtonElement) return;
          e.preventDefault(); // no page scroll
          if (!e.repeat) setPedal('sustain', true, 'keyboard');
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          if (!e.repeat) setPedal('soft', true, 'keyboard');
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setPedal('sustain', false, 'keyboard');
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') setPedal('soft', false, 'keyboard');
    };

    /** Keys held while the window loses focus never send keyup */
    const handleBlur = () => {
      setPedal('sustain', false, 'keyboard');
      setPedal('soft', false, 'keyboard');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [updateSettings, setPedal]);

  // ── Public API ─────────────────────────────────────────────────────────

  return {
    /** Keys on the keyboard for the current octave, lowest first */
    notes,
    /** Current settings (validated) */
    settings,
    /** Which pedals are down */
    pedals,
    /** Notes whose key is down */
    activeNoteIds,
    /** Notes still ringing from a pedal */
    sustainedNoteIds,
    updateSettings,
    noteOn,
    noteOff,
    setPedal,
    togglePedal,
    releaseAll,
  };
}

/** The part of the piano a recording can drive */
export type Performer = Pick<ReturnType<typeof usePiano>, 'noteOn' | 'noteOff' | 'setPedal' | 'releaseAll'>;
