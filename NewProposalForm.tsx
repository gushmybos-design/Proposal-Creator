"use client";

import { useEffect, useState, useTransition } from "react";
import { createProposal } from "@/lib/actions/proposals";
import type { DealSummary } from "@/lib/hubspot/deals";

type T = { id: string; name: string; description: string };

export function NewProposalForm({ templates, initialDealId, hubspotConnected }: { templates: T[]; initialDealId?: string; hubspotConnected: boolean }) {
  const [templateId, setTemplateId] = useState<string | undefined>(templates[0]?.id);
  const [dealId, setDealId] = useState(initialDealId ?? "");
  const [q, setQ] = useState("");
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hubspotConnected) return;
    const h = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/hubspot/deals?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        setDeals(j.deals ?? []);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(h);
  }, [q, hubspotConnected]);

  return (
    <div className="mt-6 space-y-6">
      <section className="card p-5">
        <h2 className="mb-3 font-medium">1. Template</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setTemplateId(t.id)}
              className={`rounded-lg border p-4 text-left transition ${templateId === t.id ? "border-zinc-900 ring-2 ring-zinc-900/10" : "border-zinc-200 hover:border-zinc-300"}`}
            >
              <div className="font-medium">{t.name}</div>
              <div className="mt-1 text-xs text-zinc-500">{t.description || "No description"}</div>
            </button>
          ))}
          <button
            onClick={() => setTemplateId(undefined)}
            className={`rounded-lg border border-dashed p-4 text-left transition ${templateId === undefined ? "border-zinc-900 ring-2 ring-zinc-900/10" : "border-zinc-300 hover:border-zinc-400"}`}
          >
            <div className="font-medium">Blank</div>
            <div className="mt-1 text-xs text-zinc-500">Cover, text, quote and signature blocks.</div>
          </button>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-medium">2. HubSpot deal <span className="text-zinc-400">(optional)</span></h2>
        <p className="mb-3 text-xs text-zinc-500">Company, contact, rep and line items are pulled from the deal into the template&apos;s variables.</p>
        {hubspotConnected ? (
          <>
            <input className="input" placeholder="Search deals by name…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-zinc-200">
              {loading && <div className="p-3 text-sm text-zinc-400">Searching…</div>}
              {!loading && deals.length === 0 && <div className="p-3 text-sm text-zinc-400">No deals found.</div>}
              {deals.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDealId(d.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-50 ${dealId === d.id ? "bg-blue-50" : ""}`}
                >
                  <span>{d.name}</span>
                  <span className="text-xs text-zinc-400">{d.amount ? `$${Number(d.amount).toLocaleString()}` : ""} · #{d.id}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">HubSpot isn&apos;t connected for this workspace. Enter a deal ID manually or continue without one.</div>
        )}
        <div className="mt-3">
          <label className="label">Deal ID</label>
          <input className="input" value={dealId} onChange={(e) => setDealId(e.target.value)} placeholder="e.g. 21837465012" />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-medium">3. Title <span className="text-zinc-400">(optional)</span></h2>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to the deal name" />
      </section>

      {error && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      <button
        disabled={pending}
        className="btn-primary px-5 py-2.5"
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              await createProposal({ templateId, dealId: dealId || undefined, title: title || undefined });
            } catch (e) {
              // redirect() throws NEXT_REDIRECT internally; only surface real errors
              const msg = (e as Error).message;
              if (!msg.includes("NEXT_REDIRECT")) setError(msg);
            }
          })
        }
      >
        {pending ? "Creating…" : "Create proposal →"}
      </button>
    </div>
  );
}
