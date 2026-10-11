/**
 * End-to-end tests: the real app in a real browser (Chromium), on a desktop
 * and a phone-sized touch screen. Unit and component tests (Vitest) cover
 * the logic; these check what only a browser can: layout, touch, audio
 * scheduling, the transcription worker and the model.
 *
 *   npm run build && npm run test:e2e
 *
 * The tests start the production server themselves (or reuse one already
 * running on port 3100).
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'phone',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true },
    },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
