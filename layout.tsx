import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { NotificationsBell } from "@/components/ui/NotificationsBell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [unread, notifications] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 12, include: { proposal: { select: { id: true, title: true } } } }),
  ]);
  const hsConnected = Boolean(user.workspace.hubspot);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="h-6 w-6 rounded-md gradient-aurora" /> Propel
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/dashboard" className="rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">Proposals</Link>
            <Link href="/templates" className="rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">Templates</Link>
            {user.role === "ADMIN" && <Link href="/settings" className="rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">Settings</Link>}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs sm:inline-flex ${hsConnected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${hsConnected ? "bg-emerald-500" : "bg-amber-500"}`} />
              {hsConnected ? "HubSpot connected" : "HubSpot not connected"}
            </span>
            <NotificationsBell
              unread={unread}
              items={notifications.map((n) => ({ id: n.id, message: n.message, at: n.createdAt.toISOString(), proposalId: n.proposal.id, read: Boolean(n.readAt) }))}
            />
            <span className="hidden text-zinc-500 sm:inline">{user.email}</span>
            <a href="/auth/logout" className="text-zinc-500 hover:text-zinc-900">Sign out</a>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
