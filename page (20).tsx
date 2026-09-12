import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { parseBlocks, BLOCK_META } from "@/lib/blocks/schema";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { env } from "@/lib/env";
import { CounterSignPanel } from "@/components/ui/CounterSignPanel";
import { FeedbackPanel } from "@/components/ui/FeedbackPanel";

function fmtDur(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default async function Analytics({ params }: PageProps<"/proposals/[id]/analytics">) {
  const user = await requireUser();
  const { id } = await params;
  const p = await prisma.proposal.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: {
      views: { orderBy: { startedAt: "desc" }, include: { events: true } },
      signatures: { orderBy: { signedAt: "desc" } },
      notifications: { orderBy: { createdAt: "desc" }, take: 20 },
      feedback: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!p) notFound();

  const blocks = parseBlocks(p.blocks);
  const blockName = (b: (typeof blocks)[number]) => ("heading" in b && b.heading ? b.heading : BLOCK_META[b.type].label);

  // Aggregate per-block dwell time and interactions
  const perBlock = blocks.map((b) => {
    const evs = p.views.flatMap((v) => v.events.filter((e) => e.blockId === b.id));
    const seconds = evs.filter((e) => e.type === "VIEW").reduce((s, e) => s + e.seconds, 0);
    const clicks = evs.filter((e) => e.type === "CLICK").length;
    const viewers = new Set(evs.map((e) => e.sessionId)).size;
    return { b, seconds, clicks, viewers };
  });
  const maxSeconds = Math.max(1, ...perBlock.map((x) => x.seconds));
  const totalSeconds = p.views.reduce((s, v) => s + v.totalSeconds, 0);
  const uniqueVisitors = new Set(p.views.map((v) => v.visitorId)).size;
  const mobile = p.views.filter((v) => v.isMobile).length;
  const acceptStarted = p.views.some((v) => v.events.some((e) => e.type === "ACCEPT_STARTED"));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{p.title}</h1>
            <StatusBadge status={p.status} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {p.publishedAt ? `Sent ${p.publishedAt.toLocaleString("en-AU")}` : "Not yet published"}
            {p.firstViewedAt && <> · First opened {p.firstViewedAt.toLocaleString("en-AU")}</>}
            {p.hubspotDealId && <> · Deal #{p.hubspotDealId}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/proposals/${p.id}/edit`} className="btn-ghost">Edit</Link>
          <a href={`${env.appUrl}/p/${p.publicToken}${p.status === "DRAFT" ? "?preview=1" : ""}`} target="_blank" rel="noreferrer" className="btn-ghost">Open</a>
          <a href={`/api/proposals/${p.publicToken}/pdf`} className="btn-ghost">PDF</a>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Views" value={String(p.views.length)} sub={`${uniqueVisitors} unique`} />
        <Stat label="Total time" value={fmtDur(totalSeconds)} sub={p.views.length ? `avg ${fmtDur(Math.round(totalSeconds / p.views.length))}` : ""} />
        <Stat label="Mobile" value={p.views.length ? `${Math.round((mobile / p.views.length) * 100)}%` : "—"} sub="of views" />
        <Stat label="Signing" value={p.status === "ACCEPTED" ? "Signed" : acceptStarted ? "Started" : "—"} sub={p.acceptedAt ? p.acceptedAt.toLocaleDateString("en-AU") : acceptStarted ? "not completed" : ""} />
      </div>

      <div className="mb-6 space-y-6">
        <FeedbackPanel proposalId={p.id} status={p.status} feedback={p.feedback.map((f) => ({ id: f.id, type: f.type, name: f.name, email: f.email, message: f.message, at: f.createdAt.toISOString(), resolved: Boolean(f.resolvedAt) }))} />
        {p.status === "ACCEPTED" && user.workspace.requireCounterSign && !p.signatures.some((s) => s.role === "COUNTERSIGNER") && (
          <CounterSignPanel proposalId={p.id} signerName={user.name ?? user.email} />
        )}
      </div>

      {p.status !== "ACCEPTED" && acceptStarted && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          A viewer opened the accept step but hasn&apos;t signed yet — a good moment for a follow-up call.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-3">
          <h2 className="mb-4 font-medium">Time spent per block</h2>
          <div className="space-y-3">
            {perBlock.map(({ b, seconds, clicks, viewers }) => (
              <div key={b.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="truncate"><span className="mr-1.5 rounded bg-zinc-100 px-1 text-[10px] font-medium uppercase text-zinc-500">{BLOCK_META[b.type].label}</span>{blockName(b)}</span>
                  <span className="shrink-0 text-zinc-500">{fmtDur(seconds)}{clicks ? ` · ${clicks} clicks` : ""}{viewers ? ` · ${viewers} viewers` : ""}</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100">
                  <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (seconds / maxSeconds) * 100)}%`, background: "var(--brand)" }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-400">Dwell time counts only while a block is at least half visible and the tab is active — idle time is excluded.</p>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-medium">Viewer timeline</h2>
          <ol className="space-y-3 text-sm">
            {p.views.length === 0 && <li className="text-zinc-400">No views yet.</li>}
            {p.views.map((v) => {
              const accepted = v.events.some((e) => e.type === "ACCEPTED");
              const started = v.events.some((e) => e.type === "ACCEPT_STARTED");
              const clicks = v.events.filter((e) => e.type === "CLICK").length;
              return (
                <li key={v.id} className="relative border-l-2 border-zinc-200 pl-4">
                  <span className={`absolute -left-[5px] top-1.5 h-2 w-2 rounded-full ${accepted ? "bg-emerald-500" : "bg-zinc-300"}`} />
                  <div className="font-medium">{v.viewerEmail ?? `Visitor ${v.visitorId.slice(0, 6)}`}{v.isMobile && <span className="ml-1 text-xs text-zinc-400">· mobile</span>}</div>
                  <div className="text-zinc-500">{v.startedAt.toLocaleString("en-AU")} · {fmtDur(v.totalSeconds)}{clicks ? ` · ${clicks} interactions` : ""}</div>
                  {accepted && <div className="text-xs text-emerald-600">Signed ✓</div>}
                  {!accepted && started && <div className="text-xs text-amber-600">Opened accept step</div>}
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      {p.signatures.length > 0 && (
        <section className="card mt-6 p-5">
          <h2 className="mb-3 font-medium">Signature record</h2>
          {p.signatures.map((s) => (
            <div key={s.id} className="mb-3 flex flex-wrap items-center gap-6 text-sm">
              <img src={s.imageData} alt="signature" className="h-16 rounded border border-zinc-200 bg-white" />
              <div>
                <div className="font-medium"><span className="mr-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500">{s.role === "CLIENT" ? "Client" : "MYBOS"}</span>{s.signerName}{s.signerTitle ? `, ${s.signerTitle}` : ""}</div>
                <div className="text-zinc-500">{s.signerEmail} · {s.signedAt.toLocaleString("en-AU")}</div>
                <div className="text-xs text-zinc-400">Terms {s.termsVersion} · {s.acceptedTotal ? `Accepted total $${Number(s.acceptedTotal).toLocaleString()}` : ""} · IP hash {s.ipHash?.slice(0, 8)}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="card mt-6 p-5">
        <h2 className="mb-3 font-medium">Notifications sent</h2>
        <ul className="space-y-1 text-sm">
          {p.notifications.length === 0 && <li className="text-zinc-400">None yet.</li>}
          {p.notifications.map((n) => (
            <li key={n.id} className="flex justify-between gap-4"><span>{n.message}</span><span className="shrink-0 text-zinc-400">{n.createdAt.toLocaleString("en-AU")}{n.emailedAt ? " · emailed" : ""}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-zinc-400">{sub}</div>}
    </div>
  );
}
