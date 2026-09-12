import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyHubSpotSignature, verifySharedSecret } from "@/lib/hubspot/signature";

/**
 * CRM card data-fetch endpoint. Register this URL on your HubSpot app under
 * "CRM cards" → Data fetch URL, for the Deal object:
 *   {APP_URL}/api/hubspot/crm-card
 * Request properties to send: dealname
 *
 * HubSpot calls it with ?associatedObjectId=<dealId>&portalId=<hubId>&userEmail=...
 * We return the proposals for that deal plus a primary action that opens Propel's
 * "new proposal from deal" flow — so reps never leave the HubSpot deal record.
 */
export async function GET(req: NextRequest) {
  const ok = verifyHubSpotSignature(req, "") || verifySharedSecret(req) || (env.isDev && !env.hubspot.configured);
  if (!ok) return NextResponse.json({ message: "invalid signature" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const dealId = q.get("associatedObjectId");
  const hubId = q.get("portalId");
  if (!dealId || !hubId) return NextResponse.json({ results: [] });

  const workspace = await prisma.workspace.findUnique({ where: { hubId } });
  if (!workspace) return NextResponse.json({ results: [] });

  const proposals = await prisma.proposal.findMany({
    where: { workspaceId: workspace.id, hubspotDealId: dealId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { views: true } } },
  });

  const results = proposals.map((p) => ({
    objectId: p.id,
    title: p.title,
    link: `${env.appUrl}/proposals/${p.id}/analytics`,
    properties: [
      { label: "Status", dataType: "STATUS", value: p.status, optionType: statusColor(p.status) },
      { label: "Views", dataType: "NUMERIC", value: p._count.views },
      { label: "Last updated", dataType: "DATETIME", value: p.updatedAt.toISOString() },
      ...(p.acceptedAt ? [{ label: "Accepted", dataType: "DATETIME", value: p.acceptedAt.toISOString() }] : []),
    ],
    actions: [
      { type: "IFRAME", width: 1200, height: 800, uri: `${env.appUrl}/proposals/${p.id}/edit?embed=1`, label: "Edit" },
      { type: "IFRAME", width: 1200, height: 800, uri: `${env.appUrl}/p/${p.publicToken}?preview=1`, label: "Preview" },
    ],
  }));

  return NextResponse.json({
    results,
    primaryAction: {
      type: "IFRAME",
      width: 1200,
      height: 800,
      uri: `${env.appUrl}/proposals/new?dealId=${encodeURIComponent(dealId)}&embed=1`,
      label: "New proposal",
    },
  });
}

function statusColor(s: string) {
  switch (s) {
    case "ACCEPTED":
      return "SUCCESS";
    case "VIEWED":
      return "INFO";
    case "DECLINED":
    case "EXPIRED":
      return "DANGER";
    case "PUBLISHED":
      return "WARNING";
    default:
      return "DEFAULT";
  }
}
