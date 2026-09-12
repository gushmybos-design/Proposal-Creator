"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { timelineEvent } from "@/lib/hubspot/timeline";
import { env } from "@/lib/env";

/**
 * MYBOS counter-signs an accepted proposal. Any workspace member may counter-sign (typically the
 * rep or a manager); the signature is tied to their user record. Emails the client the executed
 * copy (PDF link) when email is configured.
 */
export async function counterSign(proposalId: string, data: { signature: string; title?: string }) {
  const user = await requireUser();
  if (!data.signature.startsWith("data:image/png;base64,")) throw new Error("Invalid signature");
  const p = await prisma.proposal.findFirst({
    where: { id: proposalId, workspaceId: user.workspaceId },
    include: { signatures: true },
  });
  if (!p) throw new Error("Not found");
  if (p.status !== "ACCEPTED") throw new Error("Only accepted proposals can be counter-signed");
  if (p.signatures.some((s) => s.role === "COUNTERSIGNER")) throw new Error("Already counter-signed");
  const client = p.signatures.find((s) => s.role === "CLIENT");

  await prisma.$transaction([
    prisma.signature.create({
      data: {
        proposalId,
        role: "COUNTERSIGNER",
        userId: user.id,
        signerName: user.name ?? user.email,
        signerEmail: user.email,
        signerTitle: data.title,
        imageData: data.signature,
        termsVersion: client?.termsVersion ?? "v1",
        acceptedTotal: client?.acceptedTotal,
      },
    }),
    prisma.proposal.update({ where: { id: proposalId }, data: { counterSignedAt: new Date() } }),
  ]);

  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "proposal.countersign", entityType: "proposal", entityId: proposalId });
  const link = `${env.appUrl}/p/${p.publicToken}`;
  await Promise.allSettled([
    notify({ proposalId, type: "COUNTERSIGNED", message: `"${p.title}" is fully executed — counter-signed by ${user.name ?? user.email}.`, hubspotNote: false }),
    timelineEvent({
      workspaceId: p.workspaceId,
      dealId: p.hubspotDealId,
      name: "countersigned",
      tokens: { proposalTitle: p.title, signerName: user.name ?? user.email, signerEmail: user.email, proposalUrl: link },
      fallbackNoteHtml: `<p><strong>Proposal counter-signed ✍️</strong> — "${p.title}" by ${user.name ?? user.email}. <a href="${link}">Executed copy</a></p>`,
    }),
    client ? emailClientExecutedCopy(client.signerEmail, client.signerName, p.title, link) : Promise.resolve(),
  ]);
  revalidatePath(`/proposals/${proposalId}/analytics`);
}

async function emailClientExecutedCopy(to: string, name: string, title: string, link: string) {
  if (!env.email.resendKey) {
    console.log(`[email → ${to}] Executed copy of "${title}": ${link}`);
    return;
  }
  try {
    const { Resend } = await import("resend");
    await new Resend(env.email.resendKey).emails.send({
      from: env.email.from,
      to,
      subject: `Your signed copy of "${title}"`,
      html: `<p>Hi ${name.split(" ")[0]},</p><p>Both parties have now signed <strong>${title}</strong>. You can view it or download the PDF here:</p><p><a href="${link}">${link}</a> · <a href="${link.replace("/p/", "/api/proposals/")}/pdf">Download PDF</a></p><p>— MYBOS</p>`,
    });
  } catch (e) {
    console.warn("[email] executed copy failed", (e as Error).message);
  }
}

/** After acting on "changes requested", the rep re-opens the proposal so the client can re-review. */
export async function reopenProposal(proposalId: string, note?: string) {
  const user = await requireUser();
  const p = await prisma.proposal.findFirst({ where: { id: proposalId, workspaceId: user.workspaceId }, include: { feedback: { where: { resolvedAt: null } } } });
  if (!p) throw new Error("Not found");
  await prisma.$transaction([
    prisma.proposal.update({ where: { id: proposalId }, data: { status: p.firstViewedAt ? "VIEWED" : "PUBLISHED", declinedAt: null } }),
    prisma.proposalFeedback.updateMany({ where: { proposalId, resolvedAt: null }, data: { resolvedAt: new Date() } }),
  ]);
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "proposal.reopen", entityType: "proposal", entityId: proposalId, meta: { note } });
  const requester = p.feedback[0];
  if (requester && env.email.resendKey) {
    try {
      const { Resend } = await import("resend");
      await new Resend(env.email.resendKey).emails.send({
        from: env.email.from,
        to: requester.email,
        subject: `Updated proposal: ${p.title}`,
        html: `<p>Hi ${requester.name.split(" ")[0]},</p><p>We've updated <strong>${p.title}</strong> based on your feedback.${note ? ` ${note}` : ""}</p><p><a href="${env.appUrl}/p/${p.publicToken}">Review the updated proposal</a></p>`,
      });
    } catch (e) {
      console.warn("[email] reopen failed", (e as Error).message);
    }
  }
  revalidatePath(`/proposals/${proposalId}/analytics`);
  revalidatePath("/dashboard");
}
