import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/scripts/seed.ts', 'src/scripts/migrate.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Interní balíčky monorepa se přibalí (jsou jen jako TS zdrojáky).
  noExternal: [/^@mtsales\//],
});
