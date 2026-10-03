/**
 * @fileoverview Runs before every test file (see vitest.config.mts).
 */

// Adds DOM matchers such as toBeInTheDocument(), toBeDisabled(), toHaveAttribute()
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount anything rendered by the previous test so tests stay independent
afterEach(() => {
  cleanup();
});
