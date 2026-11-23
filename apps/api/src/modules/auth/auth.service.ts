import { TRPCError } from '@trpc/server';
import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { recoveryCodes, sessions, userRoles, users } from '@mtsales/db';
import { permissionsFor } from '@mtsales/domain';
import { cs, type LoginResult, type Role } from '@mtsales/shared';
import type { AppDeps } from '../../deps';
import {
  decrypt,
  encrypt,
  normalizeRecoveryCode,
  randomToken,
  recoveryCode,
  sha256,
} from '../../lib/crypto';
import { hashPassword, verifyDummy, verifyPassword } from '../../lib/password';
import { formatSecret, generateTotpSecret, otpauthUri, verifyTotp } from '../../lib/totp';
import type { AuditService } from '../audit/audit.service';
import type { AuthUser, ClientKind } from '../../trpc/context';

export const LOCK_THRESHOLD = 10;
export const LOCK_MINUTES = 15;
export const REFRESH_TTL_DAYS = 30;
/** Souběžné obnovení (např. dvě záložky) během této doby není považováno za zneužití tokenu. */
export const REFRESH_REUSE_GRACE_SECONDS = 30;
export const RECOVERY_CODE_COUNT = 10;
const TOTP_ISSUER = 'mtSALES';

export interface IssuedSession {
  sessionId: string;
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

type UserRow = typeof users.$inferSelect;

const unauthorized = (message: string = cs.auth.invalidCredentials) =>
  new TRPCError({ code: 'UNAUTHORIZED', message });

export class AuthService {
  constructor(
    private readonly deps: AppDeps,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    return this.deps.db;
  }

  // ---------------------------------------------------------------- přihlášení

  async login(input: { email: string; password: string }): Promise<LoginResult> {
    const user = await this.db.query.users.findFirst({
      where: sql`lower(${users.email}) = ${input.email.toLowerCase()}`,
    });
    if (!user) {
      await verifyDummy(input.password);
      await this.audit.record({ action: 'auth.login_failed', metadata: { reason: 'unknown_user' } });
      throw unauthorized();
    }
    this.assertNotLocked(user);

    if (!(await verifyPassword(user.passwordHash, input.password))) {
      await this.registerFailure(user.id, 'bad_password');
      throw unauthorized();
    }
    if (!user.isActive) {
      await this.audit.record({ actorUserId: user.id, action: 'auth.login_failed', metadata: { reason: 'inactive' } });
      throw new TRPCError({ code: 'FORBIDDEN', message: cs.auth.accountDisabled });
    }
    await this.db.update(users).set({ failedLoginCount: 0 }).where(eq(users.id, user.id));
    return this.nextStep(user);
  }

  /** Co musí uživatel udělat po ověření hesla. */
  private async nextStep(user: UserRow): Promise<LoginResult> {
    if (user.mustChangePassword) {
      return { status: 'password_change_required', onboardingToken: await this.onboardingToken(user.id) };
    }
    if (!user.totpEnabledAt) {
      return { status: 'totp_setup_required', onboardingToken: await this.onboardingToken(user.id) };
    }
    const { token } = await this.deps.tokens.sign('challenge', { sub: user.id }, this.deps.now());
    return { status: 'totp_required', challengeToken: token };
  }

  private async onboardingToken(userId: string) {
    return (await this.deps.tokens.sign('onboarding', { sub: userId }, this.deps.now())).token;
  }

  private async userFromToken(purpose: 'onboarding' | 'challenge', token: string): Promise<UserRow> {
    const payload = await this.deps.tokens.verify(purpose, token);
    if (!payload) throw unauthorized(cs.auth.sessionExpired);
    const user = await this.db.query.users.findFirst({ where: eq(users.id, payload.sub) });
    if (!user || !user.isActive) throw unauthorized(cs.auth.sessionExpired);
    this.assertNotLocked(user);
    return user;
  }

  // ---------------------------------------------------------------- první přihlášení

  async changeInitialPassword(input: { onboardingToken: string; newPassword: string }): Promise<LoginResult> {
    const user = await this.userFromToken('onboarding', input.onboardingToken);
    if (!user.mustChangePassword) throw new TRPCError({ code: 'BAD_REQUEST', message: cs.common.unknownError });
    if (await verifyPassword(user.passwordHash, input.newPassword)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nové heslo musí být jiné než dočasné.' });
    }
    const passwordHash = await hashPassword(input.newPassword);
    const [updated] = await this.db
      .update(users)
      .set({ passwordHash, mustChangePassword: false })
      .where(eq(users.id, user.id))
      .returning();
    await this.audit.record({ actorUserId: user.id, action: 'auth.password_changed', entityType: 'user', entityId: user.id });
    return this.nextStep(updated!);
  }

  async totpSetupStart(input: { onboardingToken: string }) {
    const user = await this.userFromToken('onboarding', input.onboardingToken);
    if (user.mustChangePassword || user.totpEnabledAt) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: cs.common.unknownError });
    }
    const secret = generateTotpSecret();
    await this.db
      .update(users)
      .set({ totpPendingSecretEnc: encrypt(secret, this.deps.config.APP_ENCRYPTION_KEY) })
      .where(eq(users.id, user.id));
    return {
      otpauthUri: otpauthUri({ secret, account: user.email, issuer: TOTP_ISSUER }),
      secret: formatSecret(secret),
    };
  }

  async totpSetupConfirm(
    input: { onboardingToken: string; code: string; deviceName?: string },
    client: ClientKind,
  ): Promise<{ session: IssuedSession; recoveryCodes: string[] }> {
    const user = await this.userFromToken('onboarding', input.onboardingToken);
    if (user.totpEnabledAt || !user.totpPendingSecretEnc) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: cs.common.unknownError });
    }
    const secret = decrypt(user.totpPendingSecretEnc, this.deps.config.APP_ENCRYPTION_KEY);
    const step = verifyTotp(secret, input.code, { at: this.deps.now() });
    if (step === null) {
      await this.registerFailure(user.id, 'bad_totp_setup');
      throw unauthorized(cs.auth.totpInvalid);
    }
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => recoveryCode());
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          totpSecretEnc: user.totpPendingSecretEnc,
          totpPendingSecretEnc: null,
          totpEnabledAt: this.deps.now(),
          totpLastStep: step,
          failedLoginCount: 0,
        })
        .where(eq(users.id, user.id));
      await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, user.id));
      await tx
        .insert(recoveryCodes)
        .values(codes.map((c) => ({ userId: user.id, codeHash: sha256(normalizeRecoveryCode(c)) })));
    });
    await this.audit.record({ actorUserId: user.id, action: 'auth.totp_enabled', entityType: 'user', entityId: user.id });
    const session = await this.completeLogin(user.id, client, input.deviceName);
    return { session, recoveryCodes: codes };
  }

  // ---------------------------------------------------------------- druhý faktor

  async totpVerify(
    input: { challengeToken: string; code?: string; recoveryCode?: string; deviceName?: string },
    client: ClientKind,
  ): Promise<IssuedSession> {
    const user = await this.userFromToken('challenge', input.challengeToken);
    if (!user.totpSecretEnc) throw unauthorized(cs.auth.sessionExpired);

    let ok = false;
    let method: 'totp' | 'recovery' = 'totp';
    if (input.code) {
      const secret = decrypt(user.totpSecretEnc, this.deps.config.APP_ENCRYPTION_KEY);
      const step = verifyTotp(secret, input.code, { at: this.deps.now(), lastUsedStep: user.totpLastStep });
      if (step !== null) {
        // Podmíněný zápis brání použití stejného kódu dvakrát (i souběžně).
        const updated = await this.db
          .update(users)
          .set({ totpLastStep: step })
          .where(and(eq(users.id, user.id), or(isNull(users.totpLastStep), lt(users.totpLastStep, step))))
          .returning({ id: users.id });
        ok = updated.length === 1;
      }
    } else if (input.recoveryCode) {
      method = 'recovery';
      const used = await this.db
        .update(recoveryCodes)
        .set({ usedAt: this.deps.now() })
        .where(
          and(
            eq(recoveryCodes.userId, user.id),
            eq(recoveryCodes.codeHash, sha256(normalizeRecoveryCode(input.recoveryCode))),
            isNull(recoveryCodes.usedAt),
          ),
        )
        .returning({ id: recoveryCodes.id });
      ok = used.length === 1;
    }

    if (!ok) {
      await this.registerFailure(user.id, method === 'totp' ? 'bad_totp' : 'bad_recovery_code');
      throw unauthorized(cs.auth.totpInvalid);
    }
    return this.completeLogin(user.id, client, input.deviceName, method);
  }

  private async completeLogin(
    userId: string,
    client: ClientKind,
    deviceName?: string,
    method: 'totp' | 'recovery' | 'setup' = 'setup',
  ): Promise<IssuedSession> {
    await this.db
      .update(users)
      .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: this.deps.now() })
      .where(eq(users.id, userId));
    const session = await this.issueSession(userId, client, deviceName);
    await this.audit.record({ actorUserId: userId, action: 'auth.login', metadata: { client, method } });
    return session;
  }

  // ---------------------------------------------------------------- relace

  private async issueSession(userId: string, client: ClientKind, deviceName?: string | null): Promise<IssuedSession> {
    const now = this.deps.now();
    const refreshToken = randomToken();
    const refreshTokenExpiresAt = new Date(now.getTime() + REFRESH_TTL_DAYS * 86_400_000);
    const [row] = await this.db
      .insert(sessions)
      .values({
        userId,
        refreshTokenHash: sha256(refreshToken),
        client,
        deviceName: deviceName ?? null,
        createdAt: now,
        lastUsedAt: now,
        expiresAt: refreshTokenExpiresAt,
      })
      .returning({ id: sessions.id });
    const access = await this.deps.tokens.sign('access', { sub: userId, sid: row!.id }, now);
    return {
      sessionId: row!.id,
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  /** Výměna obnovovacího tokenu za nový pár tokenů (rotace). */
  async refresh(rawToken: string, client: ClientKind): Promise<IssuedSession> {
    const now = this.deps.now();
    const session = await this.db.query.sessions.findFirst({
      where: eq(sessions.refreshTokenHash, sha256(rawToken)),
    });
    if (!session || session.client !== client) throw unauthorized(cs.auth.sessionExpired);

    if (session.revokedAt) {
      const sinceRevoke = (now.getTime() - session.revokedAt.getTime()) / 1000;
      if (session.replacedById && sinceRevoke > REFRESH_REUSE_GRACE_SECONDS) {
        // Starý (už vyměněný) token použil někdo znovu → možná krádež. Odhlásit ze všech zařízení.
        await this.revokeAllSessions(session.userId);
        await this.audit.record({ actorUserId: session.userId, action: 'auth.refresh_reuse_detected' });
      }
      throw unauthorized(cs.auth.sessionExpired);
    }
    if (session.expiresAt <= now) throw unauthorized(cs.auth.sessionExpired);

    const user = await this.db.query.users.findFirst({ where: eq(users.id, session.userId) });
    if (!user || !user.isActive) throw unauthorized(cs.auth.sessionExpired);

    const revoked = await this.db
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.id, session.id), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    if (revoked.length !== 1) throw unauthorized(cs.auth.sessionExpired);

    const issued = await this.issueSession(session.userId, client, session.deviceName);
    await this.db.update(sessions).set({ replacedById: issued.sessionId }).where(eq(sessions.id, session.id));
    return issued;
  }

  async logout(rawToken: string): Promise<void> {
    const [row] = await this.db
      .update(sessions)
      .set({ revokedAt: this.deps.now() })
      .where(and(eq(sessions.refreshTokenHash, sha256(rawToken)), isNull(sessions.revokedAt)))
      .returning({ userId: sessions.userId });
    if (row) await this.audit.record({ actorUserId: row.userId, action: 'auth.logout' });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: this.deps.now() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  /** Ověření přístupového tokenu pro každý požadavek. Role se načítají čerstvé z DB. */
  async authenticate(accessToken: string): Promise<AuthUser | null> {
    const payload = await this.deps.tokens.verify('access', accessToken);
    if (!payload?.sid) return null;
    const now = this.deps.now();
    const session = await this.db.query.sessions.findFirst({
      where: and(eq(sessions.id, payload.sid), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)),
      columns: { id: true, userId: true },
    });
    if (!session || session.userId !== payload.sub) return null;
    const user = await this.db.query.users.findFirst({ where: eq(users.id, payload.sub) });
    if (!user || !user.isActive) return null;
    const roles = (
      await this.db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id))
    ).map((r) => r.role as Role);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles,
      permissions: permissionsFor(roles),
      sessionId: session.id,
    };
  }

  // ---------------------------------------------------------------- ochrana proti hádání

  private assertNotLocked(user: UserRow) {
    if (user.lockedUntil && user.lockedUntil > this.deps.now()) {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: cs.auth.accountLocked });
    }
  }

  private async registerFailure(userId: string, reason: string) {
    const [row] = await this.db
      .update(users)
      .set({ failedLoginCount: sql`${users.failedLoginCount} + 1` })
      .where(eq(users.id, userId))
      .returning({ count: users.failedLoginCount });
    if (row && row.count >= LOCK_THRESHOLD) {
      await this.db
        .update(users)
        .set({ failedLoginCount: 0, lockedUntil: new Date(this.deps.now().getTime() + LOCK_MINUTES * 60_000) })
        .where(eq(users.id, userId));
      await this.audit.record({ actorUserId: userId, action: 'auth.locked', metadata: { reason } });
    } else {
      await this.audit.record({ actorUserId: userId, action: 'auth.login_failed', metadata: { reason } });
    }
  }
}
