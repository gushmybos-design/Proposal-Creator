import { prisma } from "@/lib/db";

/** Append-only audit trail. Never throws — auditing must not break the main action. */
export async function audit(opts: {
  workspaceId: string;
  userId?: string | null;
  action: string;
  entityType: "proposal" | "template" | "workspace" | "user" | "signature";
  entityId: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId: opts.workspaceId,
        userId: opts.userId ?? null,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        meta: opts.meta as object | undefined,
      },
    });
  } catch (e) {
    console.warn("[audit] failed", (e as Error).message);
  }
}
