/**
 * @fileoverview React hook for the metronome.
 *
 * Owns the metronome's settings (tempo, time signature, volume) and drives
 * a `MetronomeScheduler`, which books clicks on the audio clock. The
 * current beat is published for the flashing beat lights: each click is
 * booked slightly ahead of time, so the light is delayed to match the moment
 * the click is actually heard.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MetronomeScheduler, TIME_SIGNATURES, tempoFromTaps, clampBpm } from '@/lib/audio/metronome';
import { DEFAULT_BPM } from '@/lib/constants';
import { AudioControls } from './useAudioEngine';

const DEFAULT_TIME_SIGNATURE = '4/4';
const findTimeSignature = (id: string) => TIME_SIGNATURES.find((t) => t.id === id) ?? TIME_SIGNATURES[2];

export function useMetronome(audio: AudioControls) {
  const [running, setRunning] = useState(false);
  const [bpm, setBpmState] = useState(DEFAULT_BPM);
  const [timeSignature, setTimeSignatureState] = useState(DEFAULT_TIME_SIGNATURE);
  const [volume, setVolumeState] = useState(0.6);
  /** Beat currently sounding (0-based), or null when stopped */
  const [beat, setBeat] = useState<number | null>(null);

  const schedulerRef = useRef<MetronomeScheduler | null>(null);
  const beatTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const tapsRef = useRef<number[]>([]);
  const bpmRef = useRef(bpm);
  const timeSignatureRef = useRef(timeSignature);

  useEffect(() => audio.setMetronomeVolume(volume), [audio, volume]);

  const clearBeatTimers = () => {
    beatTimersRef.current.forEach(clearTimeout);
    beatTimersRef.current.clear();
  };

  const stop = useCallback(() => {
    schedulerRef.current?.stop();
    clearBeatTimers();
    setBeat(null);
    setRunning(false);
  }, []);

  const start = useCallback(() => {
    audio.start(); // inside a click: satisfies the autoplay policy
    schedulerRef.current ??= new MetronomeScheduler(
      {
        get currentTime() {
          return audio.getCurrentTime();
        },
        scheduleClick: (time, accent) => audio.scheduleClick(time, accent),
      },
      {
        bpm: bpmRef.current,
        timeSignature: findTimeSignature(timeSignatureRef.current),
        onBeat: (beatIndex, time) => {
          // Light up when the click is heard, not when it was booked
          const delay = Math.max(0, (time - audio.getCurrentTime()) * 1000);
          const timer = setTimeout(() => {
            beatTimersRef.current.delete(timer);
            setBeat(beatIndex);
          }, delay);
          beatTimersRef.current.add(timer);
        },
      }
    );
    schedulerRef.current.start();
    setRunning(true);
  }, [audio]);

  const toggle = useCallback(() => {
    if (schedulerRef.current?.running) stop();
    else start();
  }, [start, stop]);

  const setBpm = useCallback((value: number) => {
    const next = clampBpm(value);
    bpmRef.current = next;
    setBpmState(next);
    schedulerRef.current?.setTempo(next);
  }, []);

  const setTimeSignature = useCallback((id: string) => {
    timeSignatureRef.current = id;
    setTimeSignatureState(id);
    schedulerRef.current?.setTimeSignature(findTimeSignature(id));
  }, []);

  const setVolume = useCallback((value: number) => {
    setVolumeState(Math.max(0, Math.min(1, value)));
  }, []);

  /** Tap tempo: tap along to set the BPM */
  const tap = useCallback(() => {
    tapsRef.current = [...tapsRef.current, Date.now()].slice(-8);
    const tempo = tempoFromTaps(tapsRef.current);
    if (tempo !== null) setBpm(tempo);
  }, [setBpm]);

  // Stop clicking when the component unmounts
  useEffect(() => () => {
    schedulerRef.current?.stop();
    clearBeatTimers();
  }, []);

  return {
    running,
    bpm,
    timeSignature,
    beatsPerBar: findTimeSignature(timeSignature).beats,
    accents: findTimeSignature(timeSignature).accents,
    volume,
    beat,
    start,
    stop,
    toggle,
    setBpm,
    setTimeSignature,
    setVolume,
    tap,
  };
}
