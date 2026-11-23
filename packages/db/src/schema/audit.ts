import { bigserial, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * Audit log: kdo, kdy, co viděl nebo změnil.
 * `metadata` nesmí obsahovat osobní údaje v čitelné podobě – jen ID, názvy změněných polí apod.
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Např. auth.login, auth.login_failed, user.create, user.update, company.view */
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (t) => [
    index('audit_events_occurred_idx').on(t.occurredAt),
    index('audit_events_entity_idx').on(t.entityType, t.entityId),
    index('audit_events_actor_idx').on(t.actorUserId),
  ],
);
