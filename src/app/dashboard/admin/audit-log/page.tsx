import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

// Read-only by design: this table exposes no update/delete affordance anywhere in the app.
// See src/lib/audit.ts — logAudit() is the only writer, and it only ever inserts.
export default async function AuditLogPage() {
  const entries = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      actorRole: auditLogs.actorRole,
      actorName: users.name,
      targetUserId: auditLogs.targetUserId,
      targetResource: auditLogs.targetResource,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Audit Log</h1>
        <p className="text-ink-soft mt-1 max-w-2xl">
          Most recent 200 entries, newest first. Append-only — nothing here can be edited or deleted from the app.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-ink-soft text-sm">No audit entries yet.</p>
      ) : (
        <div className="paper-card rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper-dim text-left">
              <tr>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wide text-ink-soft">When</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wide text-ink-soft">Action</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wide text-ink-soft">Actor</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wide text-ink-soft">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-dim">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 font-mono text-xs text-ink-soft whitespace-nowrap">
                    {e.createdAt.toISOString()}
                  </td>
                  <td className="px-4 py-2 font-medium text-ink">{e.action}</td>
                  <td className="px-4 py-2 text-ink-soft">
                    {e.actorName ?? "system"} {e.actorRole ? `(${e.actorRole})` : ""}
                  </td>
                  <td className="px-4 py-2 text-ink-soft font-mono text-xs">{e.targetResource ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
