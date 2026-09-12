"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";

export async function saveWorkspaceSettings(data: {
  name: string;
  brandColor: string;
  logoUrl: string;
  acceptedStageId: string;
  declinedStageId: string;
  requireCounterSign: boolean;
  timelineTemplates: Record<string, string>;
}) {
  const user = await requireAdmin();
  const timelineTemplates = Object.fromEntries(Object.entries(data.timelineTemplates).filter(([, v]) => v.trim()));
  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: {
      name: data.name.trim() || user.workspace.name,
      brandColor: /^#[0-9a-fA-F]{6}$/.test(data.brandColor) ? data.brandColor : user.workspace.brandColor,
      logoUrl: data.logoUrl.trim() || null,
      acceptedStageId: data.acceptedStageId || null,
      declinedStageId: data.declinedStageId || null,
      requireCounterSign: data.requireCounterSign,
      timelineTemplates,
    },
  });
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "workspace.settings", entityType: "workspace", entityId: user.workspaceId, meta: { ...data, timelineTemplates } });
  revalidatePath("/settings");
}

export async function setUserRole(userId: string, role: "ADMIN" | "REP") {
  const admin = await requireAdmin();
  const target = await prisma.user.findFirst({ where: { id: userId, workspaceId: admin.workspaceId } });
  if (!target) throw new Error("Not found");
  if (target.id === admin.id && role === "REP") {
    const admins = await prisma.user.count({ where: { workspaceId: admin.workspaceId, role: "ADMIN" } });
    if (admins <= 1) throw new Error("You are the last admin");
  }
  await prisma.user.update({ where: { id: userId }, data: { role } });
  await audit({ workspaceId: admin.workspaceId, userId: admin.id, action: "user.role", entityType: "user", entityId: userId, meta: { role, email: target.email } });
  revalidatePath("/settings");
}

export async function addSavedLineItem(data: { name: string; description: string; unitPrice: number; billing: string }) {
  const user = await requireAdmin();
  await prisma.savedLineItem.create({
    data: { workspaceId: user.workspaceId, name: data.name, description: data.description, unitPrice: data.unitPrice, billing: data.billing },
  });
  revalidatePath("/settings");
}

export async function deleteSavedLineItem(id: string) {
  const user = await requireAdmin();
  await prisma.savedLineItem.deleteMany({ where: { id, workspaceId: user.workspaceId } });
  revalidatePath("/settings");
}
