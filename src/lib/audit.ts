import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export type AuditEntry = {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  targetUserId?: string | null;
  targetResource?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Write-once audit log insert. This is the ONLY function in the codebase that should ever
 * write to `auditLogs` — there is intentionally no update/delete exported for this table
 * anywhere in the application layer (Volume 8: append-only audit trail).
 *
 * Never throws: a logging failure must never block or fail the underlying user-facing action
 * it's attached to. Failures are logged to the server console for operator visibility instead.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorUserId: entry.actorUserId ?? null,
      actorRole: entry.actorRole ?? null,
      action: entry.action,
      targetUserId: entry.targetUserId ?? null,
      targetResource: entry.targetResource ?? null,
      metadata: entry.metadata ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to write audit log entry", entry.action, err);
  }
}
