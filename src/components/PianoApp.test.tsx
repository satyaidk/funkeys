/**
 * Integration tests: the real hooks, components and audio engine working
 * together (only the browser's AudioContext is faked).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import PianoApp from './PianoApp';
import { installFakeAudioContext } from '@/test/fake-web-audio';

const display = () => screen.getByRole('group', { name: 'Display' });
const tab = (name: string) => screen.getByRole('tab', { name });

describe('PianoApp', () => {
  beforeEach(() => installFakeAudioContext());

  it('lights the key and shows the note on the display while a key is held', () => {
    render(<PianoApp />);
    const nowPlaying = within(display()).getByLabelText('Now playing');
    expect(nowPlaying).toHaveTextContent('Play a note');

    fireEvent.keyDown(window, { code: 'KeyQ' });
    expect(screen.getByRole('button', { name: 'F4' })).toHaveAttribute('aria-pressed', 'true');
    expect(nowPlaying).toHaveTextContent('F4');

    fireEvent.keyUp(window, { code: 'KeyQ' });
    expect(screen.getByRole('button', { name: 'F4' })).toHaveAttribute('aria-pressed', 'false');
    expect(nowPlaying).toHaveTextContent('Play a note');
  });

  it('switches voice and shows it on the display', () => {
    render(<PianoApp />);
    expect(display()).toHaveTextContent('Concert grand');

    fireEvent.click(screen.getByRole('radio', { name: /Harpsichord/ }));
    expect(display()).toHaveTextContent('Harpsichord');
  });

  // Pages cross-fade (the next one mounts after the previous fades out),
  // so these tests wait for the page with findBy… queries.

  it('opens each function page from its tab', async () => {
    render(<PianoApp />);
    fireEvent.click(tab('Tuning'));
    expect(await screen.findByRole('group', { name: 'Master tuning' })).toBeInTheDocument();
    expect(tab('Tuning')).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(tab('Metronome'));
    expect(await screen.findByRole('radiogroup', { name: 'Time signature' })).toBeInTheDocument();
  });

  it('transposes from the tuning page and the display reflects it', async () => {
    render(<PianoApp />);
    fireEvent.click(tab('Tuning'));
    fireEvent.click(await screen.findByRole('button', { name: 'Transpose up a semitone' }));
    expect(display()).toHaveTextContent('Transpose +1');
  });

  it('shows both voices in layer mode', async () => {
    render(<PianoApp />);
    fireEvent.click(tab('Layer & split'));
    fireEvent.click(await screen.findByRole('radio', { name: 'Layer' }));
    expect(display()).toHaveTextContent('+ String ensemble');
  });

  it('presses a pedal from the screen', () => {
    render(<PianoApp />);
    const sustain = screen.getByRole('button', { name: 'Sustain pedal' });
    fireEvent.click(sustain);
    expect(sustain).toHaveAttribute('aria-pressed', 'true');
  });

  it('moves the keyboard up an octave with the arrow key', () => {
    render(<PianoApp />);
    expect(screen.queryByRole('button', { name: 'C7' })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'C7' })).toBeInTheDocument();
  });

  it('loops a song from the Notes page until it is stopped', async () => {
    render(<PianoApp />);
    fireEvent.click(tab('Notes'));
    fireEvent.click(await screen.findByRole('radio', { name: /Seven Nation Army/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Play loop' }));

    // The riff opens on E4, played through the piano: its key lights up
    const e4 = screen.getByRole('button', { name: 'E4' });
    await waitFor(() => expect(e4).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.click(screen.getByRole('button', { name: 'Stop loop' }));
    expect(e4).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Play loop' })).toBeInTheDocument();
  });

  it('plays a note when a key is clicked', () => {
    render(<PianoApp />);
    const key = screen.getByRole('button', { name: 'G4' });
    fireEvent.pointerDown(key, { button: 0 });
    expect(key).toHaveAttribute('aria-pressed', 'true');
    fireEvent.pointerUp(key);
    expect(key).toHaveAttribute('aria-pressed', 'false');
  });
});
