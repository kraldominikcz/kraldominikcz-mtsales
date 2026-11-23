import { TRPCError } from '@trpc/server';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import { recoveryCodes, userRoles, users } from '@mtsales/db';
import { cs, type Role, type UserDto } from '@mtsales/shared';
import type { AppDeps } from '../../deps';
import { temporaryPassword } from '../../lib/crypto';
import { hashPassword } from '../../lib/password';
import type { AuditService } from '../audit/audit.service';
import type { AuthService } from '../auth/auth.service';

type UserRow = typeof users.$inferSelect;

export class UsersService {
  constructor(
    private readonly deps: AppDeps,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  private get db() {
    return this.deps.db;
  }

  private async rolesByUser(ids: string[]): Promise<Map<string, Role[]>> {
    const map = new Map<string, Role[]>();
    if (ids.length === 0) return map;
    const rows = await this.db.select().from(userRoles).where(inArray(userRoles.userId, ids));
    for (const r of rows) map.set(r.userId, [...(map.get(r.userId) ?? []), r.role as Role]);
    return map;
  }

  private toDto(u: UserRow, roles: Role[]): UserDto {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      roles: [...roles].sort(),
      supervisorId: u.supervisorId,
      isActive: u.isActive,
      totpEnabled: Boolean(u.totpEnabledAt),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async list(): Promise<UserDto[]> {
    const rows = await this.db.select().from(users).orderBy(asc(users.name));
    const roles = await this.rolesByUser(rows.map((r) => r.id));
    return rows.map((u) => this.toDto(u, roles.get(u.id) ?? []));
  }

  async get(id: string): Promise<UserDto> {
    const u = await this.db.query.users.findFirst({ where: eq(users.id, id) });
    if (!u) throw new TRPCError({ code: 'NOT_FOUND', message: cs.errors.notFound });
    return this.toDto(u, (await this.rolesByUser([id])).get(id) ?? []);
  }

  async create(
    input: { email: string; name: string; roles: Role[]; supervisorId?: string | null },
    actorId: string | null,
  ): Promise<{ user: UserDto; temporaryPassword: string }> {
    const existing = await this.db.query.users.findFirst({ where: eq(users.email, input.email) });
    if (existing) throw new TRPCError({ code: 'CONFLICT', message: cs.errors.emailTaken });
    if (input.supervisorId) await this.get(input.supervisorId);

    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    const id = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({
          email: input.email,
          name: input.name,
          passwordHash,
          mustChangePassword: true,
          supervisorId: input.supervisorId ?? null,
        })
        .returning({ id: users.id });
      await tx.insert(userRoles).values([...new Set(input.roles)].map((role) => ({ userId: row!.id, role })));
      return row!.id;
    });
    await this.audit.record({
      actorUserId: actorId,
      action: 'user.create',
      entityType: 'user',
      entityId: id,
      metadata: { roles: input.roles },
    });
    return { user: await this.get(id), temporaryPassword: password };
  }

  async update(
    input: { id: string; name?: string; roles?: Role[]; supervisorId?: string | null; isActive?: boolean },
    actorId: string,
  ): Promise<UserDto> {
    const current = await this.get(input.id);
    if (input.supervisorId === input.id) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Uživatel nemůže být sám sobě nadřízeným.' });
    }
    if (input.supervisorId) await this.get(input.supervisorId);

    const losesManager =
      current.roles.includes('manager') &&
      current.isActive &&
      ((input.roles && !input.roles.includes('manager')) || input.isActive === false);
    if (losesManager) await this.assertAnotherActiveManager(input.id);

    await this.db.transaction(async (tx) => {
      const patch: Partial<typeof users.$inferInsert> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.supervisorId !== undefined) patch.supervisorId = input.supervisorId;
      if (input.isActive !== undefined) patch.isActive = input.isActive;
      if (Object.keys(patch).length > 0) await tx.update(users).set(patch).where(eq(users.id, input.id));
      if (input.roles) {
        await tx.delete(userRoles).where(eq(userRoles.userId, input.id));
        await tx.insert(userRoles).values([...new Set(input.roles)].map((role) => ({ userId: input.id, role })));
      }
    });
    if (input.isActive === false) await this.auth.revokeAllSessions(input.id);

    const changed = Object.keys(input).filter((k) => k !== 'id');
    await this.audit.record({
      actorUserId: actorId,
      action: 'user.update',
      entityType: 'user',
      entityId: input.id,
      metadata: { fields: changed, ...(input.roles ? { roles: input.roles } : {}) },
    });
    return this.get(input.id);
  }

  /** Nové dočasné heslo, vypnutí 2FA a odhlášení ze všech zařízení (ztracený telefon, zapomenuté heslo). */
  async resetCredentials(id: string, actorId: string): Promise<{ temporaryPassword: string }> {
    await this.get(id);
    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          passwordHash,
          mustChangePassword: true,
          totpSecretEnc: null,
          totpPendingSecretEnc: null,
          totpEnabledAt: null,
          totpLastStep: null,
          failedLoginCount: 0,
          lockedUntil: null,
        })
        .where(eq(users.id, id));
      await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, id));
    });
    await this.auth.revokeAllSessions(id);
    await this.audit.record({ actorUserId: actorId, action: 'user.reset_credentials', entityType: 'user', entityId: id });
    return { temporaryPassword: password };
  }

  /** Vždy musí zůstat alespoň jeden aktivní manažer, jinak by nikdo nemohl spravovat tým. */
  private async assertAnotherActiveManager(exceptId: string) {
    const others = await this.db
      .select({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .where(and(eq(userRoles.role, 'manager'), eq(users.isActive, true), ne(users.id, exceptId)))
      .limit(1);
    if (others.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Musí zůstat alespoň jeden aktivní manažer.' });
    }
  }
}
