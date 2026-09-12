import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { TemplateVersions } from "@/components/ui/TemplateVersions";
import { parseBlocks, parseTheme } from "@/lib/blocks/schema";
import { Editor } from "@/components/editor/Editor";
import { listTemplateVersions, saveTemplate } from "@/lib/actions/templates";

export default async function EditTemplate({ params }: PageProps<"/templates/[id]/edit">) {
  const user = await requireAdmin();
  const { id } = await params;
  const t = await prisma.template.findFirst({ where: { id, workspaceId: user.workspaceId } });
  if (!t) notFound();
  const [savedItems, versions] = await Promise.all([prisma.savedLineItem.findMany({ where: { workspaceId: user.workspaceId } }), listTemplateVersions(id)]);

  async function onSave(data: { title?: string; blocks?: unknown; theme?: unknown }) {
    "use server";
    return saveTemplate(id, { name: data.title, blocks: data.blocks, theme: data.theme });
  }

  return (
    <>
    <Editor
      kind="template"
      id={id}
      initial={{ title: t.name, blocks: parseBlocks(t.blocks), theme: parseTheme(t.theme), expiresAt: null }}
      savedItems={savedItems.map((s) => ({ id: s.id, name: s.name, description: s.description ?? "", unitPrice: Number(s.unitPrice), billing: s.billing }))}
      onSave={onSave}
    />
    <TemplateVersions templateId={id} versions={versions.map((v) => ({ id: v.id, name: v.name, at: v.createdAt.toISOString(), by: v.createdBy?.name ?? v.createdBy?.email ?? "—", blockCount: Array.isArray(v.blocks) ? v.blocks.length : 0 }))} />
    </>
  );
}
