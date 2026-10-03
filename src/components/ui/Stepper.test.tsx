import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Stepper from './Stepper';

function renderStepper(props: Partial<React.ComponentProps<typeof Stepper>> = {}) {
  const onDecrement = vi.fn();
  const onIncrement = vi.fn();
  render(
    <Stepper
      label="Transpose"
      valueText="+2"
      onDecrement={onDecrement}
      onIncrement={onIncrement}
      decrementLabel="Down"
      incrementLabel="Up"
      {...props}
    />
  );
  return { onDecrement, onIncrement, up: screen.getByRole('button', { name: 'Up' }), down: screen.getByRole('button', { name: 'Down' }) };
}

describe('Stepper', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows its value in a labelled group', () => {
    renderStepper();
    expect(screen.getByRole('group', { name: 'Transpose' })).toHaveTextContent('+2');
  });

  it('steps once per press', () => {
    const { up, onIncrement } = renderStepper();
    fireEvent.pointerDown(up, { button: 0 });
    fireEvent.pointerUp(up);
    fireEvent.click(up, { detail: 1 }); // the click that follows a pointer press is ignored
    expect(onIncrement).toHaveBeenCalledTimes(1);
  });

  it('repeats while held down', () => {
    const { down, onDecrement } = renderStepper();
    fireEvent.pointerDown(down, { button: 0 });
    act(() => vi.advanceTimersByTime(380 + 55 * 4));
    fireEvent.pointerUp(down);
    expect(onDecrement.mock.calls.length).toBeGreaterThanOrEqual(5);

    const count = onDecrement.mock.calls.length;
    act(() => vi.advanceTimersByTime(1000));
    expect(onDecrement).toHaveBeenCalledTimes(count); // stopped on release
  });

  it('steps on keyboard activation', () => {
    const { up, onIncrement } = renderStepper();
    fireEvent.click(up, { detail: 0 });
    expect(onIncrement).toHaveBeenCalledTimes(1);
  });

  it('disables a direction at its limit, or the whole control', () => {
    const { up } = renderStepper({ canIncrement: false });
    expect(up).toBeDisabled();
  });

  it('disables both buttons when disabled', () => {
    const { up, down } = renderStepper({ disabled: true });
    expect(up).toBeDisabled();
    expect(down).toBeDisabled();
  });
});
