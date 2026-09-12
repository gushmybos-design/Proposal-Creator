import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { parseBlocks, parseTheme } from "@/lib/blocks/schema";
import { ProposalRenderer } from "@/components/renderer/ProposalRenderer";
import { getCurrentUser } from "@/lib/session";
import { verifyPdfKey } from "@/lib/pdf";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/p/[token]">): Promise<Metadata> {
  const { token } = await params;
  const p = await prisma.proposal.findUnique({ where: { publicToken: token }, select: { title: true, workspace: { select: { name: true } } } });
  return { title: p ? `${p.title} — ${p.workspace.name}` : "Proposal", robots: { index: false, follow: false } };
}

/** The client-facing proposal. Mobile-first, tracked, signable. */
export default async function PublicProposal({ params, searchParams }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const p = await prisma.proposal.findUnique({
    where: { publicToken: token },
    include: { signatures: { orderBy: { signedAt: "asc" } }, workspace: { select: { name: true, logoUrl: true, brandColor: true, requireCounterSign: true } } },
  });
  if (!p) notFound();

  // Drafts are only visible to signed-in reps of the same workspace (preview).
  const isPreview = sp.preview === "1";
  const pdfKey = typeof sp.pdf_key === "string" ? sp.pdf_key : null;
  const isServerPdfRender = sp.pdf === "1" && pdfKey && verifyPdfKey(token, pdfKey);
  if ((p.status === "DRAFT" || isPreview) && !isServerPdfRender) {
    const user = await getCurrentUser();
    if (!user || user.workspaceId !== p.workspaceId) notFound();
  }
  const expired = p.status === "EXPIRED" || (p.expiresAt && p.expiresAt < new Date() && p.status !== "ACCEPTED");

  const theme = parseTheme(p.theme);
  if (!theme.logoUrl && p.workspace.logoUrl) theme.logoUrl = p.workspace.logoUrl;
  const signatures = p.signatures.map((s) => ({ role: s.role, name: s.signerName, title: s.signerTitle, at: s.signedAt.toISOString(), image: s.imageData }));
  const isPdf = Boolean(isServerPdfRender);

  return (
    <>
      {(isPreview || p.status === "DRAFT") && !isPdf && (
        <div className="sticky top-0 z-40 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950">
          Preview — this is what your client will see. Views here are not tracked.
        </div>
      )}
      {expired && (
        <div className="sticky top-0 z-40 bg-zinc-900 px-4 py-2 text-center text-sm text-white">
          This proposal has expired. Contact {p.workspace.name} for an updated version.
        </div>
      )}
      <ProposalRenderer
        blocks={parseBlocks(p.blocks)}
        theme={theme}
        token={token}
        mode={isPreview || p.status === "DRAFT" || isPdf ? "preview" : "public"}
        status={p.status}
        signatures={signatures}
        requireCounterSign={p.workspace.requireCounterSign}
        printMode={isPdf}
      />
    </>
  );
}
