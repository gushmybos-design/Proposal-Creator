import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProposalRowActions } from "@/components/ui/ProposalRowActions";

export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const sp = await searchParams;
  const filter = typeof sp.status === "string" ? sp.status : undefined;

  const proposals = await prisma.proposal.findMany({
    where: {
      workspaceId: user.workspaceId,
      ...(filter === "CHANGES_REQUESTED" ? { status: { in: ["CHANGES_REQUESTED", "DECLINED"] } } : filter ? { status: filter as never } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { owner: { select: { email: true, name: true } }, _count: { select: { views: true } }, views: { select: { totalSeconds: true } } },
  });

  const counts = await prisma.proposal.groupBy({ by: ["status"], where: { workspaceId: user.workspaceId }, _count: true });
  const stat = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proposals</h1>
          <p className="text-sm text-zinc-500">{user.workspace.name}</p>
        </div>
        <Link href="/proposals/new" className="btn-primary">+ New proposal</Link>
      </div>

      {sp.error === "admin_only" && <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">That area is for admins only.</div>}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-6">
        {[
          ["", "All", proposals.length && !filter ? proposals.length : counts.reduce((s, c) => s + c._count, 0)],
          ["DRAFT", "Drafts", stat("DRAFT")],
          ["PUBLISHED", "Sent", stat("PUBLISHED")],
          ["VIEWED", "Viewed", stat("VIEWED")],
          ["ACCEPTED", "Accepted", stat("ACCEPTED")],
          ["CHANGES_REQUESTED", "Changes", stat("CHANGES_REQUESTED") + stat("DECLINED")],
        ].map(([key, label, n]) => (
          <Link key={String(key)} href={key ? `/dashboard?status=${key}` : "/dashboard"} className={`card p-4 transition hover:border-zinc-300 ${(filter ?? "") === key ? "ring-2 ring-zinc-900/10" : ""}`}>
            <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{n as number}</div>
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2.5">Proposal</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Views</th>
              <th className="px-4 py-2.5">Time viewed</th>
              <th className="px-4 py-2.5">Updated</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {proposals.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                  No proposals yet. <Link className="underline" href="/proposals/new">Create your first one</Link> from a HubSpot deal or a template.
                </td>
              </tr>
            )}
            {proposals.map((p) => {
              const secs = p.views.reduce((s, v) => s + v.totalSeconds, 0);
              return (
                <tr key={p.id} className="border-t border-zinc-100 hover:bg-zinc-50/60">
                  <td className="px-4 py-3">
                    <Link href={`/proposals/${p.id}/edit`} className="font-medium hover:underline">{p.title}</Link>
                    <div className="text-xs text-zinc-400">
                      {p.owner.name ?? p.owner.email}
                      {p.hubspotDealId && <> · Deal #{p.hubspotDealId}</>}
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3">{p._count.views}</td>
                  <td className="px-4 py-3">{secs ? `${Math.round(secs / 60)}m ${secs % 60}s` : "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{p.updatedAt.toLocaleDateString("en-AU")}</td>
                  <td className="px-4 py-3 text-right"><ProposalRowActions id={p.id} token={p.publicToken} status={p.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
