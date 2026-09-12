import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { env } from "@/lib/env";
import { defaultTemplateBlocks } from "@/lib/blocks/schema";

/**
 * DEVELOPMENT ONLY: sign in to a local demo workspace without HubSpot, so the editor,
 * client page and analytics can be exercised end-to-end. Disabled in production.
 */
export async function GET() {
  if (!env.isDev) return new NextResponse("Not found", { status: 404 });

  const workspace = await prisma.workspace.upsert({
    where: { hubId: "dev" },
    create: { hubId: "dev", name: "MYBOS (dev)" },
    update: {},
  });
  const user = await prisma.user.upsert({
    where: { workspaceId_email: { workspaceId: workspace.id, email: "dev@mybos.com" } },
    create: { workspaceId: workspace.id, email: "dev@mybos.com", name: "Dev Admin", role: "ADMIN" },
    update: {},
  });
  if ((await prisma.template.count({ where: { workspaceId: workspace.id } })) === 0) {
    await prisma.template.create({
      data: { workspaceId: workspace.id, name: "MYBOS standard proposal", blocks: defaultTemplateBlocks() },
    });
  }
  const session = await getSession();
  session.userId = user.id;
  session.workspaceId = workspace.id;
  await session.save();
  return NextResponse.redirect(`${env.appUrl}/dashboard`);
}
