/**
 * @fileoverview Main orchestrator hook for the piano application.
 *
 * This hook is the "brain" of the app — it combines the audio engine
 * and keyboard input hooks into a unified interface. Components only
 * need to call `usePiano()` to get everything they need.
 *
 * ## Responsibilities
 * - Generate notes based on current octave shift
 * - Wire keyboard input to audio engine
 * - Track held and sustained notes for visual feedback (UI glow effects)
 * - Manage volume, octave shift, and sustain controls
 * - Handle keyboard shortcuts (Z/X for octave, Space for sustain)
 *
 * ## Data Flow
 * ```
 * Keyboard Press → useKeyboardInput → handleNoteStart → useAudioEngine.playNote
 *                                                     → activeNoteIds (→ UI update)
 *
 * Keyboard Release → useKeyboardInput → handleNoteStop → sustain off: useAudioEngine.stopNote
 *                                                      → sustain on:  sustainedNoteIds (keeps ringing)
 * ```
 *
 * ## Usage
 * ```tsx
 * const { notes, activeNoteIds, sustainedNoteIds, config, ...controls } = usePiano();
 * return <Piano notes={notes} activeNoteIds={activeNoteIds} {...controls} />;
 * ```
 */

'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { PianoConfig } from '@/types';
import { generateNotes } from '@/lib/notes';
import { isTypingTarget } from '@/lib/dom';
import { DEFAULT_VOLUME, MIN_OCTAVE_SHIFT, MAX_OCTAVE_SHIFT } from '@/lib/constants';
import { useAudioEngine } from './useAudioEngine';
import { useKeyboardInput } from './useKeyboardInput';

export function usePiano() {
  // ── State ──────────────────────────────────────────────────────────────
  const [config, setConfig] = useState<PianoConfig>({
    volume: DEFAULT_VOLUME,
    octaveShift: 0,
    sustain: false,
  });

  /** Notes whose key is currently held down (keyboard, mouse or touch) */
  const [activeNoteIds, setActiveNoteIds] = useState<Set<string>>(() => new Set());

  /** Notes released while sustain is on — key is up but the note still rings */
  const [sustainedNoteIds, setSustainedNoteIds] = useState<Set<string>>(() => new Set());

  // Refs mirror the note sets and sustain flag so event handlers always see
  // the latest values synchronously (state updates are applied on next render).
  const heldRef = useRef<Set<string>>(new Set());
  const sustainedRef = useRef<Set<string>>(new Set());
  const sustainRef = useRef(false);

  // ── Derived Data ───────────────────────────────────────────────────────

  /** Generate notes array whenever octave shift changes */
  const notes = useMemo(
    () => generateNotes(config.octaveShift),
    [config.octaveShift]
  );

  // ── Audio Engine ───────────────────────────────────────────────────────
  const { playNote, stopNote, stopAllNotes, setVolume } = useAudioEngine();

  /** Publish the ref sets to React state so the UI re-renders */
  const syncNoteState = useCallback(() => {
    setActiveNoteIds(new Set(heldRef.current));
    setSustainedNoteIds(new Set(sustainedRef.current));
  }, []);

  /** Silence everything and clear all visual state */
  const releaseAllNotes = useCallback(() => {
    stopAllNotes();
    heldRef.current.clear();
    sustainedRef.current.clear();
    syncNoteState();
  }, [stopAllNotes, syncNoteState]);

  // ── Note Handlers ──────────────────────────────────────────────────────

  /** Start playing a note (triggered by keyboard or mouse) */
  const handleNoteStart = useCallback(
    (noteId: string, frequency: number) => {
      // Already held via another input (e.g. mouse + keyboard on the same key)
      if (heldRef.current.has(noteId)) return;

      playNote(noteId, frequency);
      heldRef.current.add(noteId);
      sustainedRef.current.delete(noteId);
      syncNoteState();
    },
    [playNote, syncNoteState]
  );

  /** Stop playing a note (respects sustain setting) */
  const handleNoteStop = useCallback(
    (noteId: string) => {
      // Ignore releases for notes that aren't held — e.g. the octave
      // changed (which already silenced everything) while a key was down.
      if (!heldRef.current.delete(noteId)) return;

      if (sustainRef.current) {
        // Sustain ON: the key comes up but the note keeps ringing
        sustainedRef.current.add(noteId);
      } else {
        stopNote(noteId);
      }
      syncNoteState();
    },
    [stopNote, syncNoteState]
  );

  // ── Keyboard Input ─────────────────────────────────────────────────────

  useKeyboardInput({
    notes,
    onNoteStart: handleNoteStart,
    onNoteStop: handleNoteStop,
  });

  // ── Control Handlers ───────────────────────────────────────────────────

  /** Update master volume */
  const handleVolumeChange = useCallback(
    (volume: number) => {
      const clamped = Math.max(0, Math.min(1, volume));
      setConfig((prev) => ({ ...prev, volume: clamped }));
      setVolume(clamped);
    },
    [setVolume]
  );

  /** Shift the octave range (clamped to min/max) */
  const handleOctaveChange = useCallback(
    (octaveShift: number) => {
      const clamped = Math.max(
        MIN_OCTAVE_SHIFT,
        Math.min(MAX_OCTAVE_SHIFT, octaveShift)
      );
      if (clamped === config.octaveShift) return;

      // Stop all notes when changing octave to prevent ghost notes
      releaseAllNotes();
      setConfig((prev) => ({ ...prev, octaveShift: clamped }));
    },
    [config.octaveShift, releaseAllNotes]
  );

  /** Toggle sustain pedal */
  const handleSustainToggle = useCallback(() => {
    const newSustain = !sustainRef.current;
    sustainRef.current = newSustain;

    if (!newSustain) {
      // Pedal up: sustained notes fade out naturally; keys still held keep sounding
      sustainedRef.current.forEach((noteId) => stopNote(noteId));
      sustainedRef.current.clear();
      syncNoteState();
    }

    setConfig((prev) => ({ ...prev, sustain: newSustain }));
  }, [stopNote, syncNoteState]);

  // ── Keyboard Shortcuts for Controls ────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      // Leave browser/OS shortcuts alone (Ctrl+Z undo, Ctrl+X cut, …)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'z':
          if (e.repeat) return;
          e.preventDefault();
          handleOctaveChange(config.octaveShift - 1);
          break;
        case 'x':
          if (e.repeat) return;
          e.preventDefault();
          handleOctaveChange(config.octaveShift + 1);
          break;
        case ' ':
          // A keyboard-focused button uses Space to activate itself
          if (e.target instanceof HTMLButtonElement) return;
          // Always prevent page scroll, but only toggle once per press
          e.preventDefault();
          if (!e.repeat) handleSustainToggle();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config.octaveShift, handleOctaveChange, handleSustainToggle]);

  // ── Mouse/Touch Handlers ───────────────────────────────────────────────

  /** Start a note via mouse/touch (looks up frequency from notes array) */
  const handleMouseNoteStart = useCallback(
    (noteId: string) => {
      const note = notes.find((n) => n.id === noteId);
      if (note) {
        handleNoteStart(note.id, note.frequency);
      }
    },
    [notes, handleNoteStart]
  );

  /** Stop a note via mouse/touch */
  const handleMouseNoteStop = useCallback(
    (noteId: string) => {
      handleNoteStop(noteId);
    },
    [handleNoteStop]
  );

  // ── Public API ─────────────────────────────────────────────────────────

  return {
    /** Array of Note objects for the current octave range */
    notes,
    /** Set of currently held note IDs (for visual feedback) */
    activeNoteIds,
    /** Set of note IDs still ringing from the sustain pedal */
    sustainedNoteIds,
    /** Current piano configuration (volume, octave, sustain) */
    config,
    /** Mouse/touch note start handler */
    onNoteStart: handleMouseNoteStart,
    /** Mouse/touch note stop handler */
    onNoteStop: handleMouseNoteStop,
    /** Volume change handler */
    onVolumeChange: handleVolumeChange,
    /** Octave shift handler */
    onOctaveChange: handleOctaveChange,
    /** Sustain toggle handler */
    onSustainToggle: handleSustainToggle,
  };
}
