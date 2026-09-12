import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyHubSpotSignature, verifySharedSecret } from "@/lib/hubspot/signature";
import { parseBlocks, createBlock, type Block, type BlockOf } from "@/lib/blocks/schema";
import { baseVariables, resolveBlocks } from "@/lib/blocks/variables";
import { HubSpotClient } from "@/lib/hubspot/client";
import { fetchDealContext, lineItemsFromContext, variablesFromContext } from "@/lib/hubspot/deals";
import { audit } from "@/lib/audit";

/**
 * Backend for the React UI-extension card (hubspot/src/app/extensions/ProposalsCard.jsx).
 * Requests arrive via hubspot.fetch() and are signed with the app client secret.
 *
 *   GET  ?dealId=&portalId=   → proposals for the deal + templates for the "new" buttons
 *   POST {dealId, portalId, userEmail, templateId?} → creates a draft, returns editUrl
 */
const LABELS: Record<string, string> = { DRAFT: "Draft", PUBLISHED: "Sent", VIEWED: "Viewed", ACCEPTED: "Accepted", DECLINED: "Declined", CHANGES_REQUESTED: "Changes requested", EXPIRED: "Expired" };

function authorized(req: NextRequest, body: string) {
  return verifyHubSpotSignature(req, body) || verifySharedSecret(req) || (env.isDev && !env.hubspot.configured);
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-HubSpot-Signature-v3, X-HubSpot-Request-Timestamp",
};
export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

export async function GET(req: NextRequest) {
  if (!authorized(req, "")) return NextResponse.json({ error: "invalid signature" }, { status: 401, headers: cors });
  const dealId = req.nextUrl.searchParams.get("dealId");
  const hubId = req.nextUrl.searchParams.get("portalId");
  if (!dealId || !hubId) return NextResponse.json({ error: "dealId and portalId required" }, { status: 400, headers: cors });

  const ws = await prisma.workspace.findUnique({ where: { hubId } });
  if (!ws) return NextResponse.json({ error: "Propel is not installed on this portal. Open Propel and click “Continue with HubSpot”." }, { status: 404, headers: cors });

  const [proposals, templates] = await Promise.all([
    prisma.proposal.findMany({ where: { workspaceId: ws.id, hubspotDealId: dealId }, orderBy: { updatedAt: "desc" }, include: { views: { select: { totalSeconds: true } } } }),
    prisma.template.findMany({ where: { workspaceId: ws.id }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true } }),
  ]);

  return NextResponse.json(
    {
      templates,
      proposals: proposals.map((p) => {
        const secs = p.views.reduce((s, v) => s + v.totalSeconds, 0);
        return {
          id: p.id,
          title: p.title,
          status: p.status,
          statusLabel: LABELS[p.status] ?? p.status,
          views: p.views.length,
          timeViewed: secs ? `${Math.floor(secs / 60)}m ${secs % 60}s` : "—",
          updatedAt: p.updatedAt.toLocaleDateString("en-AU"),
          editUrl: `${env.appUrl}/proposals/${p.id}/edit?embed=1`,
          previewUrl: `${env.appUrl}/p/${p.publicToken}?preview=1`,
          analyticsUrl: `${env.appUrl}/proposals/${p.id}/analytics`,
          publicUrl: `${env.appUrl}/p/${p.publicToken}`,
        };
      }),
    },
    { headers: cors },
  );
}

const createBody = z.object({
  dealId: z.string(),
  portalId: z.string(),
  userEmail: z.string().email(),
  templateId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!authorized(req, raw)) return NextResponse.json({ error: "invalid signature" }, { status: 401, headers: cors });
  const parsed = createBody.safeParse(JSON.parse(raw || "{}"));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400, headers: cors });
  const { dealId, portalId, userEmail, templateId } = parsed.data;

  const ws = await prisma.workspace.findUnique({ where: { hubId: portalId } });
  if (!ws) return NextResponse.json({ error: "Propel is not installed on this portal." }, { status: 404, headers: cors });

  // The HubSpot user becomes (or already is) a Propel user in this workspace.
  const user = await prisma.user.upsert({
    where: { workspaceId_email: { workspaceId: ws.id, email: userEmail } },
    create: { workspaceId: ws.id, email: userEmail },
    update: {},
  });

  let blocks: Block[];
  let theme: unknown = null;
  if (templateId) {
    const t = await prisma.template.findFirst({ where: { id: templateId, workspaceId: ws.id } });
    if (!t) return NextResponse.json({ error: "Template not found" }, { status: 404, headers: cors });
    blocks = parseBlocks(t.blocks);
    theme = t.theme;
  } else {
    blocks = [createBlock("hero"), createBlock("text"), createBlock("quote"), createBlock("accept")];
  }

  let vars = baseVariables();
  let title = "Proposal";
  let hubspotContactId: string | undefined;
  let hubspotCompanyId: string | undefined;
  try {
    const ctx = await fetchDealContext(new HubSpotClient(ws.id), dealId);
    vars = { ...vars, ...variablesFromContext(ctx) };
    title = ctx.deal.properties.dealname ?? title;
    hubspotContactId = ctx.contact?.id;
    hubspotCompanyId = ctx.company?.id;
    const items = lineItemsFromContext(ctx);
    const qi = blocks.findIndex((b) => b.type === "quote");
    if (items.length && qi >= 0) blocks[qi] = { ...(blocks[qi] as BlockOf<"quote">), items };
  } catch (e) {
    console.warn("[ext] deal fetch failed", (e as Error).message);
  }

  const proposal = await prisma.proposal.create({
    data: {
      workspaceId: ws.id,
      ownerId: user.id,
      title,
      publicToken: nanoid(21),
      blocks: resolveBlocks(blocks, vars),
      theme: theme ?? { brandColor: ws.brandColor, logoUrl: ws.logoUrl ?? "" },
      variables: vars,
      hubspotDealId: dealId,
      hubspotContactId,
      hubspotCompanyId,
    },
  });
  await audit({ workspaceId: ws.id, userId: user.id, action: "proposal.create", entityType: "proposal", entityId: proposal.id, meta: { via: "hubspot-ui-extension", dealId, templateId } });

  return NextResponse.json({ id: proposal.id, editUrl: `${env.appUrl}/proposals/${proposal.id}/edit?embed=1` }, { headers: cors });
}
