import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  /** Tajný klíč pro podpis přístupových tokenů (min. 32 znaků). */
  JWT_SECRET: z.string().min(32),
  /** 32 bajtů v base64 – šifrování citlivých údajů v DB (TOTP tajemství). */
  APP_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'APP_ENCRYPTION_KEY musí být 32 bajtů v base64'),
  /** Povolené původy (CORS) oddělené čárkou, např. http://localhost:8081 */
  APP_ORIGINS: z.string().default('http://localhost:8081'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Neplatná konfigurace:\n  ${fields}`);
  }
  return parsed.data;
}
