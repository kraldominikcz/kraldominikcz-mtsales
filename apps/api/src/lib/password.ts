import { hash, verify } from '@node-rs/argon2';

// Argon2id s parametry dle OWASP (19 MiB, 2 iterace).
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Hash pro „prázdné“ ověření u neexistujícího uživatele (stejně dlouhá odezva). */
let dummyHash: Promise<string> | undefined;
export async function verifyDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword('dummy-password-for-timing');
  await verifyPassword(await dummyHash, password);
}
