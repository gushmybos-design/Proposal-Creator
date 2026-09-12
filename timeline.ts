import { prisma } from "@/lib/db";
import { HubSpotClient } from "./client";
import { noteOnDeal } from "./writeback";
import { env } from "@/lib/env";

/**
 * Custom timeline events on the HubSpot deal (nicer than notes: filterable, with their own icon
 * and tokens you can use in workflows/reports).
 *
 * Setup (once per app, using the developer API key / app credentials):
 *   POST https://api.hubapi.com/crm/v3/timeline/{appId}/event-templates
 *   see hubspot/timeline-event-templates.json for the four templates and
 *   `npm run hubspot:timeline` to create them. Then paste the returned template ids into
 *   Settings → HubSpot → Timeline event templates (stored on Workspace.timelineTemplates).
 *
 * Falls back to a deal note when no template id is configured, so nothing is lost.
 */
export type TimelineEventName = "published" | "viewed" | "accepted" | "declined" | "changes_requested" | "countersigned";

export async function timelineEvent(opts: {
  workspaceId: string;
  dealId: string | null | undefined;
  name: TimelineEventName;
  tokens: Record<string, string | number | undefined>;
  fallbackNoteHtml: string;
}) {
  if (!opts.dealId) return;
  const ws = await prisma.workspace.findUnique({ where: { id: opts.workspaceId }, select: { timelineTemplates: true } });
  const templates = (ws?.timelineTemplates ?? {}) as Record<string, string>;
  const templateId = templates[opts.name];
  if (!templateId) return noteOnDeal(opts.workspaceId, opts.dealId, opts.fallbackNoteHtml);

  try {
    const hs = new HubSpotClient(opts.workspaceId);
    const tokens = Object.fromEntries(Object.entries(opts.tokens).filter(([, v]) => v !== undefined && v !== ""));
    await hs.post(`/crm/v3/timeline/events`, {
      eventTemplateId: templateId,
      objectId: opts.dealId,
      tokens,
      extraData: { appUrl: env.appUrl },
    });
  } catch (e) {
    console.warn("[hubspot] timeline event failed, falling back to note", (e as Error).message);
    await noteOnDeal(opts.workspaceId, opts.dealId, opts.fallbackNoteHtml);
  }
}
