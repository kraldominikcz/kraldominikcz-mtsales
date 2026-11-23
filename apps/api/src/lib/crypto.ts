import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** AES-256-GCM. Výstup: v1.<iv>.<tag>.<data> (base64url). */
export function encrypt(plain: string, keyB64: string): string {
  const key = Buffer.from(keyB64, 'base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), data.toString('base64url')].join('.');
}

export function decrypt(payload: string, keyB64: string): string {
  const [version, iv, tag, data] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Neplatný šifrovaný údaj');
  const key = Buffer.from(keyB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Čitelný náhodný řetězec bez zaměnitelných znaků (0/o, 1/l/i). */
const READABLE = 'abcdefghjkmnpqrstuvwxyz23456789';
export function readableCode(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += READABLE[bytes[i]! % READABLE.length];
  return out;
}

/** Dočasné heslo pro nového uživatele: xxxx-xxxx-xxxx-xxxx (19 znaků). */
export function temporaryPassword(): string {
  return [0, 1, 2, 3].map(() => readableCode(4)).join('-');
}

/** Záložní kód: xxxxx-xxxxx. */
export function recoveryCode(): string {
  return `${readableCode(5)}-${readableCode(5)}`;
}

export function normalizeRecoveryCode(code: string): string {
  return code.trim().toLowerCase().replace(/-/g, '');
}
