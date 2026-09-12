import { NextResponse, type NextRequest } from "next/server";
import { scanStalledAndExpiring } from "@/lib/notifications";
import { env } from "@/lib/env";

/**
 * Hourly job: stalled-signing nudges, expiry warnings, mark expired.
 * Protect with ?secret=CRM_CARD_SECRET (or Vercel Cron's Authorization header).
 * vercel.json schedules this hourly.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const okSecret = req.nextUrl.searchParams.get("secret") === env.crmCardSecret && env.crmCardSecret;
  const okVercel = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!okSecret && !okVercel && !env.isDev) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sent = await scanStalledAndExpiring();
  return NextResponse.json({ ok: true, notificationsSent: sent });
}
