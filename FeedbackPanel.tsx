"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { reopenProposal } from "@/lib/actions/signing";

type Fb = { id: string; type: string; name: string; email: string; message: string; at: string; resolved: boolean };

export function FeedbackPanel({ proposalId, status, feedback }: { proposalId: string; status: string; feedback: Fb[] }) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const open = feedback.filter((f) => !f.resolved);
  if (feedback.length === 0) return null;
  const declined = status === "DECLINED";
  return (
    <section className={`card p-5 ${open.length ? (declined ? "border-rose-200" : "border-amber-200") : ""}`}>
      <h2 className="font-medium">{declined ? "Declined by the client" : "Client feedback"}</h2>
      <ul className="mt-3 space-y-3">
        {feedback.map((f) => (
          <li key={f.id} className={`rounded-lg p-3 text-sm ${f.resolved ? "bg-zinc-50 text-zinc-500" : declined ? "bg-rose-50" : "bg-amber-50"}`}>
            <div className="flex justify-between gap-3">
              <span className="font-medium">{f.name} <span className="font-normal text-zinc-500">· {f.email}</span></span>
              <span className="shrink-0 text-xs text-zinc-400">{f.type === "DECLINED" ? "Declined" : "Changes requested"} · {new Date(f.at).toLocaleString("en-AU")}{f.resolved ? " · resolved" : ""}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap">{f.message}</p>
          </li>
        ))}
      </ul>
      {open.length > 0 && (
        <div className="mt-4 border-t border-zinc-100 pt-4">
          <p className="text-sm text-zinc-600">
            {declined ? "If you've spoken with the client and want to give it another go: " : "Make the changes in the "}
            {!declined && <Link href={`/proposals/${proposalId}/edit`} className="underline">editor</Link>}
            {!declined && ", then re-open so the client can review the updated version."}
            {declined && "re-open the proposal to make the link live again."}
          </p>
          <div className="mt-2 flex gap-2">
            <input className="input" placeholder="Optional note to include in the email to the client" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-primary shrink-0" disabled={pending} onClick={() => start(() => reopenProposal(proposalId, note || undefined))}>
              {pending ? "Re-opening…" : "Re-open & notify client"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
