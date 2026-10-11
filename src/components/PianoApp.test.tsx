/**
 * Integration tests: the real hooks, components and audio engine working
 * together (only the browser's AudioContext is faked).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import PianoApp from './PianoApp';
import { installFakeAudioContext, latestAudioContext } from '@/test/fake-web-audio';

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

  it('plays a song from the Notes page, lighting its keys, until it is paused', async () => {
    render(<PianoApp />);
    fireEvent.click(tab('Notes'));
    const [play] = await screen.findAllByRole('button', { name: 'Play Seven Nation Army' });
    fireEvent.click(play);

    // Notes are booked on the audio clock: move the (fake) clock into the first one, E4
    latestAudioContext().currentTime = 0.2;
    const e4 = screen.getByRole('button', { name: 'E4' });
    await waitFor(() => expect(e4).toHaveAttribute('aria-pressed', 'true'));
    expect(display()).toHaveTextContent('Seven Nation Army');

    fireEvent.click(screen.getAllByRole('button', { name: 'Pause Seven Nation Army' })[0]);
    await waitFor(() => expect(e4).toHaveAttribute('aria-pressed', 'false'));
  });

  it('finds songs by name in the library', async () => {
    render(<PianoApp />);
    fireEvent.click(tab('Notes'));
    fireEvent.change(await screen.findByRole('searchbox'), { target: { value: 'moonlight' } });
    const results = screen.getByRole('heading', { name: /Results/ });
    expect(results).toHaveTextContent('1');
  });

  it('opens Audio to Piano from the header', async () => {
    render(<PianoApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Audio to Piano' }));
    expect(tab('Audio to Piano')).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText(/Turn a piano recording into notes/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing is uploaded or stored/)).toBeInTheDocument();
  });

  it('shifts the octave from the on-screen buttons and shows the range', () => {
    render(<PianoApp />);
    expect(screen.getByLabelText('Keyboard range')).toHaveTextContent('C3–C6');
    fireEvent.click(screen.getByRole('button', { name: 'Octave up' }));
    expect(screen.getByLabelText('Keyboard range')).toHaveTextContent('C4–C7');
    expect(screen.getByRole('button', { name: 'C7' })).toBeInTheDocument();
  });

  it('opens the keyboard shortcuts', () => {
    render(<PianoApp />);
    fireEvent.click(screen.getByRole('button', { name: /Keyboard shortcuts|Shortcuts/ }));
    expect(screen.getByRole('heading', { name: 'How to play' })).toBeInTheDocument();
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
