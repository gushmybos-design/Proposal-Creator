"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import { Plus, Trash2 } from "lucide-react";
import type { Block, BlockOf } from "@/lib/blocks/schema";
import { BLOCK_META } from "@/lib/blocks/schema";
import { VARIABLE_CATALOG } from "@/lib/blocks/variables";
import { FEATURE_ICONS } from "@/components/renderer/blocks";
import { UploadField } from "./UploadField";

export type SavedItem = { id: string; name: string; description: string; unitPrice: number; billing: string };

type P<T extends Block> = { b: T; set: (patch: Partial<T>) => void; savedItems: SavedItem[] };

export function BlockInspector({ block, onChange, savedItems, isTemplate }: { block: Block; onChange: (patch: Partial<Block>) => void; savedItems: SavedItem[]; isTemplate: boolean }) {
  const set = onChange as (patch: Partial<Block>) => void;
  return (
    <div className="p-4 text-sm">
      <div className="mb-4">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">{BLOCK_META[block.type].label}</div>
        <div className="text-xs text-zinc-500">{BLOCK_META[block.type].description}</div>
      </div>
      {isTemplate && <VariableHelper />}
      {block.type === "hero" && <HeroForm b={block} set={set} savedItems={savedItems} />}
      {block.type === "text" && <TextForm b={block} set={set} savedItems={savedItems} />}
      {block.type === "image" && <ImageForm b={block} set={set} savedItems={savedItems} />}
      {block.type === "video" && <VideoForm b={block} set={set} savedItems={savedItems} />}
      {block.type === "accordion" && <AccordionForm b={block} set={set} savedItems={savedItems} />}
      {block.type === "features" && <FeaturesForm b={block} set={set} savedItems={savedItems} />}
      {block.type === "quote" && <QuoteForm b={block} set={set} savedItems={savedItems} />}
      {block.type === "accept" && <AcceptForm b={block} set={set} savedItems={savedItems} />}
    </div>
  );
}

/* ---- shared fields ---- */
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
function Text({ label, value, onChange, hint, placeholder }: { label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string }) {
  return (
    <Field label={label} hint={hint}>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </Field>
  );
}
function Area({ label, value, onChange, rows = 6, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <textarea className="input font-mono text-xs" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}
function Select<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <Field label={label}>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </Field>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mb-3 flex items-center gap-2 text-sm">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

function VariableHelper() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
      <button className="font-medium" onClick={() => setOpen((o) => !o)}>{open ? "▾" : "▸"} Template variables</button>
      {open && (
        <ul className="mt-2 grid grid-cols-1 gap-0.5">
          {VARIABLE_CATALOG.map((v) => (
            <li key={v.key} className="flex justify-between gap-2">
              <code className="cursor-pointer select-all rounded bg-white/70 px-1" title="Click to select, then copy">{`{{${v.key}}}`}</code>
              <span className="text-blue-700/70">{v.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---- per-block forms ---- */
function HeroForm({ b, set }: P<BlockOf<"hero">>) {
  return (
    <>
      <Text label="Eyebrow" value={b.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
      <Area label="Heading" rows={2} value={b.heading} onChange={(heading) => set({ heading })} />
      <Area label="Subheading" rows={3} value={b.subheading} onChange={(subheading) => set({ subheading })} />
      <Field label="Background image" hint="Leave blank for an animated gradient."><UploadField value={b.backgroundUrl} onChange={(backgroundUrl) => set({ backgroundUrl })} /></Field>
      <Select label="Gradient" value={b.gradient} onChange={(gradient) => set({ gradient })} options={[["aurora", "Aurora"], ["dusk", "Dusk"], ["mint", "Mint"], ["solid", "Solid brand colour"]]} />
      <Select label="Alignment" value={b.align} onChange={(align) => set({ align })} options={[["left", "Left"], ["center", "Centre"]]} />
    </>
  );
}
function TextForm({ b, set }: P<BlockOf<"text">>) {
  return (
    <>
      <Text label="Heading" value={b.heading} onChange={(heading) => set({ heading })} />
      <Area label="Body" rows={14} value={b.body} onChange={(body) => set({ body })} hint="Markdown: **bold**, *italic*, ## heading, - bullets, [link](https://…)" />
      <Select label="Columns" value={String(b.columns) as "1" | "2"} onChange={(v) => set({ columns: Number(v) as 1 | 2 })} options={[["1", "One"], ["2", "Two"]]} />
    </>
  );
}
function ImageForm({ b, set }: P<BlockOf<"image">>) {
  return (
    <>
      <Field label="Image"><UploadField value={b.url} onChange={(url) => set({ url })} /></Field>
      <Text label="Caption" value={b.caption} onChange={(caption) => set({ caption })} />
      <Select label="Layout" value={b.layout} onChange={(layout) => set({ layout })} options={[["contained", "Contained"], ["full", "Full width"]]} />
    </>
  );
}
function VideoForm({ b, set }: P<BlockOf<"video">>) {
  return (
    <>
      <Text label="Heading" value={b.heading} onChange={(heading) => set({ heading })} />
      <Text label="Video URL" value={b.url} onChange={(url) => set({ url })} placeholder="YouTube, Vimeo, Loom or .mp4" />
      <Text label="Caption" value={b.caption} onChange={(caption) => set({ caption })} />
    </>
  );
}
function AccordionForm({ b, set }: P<BlockOf<"accordion">>) {
  const items = b.items;
  const upd = (i: number, patch: Partial<(typeof items)[number]>) => set({ items: items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <>
      <Text label="Heading" value={b.heading} onChange={(heading) => set({ heading })} />
      <Area label="Intro" rows={2} value={b.intro} onChange={(intro) => set({ intro })} />
      <div className="label">Sections</div>
      {items.map((it, i) => (
        <div key={it.id} className="mb-2 rounded-lg border border-zinc-200 p-2">
          <div className="flex gap-1">
            <input className="input" value={it.title} onChange={(e) => upd(i, { title: e.target.value })} />
            <button onClick={() => set({ items: items.filter((_, j) => j !== i) })} className="text-zinc-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
          </div>
          <textarea className="input mt-1 text-xs" rows={4} value={it.body} onChange={(e) => upd(i, { body: e.target.value })} />
        </div>
      ))}
      <button className="btn-ghost w-full" onClick={() => set({ items: [...items, { id: nanoid(6), title: "New section", body: "" }] })}><Plus className="h-4 w-4" /> Add section</button>
    </>
  );
}
function FeaturesForm({ b, set }: P<BlockOf<"features">>) {
  const items = b.items;
  const upd = (i: number, patch: Partial<(typeof items)[number]>) => set({ items: items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <>
      <Text label="Heading" value={b.heading} onChange={(heading) => set({ heading })} />
      <div className="label">Features</div>
      {items.map((it, i) => (
        <div key={it.id} className="mb-2 rounded-lg border border-zinc-200 p-2">
          <div className="flex gap-1">
            <select className="input w-28" value={it.icon} onChange={(e) => upd(i, { icon: e.target.value })}>
              {FEATURE_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
            </select>
            <input className="input" value={it.title} onChange={(e) => upd(i, { title: e.target.value })} />
            <button onClick={() => set({ items: items.filter((_, j) => j !== i) })} className="text-zinc-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
          </div>
          <textarea className="input mt-1 text-xs" rows={2} value={it.body} onChange={(e) => upd(i, { body: e.target.value })} />
        </div>
      ))}
      <button className="btn-ghost w-full" onClick={() => set({ items: [...items, { id: nanoid(6), icon: "check", title: "New feature", body: "" }] })}><Plus className="h-4 w-4" /> Add feature</button>
    </>
  );
}
function QuoteForm({ b, set, savedItems }: P<BlockOf<"quote">>) {
  const items = b.items;
  const upd = (i: number, patch: Partial<(typeof items)[number]>) => set({ items: items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const addSaved = (s: SavedItem) =>
    set({ items: [...items, { id: nanoid(6), name: s.name, description: s.description, quantity: 1, unitPrice: s.unitPrice, billing: (s.billing as "once" | "monthly" | "yearly") ?? "once", optional: false, selected: true }] });
  return (
    <>
      <Text label="Heading" value={b.heading} onChange={(heading) => set({ heading })} />
      <Area label="Intro" rows={2} value={b.intro} onChange={(intro) => set({ intro })} />
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Field label="Currency"><input className="input" value={b.currency} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} /></Field>
        <Field label="Tax label"><input className="input" value={b.taxLabel} onChange={(e) => set({ taxLabel: e.target.value })} /></Field>
        <Field label="Tax %"><input className="input" type="number" step="0.5" value={Math.round(b.taxRate * 1000) / 10} onChange={(e) => set({ taxRate: Number(e.target.value) / 100 })} /></Field>
      </div>
      <Field label="Discount (amount)"><input className="input" type="number" value={b.discount} onChange={(e) => set({ discount: Number(e.target.value) || 0 })} /></Field>

      <div className="label">Line items</div>
      {items.map((it, i) => (
        <div key={it.id} className="mb-2 rounded-lg border border-zinc-200 p-2">
          <div className="flex gap-1">
            <input className="input" value={it.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder="Item name" />
            <button onClick={() => set({ items: items.filter((_, j) => j !== i) })} className="text-zinc-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
          </div>
          <input className="input mt-1 text-xs" value={it.description} onChange={(e) => upd(i, { description: e.target.value })} placeholder="Description" />
          <div className="mt-1 grid grid-cols-3 gap-1">
            <input className="input" type="number" min={0} value={it.quantity} onChange={(e) => upd(i, { quantity: Number(e.target.value) || 0 })} title="Quantity" />
            <input className="input" type="number" min={0} step="0.01" value={it.unitPrice} onChange={(e) => upd(i, { unitPrice: Number(e.target.value) || 0 })} title="Unit price" />
            <select className="input" value={it.billing} onChange={(e) => upd(i, { billing: e.target.value as typeof it.billing })}>
              <option value="once">one-off</option>
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
            </select>
          </div>
          <label className="mt-1 flex items-center gap-2 text-xs text-zinc-600"><input type="checkbox" checked={it.optional} onChange={(e) => upd(i, { optional: e.target.checked })} /> Optional (client can toggle)</label>
        </div>
      ))}
      <button className="btn-ghost mb-2 w-full" onClick={() => set({ items: [...items, { id: nanoid(6), name: "New item", description: "", quantity: 1, unitPrice: 0, billing: "once", optional: false, selected: true }] })}><Plus className="h-4 w-4" /> Add line item</button>
      {savedItems.length > 0 && (
        <Field label="Insert saved item">
          <select className="input" value="" onChange={(e) => { const s = savedItems.find((x) => x.id === e.target.value); if (s) addSaved(s); }}>
            <option value="">Choose…</option>
            {savedItems.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.unitPrice}</option>)}
          </select>
        </Field>
      )}
      <Text label="Footnote" value={b.footnote} onChange={(footnote) => set({ footnote })} />
    </>
  );
}
function AcceptForm({ b, set }: P<BlockOf<"accept">>) {
  return (
    <>
      <Text label="Heading" value={b.heading} onChange={(heading) => set({ heading })} />
      <Area label="Body" rows={3} value={b.body} onChange={(body) => set({ body })} />
      <Text label="Button label" value={b.buttonLabel} onChange={(buttonLabel) => set({ buttonLabel })} />
      <Area label="Terms & conditions" rows={10} value={b.terms} onChange={(terms) => set({ terms })} hint="Shown above the signature. Markdown supported." />
      <Text label="Terms version" value={b.termsVersion} onChange={(termsVersion) => set({ termsVersion })} hint="Stored with every signature for audit." />
      <Toggle label="Require signer's title / role" value={b.requireTitle} onChange={(requireTitle) => set({ requireTitle })} />
    </>
  );
}
