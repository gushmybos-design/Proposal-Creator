import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { parseBlocks, quoteTotals, type BlockOf } from "@/lib/blocks/schema";
import { notify } from "@/lib/notifications";
import { onProposalAccepted } from "@/lib/hubspot/writeback";

const payload = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  title: z.string().max(120).optional(),
  signature: z.string().startsWith("data:image/png;base64,").max(400_000),
  sessionId: z.string().optional(),
  /** optional line items the client toggled: { itemId: selected } */
  selections: z.record(z.string(), z.boolean()).default({}),
  agreed: z.literal(true),
});

/** Client accepts & signs. Legally-binding record: signer, signature image, IP hash, UA, terms version. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const parsed = payload.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please complete all fields." }, { status: 400 });
  const d = parsed.data;

  const proposal = await prisma.proposal.findUnique({ where: { publicToken: token } });
  if (!proposal || proposal.status === "DRAFT") return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  if (proposal.status === "ACCEPTED") return NextResponse.json({ error: "Already accepted." }, { status: 409 });
  if (proposal.status === "EXPIRED" || (proposal.expiresAt && proposal.expiresAt < new Date()))
    return NextResponse.json({ error: "This proposal has expired. Please contact your rep." }, { status: 410 });

  const blocks = parseBlocks(proposal.blocks);
  const accept = blocks.find((b) => b.type === "accept") as BlockOf<"accept"> | undefined;
  if (accept?.requireTitle && !d.title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  // Apply client's optional selections and freeze them into the proposal
  let acceptedTotal: number | null = null;
  const frozen = blocks.map((b) => {
    if (b.type !== "quote") return b;
    const q = { ...b, items: b.items.map((i) => (i.optional && d.selections[i.id] !== undefined ? { ...i, selected: d.selections[i.id] } : i)) };
    acceptedTotal = (acceptedTotal ?? 0) + quoteTotals(q).total;
    return q;
  });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ua = req.headers.get("user-agent") ?? "";

  await prisma.$transaction([
    prisma.signature.create({
      data: {
        proposalId: proposal.id,
        signerName: d.name,
        signerEmail: d.email,
        signerTitle: d.title,
        imageData: d.signature,
        termsVersion: accept?.termsVersion ?? "v1",
        acceptedTotal,
        ipHash: ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null,
        userAgent: ua.slice(0, 500),
      },
    }),
    prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: "ACCEPTED", acceptedAt: new Date(), blocks: frozen },
    }),
    ...(d.sessionId
      ? [
          prisma.viewSession.updateMany({ where: { id: d.sessionId, proposalId: proposal.id }, data: { viewerEmail: d.email } }),
          prisma.blockEvent.create({ data: { sessionId: d.sessionId, blockId: accept?.id ?? "accept", type: "ACCEPTED" } }),
        ]
      : []),
  ]);

  // Fire-and-forget side effects (HubSpot stage change + note, rep notification)
  await Promise.allSettled([
    notify({ proposalId: proposal.id, type: "ACCEPTED", message: `🎉 "${proposal.title}" was accepted and signed by ${d.name}.`, hubspotNote: false }),
    onProposalAccepted(proposal.id),
  ]);

  return NextResponse.json({ ok: true });
}
