import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from './client';

export const MIGRATIONS_FOLDER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

/** Složku lze přepsat proměnnou MIGRATIONS_DIR (např. v Docker image, kde je kód přibalený). */
export async function runMigrations(url: string, folder = process.env.MIGRATIONS_DIR ?? MIGRATIONS_FOLDER) {
  const { db, close } = createDb(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await close();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Chybí DATABASE_URL');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => console.log('Migrace aplikovány.'))
    .catch((err) => {
      console.error('Migrace selhaly:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
