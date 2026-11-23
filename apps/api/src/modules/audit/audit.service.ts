import { auditEvents } from '@mtsales/db';
import type { AppDeps } from '../../deps';

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  /** Bez osobních údajů! Jen ID, názvy polí, důvody. */
  metadata?: Record<string, unknown>;
}

export class AuditService {
  constructor(private readonly deps: AppDeps) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.deps.db.insert(auditEvents).values({
      occurredAt: this.deps.now(),
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
    });
  }
}
