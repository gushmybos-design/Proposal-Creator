"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, Copy, Eye, Link2, Check, ChevronUp, ChevronDown, Monitor, Smartphone } from "lucide-react";
import { nanoid } from "nanoid";
import { BLOCK_META, createBlock, type Block, type BlockType, type Theme } from "@/lib/blocks/schema";
import { findUnresolved } from "@/lib/blocks/variables";
import { ProposalRenderer } from "@/components/renderer/ProposalRenderer";
import { BlockInspector, type SavedItem } from "./BlockInspector";
import { UploadField } from "./UploadField";

export type EditorDoc = { title: string; blocks: Block[]; theme: Theme; expiresAt: string | null };

export type EditorProps = {
  kind: "proposal" | "template";
  id: string;
  initial: EditorDoc;
  status?: string;
  publicUrl?: string;
  savedItems: SavedItem[];
  variables?: Record<string, string>;
  onSave: (data: Partial<EditorDoc>) => Promise<{ savedAt: string }>;
  onPublish?: () => Promise<{ link: string }>;
  onUnpublish?: () => Promise<void>;
  onSaveAsTemplate?: (name: string) => Promise<void>;
  embed?: boolean;
};

export function Editor(p: EditorProps) {
  const [doc, setDoc] = useState<EditorDoc>(p.initial);
  const [selected, setSelected] = useState<string | null>(p.initial.blocks[0]?.id ?? null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const [status, setStatus] = useState(p.status ?? "DRAFT");
  const [copied, setCopied] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [tab, setTab] = useState<"blocks" | "theme">("blocks");
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- autosave (1s debounce) ----
  const scheduleSave = useCallback(
    (next: EditorDoc) => {
      dirty.current = true;
      setSaveState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        setSaveState("saving");
        try {
          await p.onSave({ title: next.title, blocks: next.blocks, theme: next.theme, expiresAt: next.expiresAt });
          dirty.current = false;
          setSaveState("saved");
        } catch (e) {
          console.error(e);
          setSaveState("error");
        }
      }, 1000);
    },
    [p],
  );
  const update = useCallback(
    (fn: (d: EditorDoc) => EditorDoc) => {
      setDoc((d) => {
        const next = fn(d);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // ---- block ops ----
  const setBlocks = (fn: (b: Block[]) => Block[]) => update((d) => ({ ...d, blocks: fn(d.blocks) }));
  const updateBlock = (id: string, patch: Partial<Block>) => setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  const addBlock = (type: BlockType, afterId?: string | null) => {
    const nb = createBlock(type);
    setBlocks((bs) => {
      const i = afterId ? bs.findIndex((b) => b.id === afterId) : -1;
      const copy = [...bs];
      copy.splice(i >= 0 ? i + 1 : bs.length, 0, nb);
      return copy;
    });
    setSelected(nb.id);
  };
  const removeBlock = (id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    if (selected === id) setSelected(null);
  };
  const duplicateBlock = (id: string) => {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const copy = JSON.parse(JSON.stringify(bs[i])) as Block;
      copy.id = nanoid(10);
      const out = [...bs];
      out.splice(i + 1, 0, copy);
      return out;
    });
  };
  const move = (id: string, dir: -1 | 1) =>
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      const j = i + dir;
      if (j < 0 || j >= bs.length) return bs;
      return arrayMove(bs, i, j);
    });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setBlocks((bs) => arrayMove(bs, bs.findIndex((b) => b.id === active.id), bs.findIndex((b) => b.id === over.id)));
  };

  const selectedBlock = doc.blocks.find((b) => b.id === selected) ?? null;
  const unresolved = useMemo(() => (p.kind === "proposal" ? findUnresolved(doc.blocks) : []), [doc.blocks, p.kind]);

  const publish = async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      await p.onSave({ title: doc.title, blocks: doc.blocks, theme: doc.theme, expiresAt: doc.expiresAt });
      setSaveState("saved");
    }
    await p.onPublish?.();
    setStatus((s) => (s === "DRAFT" ? "PUBLISHED" : s));
  };
  const copyLink = async () => {
    if (!p.publicUrl) return;
    await navigator.clipboard.writeText(p.publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`flex flex-col ${p.embed ? "h-screen" : "h-[calc(100vh-3.5rem)]"} -mx-4 -my-6 bg-zinc-100`}>
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-lg font-semibold hover:border-zinc-200 focus:border-zinc-300 focus:outline-none"
          value={doc.title}
          onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
        />
        <span className="text-xs text-zinc-400">
          {saveState === "saved" && "Saved"}
          {saveState === "saving" && "Saving…"}
          {saveState === "dirty" && "Unsaved changes"}
          {saveState === "error" && <span className="text-rose-600">Save failed</span>}
        </span>
        <div className="hidden items-center rounded-md border border-zinc-200 sm:flex">
          <button className={`p-1.5 ${device === "desktop" ? "bg-zinc-100" : ""}`} onClick={() => setDevice("desktop")} title="Desktop"><Monitor className="h-4 w-4" /></button>
          <button className={`p-1.5 ${device === "mobile" ? "bg-zinc-100" : ""}`} onClick={() => setDevice("mobile")} title="Mobile"><Smartphone className="h-4 w-4" /></button>
        </div>
        {p.kind === "proposal" && (
          <>
            {p.publicUrl && (
              <a href={`${p.publicUrl}?preview=1`} target="_blank" rel="noreferrer" className="btn-ghost"><Eye className="h-4 w-4" /> Preview</a>
            )}
            {status === "DRAFT" ? (
              <button className="btn-primary" onClick={publish}>Publish & get link</button>
            ) : (
              <>
                <button className="btn-ghost" onClick={copyLink}>{copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} {copied ? "Copied" : "Copy client link"}</button>
                {status !== "ACCEPTED" && <button className="btn-ghost" onClick={() => p.onUnpublish?.().then(() => setStatus("DRAFT"))}>Unpublish</button>}
              </>
            )}
            {p.onSaveAsTemplate && (
              <button
                className="btn-ghost"
                onClick={() => {
                  const name = prompt("Template name", doc.title);
                  if (name) p.onSaveAsTemplate!(name);
                }}
              >
                Save as template
              </button>
            )}
          </>
        )}
      </div>

      {unresolved.length > 0 && (
        <div className="bg-amber-50 px-4 py-1.5 text-xs text-amber-800">
          Unfilled variables: {unresolved.map((v) => `{{${v}}}`).join(", ")} — link a deal with these fields or edit the text.
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Left: block list */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white">
          <div className="flex border-b border-zinc-200 text-sm">
            <button className={`flex-1 px-3 py-2 ${tab === "blocks" ? "border-b-2 border-zinc-900 font-medium" : "text-zinc-500"}`} onClick={() => setTab("blocks")}>Blocks</button>
            <button className={`flex-1 px-3 py-2 ${tab === "theme" ? "border-b-2 border-zinc-900 font-medium" : "text-zinc-500"}`} onClick={() => setTab("theme")}>Theme</button>
          </div>
          {tab === "blocks" ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={doc.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                    {doc.blocks.map((b) => (
                      <SortableRow key={b.id} block={b} selected={selected === b.id} onSelect={() => setSelected(b.id)} onRemove={() => removeBlock(b.id)} onDuplicate={() => duplicateBlock(b.id)} onUp={() => move(b.id, -1)} onDown={() => move(b.id, 1)} />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
              <div className="border-t border-zinc-200 p-2">
                <div className="label px-1">Add block</div>
                <div className="grid grid-cols-2 gap-1">
                  {(Object.keys(BLOCK_META) as BlockType[]).map((t) => (
                    <button key={t} onClick={() => addBlock(t, selected)} className="flex items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs hover:bg-zinc-100" title={BLOCK_META[t].description}>
                      <Plus className="h-3 w-3 text-zinc-400" /> {BLOCK_META[t].label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <ThemePanel theme={doc.theme} onChange={(theme) => update((d) => ({ ...d, theme }))} expiresAt={doc.expiresAt} onExpires={p.kind === "proposal" ? (v) => update((d) => ({ ...d, expiresAt: v })) : undefined} />
          )}
        </aside>

        {/* Centre: live canvas */}
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          <div className={`mx-auto overflow-hidden rounded-xl bg-white shadow-lg transition-all ${device === "mobile" ? "max-w-[390px]" : "max-w-6xl"}`}>
            <ProposalRenderer blocks={doc.blocks} theme={doc.theme} token="preview" mode="editor" selectedId={selected} onSelect={setSelected} />
          </div>
        </div>

        {/* Right: inspector */}
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-zinc-200 bg-white">
          {selectedBlock ? (
            <BlockInspector block={selectedBlock} onChange={(patch) => updateBlock(selectedBlock.id, patch)} savedItems={p.savedItems} isTemplate={p.kind === "template"} />
          ) : (
            <div className="p-6 text-sm text-zinc-500">Select a block on the canvas or in the list to edit it.</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SortableRow({ block, selected, onSelect, onRemove, onDuplicate, onUp, onDown }: { block: Block; selected: boolean; onSelect: () => void; onRemove: () => void; onDuplicate: () => void; onUp: () => void; onDown: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const title = "heading" in block && block.heading ? block.heading : BLOCK_META[block.type].label;
  return (
    <div ref={setNodeRef} style={style} className={`group mb-1 flex items-center gap-1 rounded-md border px-1.5 py-1.5 text-sm ${selected ? "border-blue-400 bg-blue-50" : "border-transparent hover:bg-zinc-50"}`}>
      <button {...attributes} {...listeners} className="cursor-grab text-zinc-300 hover:text-zinc-500" aria-label="Drag"><GripVertical className="h-4 w-4" /></button>
      <button onClick={onSelect} className="min-w-0 flex-1 truncate text-left">
        <span className="mr-1.5 rounded bg-zinc-100 px-1 text-[10px] font-medium uppercase text-zinc-500">{BLOCK_META[block.type].label}</span>
        <span className="text-zinc-700">{title}</span>
      </button>
      <div className="hidden items-center text-zinc-400 group-hover:flex">
        <button onClick={onUp} className="p-0.5 hover:text-zinc-900"><ChevronUp className="h-3.5 w-3.5" /></button>
        <button onClick={onDown} className="p-0.5 hover:text-zinc-900"><ChevronDown className="h-3.5 w-3.5" /></button>
        <button onClick={onDuplicate} className="p-0.5 hover:text-zinc-900"><Copy className="h-3.5 w-3.5" /></button>
        <button onClick={onRemove} className="p-0.5 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

function ThemePanel({ theme, onChange, expiresAt, onExpires }: { theme: Theme; onChange: (t: Theme) => void; expiresAt: string | null; onExpires?: (v: string | null) => void }) {
  return (
    <div className="space-y-4 p-3 text-sm">
      <div>
        <label className="label">Brand colour</label>
        <div className="flex items-center gap-2">
          <input type="color" value={theme.brandColor} onChange={(e) => onChange({ ...theme, brandColor: e.target.value })} className="h-9 w-12 rounded border border-zinc-200" />
          <input className="input" value={theme.brandColor} onChange={(e) => onChange({ ...theme, brandColor: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="label">Logo</label>
        <UploadField value={theme.logoUrl} onChange={(logoUrl) => onChange({ ...theme, logoUrl })} />
      </div>
      <div>
        <label className="label">Font</label>
        <select className="input" value={theme.font} onChange={(e) => onChange({ ...theme, font: e.target.value as Theme["font"] })}>
          <option value="sans">Sans-serif</option>
          <option value="serif">Serif</option>
        </select>
      </div>
      {onExpires && (
        <div>
          <label className="label">Expires on</label>
          <input type="date" className="input" value={expiresAt ? expiresAt.slice(0, 10) : ""} onChange={(e) => onExpires(e.target.value ? new Date(e.target.value).toISOString() : null)} />
          <p className="mt-1 text-xs text-zinc-400">Clients can&apos;t sign after this date; you&apos;re warned 3 days before.</p>
        </div>
      )}
    </div>
  );
}
