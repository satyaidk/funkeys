/**
 * @fileoverview The function pages, below the keyboard.
 *
 * Voice · Layer & split · Sound · Tuning · Metronome · Notes · Audio to Piano
 *
 * A container component: it receives the controllers and hands each page
 * only the values and callbacks it needs. Each tab's LED lights when its
 * page holds a changed setting or something is running there.
 */

'use client';

import { PianoNoteEvent } from '@/types';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { SONGS } from '@/lib/music/song-library';
import { usePiano } from '@/hooks/usePiano';
import { useMetronome } from '@/hooks/useMetronome';
import { SequencePlayerControls } from '@/hooks/useSequencePlayer';
import { TranscriptionControls } from '@/hooks/useTranscription';
import FunctionTabs, { TabId } from './FunctionTabs';
import VoicePanel from './panels/VoicePanel';
import LayerSplitPanel from './panels/LayerSplitPanel';
import SoundPanel from './panels/SoundPanel';
import TuningPanel from './panels/TuningPanel';
import MetronomePanel from './panels/MetronomePanel';
import NotesPanel from './panels/NotesPanel';
import AudioPanel from '../transcription/AudioPanel';

interface WorkspaceProps {
  tab: TabId;
  onTabChange: (tab: TabId) => void;
  piano: ReturnType<typeof usePiano>;
  metronome: ReturnType<typeof useMetronome>;
  player: SequencePlayerControls;
  transcription: TranscriptionControls;
  onPreviewNote: (note: PianoNoteEvent) => void;
}

export default function Workspace({ tab, onTabChange, piano, metronome, player, transcription, onPreviewNote }: WorkspaceProps) {
  const { settings, updateSettings, notes } = piano;
  const playing = (kind: 'song' | 'transcription') => player.state === 'playing' && player.source?.kind === kind;

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
    <FunctionTabs
      value={tab}
      onChange={onTabChange}
      indicators={{
        voice: settings.voice !== DEFAULT_SETTINGS.voice,
        layer: settings.mode !== 'single',
        sound: soundChanged,
        tuning: tuningChanged,
        metronome: metronome.running,
        notes: playing('song'),
        audio: playing('transcription') || transcription.status === 'working',
      }}
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
        notes: <NotesPanel songs={SONGS} player={player} />,
        audio: (
          <AudioPanel
            transcription={transcription}
            player={player}
            octaveShift={settings.octaveShift}
            onPreview={onPreviewNote}
          />
        ),
      }}
    />
  );
}
