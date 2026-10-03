/**
 * @fileoverview Client root of the instrument.
 *
 * Creates the hooks once and wires them together:
 *
 * ```
 * useAudioEngine ──► usePiano ◄── useRecorder (captures actions, plays them back)
 *        │               ▲
 *        │               └──────── useLooper (loops riffs from the Notes page)
 *        └─────────► useMetronome
 * ```
 *
 * then lays out the cabinet: control panel, keyboard, pedals and key guide.
 * Kept separate from the page so the page can stay a Server Component.
 */

'use client';

import { useAudioEngine } from '@/hooks/useAudioEngine';
import { usePiano } from '@/hooks/usePiano';
import { useMetronome } from '@/hooks/useMetronome';
import { useRecorder } from '@/hooks/useRecorder';
import { useLooper } from '@/hooks/useLooper';
import { useKeyboardLabels } from '@/hooks/useKeyboardLabels';
import { getVoice } from '@/lib/audio/voices';
import ConsolePanel from './console/ConsolePanel';
import Piano from './piano/Piano';
import PedalUnit from './piano/PedalUnit';
import KeyGuide from './KeyGuide';

export default function PianoApp() {
  const audio = useAudioEngine();
  const recorder = useRecorder();
  const piano = usePiano({ audio, onPerformanceAction: recorder.capture });
  const metronome = useMetronome(audio);
  const looper = useLooper({ audio, performer: piano, octaveShift: piano.settings.octaveShift });
  const labels = useKeyboardLabels();

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
    <div className="flex flex-col gap-10">
      <div>
        {/* Cabinet */}
        <div className="rounded-[18px] bg-linear-to-b from-[var(--cabinet-edge)] via-cabinet to-[#0b0a0d] p-2 shadow-[0_40px_90px_-30px_rgb(0_0_0/0.85),inset_0_1px_0_rgb(255_255_255/0.07)] sm:p-3">
          <ConsolePanel piano={piano} metronome={metronome} recorder={recorder} looper={looper} />
          <div className="rounded-b-[14px] bg-[#0c0a0e] pb-3 pt-3 sm:pb-4">
            <Piano
              notes={piano.notes}
              labels={labels}
              activeNoteIds={piano.activeNoteIds}
              sustainedNoteIds={piano.sustainedNoteIds}
              onNoteOn={piano.noteOn}
              onNoteOff={piano.noteOff}
              split={split}
            />
          </div>
        </div>
        <PedalUnit pedals={piano.pedals} onToggle={piano.togglePedal} />
      </div>

      <KeyGuide notes={piano.notes} />
    </div>
  );
}
