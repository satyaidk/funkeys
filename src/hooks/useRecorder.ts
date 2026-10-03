/**
 * @fileoverview Performance recorder: record what you play, then play it back.
 *
 * Like the recorder on a digital piano, it records *performance data*
 * (which keys and pedals, and when), not audio. That makes recordings tiny,
 * and playback goes through the live instrument, so the keys light up and
 * you can even switch voices before replaying.
 *
 * ```
 * usePiano ─► onPerformanceAction ─► capture()  (timestamps while recording)
 * play(performer) ─► setTimeout per event ─► performer.noteOn / noteOff / setPedal
 * ```
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PedalName, PerformanceAction, PerformanceEvent, RecorderStatus } from '@/types';
import { Performer } from './usePiano';

const PEDALS: PedalName[] = ['soft', 'sostenuto', 'sustain'];

/** How often the elapsed-time display updates (ms) */
const TICK_MS = 100;

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  /** Length of the current recording in ms (0 = nothing recorded) */
  const [duration, setDuration] = useState(0);
  /** Time since recording or playback started, in ms */
  const [elapsed, setElapsed] = useState(0);

  const statusRef = useRef<RecorderStatus>('idle');
  const eventsRef = useRef<PerformanceEvent[]>([]);
  const startedAtRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const performerRef = useRef<Performer | null>(null);

  const changeStatus = (next: RecorderStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

  const startTicker = () => {
    setElapsed(0);
    tickerRef.current = setInterval(() => setElapsed(Date.now() - startedAtRef.current), TICK_MS);
  };

  const stopTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = null;
  };

  /** Stop recording or playback */
  const stop = useCallback(() => {
    const current = statusRef.current;
    if (current === 'idle') return;
    stopTimers();

    if (current === 'recording') {
      setDuration(Date.now() - startedAtRef.current);
    } else {
      // Lift anything playback was holding down
      const performer = performerRef.current;
      PEDALS.forEach((pedal) => performer?.setPedal(pedal, false, 'playback'));
      performer?.releaseAll();
      performerRef.current = null;
    }
    setElapsed(0);
    changeStatus('idle');
  }, []);

  /** Start a new recording (replaces the previous one) */
  const record = useCallback(() => {
    stop();
    eventsRef.current = [];
    setDuration(0);
    startedAtRef.current = Date.now();
    changeStatus('recording');
    startTicker();
  }, [stop]);

  /** Called for every note/pedal action; stored only while recording */
  const capture = useCallback((action: PerformanceAction) => {
    if (statusRef.current !== 'recording') return;
    eventsRef.current.push({ ...action, time: Date.now() - startedAtRef.current } as PerformanceEvent);
  }, []);

  /** Play the recording through the instrument */
  const play = useCallback(
    (performer: Performer) => {
      stop();
      const events = eventsRef.current;
      if (events.length === 0) return;

      performerRef.current = performer;
      startedAtRef.current = Date.now();
      changeStatus('playing');
      startTicker();

      timersRef.current = events.map((event) =>
        setTimeout(() => {
          if (event.type === 'noteOn') performer.noteOn(event.noteId, event.velocity);
          else if (event.type === 'noteOff') performer.noteOff(event.noteId);
          else performer.setPedal(event.pedal, event.down, 'playback');
        }, event.time)
      );
      const end = Math.max(duration, events[events.length - 1].time);
      timersRef.current.push(setTimeout(stop, end + 50));
    },
    [duration, stop]
  );

  /** Delete the recording */
  const clear = useCallback(() => {
    stop();
    eventsRef.current = [];
    setDuration(0);
  }, [stop]);

  // Don't leave timers running after unmount
  useEffect(() => stopTimers, []);

  return {
    status,
    duration,
    elapsed,
    hasRecording: duration > 0,
    capture,
    record,
    play,
    stop,
    clear,
  };
}
