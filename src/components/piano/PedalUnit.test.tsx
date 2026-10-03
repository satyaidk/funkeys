import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PedalUnit from './PedalUnit';

const UP = { soft: false, sostenuto: false, sustain: false };

describe('PedalUnit', () => {
  it('shows the three pedals left to right', () => {
    render(<PedalUnit pedals={UP} onToggle={vi.fn()} />);
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Soft pedal', 'Sostenuto pedal', 'Sustain pedal']);
  });

  it('shows which pedals are down', () => {
    render(<PedalUnit pedals={{ ...UP, sustain: true }} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Sustain pedal' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Soft pedal' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles a pedal on click', () => {
    const onToggle = vi.fn();
    render(<PedalUnit pedals={UP} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sostenuto pedal' }));
    expect(onToggle).toHaveBeenCalledWith('sostenuto');
  });

  it('lists the keyboard shortcut for each pedal', () => {
    render(<PedalUnit pedals={UP} onToggle={vi.fn()} />);
    expect(screen.getByText('Space')).toBeInTheDocument();
    expect(screen.getByText('Shift')).toBeInTheDocument();
  });
});
