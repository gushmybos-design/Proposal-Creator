import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { timelineEvent } from "@/lib/hubspot/timeline";
import { env } from "@/lib/env";

const payload = z.object({
  token: z.string(),
  visitorId: z.string().min(6).max(64),
  sessionId: z.string().optional(),
  events: z
    .array(
      z.object({
        blockId: z.string(),
        type: z.enum(["VIEW", "CLICK", "ACCEPT_STARTED"]),
        seconds: z.number().int().min(0).max(3600).default(0),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .default([]),
  seconds: z.number().int().min(0).max(3600).default(0), // total active seconds since last beacon
});

/**
 * Engagement beacon. The public page batches events (block dwell time, clicks) and posts
 * them every ~10s and on unload. First call of a session creates a ViewSession.
 */
export async function POST(req: NextRequest) {
  const parsed = payload.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad payload" }, { status: 400 });
  const { token, visitorId, events, seconds } = parsed.data;
  if (req.nextUrl.searchParams.get("preview") === "1") return NextResponse.json({ ok: true });

  const proposal = await prisma.proposal.findUnique({
    where: { publicToken: token },
    select: { id: true, status: true, title: true, firstViewedAt: true, workspaceId: true, hubspotDealId: true, publicToken: true },
  });
  if (!proposal || proposal.status === "DRAFT") return NextResponse.json({ error: "not found" }, { status: 404 });

  const ua = req.headers.get("user-agent") ?? "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ipHash = ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null;

  let sessionId = parsed.data.sessionId;
  let isNewSession = false;
  if (sessionId) {
    const exists = await prisma.viewSession.findFirst({ where: { id: sessionId, proposalId: proposal.id }, select: { id: true } });
    if (!exists) sessionId = undefined;
  }
  if (!sessionId) {
    const s = await prisma.viewSession.create({
      data: { proposalId: proposal.id, visitorId, userAgent: ua.slice(0, 500), ipHash, isMobile: /Mobi|Android|iPhone/i.test(ua) },
    });
    sessionId = s.id;
    isNewSession = true;
  }

  await prisma.$transaction([
    prisma.viewSession.update({
      where: { id: sessionId },
      data: { lastSeenAt: new Date(), totalSeconds: { increment: seconds } },
    }),
    ...(events.length
      ? [
          prisma.blockEvent.createMany({
            data: events.map((e) => ({
              sessionId: sessionId!,
              blockId: e.blockId,
              type: e.type,
              seconds: e.seconds,
              meta: e.meta as object | undefined,
            })),
          }),
        ]
      : []),
  ]);

  // Notifications: first view / revisit (throttled to one per visitor per hour)
  if (isNewSession) {
    if (!proposal.firstViewedAt) {
      await prisma.proposal.update({
        where: { id: proposal.id },
        data: { firstViewedAt: new Date(), status: proposal.status === "PUBLISHED" ? "VIEWED" : undefined },
      });
      await Promise.allSettled([
        notify({ proposalId: proposal.id, type: "FIRST_VIEW", message: `"${proposal.title}" was just opened for the first time 👀`, hubspotNote: false }),
        timelineEvent({
          workspaceId: proposal.workspaceId,
          dealId: proposal.hubspotDealId,
          name: "viewed",
          tokens: { proposalTitle: proposal.title, proposalUrl: `${env.appUrl}/proposals/${proposal.id}/analytics`, device: /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop" },
          fallbackNoteHtml: `<p>Proposal opened for the first time 👀 — "${proposal.title}" · <a href="${env.appUrl}/proposals/${proposal.id}/analytics">Analytics</a></p>`,
        }),
      ]);
    } else {
      const recent = await prisma.viewSession.count({
        where: { proposalId: proposal.id, visitorId, startedAt: { gt: new Date(Date.now() - 3600_000) }, NOT: { id: sessionId } },
      });
      if (recent === 0) {
        await notify({ proposalId: proposal.id, type: "REVISIT", message: `"${proposal.title}" is being viewed again.`, hubspotNote: false });
      }
    }
  }

  return NextResponse.json({ ok: true, sessionId });
}
