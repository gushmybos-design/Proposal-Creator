"use client";

import { useState } from "react";
import { ChevronDown, Check, Building2, Smartphone, BarChart3, ShieldCheck, Clock, Users, Star, Zap } from "lucide-react";
import type { BlockOf } from "@/lib/blocks/schema";
import { formatMoney, quoteTotals } from "@/lib/blocks/schema";
import { Markdown } from "./markdown";

export type Track = (ev: { blockId: string; type: "CLICK" | "ACCEPT_STARTED"; meta?: Record<string, unknown> }) => void;

/* ---------------- Hero ---------------- */
export function HeroBlock({ b, logoUrl }: { b: BlockOf<"hero">; logoUrl?: string }) {
  const hasImg = Boolean(b.backgroundUrl);
  return (
    <section
      className={`relative flex min-h-[70vh] items-end overflow-hidden text-white ${hasImg ? "" : `gradient-${b.gradient}`}`}
      style={hasImg ? { backgroundImage: `url(${b.backgroundUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      {hasImg && <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />}
      {logoUrl && <img src={logoUrl} alt="" className="absolute left-6 top-6 h-8 w-auto sm:left-10 sm:top-8 sm:h-10" />}
      <div className={`relative mx-auto w-full max-w-5xl px-6 pb-16 pt-32 sm:px-10 sm:pb-20 ${b.align === "center" ? "text-center" : ""}`}>
        {b.eyebrow && <div className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-white/80">{b.eyebrow}</div>}
        <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">{b.heading}</h1>
        {b.subheading && <p className="mt-5 max-w-2xl text-lg text-white/85 sm:text-xl">{b.subheading}</p>}
      </div>
    </section>
  );
}

/* ---------------- Text ---------------- */
export function TextBlock({ b }: { b: BlockOf<"text"> }) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-14 sm:px-10 sm:py-20">
      {b.heading && <h2 className="mb-6 text-3xl font-semibold tracking-tight sm:text-4xl">{b.heading}</h2>}
      <Markdown text={b.body} className={`text-[17px] text-zinc-700 ${b.columns === 2 ? "sm:columns-2 sm:gap-10" : "max-w-3xl"}`} />
    </section>
  );
}

/* ---------------- Features ---------------- */
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  check: Check, building: Building2, smartphone: Smartphone, chart: BarChart3, shield: ShieldCheck, clock: Clock, users: Users, star: Star, zap: Zap,
};
export const FEATURE_ICONS = Object.keys(ICONS);

export function FeaturesBlock({ b }: { b: BlockOf<"features"> }) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-5xl px-6 py-14 sm:px-10 sm:py-20">
        {b.heading && <h2 className="mb-10 text-3xl font-semibold tracking-tight sm:text-4xl">{b.heading}</h2>}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {b.items.map((it) => {
            const Icon = ICONS[it.icon] ?? Check;
            return (
              <div key={it.id}>
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ background: "var(--brand)" }}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{it.title}</h3>
                <p className="mt-1 text-zinc-600">{it.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Image ---------------- */
export function ImageBlock({ b }: { b: BlockOf<"image"> }) {
  if (!b.url) return <section className="mx-auto max-w-5xl px-6 py-8 text-center text-sm text-zinc-400">No image URL set</section>;
  return (
    <section className={b.layout === "full" ? "" : "mx-auto max-w-5xl px-6 py-10 sm:px-10"}>
      <img src={b.url} alt={b.caption} className={`w-full ${b.layout === "full" ? "" : "rounded-xl shadow-md"}`} />
      {b.caption && <p className="mt-3 text-center text-sm text-zinc-500">{b.caption}</p>}
    </section>
  );
}

/* ---------------- Video ---------------- */
export function embedUrl(url: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  const loom = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;
  return url;
}

export function VideoBlock({ b, track }: { b: BlockOf<"video">; track?: Track }) {
  const src = embedUrl(b.url);
  const isFile = /\.(mp4|webm|mov)(\?|$)/i.test(b.url);
  return (
    <section className="bg-zinc-900 text-white">
      <div className="mx-auto max-w-5xl px-6 py-14 sm:px-10 sm:py-20">
        {b.heading && <h2 className="mb-6 text-3xl font-semibold tracking-tight sm:text-4xl">{b.heading}</h2>}
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl" onClick={() => track?.({ blockId: b.id, type: "CLICK", meta: { action: "play" } })}>
          {!src ? (
            <div className="flex h-full items-center justify-center text-zinc-500">Paste a YouTube, Vimeo or Loom link</div>
          ) : isFile ? (
            <video src={src} controls className="h-full w-full" />
          ) : (
            <iframe src={src} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={b.heading || "Video"} />
          )}
        </div>
        {b.caption && <p className="mt-3 text-sm text-zinc-400">{b.caption}</p>}
      </div>
    </section>
  );
}

/* ---------------- Accordion ---------------- */
export function AccordionBlock({ b, track, expandAll = false }: { b: BlockOf<"accordion">; track?: Track; expandAll?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="mx-auto max-w-5xl px-6 py-14 sm:px-10 sm:py-20">
      {b.heading && <h2 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">{b.heading}</h2>}
      {b.intro && <p className="mb-8 max-w-3xl text-zinc-600">{b.intro}</p>}
      <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {b.items.map((it) => {
          const isOpen = expandAll || open === it.id;
          return (
            <div key={it.id}>
              <button
                className="flex w-full items-center justify-between px-5 py-4 text-left font-medium hover:bg-zinc-50"
                onClick={() => {
                  setOpen(isOpen ? null : it.id);
                  if (!isOpen) track?.({ blockId: b.id, type: "CLICK", meta: { item: it.title } });
                }}
                aria-expanded={isOpen}
              >
                {it.title}
                <ChevronDown className={`h-5 w-5 text-zinc-400 transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className={`px-5 pb-5 ${expandAll ? "pt-4 border-t border-zinc-100" : ""}`}>
                  {expandAll && <div className="mb-2 font-semibold">{it.title}</div>}
                  <Markdown text={it.body} className="text-zinc-700" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- Quote ---------------- */
export function QuoteBlock({
  b,
  selections,
  onToggle,
}: {
  b: BlockOf<"quote">;
  selections?: Record<string, boolean>;
  onToggle?: (id: string, v: boolean) => void;
}) {
  const applied = { ...b, items: b.items.map((i) => (i.optional && selections?.[i.id] !== undefined ? { ...i, selected: selections[i.id] } : i)) };
  const t = quoteTotals(applied);
  const fm = (n: number) => formatMoney(n, b.currency);
  const billingLabel = { once: "one-off", monthly: "/ month", yearly: "/ year" };
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-5xl px-6 py-14 sm:px-10 sm:py-20">
        {b.heading && <h2 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">{b.heading}</h2>}
        {b.intro && <p className="mb-8 max-w-3xl text-zinc-600">{b.intro}</p>}
        <div className="overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Unit</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {applied.items.map((i) => {
                const off = i.optional && !i.selected;
                return (
                  <tr key={i.id} className={`border-t border-zinc-100 ${off ? "text-zinc-400" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        {i.optional && (
                          <input type="checkbox" className="mt-1 h-4 w-4" checked={i.selected} onChange={(e) => onToggle?.(i.id, e.target.checked)} disabled={!onToggle} />
                        )}
                        <div>
                          <div className="font-medium text-zinc-900">{i.name}{i.optional && <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-500">optional</span>}</div>
                          {i.description && <div className="text-zinc-500">{i.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{i.quantity}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{fm(i.unitPrice)} <span className="text-xs text-zinc-400">{billingLabel[i.billing]}</span></td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{off ? "—" : fm(i.quantity * i.unitPrice)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-zinc-200 bg-zinc-50/60 text-sm">
              {t.once > 0 && <Row label="One-off" value={fm(t.once)} />}
              {t.monthly > 0 && <Row label="Monthly" value={`${fm(t.monthly)} / mo`} />}
              {t.yearly > 0 && <Row label="Yearly" value={`${fm(t.yearly)} / yr`} />}
              {b.discount > 0 && <Row label="Discount" value={`− ${fm(b.discount)}`} />}
              {b.taxRate > 0 && <Row label={`${b.taxLabel} (${Math.round(b.taxRate * 100)}%)`} value={fm(t.tax)} />}
              <tr className="border-t border-zinc-200">
                <td colSpan={3} className="px-4 py-3 text-base font-semibold">Total{b.taxRate > 0 ? ` incl. ${b.taxLabel}` : ""}</td>
                <td className="px-4 py-3 text-right text-base font-semibold whitespace-nowrap">{fm(t.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {b.footnote && <p className="mt-3 text-xs text-zinc-500">{b.footnote}</p>}
      </div>
    </section>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td colSpan={3} className="px-4 py-2 text-zinc-600">{label}</td>
      <td className="px-4 py-2 text-right whitespace-nowrap">{value}</td>
    </tr>
  );
}
