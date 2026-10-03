import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Resolve the `@/…` import alias from tsconfig.json
  resolve: { tsconfigPaths: true },
  test: {
    // Simulated browser DOM (document, window, events) for components and hooks
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Undo vi.spyOn / vi.stubGlobal between tests so they can't leak into each other
    restoreMocks: true,
    unstubGlobals: true,
  },
});
