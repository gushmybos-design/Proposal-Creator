"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { blocksSchema, defaultTemplateBlocks, themeSchema } from "@/lib/blocks/schema";

export async function createTemplate(name: string) {
  const user = await requireAdmin();
  const t = await prisma.template.create({
    data: { workspaceId: user.workspaceId, name: name || "New template", blocks: defaultTemplateBlocks() },
  });
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "template.create", entityType: "template", entityId: t.id, meta: { name: t.name } });
  redirect(`/templates/${t.id}/edit`);
}

/**
 * Saves a template and keeps a version snapshot (max one per 5 minutes per template so autosave
 * doesn't flood the history; the latest snapshot within the window is updated instead).
 */
export async function saveTemplate(id: string, data: { name?: string; blocks?: unknown; theme?: unknown; description?: string }) {
  const user = await requireAdmin();
  const t = await prisma.template.findFirst({ where: { id, workspaceId: user.workspaceId } });
  if (!t) throw new Error("Not found");
  const recent = await prisma.templateVersion.findFirst({ where: { templateId: id, createdAt: { gt: new Date(Date.now() - 5 * 60_000) } }, orderBy: { createdAt: "desc" } });
  const snapshot = { name: data.name ?? t.name, blocks: (data.blocks ?? t.blocks) as object, theme: (data.theme ?? t.theme) as object | undefined, createdById: user.id };
  if (recent) await prisma.templateVersion.update({ where: { id: recent.id }, data: snapshot });
  else await prisma.templateVersion.create({ data: { templateId: id, ...snapshot } });
  await prisma.template.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      blocks: data.blocks !== undefined ? blocksSchema.parse(data.blocks) : undefined,
      theme: data.theme !== undefined ? themeSchema.parse(data.theme) : undefined,
    },
  });
  return { savedAt: new Date().toISOString() };
}

export async function deleteTemplate(id: string) {
  const user = await requireAdmin();
  await prisma.template.deleteMany({ where: { id, workspaceId: user.workspaceId } });
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "template.delete", entityType: "template", entityId: id });
  revalidatePath("/templates");
}

/** Restore a template to an earlier version (the current state is snapshotted first). */
export async function restoreTemplateVersion(templateId: string, versionId: string) {
  const user = await requireAdmin();
  const t = await prisma.template.findFirst({ where: { id: templateId, workspaceId: user.workspaceId } });
  const v = await prisma.templateVersion.findFirst({ where: { id: versionId, templateId } });
  if (!t || !v) throw new Error("Not found");
  await prisma.$transaction([
    prisma.templateVersion.create({ data: { templateId, name: t.name, blocks: t.blocks as object, theme: t.theme as object | undefined, createdById: user.id } }),
    prisma.template.update({ where: { id: templateId }, data: { name: v.name, blocks: v.blocks as object, theme: v.theme as object | undefined } }),
  ]);
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "template.restore", entityType: "template", entityId: templateId, meta: { versionId } });
  revalidatePath(`/templates/${templateId}/edit`);
  redirect(`/templates/${templateId}/edit`);
}

export async function listTemplateVersions(templateId: string) {
  const user = await requireUser();
  return prisma.templateVersion.findMany({
    where: { templateId, template: { workspaceId: user.workspaceId } },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { createdBy: { select: { email: true, name: true } } },
  });
}
