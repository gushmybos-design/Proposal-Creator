import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { NotificationType } from "@/generated/prisma/enums";
import { noteOnDeal } from "./hubspot/writeback";

/**
 * Notify the proposal owner: in-app record, email (Resend, if configured) and a note on
 * the HubSpot deal so activity is visible in the CRM without opening Propel.
 */
export async function notify(opts: {
  proposalId: string;
  type: NotificationType;
  message: string;
  hubspotNote?: boolean;
}) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: opts.proposalId },
    include: { owner: true },
  });
  if (!proposal) return;

  const n = await prisma.notification.create({
    data: { userId: proposal.ownerId, proposalId: proposal.id, type: opts.type, message: opts.message },
  });

  const link = `${env.appUrl}/proposals/${proposal.id}/analytics`;
  const subject = `[Propel] ${opts.message}`;
  const html = `<p>${opts.message}</p><p><a href="${link}">Open engagement analytics</a></p>`;

  if (env.email.resendKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(env.email.resendKey);
      await resend.emails.send({ from: env.email.from, to: proposal.owner.email, subject, html });
      await prisma.notification.update({ where: { id: n.id }, data: { emailedAt: new Date() } });
    } catch (e) {
      console.warn("[email] failed", (e as Error).message);
    }
  } else {
    console.log(`[email → ${proposal.owner.email}] ${subject}`);
  }

  if (opts.hubspotNote !== false) {
    await noteOnDeal(
      proposal.workspaceId,
      proposal.hubspotDealId,
      `<p>${opts.message}</p><p><a href="${env.appUrl}/p/${proposal.publicToken}">Proposal</a> · <a href="${link}">Analytics</a></p>`,
    );
  }
}

/**
 * Scheduled scan (call from /api/cron/stalled): finds proposals where someone started the
 * accept flow but didn't sign within 24h, and proposals expiring within 3 days.
 */
export async function scanStalledAndExpiring() {
  const dayAgo = new Date(Date.now() - 24 * 3600_000);
  const stalled = await prisma.blockEvent.findMany({
    where: { type: "ACCEPT_STARTED", at: { lt: dayAgo, gt: new Date(dayAgo.getTime() - 24 * 3600_000) } },
    include: { session: { include: { proposal: { include: { notifications: true } } } } },
  });
  let sent = 0;
  const seen = new Set<string>();
  for (const ev of stalled) {
    const p = ev.session.proposal;
    if (seen.has(p.id) || p.status === "ACCEPTED") continue;
    seen.add(p.id);
    if (p.notifications.some((n) => n.type === "ACCEPT_STALLED")) continue;
    await notify({
      proposalId: p.id,
      type: "ACCEPT_STALLED",
      message: `Signing stalled on "${p.title}" — a viewer opened the accept step but hasn't signed. Worth a nudge.`,
    });
    sent++;
  }

  const soon = new Date(Date.now() + 3 * 24 * 3600_000);
  const expiring = await prisma.proposal.findMany({
    where: { status: { in: ["PUBLISHED", "VIEWED"] }, expiresAt: { lte: soon, gt: new Date() } },
    include: { notifications: true },
  });
  for (const p of expiring) {
    if (p.notifications.some((n) => n.type === "EXPIRING")) continue;
    await notify({ proposalId: p.id, type: "EXPIRING", message: `"${p.title}" expires on ${p.expiresAt!.toLocaleDateString("en-AU")}.` });
    sent++;
  }
  await prisma.proposal.updateMany({
    where: { status: { in: ["PUBLISHED", "VIEWED"] }, expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  return sent;
}
