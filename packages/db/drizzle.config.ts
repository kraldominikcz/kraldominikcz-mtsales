import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgresql://mtsales:mtsales@localhost:5432/mtsales' },
  strict: true,
  verbose: true,
});
