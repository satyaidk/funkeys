import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ControlPanel from './ControlPanel';
import { ControlPanelProps } from '@/types';
import { MIN_OCTAVE_SHIFT, MAX_OCTAVE_SHIFT } from '@/lib/constants';

function renderPanel(props: Partial<ControlPanelProps> = {}) {
  const handlers = {
    onVolumeChange: vi.fn(),
    onOctaveChange: vi.fn(),
    onSustainToggle: vi.fn(),
  };
  render(<ControlPanel volume={0.7} octaveShift={0} sustain={false} {...handlers} {...props} />);
  return handlers;
}

describe('ControlPanel', () => {
  describe('volume', () => {
    it('shows the volume as a percentage', () => {
      renderPanel({ volume: 0.42 });
      expect(screen.getByText('42%')).toBeInTheDocument();
    });

    it('reports slider changes as a 0–1 number', () => {
      const { onVolumeChange } = renderPanel();
      fireEvent.change(screen.getByLabelText('Volume'), { target: { value: '0.5' } });
      expect(onVolumeChange).toHaveBeenCalledWith(0.5);
    });
  });

  describe('octave', () => {
    it('shifts down and up by one', () => {
      const { onOctaveChange } = renderPanel({ octaveShift: 1 });

      fireEvent.click(screen.getByRole('button', { name: 'Octave down' }));
      expect(onOctaveChange).toHaveBeenLastCalledWith(0);

      fireEvent.click(screen.getByRole('button', { name: 'Octave up' }));
      expect(onOctaveChange).toHaveBeenLastCalledWith(2);
    });

    it('shows the signed shift and the starting note', () => {
      renderPanel({ octaveShift: 1 });
      expect(screen.getByText('+1')).toBeInTheDocument();
      expect(screen.getByText('starts at C5')).toBeInTheDocument();
    });

    it('disables "down" at the lowest octave', () => {
      renderPanel({ octaveShift: MIN_OCTAVE_SHIFT });
      expect(screen.getByRole('button', { name: 'Octave down' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Octave up' })).toBeEnabled();
    });

    it('disables "up" at the highest octave', () => {
      renderPanel({ octaveShift: MAX_OCTAVE_SHIFT });
      expect(screen.getByRole('button', { name: 'Octave up' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Octave down' })).toBeEnabled();
    });
  });

  describe('sustain', () => {
    it('reflects the sustain state with aria-pressed', () => {
      renderPanel({ sustain: true });
      const button = screen.getByRole('button', { name: /on/i });
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('toggles on click', () => {
      const { onSustainToggle } = renderPanel();
      fireEvent.click(screen.getByRole('button', { name: /off/i }));
      expect(onSustainToggle).toHaveBeenCalledTimes(1);
    });
  });
});
