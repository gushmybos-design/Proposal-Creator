import type { Block } from "./schema";

/**
 * Variables available inside templates, e.g. {{deal.dealname}}, {{contact.firstname}},
 * {{company.name}}, {{owner.firstname}}, {{today}}.
 * Values are flattened to "group.key" -> string.
 */
export type Variables = Record<string, string>;

export const VARIABLE_CATALOG: { key: string; label: string }[] = [
  { key: "deal.dealname", label: "Deal name" },
  { key: "deal.amount", label: "Deal amount" },
  { key: "deal.closedate", label: "Deal close date" },
  { key: "deal.dealstage", label: "Deal stage" },
  { key: "contact.firstname", label: "Contact first name" },
  { key: "contact.lastname", label: "Contact last name" },
  { key: "contact.email", label: "Contact email" },
  { key: "contact.jobtitle", label: "Contact job title" },
  { key: "company.name", label: "Company name" },
  { key: "company.domain", label: "Company domain" },
  { key: "company.city", label: "Company city" },
  { key: "company.numberofemployees", label: "Company employees" },
  { key: "owner.firstname", label: "Rep first name" },
  { key: "owner.lastname", label: "Rep last name" },
  { key: "owner.email", label: "Rep email" },
  { key: "today", label: "Today's date" },
];

const VAR_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function resolveString(s: string, vars: Variables): string {
  return s.replace(VAR_RE, (m, key: string) => {
    const v = vars[key];
    return v === undefined || v === "" ? m : v;
  });
}

/** Walk a block tree and resolve variables in every string field. */
export function resolveBlocks(blocks: Block[], vars: Variables): Block[] {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return resolveString(v, vars);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, walk(val)]));
    }
    return v;
  };
  return walk(blocks) as Block[];
}

/** Find unresolved {{vars}} left in a block list (useful to warn the rep). */
export function findUnresolved(blocks: Block[]): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") for (const m of v.matchAll(VAR_RE)) found.add(m[1]);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(blocks);
  return [...found];
}

export function baseVariables(): Variables {
  return {
    today: new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }),
  };
}
