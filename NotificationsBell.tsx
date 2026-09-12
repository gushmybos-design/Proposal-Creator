"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { markNotificationsRead } from "@/lib/actions/proposals";

type Item = { id: string; message: string; at: string; proposalId: string; read: boolean };

export function NotificationsBell({ unread, items }: { unread: number; items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  return (
    <div className="relative">
      <button
        className="relative rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100"
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unread > 0) start(() => markNotificationsRead());
        }}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 mt-2 w-80 overflow-hidden p-0 shadow-lg">
          <div className="border-b border-zinc-100 px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Activity</div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && <li className="p-4 text-sm text-zinc-500">No activity yet. You&apos;ll be notified when clients open, revisit or sign proposals.</li>}
            {items.map((n) => (
              <li key={n.id} className={`border-b border-zinc-50 ${n.read ? "" : "bg-blue-50/40"}`}>
                <Link href={`/proposals/${n.proposalId}/analytics`} className="block px-3 py-2.5 text-sm hover:bg-zinc-50" onClick={() => setOpen(false)}>
                  <div>{n.message}</div>
                  <div className="mt-0.5 text-xs text-zinc-400">{new Date(n.at).toLocaleString("en-AU")}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
