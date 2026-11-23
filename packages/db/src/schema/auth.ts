import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { ROLES } from '@mtsales/shared';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const roleEnum = pgEnum('role', ROLES);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Vždy malými písmeny (normalizuje Zod schéma). */
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    mustChangePassword: boolean('must_change_password').notNull().default(true),
    /** TOTP tajemství zašifrované AES-256-GCM (klíč APP_ENCRYPTION_KEY). */
    totpSecretEnc: text('totp_secret_enc'),
    totpPendingSecretEnc: text('totp_pending_secret_enc'),
    totpEnabledAt: timestamp('totp_enabled_at', { withTimezone: true }),
    /** Poslední použitý časový krok TOTP – brání opakovanému použití stejného kódu. */
    totpLastStep: integer('totp_last_step'),
    supervisorId: uuid('supervisor_id').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    isActive: boolean('is_active').notNull().default(true),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_unique').on(sql`lower(${t.email})`)],
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

export const recoveryCodes = pgTable(
  'recovery_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('recovery_codes_user_idx').on(t.userId)],
);

export const clientKindEnum = pgEnum('client_kind', ['web', 'native']);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 obnovovacího tokenu (samotný token se neukládá). */
    refreshTokenHash: text('refresh_token_hash').notNull(),
    client: clientKindEnum('client').notNull(),
    deviceName: text('device_name'),
    createdAt: createdAt(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedById: uuid('replaced_by_id'),
  },
  (t) => [
    uniqueIndex('sessions_refresh_token_hash_unique').on(t.refreshTokenHash),
    index('sessions_user_idx').on(t.userId),
  ],
);
