import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { exchangeCode, getTokenInfo } from "@/lib/hubspot/oauth";
import { getSession } from "@/lib/session";
import { env } from "@/lib/env";
import { defaultTemplateBlocks } from "@/lib/blocks/schema";

/**
 * OAuth callback. Creates/updates the Workspace for the HubSpot portal, stores tokens,
 * upserts the signing-in user and starts a session.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const store = await cookies();
  const expected = store.get("hs_oauth_state")?.value;
  store.delete("hs_oauth_state");

  if (!code || !state || state !== expected) {
    return NextResponse.redirect(`${env.appUrl}/?error=oauth_state`);
  }

  try {
    const tokens = await exchangeCode(code);
    const info = await getTokenInfo(tokens.access_token);
    const hubId = String(info.hub_id);

    const workspace = await prisma.workspace.upsert({
      where: { hubId },
      create: { hubId, name: info.hub_domain || `HubSpot ${hubId}` },
      update: {},
    });

    await prisma.hubSpotConnection.upsert({
      where: { workspaceId: workspace.id },
      create: {
        workspaceId: workspace.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: info.scopes ?? [],
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: info.scopes ?? [],
      },
    });

    const isFirstUser = (await prisma.user.count({ where: { workspaceId: workspace.id } })) === 0;
    const user = await prisma.user.upsert({
      where: { workspaceId_email: { workspaceId: workspace.id, email: info.user } },
      create: { workspaceId: workspace.id, email: info.user, hubspotUserId: String(info.user_id), role: isFirstUser ? "ADMIN" : "REP" },
      update: { hubspotUserId: String(info.user_id) },
    });

    // Seed a starter template on first connect
    const count = await prisma.template.count({ where: { workspaceId: workspace.id } });
    if (count === 0) {
      await prisma.template.create({
        data: {
          workspaceId: workspace.id,
          name: "MYBOS standard proposal",
          description: "Cover, story, features, video, details, quote and e-signature.",
          blocks: defaultTemplateBlocks(),
        },
      });
    }

    const session = await getSession();
    session.userId = user.id;
    session.workspaceId = workspace.id;
    await session.save();

    return NextResponse.redirect(`${env.appUrl}/dashboard`);
  } catch (e) {
    console.error("[oauth callback]", e);
    return NextResponse.redirect(`${env.appUrl}/?error=oauth_failed`);
  }
}
