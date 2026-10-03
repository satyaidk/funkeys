import { describe, it, expect } from 'vitest';
import { applyTouchCurve, FIXED_VELOCITY, velocityFromPosition, velocityToGain } from './dynamics';

describe('applyTouchCurve', () => {
  it('passes velocity through unchanged on the medium curve', () => {
    expect(applyTouchCurve(0.6, 'medium')).toBe(0.6);
  });

  it('plays louder on light and softer on heavy for the same force', () => {
    const raw = 0.5;
    expect(applyTouchCurve(raw, 'light')).toBeGreaterThan(raw);
    expect(applyTouchCurve(raw, 'heavy')).toBeLessThan(raw);
  });

  it('ignores force on the fixed curve', () => {
    expect(applyTouchCurve(0.1, 'fixed')).toBe(FIXED_VELOCITY);
    expect(applyTouchCurve(1, 'fixed')).toBe(FIXED_VELOCITY);
  });

  it('keeps results between a small floor and 1', () => {
    expect(applyTouchCurve(0, 'heavy')).toBe(0.05);
    expect(applyTouchCurve(2, 'light')).toBe(1);
  });
});

describe('velocityFromPosition', () => {
  it('is stronger nearer the front edge of the key', () => {
    expect(velocityFromPosition(1)).toBe(1);
    expect(velocityFromPosition(0)).toBeCloseTo(0.35);
    expect(velocityFromPosition(0.8)).toBeGreaterThan(velocityFromPosition(0.2));
  });
});

describe('velocityToGain', () => {
  it('rises with velocity and never goes silent', () => {
    expect(velocityToGain(0)).toBeCloseTo(0.08);
    expect(velocityToGain(1)).toBeCloseTo(1);
    expect(velocityToGain(0.8)).toBeGreaterThan(velocityToGain(0.4));
  });
});
