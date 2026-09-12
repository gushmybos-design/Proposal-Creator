"use client";

import { useState, useTransition } from "react";
import { SignaturePad } from "@/components/renderer/SignaturePad";
import { counterSign } from "@/lib/actions/signing";

export function CounterSignPanel({ proposalId, signerName }: { proposalId: string; signerName: string }) {
  const [sig, setSig] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="card border-emerald-200 p-5">
      <h2 className="font-medium">Counter-sign for MYBOS</h2>
      <p className="mb-4 text-sm text-zinc-500">The client has signed. Add MYBOS&apos;s signature to fully execute the agreement — the client is emailed the executed copy.</p>
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <div>
          <label className="label">Signing as</label>
          <div className="input bg-zinc-50">{signerName}</div>
          <label className="label mt-3">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Head of Sales" />
        </div>
        <div>
          <label className="label">Signature</label>
          <SignaturePad onChange={setSig} height={120} />
        </div>
      </div>
      {error && <div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      <button
        className="btn-primary mt-4"
        disabled={!sig || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              await counterSign(proposalId, { signature: sig!, title: title || undefined });
            } catch (e) {
              setError((e as Error).message);
            }
          })
        }
      >
        {pending ? "Signing…" : "Counter-sign"}
      </button>
    </section>
  );
}
