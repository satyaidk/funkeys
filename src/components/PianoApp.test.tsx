/**
 * Integration tests: the real hooks, components and audio engine working
 * together (only the browser's AudioContext is faked).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PianoApp from './PianoApp';
import { installFakeAudioContext } from '@/test/fake-web-audio';

describe('PianoApp', () => {
  beforeEach(() => installFakeAudioContext());

  it('lights up the key and the "now playing" readout while a key is held', () => {
    render(<PianoApp />);
    const nowPlaying = screen.getByLabelText('Now playing');
    expect(nowPlaying).toHaveTextContent('Play a note…');

    fireEvent.keyDown(window, { key: 'a', code: 'KeyA' });
    expect(screen.getByRole('button', { name: 'C4' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(nowPlaying).getByText('C4')).toBeInTheDocument();

    fireEvent.keyUp(window, { key: 'a', code: 'KeyA' });
    expect(screen.getByRole('button', { name: 'C4' })).toHaveAttribute('aria-pressed', 'false');
    expect(nowPlaying).toHaveTextContent('Play a note…');
  });

  it('relabels the keys when the octave changes', () => {
    render(<PianoApp />);
    expect(screen.queryByRole('button', { name: 'E6' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Octave up' }));

    expect(screen.getByRole('button', { name: 'E6' })).toBeInTheDocument();
    expect(screen.getByText('starts at C5')).toBeInTheDocument();
  });

  it('plays a note when a key is clicked', () => {
    render(<PianoApp />);
    const key = screen.getByRole('button', { name: 'F4' });

    fireEvent.pointerDown(key, { button: 0 });
    expect(key).toHaveAttribute('aria-pressed', 'true');

    fireEvent.pointerUp(key);
    expect(key).toHaveAttribute('aria-pressed', 'false');
  });
});
