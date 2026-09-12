import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function AuditLogPage({ searchParams }: PageProps<"/settings/audit">) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const take = 50;
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ where: { workspaceId: user.workspaceId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take, include: { user: { select: { email: true, name: true } } } }),
    prisma.auditLog.count({ where: { workspaceId: user.workspaceId } }),
  ]);
  const href = (e: (typeof logs)[number]) =>
    e.entityType === "proposal" ? `/proposals/${e.entityId}/analytics` : e.entityType === "template" ? `/templates/${e.entityId}/edit` : null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="text-sm text-zinc-500">{total} events · who changed what, and when.</p>
        </div>
        <Link href="/settings" className="btn-ghost">← Settings</Link>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr><th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Who</th><th className="px-4 py-2.5">Action</th><th className="px-4 py-2.5">Entity</th><th className="px-4 py-2.5">Details</th></tr>
          </thead>
          <tbody>
            {logs.map((e) => (
              <tr key={e.id} className="border-t border-zinc-100 align-top">
                <td className="whitespace-nowrap px-4 py-2 text-zinc-500">{e.createdAt.toLocaleString("en-AU")}</td>
                <td className="px-4 py-2">{e.user?.name ?? e.user?.email ?? <span className="text-zinc-400">system</span>}</td>
                <td className="px-4 py-2"><code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{e.action}</code></td>
                <td className="px-4 py-2">{href(e) ? <Link className="underline" href={href(e)!}>{e.entityType} {e.entityId.slice(0, 8)}</Link> : `${e.entityType} ${e.entityId.slice(0, 8)}`}</td>
                <td className="max-w-md truncate px-4 py-2 text-xs text-zinc-500" title={JSON.stringify(e.meta)}>{e.meta ? JSON.stringify(e.meta) : ""}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400">Nothing yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link className="btn-ghost" href={`/settings/audit?page=${page - 1}`}>← Newer</Link> : <span />}
        {page * take < total && <Link className="btn-ghost" href={`/settings/audit?page=${page + 1}`}>Older →</Link>}
      </div>
    </div>
  );
}
