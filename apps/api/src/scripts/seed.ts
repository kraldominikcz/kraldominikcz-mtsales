/**
 * Vytvoří první manažerský účet, pokud v databázi ještě žádný uživatel není.
 * Použití: SEED_ADMIN_EMAIL=... SEED_ADMIN_NAME="..." pnpm db:seed
 * Dočasné heslo se vypíše jen jednou do terminálu.
 */
import { createDb, users } from '@mtsales/db';
import { createUserInput } from '@mtsales/shared';
import { loadConfig } from '../config';
import { TokenService } from '../lib/tokens';
import { createServices } from '../services';

const config = loadConfig();
const { db, close } = createDb(config.DATABASE_URL, { max: 1 });
try {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    console.log('V databázi už jsou uživatelé – nic nevytvářím. Další přidá manažer v aplikaci (Tým).');
  } else {
    const input = createUserInput.parse({
      email: process.env.SEED_ADMIN_EMAIL,
      name: process.env.SEED_ADMIN_NAME,
      roles: ['manager', 'sales'],
    });
    const now = () => new Date();
    const services = createServices({ db, config, tokens: new TokenService(config.JWT_SECRET, now), now });
    const { temporaryPassword } = await services.users.create(input, null);
    console.log('\nVytvořen první manažer.');
    console.log(`  Dočasné heslo: ${temporaryPassword}`);
    console.log('  Při prvním přihlášení si nastavíte vlastní heslo a Microsoft Authenticator.\n');
  }
} finally {
  await close();
}
