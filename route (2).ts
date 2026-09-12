import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { HubSpotClient, HubSpotNotConnected } from "@/lib/hubspot/client";
import { searchDeals } from "@/lib/hubspot/deals";

/** Deal search for the new-proposal picker: GET /api/hubspot/deals?q=acme */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const hs = new HubSpotClient(user.workspaceId);
    const deals = await searchDeals(hs, req.nextUrl.searchParams.get("q") ?? "");
    return NextResponse.json({ deals });
  } catch (e) {
    if (e instanceof HubSpotNotConnected) return NextResponse.json({ deals: [], error: "not_connected" });
    return NextResponse.json({ deals: [], error: (e as Error).message }, { status: 502 });
  }
}
