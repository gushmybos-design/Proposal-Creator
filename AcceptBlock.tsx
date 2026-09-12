"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Download, MessageSquare, XCircle } from "lucide-react";
import type { BlockOf } from "@/lib/blocks/schema";
import { Markdown } from "./markdown";
import { SignaturePad } from "./SignaturePad";
import type { Track } from "./blocks";

export type SignatureInfo = { role: "CLIENT" | "COUNTERSIGNER"; name: string; title?: string | null; at: string; image?: string };

export function AcceptBlock({
  b,
  token,
  mode,
  status,
  signatures,
  requireCounterSign,
  selections,
  track,
  getSessionId,
}: {
  b: BlockOf<"accept">;
  token: string;
  mode: "public" | "preview" | "editor";
  status?: string;
  signatures?: SignatureInfo[];
  requireCounterSign?: boolean;
  selections: Record<string, boolean>;
  track?: Track;
  getSessionId?: () => string | undefined;
}) {
  const [open, setOpen] = useState<"sign" | "decline" | "changes" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [sig, setSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<string | undefined>(status);
  const [localSigs, setLocalSigs] = useState<SignatureInfo[]>(signatures ?? []);

  const client = localSigs.find((s) => s.role === "CLIENT");
  const counter = localSigs.find((s) => s.role === "COUNTERSIGNER");

  /* ---------- terminal states ---------- */
  if (localStatus === "ACCEPTED" && client) {
    const fullyExecuted = !requireCounterSign || Boolean(counter);
    return (
      <section className="mx-auto max-w-5xl px-6 py-16 sm:px-10">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8">
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h2 className="mt-3 text-2xl font-semibold text-emerald-900">{fullyExecuted ? "Proposal accepted" : "Accepted — awaiting counter-signature"}</h2>
            {!fullyExecuted && <p className="mt-1 text-emerald-800">Thanks {client.name.split(" ")[0]} — MYBOS will counter-sign shortly and you&apos;ll receive the executed copy.</p>}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <SigCard label="Client" s={client} />
            {counter ? (
              <SigCard label="MYBOS" s={counter} />
            ) : requireCounterSign ? (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-emerald-300 p-4 text-sm text-emerald-800"><Clock className="h-5 w-5" /> Awaiting MYBOS counter-signature</div>
            ) : null}
          </div>
          {mode === "public" && (
            <div className="mt-6 text-center">
              <a href={`/api/proposals/${token}/pdf`} className="btn-ghost"><Download className="h-4 w-4" /> Download signed PDF</a>
            </div>
          )}
        </div>
      </section>
    );
  }
  if (localStatus === "DECLINED") {
    return (
      <section className="mx-auto max-w-5xl px-6 py-16 sm:px-10">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center">
          <XCircle className="mx-auto h-12 w-12 text-zinc-400" />
          <h2 className="mt-3 text-2xl font-semibold">Proposal declined</h2>
          <p className="mt-1 text-zinc-600">Thanks for letting us know. Your account manager will be in touch.</p>
        </div>
      </section>
    );
  }
  if (localStatus === "CHANGES_REQUESTED" && open === null && message === "") {
    // Show a soft banner but keep the accept flow available (rep may have already edited)
  }

  const post = async (path: string, body: unknown) => {
    setError(null);
    if (mode !== "public") {
      setError("Actions are disabled in preview.");
      return false;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/proposals/${token}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Something went wrong");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitSign = async () => {
    if (!sig) return setError("Please draw your signature.");
    const ok = await post("accept", { name, email, title: title || undefined, signature: sig, agreed, selections, sessionId: getSessionId?.() });
    if (ok) {
      setLocalSigs([{ role: "CLIENT", name, title, at: new Date().toISOString(), image: sig }]);
      setLocalStatus("ACCEPTED");
    }
  };
  const submitFeedback = async (type: "DECLINED" | "CHANGES_REQUESTED") => {
    const ok = await post("feedback", { type, name, email, message, sessionId: getSessionId?.() });
    if (ok) {
      setLocalStatus(type);
      setOpen(null);
    }
  };

  return (
    <section className="mx-auto max-w-5xl px-6 py-16 sm:px-10 sm:py-24">
      {localStatus === "CHANGES_REQUESTED" && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <MessageSquare className="h-4 w-4" /> Thanks — we&apos;ve received your requested changes and will update this proposal shortly.
        </div>
      )}
      <div className="rounded-2xl p-8 text-white sm:p-12" style={{ background: "var(--brand)" }}>
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{b.heading}</h2>
        <p className="mt-3 max-w-2xl text-white/85">{b.body}</p>
        {open === null && (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              className="rounded-lg bg-white px-6 py-3 font-semibold text-zinc-900 shadow hover:bg-zinc-100"
              onClick={() => {
                setOpen("sign");
                track?.({ blockId: b.id, type: "ACCEPT_STARTED" });
              }}
            >
              {b.buttonLabel}
            </button>
            <button className="text-sm text-white/80 underline-offset-2 hover:underline" onClick={() => setOpen("changes")}>Request changes</button>
            <button className="text-sm text-white/60 underline-offset-2 hover:underline" onClick={() => setOpen("decline")}>Decline</button>
          </div>
        )}
      </div>

      {open === "sign" && (
        <div className="card mt-6 p-6 sm:p-8">
          {b.terms && (
            <div className="mb-6 max-h-48 overflow-y-auto rounded-lg bg-zinc-50 p-4 text-sm text-zinc-700">
              <Markdown text={b.terms} />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Full name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
            <div className="sm:col-span-2"><label className="label">Title / role {b.requireTitle ? "" : "(optional)"}</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label">Signature</label><SignaturePad onChange={setSig} /></div>
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm text-zinc-700">
            <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            I have authority to accept this proposal on behalf of my organisation and agree to the terms above. I understand this electronic signature is legally binding.
          </label>
          {error && <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          <div className="mt-6 flex items-center gap-3">
            <button className="btn-brand px-6 py-3 text-base" disabled={busy || !name || !email || !agreed || !sig} onClick={submitSign}>{busy ? "Signing…" : "Sign & accept"}</button>
            <button className="text-sm text-zinc-500 hover:text-zinc-900" onClick={() => setOpen(null)}>Cancel</button>
          </div>
        </div>
      )}

      {(open === "changes" || open === "decline") && (
        <div className="card mt-6 p-6 sm:p-8">
          <h3 className="text-lg font-semibold">{open === "changes" ? "What would you like changed?" : "Sorry to hear that — what's the reason?"}</h3>
          <p className="mt-1 text-sm text-zinc-500">{open === "changes" ? "Your account manager will update the proposal and this link will refresh with the new version." : "Your feedback helps us improve. This closes the proposal."}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><label className="label">Your name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
            <div className="sm:col-span-2"><label className="label">Message</label><textarea className="input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
          </div>
          {error && <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          <div className="mt-6 flex items-center gap-3">
            <button className={open === "changes" ? "btn-brand px-5 py-2.5" : "btn-primary px-5 py-2.5"} disabled={busy || !name || !email || message.length < 2} onClick={() => submitFeedback(open === "changes" ? "CHANGES_REQUESTED" : "DECLINED")}>
              {busy ? "Sending…" : open === "changes" ? "Send request" : "Decline proposal"}
            </button>
            <button className="text-sm text-zinc-500 hover:text-zinc-900" onClick={() => setOpen(null)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

function SigCard({ label, s }: { label: string; s: SignatureInfo }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">{label}</div>
      {s.image && <img src={s.image} alt="" className="my-2 h-14" />}
      <div className="text-sm font-medium">{s.name}{s.title ? `, ${s.title}` : ""}</div>
      <div className="text-xs text-zinc-500">{new Date(s.at).toLocaleString("en-AU")}</div>
    </div>
  );
}
