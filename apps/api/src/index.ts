import { createDb } from '@mtsales/db';
import { loadConfig } from './config';
import { TokenService } from './lib/tokens';
import { buildServer } from './server';

const config = loadConfig();
const { db, close } = createDb(config.DATABASE_URL);
const now = () => new Date();
const { app } = await buildServer({ db, config, tokens: new TokenService(config.JWT_SECRET, now), now });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Ukončuji server');
  await app.close();
  await close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: config.PORT, host: config.HOST });
