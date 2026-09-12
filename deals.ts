import { HubSpotClient, type HsObject } from "./client";
import { baseVariables, type Variables } from "@/lib/blocks/variables";
import type { QuoteLineItem } from "@/lib/blocks/schema";
import { nanoid } from "nanoid";

const DEAL_PROPS = ["dealname", "amount", "closedate", "dealstage", "pipeline", "hubspot_owner_id"];
const CONTACT_PROPS = ["firstname", "lastname", "email", "jobtitle", "phone"];
const COMPANY_PROPS = ["name", "domain", "city", "numberofemployees", "industry"];
const LINE_ITEM_PROPS = ["name", "description", "quantity", "price", "recurringbillingfrequency", "hs_product_id"];

export type DealContext = {
  deal: HsObject;
  contact: HsObject | null;
  company: HsObject | null;
  owner: { id: string; email: string; firstName: string; lastName: string } | null;
  lineItems: HsObject[];
};

/** Fetch a deal plus its primary contact, company, owner and line items. */
export async function fetchDealContext(hs: HubSpotClient, dealId: string): Promise<DealContext> {
  const deal = await hs.get<HsObject>(
    `/crm/v3/objects/deals/${dealId}?properties=${DEAL_PROPS.join(",")}&associations=contacts,companies,line_items`,
  );

  const contactId = deal.associations?.contacts?.results?.[0]?.id;
  const companyId = deal.associations?.companies?.results?.[0]?.id;
  const lineItemIds = deal.associations?.["line items"]?.results?.map((r) => r.id) ?? [];
  const ownerId = deal.properties.hubspot_owner_id;

  const [contact, company, owner, lineItems] = await Promise.all([
    contactId
      ? hs.get<HsObject>(`/crm/v3/objects/contacts/${contactId}?properties=${CONTACT_PROPS.join(",")}`).catch(() => null)
      : null,
    companyId
      ? hs.get<HsObject>(`/crm/v3/objects/companies/${companyId}?properties=${COMPANY_PROPS.join(",")}`).catch(() => null)
      : null,
    ownerId
      ? hs
          .get<{ id: string; email: string; firstName: string; lastName: string }>(`/crm/v3/owners/${ownerId}`)
          .catch(() => null)
      : null,
    lineItemIds.length
      ? hs
          .post<{ results: HsObject[] }>(`/crm/v3/objects/line_items/batch/read`, {
            properties: LINE_ITEM_PROPS,
            inputs: lineItemIds.map((id) => ({ id })),
          })
          .then((r) => r.results)
          .catch(() => [])
      : Promise.resolve([] as HsObject[]),
  ]);

  return { deal, contact, company, owner, lineItems };
}

/** Flatten a DealContext into template variables. */
export function variablesFromContext(ctx: DealContext): Variables {
  const vars: Variables = baseVariables();
  const add = (prefix: string, props: Record<string, string | null> | undefined) => {
    if (!props) return;
    for (const [k, v] of Object.entries(props)) if (v != null && v !== "") vars[`${prefix}.${k}`] = String(v);
  };
  add("deal", ctx.deal.properties);
  add("contact", ctx.contact?.properties);
  add("company", ctx.company?.properties);
  if (ctx.owner) {
    vars["owner.firstname"] = ctx.owner.firstName ?? "";
    vars["owner.lastname"] = ctx.owner.lastName ?? "";
    vars["owner.email"] = ctx.owner.email ?? "";
  }
  if (vars["deal.amount"]) {
    const n = Number(vars["deal.amount"]);
    if (!Number.isNaN(n)) vars["deal.amount"] = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
  }
  if (vars["deal.closedate"]) {
    const d = new Date(vars["deal.closedate"]);
    if (!Number.isNaN(d.getTime())) vars["deal.closedate"] = d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  }
  return vars;
}

/** Convert HubSpot deal line items into quote block line items. */
export function lineItemsFromContext(ctx: DealContext): QuoteLineItem[] {
  return ctx.lineItems.map((li) => {
    const freq = (li.properties.recurringbillingfrequency ?? "").toLowerCase();
    return {
      id: nanoid(6),
      name: li.properties.name ?? "Item",
      description: li.properties.description ?? "",
      quantity: Number(li.properties.quantity ?? 1) || 1,
      unitPrice: Number(li.properties.price ?? 0) || 0,
      billing: freq.includes("month") ? "monthly" : freq.includes("annual") || freq.includes("year") ? "yearly" : "once",
      optional: false,
      selected: true,
    };
  });
}

export type DealSummary = { id: string; name: string; amount: string | null; stage: string | null; company?: string };

/** Search deals by name (for the "new proposal" picker). */
export async function searchDeals(hs: HubSpotClient, query: string): Promise<DealSummary[]> {
  const body = {
    query: query || undefined,
    limit: 20,
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
    properties: ["dealname", "amount", "dealstage"],
  };
  const r = await hs.post<{ results: HsObject[] }>(`/crm/v3/objects/deals/search`, body);
  return r.results.map((d) => ({
    id: d.id,
    name: d.properties.dealname ?? `Deal ${d.id}`,
    amount: d.properties.amount,
    stage: d.properties.dealstage,
  }));
}

export type PipelineStage = { id: string; label: string; pipeline: string };

export async function listDealStages(hs: HubSpotClient): Promise<PipelineStage[]> {
  const r = await hs.get<{ results: { id: string; label: string; stages: { id: string; label: string }[] }[] }>(
    `/crm/v3/pipelines/deals`,
  );
  return r.results.flatMap((p) => p.stages.map((s) => ({ id: s.id, label: `${p.label} → ${s.label}`, pipeline: p.id })));
}
