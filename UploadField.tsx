"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";

/**
 * URL input + upload button. Works controlled (value/onChange, in the editor inspector) or
 * uncontrolled (name/defaultValue, inside a server-action form).
 */
export function UploadField({
  value,
  onChange,
  name,
  defaultValue,
  accept = "image/*",
  placeholder = "https://… or upload",
}: {
  value?: string;
  onChange?: (url: string) => void;
  name?: string;
  defaultValue?: string;
  accept?: string;
  placeholder?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const set = (v: string) => {
    if (!controlled) setInner(v);
    onChange?.(v);
  };

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Upload failed");
      set(j.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex gap-1">
        <input className="input" name={name} value={current} onChange={(e) => set(e.target.value)} placeholder={placeholder} />
        <button type="button" className="btn-ghost shrink-0 px-2.5" disabled={busy} onClick={() => input.current?.click()} title="Upload">
          {busy ? <span className="text-xs">…</span> : <Upload className="h-4 w-4" />}
        </button>
        {current && (
          <button type="button" className="btn-ghost shrink-0 px-2.5" onClick={() => set("")} title="Clear"><X className="h-4 w-4" /></button>
        )}
        <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      </div>
      {current && /\.(png|jpe?g|webp|gif|svg)(\?|$)|blob\.vercel-storage\.com/i.test(current) && (
        <img src={current} alt="" className="mt-2 max-h-24 rounded border border-zinc-200 object-contain" />
      )}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
