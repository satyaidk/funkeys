/**
 * @fileoverview Runs before every test file (see vitest.config.mts).
 */

// Adds DOM matchers such as toBeInTheDocument(), toBeDisabled(), toHaveAttribute()
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom has no 2D canvas (it logs "not implemented"); components draw only when there is one
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

// Unmount anything rendered by the previous test so tests stay independent
afterEach(() => {
  cleanup();
});
