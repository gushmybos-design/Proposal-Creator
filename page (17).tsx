import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { HubSpotClient } from "@/lib/hubspot/client";
import { listDealStages, type PipelineStage } from "@/lib/hubspot/deals";
import { addSavedLineItem, deleteSavedLineItem, saveWorkspaceSettings, setUserRole } from "@/lib/actions/settings";
import { env } from "@/lib/env";
import { UploadField } from "@/components/editor/UploadField";

const TIMELINE_EVENTS = ["published", "viewed", "accepted", "declined", "changes_requested", "countersigned"] as const;

export default async function Settings() {
  const user = await requireAdmin();
  const ws = user.workspace;
  const [items, users] = await Promise.all([
    prisma.savedLineItem.findMany({ where: { workspaceId: ws.id }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { workspaceId: ws.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const timeline = (ws.timelineTemplates ?? {}) as Record<string, string>;

  let stages: PipelineStage[] = [];
  if (ws.hubspot) {
    try {
      stages = await listDealStages(new HubSpotClient(ws.id));
    } catch {
      /* show manual input instead */
    }
  }
  const stageSelect = (name: string, value: string | null) =>
    stages.length ? (
      <select name={name} className="input" defaultValue={value ?? ""}>
        <option value="">— don&apos;t change stage —</option>
        {stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
    ) : (
      <input name={name} className="input" defaultValue={value ?? ""} placeholder="Deal stage id, e.g. closedwon" />
    );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-zinc-500">Workspace branding, signing rules and HubSpot behaviour. Admins only.</p>
        </div>
        <Link href="/settings/audit" className="btn-ghost">Audit log</Link>
      </div>

      <form
        className="card space-y-5 p-6"
        action={async (fd) => {
          "use server";
          await saveWorkspaceSettings({
            name: String(fd.get("name") ?? ""),
            brandColor: String(fd.get("brandColor") ?? ""),
            logoUrl: String(fd.get("logoUrl") ?? ""),
            acceptedStageId: String(fd.get("acceptedStageId") ?? ""),
            declinedStageId: String(fd.get("declinedStageId") ?? ""),
            requireCounterSign: fd.get("requireCounterSign") === "on",
            timelineTemplates: Object.fromEntries(TIMELINE_EVENTS.map((e) => [e, String(fd.get(`tl_${e}`) ?? "")])),
          });
        }}
      >
        <h2 className="font-medium">Branding</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Workspace name</label><input name="name" className="input" defaultValue={ws.name} /></div>
          <div><label className="label">Brand colour</label><input name="brandColor" className="input" defaultValue={ws.brandColor} /></div>
          <div className="sm:col-span-2"><label className="label">Logo</label><UploadField name="logoUrl" defaultValue={ws.logoUrl ?? ""} accept="image/*" /></div>
        </div>

        <h2 className="pt-2 font-medium">Signing</h2>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="requireCounterSign" defaultChecked={ws.requireCounterSign} className="mt-1" />
          <span>
            <span className="font-medium">Require MYBOS counter-signature.</span>{" "}
            <span className="text-zinc-500">After the client signs, a team member counter-signs from the analytics page; the client is then emailed the executed copy.</span>
          </span>
        </label>

        <h2 className="pt-2 font-medium">HubSpot</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Deal stage when accepted</label>
            {stageSelect("acceptedStageId", ws.acceptedStageId)}
          </div>
          <div>
            <label className="label">Deal stage when declined</label>
            {stageSelect("declinedStageId", ws.declinedStageId)}
          </div>
        </div>
        <p className="text-xs text-zinc-400">Drive downstream automation (invoicing, onboarding tasks, Slack alerts) from these stage changes with HubSpot workflows.</p>

        <details className="rounded-lg border border-zinc-200 p-4 text-sm">
          <summary className="cursor-pointer font-medium">Timeline event templates (optional)</summary>
          <p className="mt-2 text-xs text-zinc-500">
            Without these, Propel writes activity as <em>notes</em> on the deal. With custom timeline events you get filterable, reportable
            events with their own icon. Create them once with <code className="rounded bg-zinc-100 px-1">npm run hubspot:timeline</code> (see
            <code className="rounded bg-zinc-100 px-1">hubspot/README.md</code>) and paste the template ids here.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {TIMELINE_EVENTS.map((e) => (
              <div key={e}>
                <label className="label">{e.replace("_", " ")}</label>
                <input name={`tl_${e}`} className="input" defaultValue={timeline[e] ?? ""} placeholder="template id" />
              </div>
            ))}
          </div>
        </details>

        <div className="rounded-lg bg-zinc-50 p-4 text-xs text-zinc-600">
          <div className="mb-1 font-medium text-zinc-800">Deal record card</div>
          Two options, both documented in <code className="rounded bg-white px-1">hubspot/README.md</code>:
          <ul className="ml-4 mt-1 list-disc space-y-0.5">
            <li><strong>Classic CRM card</strong> — data fetch URL <code className="select-all rounded bg-white px-1">{env.appUrl}/api/hubspot/crm-card</code></li>
            <li><strong>UI extension (React)</strong> — richer card built with HubSpot&apos;s developer projects; source in <code className="rounded bg-white px-1">hubspot/</code></li>
          </ul>
          {!ws.hubspot && <div className="mt-2 text-amber-700">HubSpot isn&apos;t connected — <a className="underline" href="/api/hubspot/install">connect now</a>.</div>}
        </div>
        <button className="btn-primary">Save settings</button>
      </form>

      <section className="card p-6">
        <h2 className="font-medium">Team</h2>
        <p className="mb-4 text-sm text-zinc-500">Everyone who signs in with HubSpot joins as a Rep. Admins manage templates, settings and can delete any proposal.</p>
        <table className="w-full text-sm">
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-zinc-100">
                <td className="py-2 font-medium">{u.name ?? u.email}<div className="text-xs text-zinc-400">{u.email}</div></td>
                <td className="py-2 text-right">
                  <form action={async (fd) => { "use server"; await setUserRole(u.id, String(fd.get("role")) as "ADMIN" | "REP"); }} className="inline-flex items-center gap-2">
                    <select name="role" defaultValue={u.role} className="input w-28"><option value="REP">Rep</option><option value="ADMIN">Admin</option></select>
                    <button className="btn-ghost">Update</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-6">
        <h2 className="font-medium">Saved line items</h2>
        <p className="mb-4 text-sm text-zinc-500">Standard products reps can drop into a quote block in one click.</p>
        <table className="mb-4 w-full text-sm">
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-zinc-100">
                <td className="py-2 font-medium">{i.name}<div className="text-xs text-zinc-400">{i.description}</div></td>
                <td className="py-2 text-right">${Number(i.unitPrice).toLocaleString()} <span className="text-xs text-zinc-400">{i.billing}</span></td>
                <td className="py-2 text-right">
                  <form action={async () => { "use server"; await deleteSavedLineItem(i.id); }}><button className="text-xs text-zinc-400 hover:text-rose-600">Remove</button></form>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td className="py-3 text-zinc-400">None yet.</td></tr>}
          </tbody>
        </table>
        <form
          className="grid gap-2 sm:grid-cols-[2fr_2fr_1fr_1fr_auto]"
          action={async (fd) => {
            "use server";
            await addSavedLineItem({ name: String(fd.get("name")), description: String(fd.get("description") ?? ""), unitPrice: Number(fd.get("unitPrice")) || 0, billing: String(fd.get("billing")) });
          }}
        >
          <input name="name" className="input" placeholder="Name" required />
          <input name="description" className="input" placeholder="Description" />
          <input name="unitPrice" className="input" type="number" step="0.01" placeholder="Price" required />
          <select name="billing" className="input"><option value="once">one-off</option><option value="monthly">monthly</option><option value="yearly">yearly</option></select>
          <button className="btn-ghost">Add</button>
        </form>
      </section>
    </div>
  );
}
