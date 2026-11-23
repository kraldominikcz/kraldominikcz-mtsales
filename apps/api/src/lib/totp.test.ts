import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, hotp, otpauthUri, timeStep, totp, verifyTotp } from './totp';

// RFC 6238, příloha B (SHA-1, 8 číslic)
const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');
const RFC_VECTORS: [number, string][] = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
];

describe('TOTP (RFC 6238)', () => {
  it.each(RFC_VECTORS)('čas %i → %s', (seconds, expected) => {
    expect(hotp(RFC_SECRET, timeStep(new Date(seconds * 1000)), 8)).toBe(expected);
  });

  it('base32 tam a zpět', () => {
    const buf = Buffer.from('mtSALES test 123');
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    expect(base32Encode(RFC_SECRET)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('ověří kód s tolerancí ±30 s a odmítne starší kroky', () => {
    const secret = base32Encode(RFC_SECRET);
    const at = new Date('2026-11-23T09:00:00Z');
    const code = totp(secret, at);
    const step = verifyTotp(secret, code, { at: new Date(at.getTime() + 30_000) });
    expect(step).toBe(timeStep(at));
    expect(verifyTotp(secret, code, { at: new Date(at.getTime() + 90_000) })).toBeNull();
    expect(verifyTotp(secret, code, { at, lastUsedStep: timeStep(at) })).toBeNull();
  });

  it('otpauth URI pro Microsoft Authenticator', () => {
    const uri = otpauthUri({ secret: 'ABC', account: 'a@b.cz', issuer: 'mtSALES' });
    expect(uri).toBe('otpauth://totp/mtSALES%3Aa%40b.cz?secret=ABC&issuer=mtSALES&algorithm=SHA1&digits=6&period=30');
  });
});
