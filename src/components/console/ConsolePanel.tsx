/**
 * @fileoverview The control panel on top of the cabinet.
 *
 * ```
 * ┌──────────┬──────────────────────────────┬────────────┐
 * │ Volume   │ LCD display                  │ Recorder   │
 * └──────────┴──────────────────────────────┴────────────┘
 * ```
 *
 * On phones the LCD comes first, full width, with volume and recorder side
 * by side below it, so the keyboard starts high on the screen.
 *
 * The function pages (Voice … Audio to Piano) live in `Workspace`, below
 * the keyboard, so opening a large page never pushes the keys away.
 */

'use client';

import { usePiano } from '@/hooks/usePiano';
import { useMetronome } from '@/hooks/useMetronome';
import { useRecorder } from '@/hooks/useRecorder';
import { SequencePlayerControls } from '@/hooks/useSequencePlayer';
import { noteIdToMidi } from '@/lib/music/notes';
import Knob from '../ui/Knob';
import Display from './Display';
import Transport from './Transport';

interface ConsolePanelProps {
  piano: ReturnType<typeof usePiano>;
  metronome: ReturnType<typeof useMetronome>;
  recorder: ReturnType<typeof useRecorder>;
  player: SequencePlayerControls;
}

const percent = (v: number) => `${Math.round(v * 100)}%`;

export default function ConsolePanel({ piano, metronome, recorder, player }: ConsolePanelProps) {
  const { settings, updateSettings } = piano;

  // Everything sounding: your keys, pedal-held notes and playback, low to high
  const soundingNotes = [...new Set([...piano.activeNoteIds, ...piano.sustainedNoteIds, ...player.playingNoteIds])].sort(
    (a, b) => (noteIdToMidi(a) ?? 0) - (noteIdToMidi(b) ?? 0)
  );

  return (
    <section
      aria-label="Control panel"
      className="rounded-t-[14px] bg-panel px-3 pb-4 pt-3 shadow-[inset_0_1px_0_var(--sheen)] sm:px-6 sm:pb-5 sm:pt-4"
      style={{
        backgroundImage: 'repeating-linear-gradient(0deg, rgb(255 255 255 / 0.012) 0 1px, transparent 1px 3px)',
      }}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 sm:gap-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-stretch">
        <div className="order-1 col-span-2 sm:order-none sm:col-span-1 sm:col-start-2 sm:row-start-1">
          <Display
            settings={settings}
            pedals={piano.pedals}
            soundingNotes={soundingNotes}
            metronome={metronome}
            recorder={recorder}
            playback={player.source && player.state !== 'stopped' ? { title: player.source.title, state: player.state } : null}
          />
        </div>

        <div className="order-2 flex items-center gap-3 sm:order-none sm:col-start-1 sm:row-start-1 sm:flex-col sm:justify-center sm:gap-2 sm:pr-1">
          <Knob
            label="Master volume"
            value={settings.volume}
            min={0}
            max={1}
            step={0.01}
            size={72}
            onChange={(volume) => updateSettings({ volume })}
            format={percent}
          />
          <div className="text-left sm:text-center">
            <p className="text-sm text-ink-muted">Volume</p>
            <p className="text-sm tabular-nums text-ink">{percent(settings.volume)}</p>
          </div>
        </div>

        <div className="order-3 min-w-0 sm:order-none sm:col-span-2 lg:col-span-1 lg:w-60 lg:border-l lg:border-black/50 lg:pl-5 lg:shadow-[inset_1px_0_0_rgb(255_255_255/0.04)]">
          <Transport
            status={recorder.status}
            duration={recorder.duration}
            hasRecording={recorder.hasRecording}
            onRecord={recorder.record}
            onPlay={() => recorder.play(piano)}
            onStop={recorder.stop}
            onClear={recorder.clear}
          />
        </div>
      </div>
    </section>
  );
}
