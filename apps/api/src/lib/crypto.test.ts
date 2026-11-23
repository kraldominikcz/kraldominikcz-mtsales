import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, normalizeRecoveryCode, recoveryCode, temporaryPassword } from './crypto';

const KEY = Buffer.alloc(32, 1).toString('base64');

describe('crypto', () => {
  it('šifrování AES-GCM tam a zpět', () => {
    const enc = encrypt('tajemstvi', KEY);
    expect(enc).not.toContain('tajemstvi');
    expect(decrypt(enc, KEY)).toBe('tajemstvi');
  });

  it('pozměněná data neprojdou', () => {
    const parts = encrypt('tajemstvi', KEY).split('.');
    parts[3] = Buffer.from('jina-data').toString('base64url');
    expect(() => decrypt(parts.join('.'), KEY)).toThrow();
  });

  it('jiný klíč neprojde', () => {
    const enc = encrypt('tajemstvi', KEY);
    expect(() => decrypt(enc, Buffer.alloc(32, 2).toString('base64'))).toThrow();
  });

  it('dočasné heslo a záložní kód mají správný tvar', () => {
    expect(temporaryPassword()).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);
    const code = recoveryCode();
    expect(code).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);
    expect(normalizeRecoveryCode(code.toUpperCase())).toBe(code.replace('-', ''));
  });
});
