import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { cookies } from "next/headers";
import { installUrl } from "@/lib/hubspot/oauth";
import { env } from "@/lib/env";

/** Starts the HubSpot OAuth flow (doubles as "Sign in with HubSpot"). */
export async function GET() {
  if (!env.hubspot.configured) {
    return NextResponse.redirect(`${env.appUrl}/?error=hubspot_not_configured`);
  }
  const state = nanoid(24);
  const store = await cookies();
  store.set("hs_oauth_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(installUrl(state));
}
