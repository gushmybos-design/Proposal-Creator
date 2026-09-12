import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { parseBlocks, parseTheme } from "@/lib/blocks/schema";
import { Editor } from "@/components/editor/Editor";
import { publishProposal, saveAsTemplate, saveProposal, unpublishProposal } from "@/lib/actions/proposals";
import { env } from "@/lib/env";

export default async function EditProposal({ params, searchParams }: PageProps<"/proposals/[id]/edit">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const p = await prisma.proposal.findFirst({ where: { id, workspaceId: user.workspaceId } });
  if (!p) notFound();
  const savedItems = await prisma.savedLineItem.findMany({ where: { workspaceId: user.workspaceId } });

  // Bind server actions to this proposal id so the client component can call them directly.
  const onSave = saveProposal.bind(null, id);
  const onPublish = publishProposal.bind(null, id);
  const onUnpublish = unpublishProposal.bind(null, id);
  const onSaveAsTemplate = saveAsTemplate.bind(null, id);

  return (
    <Editor
      kind="proposal"
      id={id}
      status={p.status}
      publicUrl={`${env.appUrl}/p/${p.publicToken}`}
      embed={sp.embed === "1"}
      initial={{ title: p.title, blocks: parseBlocks(p.blocks), theme: parseTheme(p.theme), expiresAt: p.expiresAt?.toISOString() ?? null }}
      savedItems={savedItems.map((s) => ({ id: s.id, name: s.name, description: s.description ?? "", unitPrice: Number(s.unitPrice), billing: s.billing }))}
      variables={(p.variables as Record<string, string>) ?? undefined}
      onSave={onSave}
      onPublish={onPublish}
      onUnpublish={onUnpublish}
      onSaveAsTemplate={onSaveAsTemplate}
    />
  );
}
