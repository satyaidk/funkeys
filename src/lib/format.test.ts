import { describe, it, expect } from 'vitest';
import { formatBytes, formatSeconds } from './format';

describe('formatSeconds', () => {
  it('shows minutes and seconds', () => {
    expect(formatSeconds(0)).toBe('0:00');
    expect(formatSeconds(9.99)).toBe('0:09');
    expect(formatSeconds(65.4)).toBe('1:05');
    expect(formatSeconds(300)).toBe('5:00');
  });

  it('adds hours for long recordings', () => {
    expect(formatSeconds(3725)).toBe('1:02:05');
  });

  it('shows 0:00 for bad input', () => {
    expect(formatSeconds(NaN)).toBe('0:00');
    expect(formatSeconds(-3)).toBe('0:00');
  });
});

describe('formatBytes', () => {
  it('picks a readable unit', () => {
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB');
    expect(formatBytes(NaN)).toBe('0 B');
  });
});
