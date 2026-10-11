/**
 * @fileoverview Client root of the app.
 *
 * Creates the hooks once and wires them together:
 *
 * ```
 * useAudioEngine ──► usePiano ◄── useRecorder (captures actions, plays them back)
 *        │    │          ▲ settings
 *        │    │          │
 *        │    └──► useSequencePlayer ◄── useTranscription (Audio to Piano)
 *        │              ▲
 *        │              └── Notes library
 *        └─────────► useMetronome
 * ```
 *
 * then lays out the page:
 *
 * ```
 *  header (name, links)                 header
 *  control panel (volume · LCD · rec)   control panel
 *  keyboard  ← pinned at the top        pedals
 *  pedals                               function pages
 *  function pages (Voice … Audio)       key guide
 *  key guide                            keyboard ← docked at the bottom
 *        tablet / desktop                     phone (ADR 0015)
 * ```
 *
 * Either way the keys stay on screen while a long song list or a piano
 * roll scrolls past, so you can watch them light up as you browse. The
 * `dock` and `pin` variants are defined in globals.css. Kept separate from
 * the page so the page can stay a Server Component.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PianoNoteEvent } from '@/types';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { usePiano } from '@/hooks/usePiano';
import { useMetronome } from '@/hooks/useMetronome';
import { useRecorder } from '@/hooks/useRecorder';
import { useSequencePlayer } from '@/hooks/useSequencePlayer';
import { useTranscription } from '@/hooks/useTranscription';
import { useKeyboardLabels } from '@/hooks/useKeyboardLabels';
import { getVoice } from '@/lib/audio/voices';
import { bestOctaveShift } from '@/lib/music/keyboard-map';
import { voiceNote } from '@/lib/voicing';
import { MAX_OCTAVE_SHIFT, MIN_OCTAVE_SHIFT } from '@/lib/constants';
import ConsolePanel from './console/ConsolePanel';
import Workspace from './console/Workspace';
import { TabId } from './console/FunctionTabs';
import AppHeader from './layout/AppHeader';
import Piano from './piano/Piano';
import PedalUnit from './piano/PedalUnit';
import PadButton from './ui/PadButton';
import KeyGuide from './KeyGuide';
import ShortcutsDialog from './ShortcutsDialog';

export default function PianoApp() {
  const audio = useAudioEngine();
  const recorder = useRecorder();
  const piano = usePiano({ audio, onPerformanceAction: recorder.capture });
  const metronome = useMetronome(audio);
  const { settingsRef, updateSettings } = piano;

  /** When a piece starts, move the keyboard to where its notes are, so they light up in view */
  const fitKeyboard = useCallback(
    (midis: number[]) => {
      const current = settingsRef.current.octaveShift;
      const best = bestOctaveShift(midis, current);
      if (best !== current) updateSettings({ octaveShift: best });
    },
    [settingsRef, updateSettings]
  );
  const player = useSequencePlayer({ audio, settingsRef, onStart: fitKeyboard });
  const transcription = useTranscription(player);
  const labels = useKeyboardLabels();

  const [tab, setTab] = useState<TabId>('voice');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);

  // Publish the keyboard's height, so content scrolled into view stays clear of it (globals.css)
  useEffect(() => {
    const keyboard = keyboardRef.current;
    if (!keyboard || typeof ResizeObserver !== 'function') return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty('--keyboard-height', `${keyboard.offsetHeight}px`));
    observer.observe(keyboard);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--keyboard-height');
    };
  }, []);

  /** Open a page and bring it into view (scroll-padding keeps it clear of the keyboard) */
  const openTab = (next: TabId) => {
    setTab(next);
    workspaceRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  /** The editor's "Preview note": sound one note now, with the current voice */
  const previewNote = useCallback(
    (note: PianoNoteEvent) => {
      audio.start();
      const now = audio.getCurrentTime() + 0.02;
      const { frequency, options } = voiceNote(note.midi, settingsRef.current, note.velocity);
      audio.scheduleNote(frequency, options, now, now + Math.min(2, note.endTime - note.startTime));
    },
    [audio, settingsRef]
  );

  const { settings } = piano;
  const split =
    settings.mode === 'split'
      ? {
          index: settings.splitIndex,
          leftLabel: getVoice(settings.splitVoice).name,
          rightLabel: getVoice(settings.voice).name,
        }
      : null;

  return (
    <div className="flex flex-col">
      <AppHeader onNavigate={openTab} onShowShortcuts={() => setShortcutsOpen(true)} />

      {/* Cabinet, top: the control panel (a whole panel of its own when the keyboard is docked) */}
      <div className="mt-4 rounded-t-[18px] bg-linear-to-b from-[var(--cabinet-edge)] to-cabinet px-2 pt-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.07)] dock:rounded-b-[18px] dock:pb-2 sm:mt-6 sm:px-3 sm:pt-3">
        <ConsolePanel piano={piano} metronome={metronome} recorder={recorder} player={player} />
      </div>

      {/* Cabinet, bottom: the keyboard. Docked to the bottom of a phone screen, pinned to the
          top of a tall one, so the keys stay in view while you scroll */}
      <div
        ref={keyboardRef}
        className="z-30 dock:sticky dock:bottom-0 dock:order-last dock:mt-6 pin:sticky pin:top-0"
      >
        <div className="rounded-b-[18px] bg-linear-to-b from-cabinet to-[#0b0a0d] px-2 pb-2 shadow-[0_40px_90px_-30px_rgb(0_0_0/0.85)] dock:rounded-b-none dock:rounded-t-[18px] dock:pb-[max(0.5rem,env(safe-area-inset-bottom))] dock:shadow-[0_-18px_40px_-12px_rgb(0_0_0/0.9)] sm:px-3 sm:pb-3">
          <div className="rounded-b-[14px] bg-[#0c0a0e] pb-3 pt-3 dock:rounded-[14px] dock:pb-2 dock:pt-2.5 sm:pb-4">
            <Piano
              notes={piano.notes}
              labels={labels}
              activeNoteIds={piano.activeNoteIds}
              sustainedNoteIds={piano.sustainedNoteIds}
              playbackNoteIds={player.playingNoteIds}
              onNoteOn={piano.noteOn}
              onNoteOff={piano.noteOff}
              split={split}
              octave={{
                shift: settings.octaveShift,
                min: MIN_OCTAVE_SHIFT,
                max: MAX_OCTAVE_SHIFT,
                onChange: (octaveShift) => updateSettings({ octaveShift }),
              }}
              toolbarEnd={
                <PadButton onClick={piano.releaseAll} className="h-9 px-3 text-xs text-ink-muted hover:text-ink">
                  All notes off
                </PadButton>
              }
            />
          </div>
        </div>
      </div>

      <PedalUnit pedals={piano.pedals} onToggle={piano.togglePedal} />

      <section
        ref={workspaceRef}
        aria-label="Functions"
        className="mt-6 rounded-[18px] bg-panel px-3 pb-5 pt-1 shadow-[inset_0_1px_0_var(--sheen),0_30px_60px_-30px_rgb(0_0_0/0.8)] sm:mt-8 sm:px-6 sm:pb-6"
      >
        <Workspace
          tab={tab}
          onTabChange={setTab}
          piano={piano}
          metronome={metronome}
          player={player}
          transcription={transcription}
          onPreviewNote={previewNote}
        />
      </section>

      {/* The computer-key legend, where there's likely a keyboard to use it */}
      <div className="mt-10 hidden md:block">
        <KeyGuide notes={piano.notes} />
      </div>

      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} notes={piano.notes} />
    </div>
  );
}
