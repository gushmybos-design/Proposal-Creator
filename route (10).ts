import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { HubSpotClient } from "@/lib/hubspot/client";
import { timelineEvent } from "@/lib/hubspot/timeline";
import { env } from "@/lib/env";

const payload = z.object({
  type: z.enum(["DECLINED", "CHANGES_REQUESTED"]),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  message: z.string().min(2).max(4000),
  sessionId: z.string().optional(),
});

/**
 * Client declines the proposal or asks for changes. Records the feedback, updates status,
 * notifies the rep (email + in-app + HubSpot) and optionally moves the deal stage on decline.
 * "Changes requested" keeps the link live so the rep can edit and the client can re-review.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const parsed = payload.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please complete all fields." }, { status: 400 });
  const d = parsed.data;

  const p = await prisma.proposal.findUnique({ where: { publicToken: token }, include: { workspace: true } });
  if (!p || p.status === "DRAFT") return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  if (p.status === "ACCEPTED") return NextResponse.json({ error: "This proposal has already been accepted." }, { status: 409 });

  await prisma.$transaction([
    prisma.proposalFeedback.create({ data: { proposalId: p.id, type: d.type, name: d.name, email: d.email, message: d.message } }),
    prisma.proposal.update({
      where: { id: p.id },
      data: d.type === "DECLINED" ? { status: "DECLINED", declinedAt: new Date() } : { status: "CHANGES_REQUESTED" },
    }),
    ...(d.sessionId ? [prisma.viewSession.updateMany({ where: { id: d.sessionId, proposalId: p.id }, data: { viewerEmail: d.email } })] : []),
  ]);

  const verb = d.type === "DECLINED" ? "declined" : "requested changes to";
  const msg = `${d.name} ${verb} "${p.title}": “${d.message.slice(0, 200)}${d.message.length > 200 ? "…" : ""}”`;
  const link = `${env.appUrl}/proposals/${p.id}/analytics`;

  await Promise.allSettled([
    notify({ proposalId: p.id, type: d.type, message: msg, hubspotNote: false }),
    timelineEvent({
      workspaceId: p.workspaceId,
      dealId: p.hubspotDealId,
      name: d.type === "DECLINED" ? "declined" : "changes_requested",
      tokens: { proposalTitle: p.title, signerName: d.name, signerEmail: d.email, message: d.message.slice(0, 500), proposalUrl: link },
      fallbackNoteHtml: `<p><strong>Proposal ${verb === "declined" ? "declined ❌" : "— changes requested ✏️"}</strong> — "${p.title}"</p><p>${d.name} (${d.email}): ${escapeHtml(d.message)}</p><p><a href="${link}">Open in Propel</a></p>`,
    }),
    d.type === "DECLINED" && p.workspace.declinedStageId && p.hubspotDealId
      ? new HubSpotClient(p.workspaceId).patch(`/crm/v3/objects/deals/${p.hubspotDealId}`, { properties: { dealstage: p.workspace.declinedStageId } }).catch((e) => console.warn("[hubspot] stage", e.message))
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
