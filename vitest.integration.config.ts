import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/tests/integration/**/*.test.ts'],
    testTimeout: 30000,
    // Every lifecycle file creates identically named TEST: fixtures, so they
    // must not run in parallel against one OmniFocus database.
    fileParallelism: false,
    sequence: { concurrent: false, shuffle: false },
  },
});
