"use client";

import Link from "next/link";
import { useTransition } from "react";
import { BarChart3, Copy, Trash2, ExternalLink } from "lucide-react";
import { deleteProposal, duplicateProposal } from "@/lib/actions/proposals";

export function ProposalRowActions({ id, token, status }: { id: string; token: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="inline-flex items-center gap-1 text-zinc-500">
      <Link href={`/proposals/${id}/analytics`} className="rounded p-1.5 hover:bg-zinc-100 hover:text-zinc-900" title="Analytics"><BarChart3 className="h-4 w-4" /></Link>
      {status !== "DRAFT" && (
        <a href={`/p/${token}`} target="_blank" rel="noreferrer" className="rounded p-1.5 hover:bg-zinc-100 hover:text-zinc-900" title="Open client link"><ExternalLink className="h-4 w-4" /></a>
      )}
      <button disabled={pending} onClick={() => start(() => duplicateProposal(id))} className="rounded p-1.5 hover:bg-zinc-100 hover:text-zinc-900" title="Duplicate"><Copy className="h-4 w-4" /></button>
      <button
        disabled={pending}
        onClick={() => { if (confirm("Delete this proposal? This cannot be undone.")) start(() => deleteProposal(id)); }}
        className="rounded p-1.5 hover:bg-rose-50 hover:text-rose-600"
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
