import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SegmentedControl from './SegmentedControl';
import RadioPads from './RadioPads';

const OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'room', label: 'Room' },
  { value: 'hall', label: 'Hall' },
] as const;

describe('SegmentedControl', () => {
  it('is a radio group with the selected option checked', () => {
    render(<SegmentedControl label="Reverb" options={OPTIONS} value="room" onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: 'Reverb' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Room' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Off' })).toHaveAttribute('aria-checked', 'false');
  });

  it('has a single tab stop on the selected option', () => {
    render(<SegmentedControl label="Reverb" options={OPTIONS} value="room" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Room' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Hall' })).toHaveAttribute('tabindex', '-1');
  });

  it('selects on click', () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Reverb" options={OPTIONS} value="room" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Hall' }));
    expect(onChange).toHaveBeenCalledWith('hall');
  });

  it('moves the selection with arrow keys, wrapping around', () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Reverb" options={OPTIONS} value="hall" onChange={onChange} />);
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    fireEvent.keyDown(group, { key: 'Home' });
    expect(onChange.mock.calls.map(([v]) => v)).toEqual(['off', 'room', 'off']);
  });

  it('can be disabled', () => {
    render(<SegmentedControl label="Reverb" options={OPTIONS} value="room" onChange={vi.fn()} disabled />);
    screen.getAllByRole('radio').forEach((radio) => expect(radio).toBeDisabled());
  });
});

describe('RadioPads', () => {
  const VOICES = [
    { value: 'grand', label: 'Concert grand', description: 'Warm' },
    { value: 'organ', label: 'Drawbar organ', description: 'Steady' },
  ] as const;

  it('shows names with descriptions and selects on click', () => {
    const onChange = vi.fn();
    render(<RadioPads label="Voice" options={VOICES} value="grand" onChange={onChange} columns="grid-cols-2" />);
    expect(screen.getByRole('radio', { name: /Concert grand/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Steady')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Drawbar organ/ }));
    expect(onChange).toHaveBeenCalledWith('organ');
  });

  it('hides descriptions when compact and supports arrow keys', () => {
    const onChange = vi.fn();
    render(<RadioPads label="Voice" options={VOICES} value="grand" onChange={onChange} columns="grid-cols-2" compact />);
    expect(screen.queryByText('Steady')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith('organ');
  });
});
