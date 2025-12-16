import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    setupFiles: ['__tests__/testSetup.ts'],
    testTimeout: 30000,
    // Run test files sequentially to avoid Canton contract lock contention
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
});

