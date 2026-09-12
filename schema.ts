import { z } from "zod";
import { nanoid } from "nanoid";

/**
 * Block model. A proposal is an ordered array of blocks (Qwilr-style).
 * Text fields may contain {{variables}} that are resolved from HubSpot
 * (see variables.ts) when a proposal is created from a template.
 */

const base = { id: z.string() };

export const heroBlock = z.object({
  ...base,
  type: z.literal("hero"),
  heading: z.string(),
  subheading: z.string().default(""),
  eyebrow: z.string().default(""),
  backgroundUrl: z.string().default(""),
  /** animated gradient when no image */
  gradient: z.string().default("aurora"),
  align: z.enum(["left", "center"]).default("left"),
});

export const textBlock = z.object({
  ...base,
  type: z.literal("text"),
  heading: z.string().default(""),
  /** Simple markdown: paragraphs, **bold**, *italic*, - bullets, ## headings */
  body: z.string(),
  columns: z.union([z.literal(1), z.literal(2)]).default(1),
});

export const imageBlock = z.object({
  ...base,
  type: z.literal("image"),
  url: z.string(),
  caption: z.string().default(""),
  layout: z.enum(["full", "contained"]).default("contained"),
});

export const videoBlock = z.object({
  ...base,
  type: z.literal("video"),
  /** YouTube / Vimeo / Loom / direct .mp4 URL */
  url: z.string(),
  heading: z.string().default(""),
  caption: z.string().default(""),
});

export const accordionBlock = z.object({
  ...base,
  type: z.literal("accordion"),
  heading: z.string().default(""),
  intro: z.string().default(""),
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      body: z.string(),
    }),
  ),
});

export const featuresBlock = z.object({
  ...base,
  type: z.literal("features"),
  heading: z.string().default(""),
  items: z.array(
    z.object({
      id: z.string(),
      icon: z.string().default("check"),
      title: z.string(),
      body: z.string(),
    }),
  ),
});

export const quoteLineItem = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  quantity: z.number().default(1),
  unitPrice: z.number(),
  billing: z.enum(["once", "monthly", "yearly"]).default("once"),
  /** Optional for the client to toggle. MYBOS prefers static pricing, so default false. */
  optional: z.boolean().default(false),
  selected: z.boolean().default(true),
});
export type QuoteLineItem = z.infer<typeof quoteLineItem>;

export const quoteBlock = z.object({
  ...base,
  type: z.literal("quote"),
  heading: z.string().default("Your investment"),
  intro: z.string().default(""),
  currency: z.string().default("AUD"),
  taxLabel: z.string().default("GST"),
  taxRate: z.number().default(0.1),
  discount: z.number().default(0), // absolute amount
  items: z.array(quoteLineItem),
  footnote: z.string().default(""),
});

export const acceptBlock = z.object({
  ...base,
  type: z.literal("accept"),
  heading: z.string().default("Ready to get started?"),
  body: z.string().default("Review the terms below and sign to accept this proposal."),
  terms: z.string().default(""),
  termsVersion: z.string().default("v1"),
  buttonLabel: z.string().default("Accept & sign"),
  requireTitle: z.boolean().default(false),
});

export const blockSchema = z.discriminatedUnion("type", [
  heroBlock,
  textBlock,
  imageBlock,
  videoBlock,
  accordionBlock,
  featuresBlock,
  quoteBlock,
  acceptBlock,
]);
export const blocksSchema = z.array(blockSchema);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;

export const themeSchema = z.object({
  brandColor: z.string().default("#1D4ED8"),
  logoUrl: z.string().default(""),
  font: z.enum(["sans", "serif"]).default("sans"),
});
export type Theme = z.infer<typeof themeSchema>;

export function parseBlocks(input: unknown): Block[] {
  const r = blocksSchema.safeParse(input);
  return r.success ? r.data : [];
}
export function parseTheme(input: unknown): Theme {
  const r = themeSchema.safeParse(input ?? {});
  return r.success ? r.data : themeSchema.parse({});
}

export const BLOCK_META: Record<BlockType, { label: string; description: string }> = {
  hero: { label: "Cover", description: "Full-width opening with headline & animated background" },
  text: { label: "Text", description: "Rich text section, one or two columns" },
  features: { label: "Features", description: "Grid of benefits with icons" },
  image: { label: "Image", description: "Photo, screenshot or diagram" },
  video: { label: "Video", description: "Embedded YouTube, Vimeo or Loom" },
  accordion: { label: "Accordion", description: "Collapsible sections to condense detail" },
  quote: { label: "Quote", description: "Pricing table with totals" },
  accept: { label: "Accept & sign", description: "Terms, e-signature and acceptance" },
};

/** Sensible starter content for a freshly added block. */
export function createBlock(type: BlockType): Block {
  const id = nanoid(10);
  switch (type) {
    case "hero":
      return heroBlock.parse({
        id,
        type,
        eyebrow: "Proposal for {{company.name}}",
        heading: "A better way to run {{company.name}}'s buildings",
        subheading: "Prepared by {{owner.firstname}} {{owner.lastname}} · {{today}}",
      });
    case "text":
      return textBlock.parse({
        id,
        type,
        heading: "Why MYBOS",
        body: "Write your story here. Use **bold**, *italic*, and\n\n- bullet points\n- to structure content.",
      });
    case "image":
      return imageBlock.parse({ id, type, url: "", caption: "" });
    case "video":
      return videoBlock.parse({ id, type, url: "", heading: "See it in action" });
    case "accordion":
      return accordionBlock.parse({
        id,
        type,
        heading: "The details",
        items: [
          { id: nanoid(6), title: "Implementation & onboarding", body: "Describe onboarding here." },
          { id: nanoid(6), title: "Support", body: "Describe support here." },
        ],
      });
    case "features":
      return featuresBlock.parse({
        id,
        type,
        heading: "What you get",
        items: [
          { id: nanoid(6), icon: "building", title: "Building management", body: "One place for every building." },
          { id: nanoid(6), icon: "smartphone", title: "Resident app", body: "Residents self-serve on mobile." },
          { id: nanoid(6), icon: "chart", title: "Reporting", body: "Live dashboards for committees." },
        ],
      });
    case "quote":
      return quoteBlock.parse({
        id,
        type,
        items: [
          { id: nanoid(6), name: "MYBOS platform licence", description: "Per building, billed annually", quantity: 1, unitPrice: 4800, billing: "yearly" },
          { id: nanoid(6), name: "Onboarding & data migration", description: "One-off", quantity: 1, unitPrice: 1500, billing: "once" },
        ],
      });
    case "accept":
      return acceptBlock.parse({
        id,
        type,
        terms: "By signing you agree to the MYBOS Terms of Service and the pricing above.",
      });
  }
}

/** A default template used to seed a fresh workspace. */
export function defaultTemplateBlocks(): Block[] {
  return [
    createBlock("hero"),
    createBlock("text"),
    createBlock("features"),
    createBlock("video"),
    createBlock("accordion"),
    createBlock("quote"),
    createBlock("accept"),
  ];
}

/* ---------- Quote math (shared by editor, renderer and accept API) ---------- */

export function quoteTotals(block: BlockOf<"quote">) {
  const active = block.items.filter((i) => !i.optional || i.selected);
  const once = active.filter((i) => i.billing === "once").reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const monthly = active.filter((i) => i.billing === "monthly").reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const yearly = active.filter((i) => i.billing === "yearly").reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const subtotal = once + monthly + yearly - block.discount;
  const tax = subtotal * block.taxRate;
  return { once, monthly, yearly, subtotal, tax, total: subtotal + tax };
}

export function formatMoney(n: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}
