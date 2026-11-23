import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integrační testy sdílí jednu testovací databázi → spouštět postupně.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
