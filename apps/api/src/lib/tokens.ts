import { SignJWT, jwtVerify } from 'jose';

export type TokenPurpose = 'access' | 'onboarding' | 'challenge';

export const TOKEN_TTL_SECONDS: Record<TokenPurpose, number> = {
  access: 15 * 60,
  onboarding: 30 * 60,
  challenge: 5 * 60,
};

export interface TokenPayload {
  sub: string;
  sid?: string;
}

const ISSUER = 'mtsales';

export class TokenService {
  private readonly key: Uint8Array;
  constructor(
    secret: string,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async sign(purpose: TokenPurpose, payload: TokenPayload, now = this.clock()) {
    const iat = Math.floor(now.getTime() / 1000);
    const exp = iat + TOKEN_TTL_SECONDS[purpose];
    const token = await new SignJWT({ ...(payload.sid ? { sid: payload.sid } : {}) })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setIssuer(ISSUER)
      .setAudience(purpose)
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .sign(this.key);
    return { token, expiresAt: new Date(exp * 1000) };
  }

  /** Vrací payload, nebo null pro neplatný/prošlý token nebo jiný účel. */
  async verify(purpose: TokenPurpose, token: string): Promise<TokenPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: purpose,
        currentDate: this.clock(),
        algorithms: ['HS256'],
      });
      if (!payload.sub) return null;
      return { sub: payload.sub, sid: typeof payload.sid === 'string' ? payload.sid : undefined };
    } catch {
      return null;
    }
  }
}
