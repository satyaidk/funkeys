/**
 * @fileoverview The control panel on top of the cabinet.
 *
 * ```
 * ┌──────────┬──────────────────────────────┬────────────┐
 * │ Volume   │ LCD display                  │ Recorder   │
 * ├──────────┴──────────────────────────────┴────────────┤
 * │ Voice │ Layer & split │ Sound │ Tuning │ Metronome │ Notes │
 * │ …selected function page…                             │
 * └──────────────────────────────────────────────────────┘
 * ```
 *
 * A container component: it receives the piano, metronome, recorder and
 * looper controllers and hands each panel only the values and callbacks it needs.
 */

'use client';

import { DEFAULT_SETTINGS } from '@/lib/settings';
import { usePiano } from '@/hooks/usePiano';
import { useMetronome } from '@/hooks/useMetronome';
import { useRecorder } from '@/hooks/useRecorder';
import { useLooper } from '@/hooks/useLooper';
import Knob from '../ui/Knob';
import PadButton from '../ui/PadButton';
import Display from './Display';
import Transport from './Transport';
import FunctionTabs from './FunctionTabs';
import VoicePanel from './panels/VoicePanel';
import LayerSplitPanel from './panels/LayerSplitPanel';
import SoundPanel from './panels/SoundPanel';
import TuningPanel from './panels/TuningPanel';
import MetronomePanel from './panels/MetronomePanel';
import NotesPanel from './panels/NotesPanel';

interface ConsolePanelProps {
  piano: ReturnType<typeof usePiano>;
  metronome: ReturnType<typeof useMetronome>;
  recorder: ReturnType<typeof useRecorder>;
  looper: ReturnType<typeof useLooper>;
}

const percent = (v: number) => `${Math.round(v * 100)}%`;

export default function ConsolePanel({ piano, metronome, recorder, looper }: ConsolePanelProps) {
  const { settings, updateSettings, notes } = piano;

  const soundingNotes = notes
    .filter((n) => piano.activeNoteIds.has(n.id) || piano.sustainedNoteIds.has(n.id))
    .map((n) => n.id);

  const tuningChanged =
    settings.transpose !== 0 ||
    settings.referencePitch !== DEFAULT_SETTINGS.referencePitch ||
    settings.temperament !== 'equal';

  const soundChanged =
    settings.reverb !== DEFAULT_SETTINGS.reverb ||
    settings.reverbLevel !== DEFAULT_SETTINGS.reverbLevel ||
    settings.brilliance !== DEFAULT_SETTINGS.brilliance ||
    settings.touch !== DEFAULT_SETTINGS.touch;

  return (
    <section
      aria-label="Control panel"
      className="rounded-t-[14px] bg-panel px-4 pb-5 pt-4 shadow-[inset_0_1px_0_var(--sheen)] sm:px-6"
      style={{
        backgroundImage: 'repeating-linear-gradient(0deg, rgb(255 255 255 / 0.012) 0 1px, transparent 1px 3px)',
      }}
    >
      <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-stretch">
        <div className="flex items-center gap-4 sm:flex-col sm:items-center sm:justify-center sm:gap-2 sm:pr-1">
          <Knob
            label="Master volume"
            value={settings.volume}
            min={0}
            max={1}
            step={0.01}
            size={84}
            onChange={(volume) => updateSettings({ volume })}
            format={percent}
          />
          <div className="text-left sm:text-center">
            <p className="text-sm text-ink-muted">Volume</p>
            <p className="text-sm tabular-nums text-ink">{percent(settings.volume)}</p>
          </div>
        </div>

        <Display
          settings={settings}
          pedals={piano.pedals}
          soundingNotes={soundingNotes}
          metronome={metronome}
          recorder={recorder}
        />

        <div className="sm:col-span-2 lg:col-span-1 lg:w-60 lg:border-l lg:border-black/50 lg:pl-5 lg:shadow-[inset_1px_0_0_rgb(255_255_255/0.04)]">
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

      <div className="mt-4">
        <FunctionTabs
          indicators={{
            voice: settings.voice !== DEFAULT_SETTINGS.voice,
            layer: settings.mode !== 'single',
            sound: soundChanged,
            tuning: tuningChanged,
            metronome: metronome.running,
            notes: looper.playing,
          }}
          actions={
            <PadButton onClick={piano.releaseAll} className="px-3 py-1.5 text-xs text-ink-muted hover:text-ink">
              All notes off
            </PadButton>
          }
          panels={{
            voice: <VoicePanel voice={settings.voice} onChange={(voice) => updateSettings({ voice })} />,
            layer: <LayerSplitPanel settings={settings} notes={notes} onChange={updateSettings} />,
            sound: <SoundPanel settings={settings} onChange={updateSettings} />,
            tuning: <TuningPanel settings={settings} onChange={updateSettings} />,
            metronome: (
              <MetronomePanel
                running={metronome.running}
                bpm={metronome.bpm}
                timeSignature={metronome.timeSignature}
                beatsPerBar={metronome.beatsPerBar}
                accents={metronome.accents}
                beat={metronome.beat}
                volume={metronome.volume}
                onToggle={metronome.toggle}
                onBpmChange={metronome.setBpm}
                onTimeSignatureChange={metronome.setTimeSignature}
                onVolumeChange={metronome.setVolume}
                onTap={metronome.tap}
              />
            ),
            notes: (
              <NotesPanel
                riffs={looper.riffs}
                riffId={looper.riffId}
                speed={looper.speed}
                playing={looper.playing}
                onToggle={looper.toggle}
                onSelect={looper.select}
                onSpeedChange={looper.setSpeed}
              />
            ),
          }}
        />
      </div>
    </section>
  );
}
