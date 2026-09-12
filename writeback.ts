import { prisma } from "@/lib/db";
import { HubSpotClient } from "./client";
import { env } from "@/lib/env";

// HubSpot association type ids (HUBSPOT_DEFINED)
const NOTE_TO_DEAL = 214;

/**
 * Write a timeline note on the deal so the whole team sees proposal activity in HubSpot.
 * Silently no-ops if HubSpot isn't connected or the proposal has no deal.
 */
export async function noteOnDeal(workspaceId: string, dealId: string | null | undefined, html: string) {
  if (!dealId) return;
  try {
    const hs = new HubSpotClient(workspaceId);
    await hs.post(`/crm/v3/objects/notes`, {
      properties: { hs_timestamp: new Date().toISOString(), hs_note_body: html },
      associations: [
        { to: { id: dealId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: NOTE_TO_DEAL }] },
      ],
    });
  } catch (e) {
    console.warn("[hubspot] note failed", (e as Error).message);
  }
}

/**
 * Fired when a client accepts & signs. Moves the deal to the configured "accepted" stage,
 * stamps the deal with the proposal link, and leaves a note. Everything downstream (workflows,
 * notifications, invoicing) can then be driven by HubSpot automation on the stage change.
 */
export async function onProposalAccepted(proposalId: string) {
  const p = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { workspace: true, signatures: { orderBy: { signedAt: "desc" }, take: 1 } },
  });
  if (!p || !p.hubspotDealId) return;
  const hs = new HubSpotClient(p.workspaceId);
  const sig = p.signatures[0];
  const link = `${env.appUrl}/p/${p.publicToken}`;

  const props: Record<string, string> = {};
  if (p.workspace.acceptedStageId) props.dealstage = p.workspace.acceptedStageId;
  if (sig?.acceptedTotal) props.amount = String(sig.acceptedTotal);

  try {
    if (Object.keys(props).length) await hs.patch(`/crm/v3/objects/deals/${p.hubspotDealId}`, { properties: props });
  } catch (e) {
    console.warn("[hubspot] deal update failed", (e as Error).message);
  }

  const { timelineEvent } = await import("./timeline");
  await timelineEvent({
    workspaceId: p.workspaceId,
    dealId: p.hubspotDealId,
    name: "accepted",
    tokens: { proposalTitle: p.title, signerName: sig?.signerName, signerEmail: sig?.signerEmail, acceptedTotal: sig?.acceptedTotal ? Number(sig.acceptedTotal) : undefined, proposalUrl: link },
    fallbackNoteHtml:
      `<p><strong>Proposal accepted ✅</strong> — "${p.title}"</p>` +
      (sig ? `<p>Signed by ${sig.signerName} (${sig.signerEmail}) on ${sig.signedAt.toLocaleString("en-AU")}.</p>` : "") +
      `<p><a href="${link}">View signed proposal</a></p>`,
  });
}
