"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { blocksSchema, createBlock, parseBlocks, themeSchema, type Block, type BlockOf } from "@/lib/blocks/schema";
import { baseVariables, resolveBlocks, type Variables } from "@/lib/blocks/variables";
import { HubSpotClient, HubSpotNotConnected } from "@/lib/hubspot/client";
import { fetchDealContext, lineItemsFromContext, variablesFromContext } from "@/lib/hubspot/deals";
import { timelineEvent } from "@/lib/hubspot/timeline";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";

/**
 * Create a proposal from a template, optionally pre-filled from a HubSpot deal.
 * Template {{variables}} are resolved from the deal/contact/company/owner, and
 * HubSpot line items are dropped into the first quote block if present.
 */
export async function createProposal(input: { templateId?: string; dealId?: string; title?: string }) {
  const user = await requireUser();

  let blocks: Block[];
  let theme: unknown = null;
  if (input.templateId) {
    const t = await prisma.template.findFirst({ where: { id: input.templateId, workspaceId: user.workspaceId } });
    if (!t) throw new Error("Template not found");
    blocks = parseBlocks(t.blocks);
    theme = t.theme;
  } else {
    blocks = [createBlock("hero"), createBlock("text"), createBlock("quote"), createBlock("accept")];
  }

  let vars: Variables = baseVariables();
  vars["owner.firstname"] = user.name?.split(" ")[0] ?? "";
  vars["owner.email"] = user.email;
  let hubspotContactId: string | undefined;
  let hubspotCompanyId: string | undefined;
  let title = input.title ?? "";

  if (input.dealId) {
    try {
      const hs = new HubSpotClient(user.workspaceId);
      const ctx = await fetchDealContext(hs, input.dealId);
      vars = { ...vars, ...variablesFromContext(ctx) };
      hubspotContactId = ctx.contact?.id;
      hubspotCompanyId = ctx.company?.id;
      if (!title) title = ctx.deal.properties.dealname ?? "Proposal";
      const items = lineItemsFromContext(ctx);
      if (items.length) {
        const qi = blocks.findIndex((b) => b.type === "quote");
        if (qi >= 0) blocks[qi] = { ...(blocks[qi] as BlockOf<"quote">), items };
      }
    } catch (e) {
      if (!(e instanceof HubSpotNotConnected)) console.warn("[createProposal] HubSpot fetch failed", (e as Error).message);
    }
  }
  if (!title) title = vars["company.name"] ? `Proposal for ${vars["company.name"]}` : "Untitled proposal";

  const proposal = await prisma.proposal.create({
    data: {
      workspaceId: user.workspaceId,
      ownerId: user.id,
      title,
      publicToken: nanoid(21),
      blocks: resolveBlocks(blocks, vars),
      theme: theme ?? { brandColor: user.workspace.brandColor, logoUrl: user.workspace.logoUrl ?? "" },
      variables: vars,
      hubspotDealId: input.dealId,
      hubspotContactId,
      hubspotCompanyId,
    },
  });
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "proposal.create", entityType: "proposal", entityId: proposal.id, meta: { title, dealId: input.dealId, templateId: input.templateId } });
  redirect(`/proposals/${proposal.id}/edit`);
}

export async function saveProposal(id: string, data: { title?: string; blocks?: unknown; theme?: unknown; expiresAt?: string | null }) {
  const user = await requireUser();
  const p = await prisma.proposal.findFirst({ where: { id, workspaceId: user.workspaceId } });
  if (!p) throw new Error("Not found");
  const blocks = data.blocks !== undefined ? blocksSchema.parse(data.blocks) : undefined;
  const theme = data.theme !== undefined ? themeSchema.parse(data.theme) : undefined;
  await prisma.proposal.update({
    where: { id },
    data: {
      title: data.title,
      blocks,
      theme,
      expiresAt: data.expiresAt === undefined ? undefined : data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });
  return { savedAt: new Date().toISOString() };
}

export async function publishProposal(id: string) {
  const user = await requireUser();
  const p = await prisma.proposal.findFirst({ where: { id, workspaceId: user.workspaceId } });
  if (!p) throw new Error("Not found");
  await prisma.proposal.update({
    where: { id },
    data: { status: p.status === "DRAFT" ? "PUBLISHED" : p.status, publishedAt: p.publishedAt ?? new Date() },
  });
  const link = `${env.appUrl}/p/${p.publicToken}`;
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "proposal.publish", entityType: "proposal", entityId: id });
  await timelineEvent({
    workspaceId: user.workspaceId,
    dealId: p.hubspotDealId,
    name: "published",
    tokens: { proposalTitle: p.title, proposalUrl: link, repEmail: user.email },
    fallbackNoteHtml: `<p>Proposal sent: <a href="${link}">${p.title}</a></p>`,
  });
  revalidatePath(`/proposals/${id}/edit`);
  revalidatePath("/dashboard");
  return { link };
}

export async function unpublishProposal(id: string) {
  const user = await requireUser();
  await prisma.proposal.updateMany({ where: { id, workspaceId: user.workspaceId, status: { in: ["PUBLISHED", "VIEWED", "CHANGES_REQUESTED"] } }, data: { status: "DRAFT" } });
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "proposal.unpublish", entityType: "proposal", entityId: id });
  revalidatePath(`/proposals/${id}/edit`);
}

export async function duplicateProposal(id: string) {
  const user = await requireUser();
  const p = await prisma.proposal.findFirst({ where: { id, workspaceId: user.workspaceId } });
  if (!p) throw new Error("Not found");
  const copy = await prisma.proposal.create({
    data: {
      workspaceId: p.workspaceId,
      ownerId: user.id,
      title: `${p.title} (copy)`,
      publicToken: nanoid(21),
      blocks: p.blocks as object,
      theme: p.theme as object,
      variables: p.variables as object,
      hubspotDealId: p.hubspotDealId,
      hubspotContactId: p.hubspotContactId,
      hubspotCompanyId: p.hubspotCompanyId,
    },
  });
  redirect(`/proposals/${copy.id}/edit`);
}

export async function deleteProposal(id: string) {
  const user = await requireUser();
  const p = await prisma.proposal.findFirst({ where: { id, workspaceId: user.workspaceId }, select: { title: true, ownerId: true } });
  if (!p) return;
  if (p.ownerId !== user.id && user.role !== "ADMIN") throw new Error("Only the owner or an admin can delete this proposal");
  await prisma.proposal.delete({ where: { id } });
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "proposal.delete", entityType: "proposal", entityId: id, meta: { title: p.title } });
  revalidatePath("/dashboard");
}

export async function saveAsTemplate(id: string, name: string) {
  const user = await requireUser();
  const p = await prisma.proposal.findFirst({ where: { id, workspaceId: user.workspaceId } });
  if (!p) throw new Error("Not found");
  const t = await prisma.template.create({
    data: { workspaceId: user.workspaceId, name, blocks: p.blocks as object, theme: p.theme as object },
  });
  redirect(`/templates/${t.id}/edit`);
}

export async function markNotificationsRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/dashboard");
}
