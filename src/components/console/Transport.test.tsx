import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Transport from './Transport';
import FunctionTabs from './FunctionTabs';

function renderTransport(props: Partial<React.ComponentProps<typeof Transport>> = {}) {
  const handlers = { onRecord: vi.fn(), onPlay: vi.fn(), onStop: vi.fn(), onClear: vi.fn() };
  render(<Transport status="idle" duration={0} hasRecording={false} {...handlers} {...props} />);
  return handlers;
}

describe('Transport', () => {
  it('can only play once something is recorded', () => {
    renderTransport();
    expect(screen.getByRole('button', { name: 'Play recording' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled();
    expect(screen.getByText('Press record, then play')).toBeInTheDocument();
  });

  it('starts recording', () => {
    const { onRecord } = renderTransport();
    fireEvent.click(screen.getByRole('button', { name: 'Record' }));
    expect(onRecord).toHaveBeenCalled();
  });

  it('shows the take and lets you play or delete it', () => {
    const { onPlay, onClear } = renderTransport({ hasRecording: true, duration: 12000 });
    expect(screen.getByText('Take ready, 0:12')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play recording' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onPlay).toHaveBeenCalled();
    expect(onClear).toHaveBeenCalled();
  });

  it('marks the record button pressed while recording', () => {
    renderTransport({ status: 'recording' });
    expect(screen.getByRole('button', { name: 'Record' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();
  });
});

describe('FunctionTabs', () => {
  const panels = {
    voice: <p>Voice page</p>,
    layer: <p>Layer page</p>,
    sound: <p>Sound page</p>,
    tuning: <p>Tuning page</p>,
    metronome: <p>Metronome page</p>,
  };

  it('shows the first page and selects tabs with the arrow keys', async () => {
    render(<FunctionTabs panels={panels} indicators={{}} />);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Voice page');

    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Metronome' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Metronome page')).toBeInTheDocument();
  });

  it('connects each tab to its panel', () => {
    render(<FunctionTabs panels={panels} indicators={{}} />);
    const tab = screen.getByRole('tab', { name: 'Voice' });
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tab.id);
  });
});
