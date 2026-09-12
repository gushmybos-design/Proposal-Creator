import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { renderProposalPdf } from "@/lib/pdf";

export const maxDuration = 60;

/**
 * PDF of the proposal.
 * - Accepted proposals: anyone with the link may download the signed copy (the client's record).
 * - Otherwise: only signed-in members of the workspace (rep wants a PDF to attach to an email).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const p = await prisma.proposal.findUnique({ where: { publicToken: token }, select: { id: true, title: true, status: true, workspaceId: true } });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (p.status !== "ACCEPTED") {
    const user = await getCurrentUser();
    if (!user || user.workspaceId !== p.workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const pdf = await renderProposalPdf(token);
    const filename = `${p.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "proposal"}${p.status === "ACCEPTED" ? "-signed" : ""}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[pdf]", e);
    return NextResponse.json({ error: "PDF rendering failed. Is Chromium available? See README → PDF export." }, { status: 500 });
  }
}
