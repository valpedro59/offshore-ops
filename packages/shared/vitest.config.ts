import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Les bases PGlite démarrent plus lentement quand plusieurs suites tournent en parallèle (CI comprise).
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
