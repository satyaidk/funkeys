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
 * then lays out the page, top to bottom, the same at every width:
 *
 * ```
 *  header (name, links)
 *  control panel (volume · LCD · recorder)
 *  keyboard  ← stays in view while you scroll, on screens tall enough
 *  pedals
 *  function pages (Voice … Notes · Audio to Piano)
 *  key guide
 * ```
 *
 * The pages sit *below* the keyboard so a long song list or a piano roll
 * never pushes the keys off screen, and you can watch them light up while
 * you browse. Kept separate from the page so the page can stay a Server
 * Component.
 */

'use client';

import { useCallback, useRef, useState } from 'react';
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

  /** Open a page and scroll it into view, just below the keyboard if that stays on screen */
  const openTab = (next: TabId) => {
    setTab(next);
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const keyboard = keyboardRef.current;
    const sticky = keyboard && getComputedStyle(keyboard).position === 'sticky';
    const offset = sticky ? keyboard.getBoundingClientRect().height + 8 : 12;
    window.scrollTo({ top: window.scrollY + workspace.getBoundingClientRect().top - offset, behavior: 'smooth' });
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

      {/* Cabinet, top: the control panel */}
      <div className="mt-4 rounded-t-[18px] bg-linear-to-b from-[var(--cabinet-edge)] to-cabinet px-2 pt-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.07)] sm:mt-6 sm:px-3 sm:pt-3">
        <ConsolePanel piano={piano} metronome={metronome} recorder={recorder} player={player} />
      </div>

      {/* Cabinet, bottom: the keyboard. It stays in view while you scroll, only where that
          leaves room for the page below it (Tailwind needs the class names written out in full) */}
      <div
        ref={keyboardRef}
        className="z-30 [@media(min-width:768px)_and_(min-height:700px)]:sticky [@media(min-width:768px)_and_(min-height:700px)]:top-0"
      >
        <div className="rounded-b-[18px] bg-linear-to-b from-cabinet to-[#0b0a0d] px-2 pb-2 shadow-[0_40px_90px_-30px_rgb(0_0_0/0.85)] sm:px-3 sm:pb-3">
          <div className="rounded-b-[14px] bg-[#0c0a0e] pb-3 pt-3 sm:pb-4">
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
