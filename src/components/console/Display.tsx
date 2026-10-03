/**
 * @fileoverview The backlit LCD: a dot-matrix readout of the instrument's state.
 *
 * Like the screen on a digital piano, it shows what you'd otherwise have to
 * remember: the voice (or both voices in layer/split mode), tuning, tempo,
 * recorder status, pedals, and the notes sounding right now. Values at
 * their default are dimmed, so anything you've changed stands out.
 */

'use client';

import { PedalState, PianoSettings, RecorderStatus } from '@/types';
import { getVoice } from '@/lib/audio/voices';
import { getTemperament } from '@/lib/music/tuning';
import { KEY_NAMES } from '@/lib/music/notes';
import { DEFAULT_REFERENCE_PITCH } from '@/lib/constants';
import Led from '../ui/Led';

interface DisplayProps {
  settings: PianoSettings;
  pedals: PedalState;
  /** Ids of sounding notes, low to high */
  soundingNotes: string[];
  metronome: { running: boolean; bpm: number; timeSignature: string; beat: number | null; beatsPerBar: number };
  recorder: { status: RecorderStatus; elapsed: number; duration: number };
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** One status readout: bright when changed from its default, dim otherwise */
function Cell({ label, value, changed }: { label: string; value: string; changed: boolean }) {
  return (
    <span className={`whitespace-nowrap ${changed ? 'text-led' : 'text-led/35'}`}>
      <span className="text-led/50">{label}</span> {value}
    </span>
  );
}

export default function Display({ settings, pedals, soundingNotes, metronome, recorder }: DisplayProps) {
  const main = getVoice(settings.voice).name;
  const temperament = getTemperament(settings.temperament);

  const subtitle =
    settings.mode === 'layer'
      ? `+ ${getVoice(settings.layerVoice).name}`
      : settings.mode === 'split'
        ? `Left hand: ${getVoice(settings.splitVoice).name}`
        : null;

  const recorderText =
    recorder.status === 'recording'
      ? `Rec ${formatTime(recorder.elapsed)}`
      : recorder.status === 'playing'
        ? `Play ${formatTime(recorder.elapsed)}`
        : recorder.duration > 0
          ? `Take ${formatTime(recorder.duration)}`
          : 'No take';

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-lcd-glass p-[3px] shadow-[inset_0_2px_6px_rgb(0_0_0/0.9),0_1px_0_rgb(255_255_255/0.06)]"
      aria-label="Display"
      role="group"
    >
      <div className="lcd-grid relative flex h-full min-h-[124px] flex-col justify-between gap-2.5 rounded-md px-4 py-3 font-lcd text-led [text-shadow:0_0_6px_rgb(255_181_71/0.45)]">
        {/* Row 1: voice(s) + tempo */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-2xl leading-tight sm:text-[1.7rem]">{main}</p>
            <p className={`truncate text-sm ${subtitle ? 'text-led/80' : 'text-led/25'}`}>
              {subtitle ?? 'Single voice'}
            </p>
          </div>
          <div className={`shrink-0 text-right ${metronome.running ? 'text-led' : 'text-led/35'}`}>
            <p className="text-xl leading-tight">♩ {metronome.bpm}</p>
            <div className="mt-1 flex items-center justify-end gap-1.5" aria-hidden="true">
              <span className="text-xs text-led/60">{metronome.timeSignature}</span>
              {Array.from({ length: metronome.beatsPerBar }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-colors duration-75 ${
                    metronome.beat === i ? 'bg-led shadow-[0_0_6px_var(--led)]' : 'bg-led/15'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: tuning + recorder */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
          <Cell label="Transpose" value={signed(settings.transpose)} changed={settings.transpose !== 0} />
          <Cell label="Octave" value={signed(settings.octaveShift)} changed={settings.octaveShift !== 0} />
          <Cell
            label="A4"
            value={`${settings.referencePitch.toFixed(1)} Hz`}
            changed={settings.referencePitch !== DEFAULT_REFERENCE_PITCH}
          />
          <Cell
            label="Tuning"
            value={
              settings.temperament === 'equal'
                ? temperament.name
                : `${temperament.name} in ${KEY_NAMES[settings.temperamentRoot]}`
            }
            changed={settings.temperament !== 'equal'}
          />
          <span className="ml-auto flex items-center gap-2 whitespace-nowrap">
            <Led on={recorder.status === 'recording'} tone="red" blink />
            <span className={recorder.status === 'idle' && recorder.duration === 0 ? 'text-led/35' : 'text-led'}>
              {recorderText}
            </span>
          </span>
        </div>

        {/* Row 3: sounding notes + pedals */}
        <div className="flex items-center justify-between gap-4 text-sm">
          <p className="min-w-0 truncate" aria-live="polite" aria-label="Now playing">
            {soundingNotes.length > 0 ? (
              <span>♪ {soundingNotes.join(' ')}</span>
            ) : (
              <span className="text-led/30">Play a note</span>
            )}
          </p>
          <div className="flex shrink-0 gap-3 text-xs">
            <span className={pedals.soft ? 'text-led' : 'text-led/25'}>Soft</span>
            <span className={pedals.sostenuto ? 'text-led' : 'text-led/25'}>Sost</span>
            <span className={pedals.sustain ? 'text-led' : 'text-led/25'}>Sus</span>
          </div>
        </div>
      </div>
    </div>
  );
}
