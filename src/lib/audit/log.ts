import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  previousState?: string | null;
  newState?: string | null;
  metadata?: Record<string, Json>;
}

/**
 * Write an audit log row using the service-role client (the only writer —
 * RLS grants no INSERT to anyone and no UPDATE/DELETE to anybody).
 *
 * Callers MUST pass a sanitised metadata object: never include passwords,
 * tokens, gift-card secrets, private keys, seed phrases or payment evidence
 * contents.
 *
 * Throws on failure: privileged callers should let the error surface so a
 * decision never lands without its audit trail.
 */
export async function writeAudit(
  admin: SupabaseClient<Database>,
  entry: AuditEntry
): Promise<void> {
  const { error } = await admin.from('audit_logs').insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    previous_state: entry.previousState ?? null,
    new_state: entry.newState ?? null,
    metadata: entry.metadata ?? {}
  });
  if (error) throw new Error(`Audit write failed: ${error.message}`);
}

/** Best-effort audit for non-critical events; logs instead of throwing. */
export async function tryAudit(
  admin: SupabaseClient<Database>,
  entry: AuditEntry
): Promise<void> {
  try {
    await writeAudit(admin, entry);
  } catch (err) {
    console.error('[audit] failed to record', entry.action, err);
  }
}
