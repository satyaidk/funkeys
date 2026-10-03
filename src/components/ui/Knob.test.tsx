import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Knob from './Knob';

function renderKnob(value = 0.5, onChange = vi.fn()) {
  render(
    <Knob label="Volume" value={value} min={0} max={1} step={0.01} onChange={onChange} format={(v) => `${Math.round(v * 100)}%`} />
  );
  return { onChange, knob: screen.getByRole('slider', { name: 'Volume' }) };
}

describe('Knob', () => {
  it('exposes its value to assistive technology', () => {
    const { knob } = renderKnob(0.7);
    expect(knob).toHaveAttribute('aria-valuenow', '0.7');
    expect(knob).toHaveAttribute('aria-valuemin', '0');
    expect(knob).toHaveAttribute('aria-valuemax', '1');
    expect(knob).toHaveAttribute('aria-valuetext', '70%');
  });

  it('steps with the arrow keys and jumps with Page/Home/End', () => {
    const { knob, onChange } = renderKnob(0.5);
    fireEvent.keyDown(knob, { key: 'ArrowUp' });
    fireEvent.keyDown(knob, { key: 'ArrowLeft' });
    fireEvent.keyDown(knob, { key: 'PageUp' });
    fireEvent.keyDown(knob, { key: 'Home' });
    fireEvent.keyDown(knob, { key: 'End' });
    expect(onChange.mock.calls.map(([v]) => v)).toEqual([0.51, 0.49, 0.6, 0, 1]);
  });

  it('marks handled keys so global shortcuts ignore them', () => {
    const { knob } = renderKnob();
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    knob.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('turns when dragged up or down, clamped to its range', () => {
    const { knob, onChange } = renderKnob(0.5);
    fireEvent.pointerDown(knob, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(knob, { clientY: 120, pointerId: 1 }); // 80px up = half the range
    expect(onChange).toHaveBeenLastCalledWith(1);
    fireEvent.pointerMove(knob, { clientY: 400, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(0);
    fireEvent.pointerUp(knob, { pointerId: 1 });

    onChange.mockClear();
    fireEvent.pointerMove(knob, { clientY: 0, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled(); // drag ended
  });
});
