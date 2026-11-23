import { runMigrations } from '@mtsales/db';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Chybí DATABASE_URL');
  process.exit(1);
}
await runMigrations(url);
console.log('Migrace aplikovány.');
