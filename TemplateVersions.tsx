"use client";

import { useState, useTransition } from "react";
import { History } from "lucide-react";
import { restoreTemplateVersion } from "@/lib/actions/templates";

type V = { id: string; name: string; at: string; by: string; blockCount: number };

/** Floating version-history drawer for the template editor. */
export function TemplateVersions({ templateId, versions }: { templateId: string; versions: V[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="fixed bottom-4 right-4 z-40">
      {open && (
        <div className="card mb-2 max-h-96 w-80 overflow-y-auto p-0 shadow-xl">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Version history</div>
          <ul>
            {versions.length === 0 && <li className="p-4 text-sm text-zinc-500">No versions yet — one is saved each time you edit (grouped in 5-minute windows).</li>}
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 border-b border-zinc-50 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{new Date(v.at).toLocaleString("en-AU")}</div>
                  <div className="text-xs text-zinc-400">{v.by} · {v.blockCount} blocks · {v.name}</div>
                </div>
                <button
                  className="btn-ghost px-2 py-1 text-xs"
                  disabled={pending}
                  onClick={() => { if (confirm("Restore this version? The current version is kept in history.")) start(() => restoreTemplateVersion(templateId, v.id)); }}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button className="btn-ghost shadow-md" onClick={() => setOpen((o) => !o)}><History className="h-4 w-4" /> History ({versions.length})</button>
    </div>
  );
}
