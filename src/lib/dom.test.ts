import { describe, it, expect } from 'vitest';
import { isAdjustableTarget, isTypingTarget } from './dom';

function input(type: string) {
  const el = document.createElement('input');
  el.type = type;
  return el;
}

describe('isTypingTarget', () => {
  it.each(['text', 'search', 'email', 'password', 'number'])(
    'is true for <input type="%s">',
    (type) => {
      expect(isTypingTarget(input(type))).toBe(true);
    }
  );

  it.each(['range', 'checkbox', 'radio', 'button'])(
    'is false for <input type="%s"> so the keyboard keeps playing',
    (type) => {
      expect(isTypingTarget(input(type))).toBe(false);
    }
  );

  it('is true for textarea and select', () => {
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
  });

  it('is true for contentEditable elements', () => {
    const div = document.createElement('div');
    // jsdom doesn't compute isContentEditable, so set it directly
    Object.defineProperty(div, 'isContentEditable', { value: true });
    expect(isTypingTarget(div)).toBe(true);
  });

  it('is false for buttons, plain elements and non-elements', () => {
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
    expect(isTypingTarget(window)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('isAdjustableTarget', () => {
  it('recognizes controls that use the arrow keys themselves', () => {
    const range = document.createElement('input');
    range.type = 'range';
    const knob = document.createElement('div');
    knob.setAttribute('role', 'slider');
    expect(isAdjustableTarget(range)).toBe(true);
    expect(isAdjustableTarget(knob)).toBe(true);
  });

  it('ignores everything else', () => {
    expect(isAdjustableTarget(document.createElement('button'))).toBe(false);
    expect(isAdjustableTarget(window)).toBe(false);
    expect(isAdjustableTarget(null)).toBe(false);
  });
});
