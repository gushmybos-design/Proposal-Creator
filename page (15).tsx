import Link from "next/link";
import { prisma } from "@/lib/db";
import { isAdmin, requireUser } from "@/lib/session";
import { createTemplate, deleteTemplate } from "@/lib/actions/templates";

export default async function Templates() {
  const user = await requireUser();
  const templates = await prisma.template.findMany({ where: { workspaceId: user.workspaceId }, orderBy: { updatedAt: "desc" } });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-zinc-500">Reusable proposal structures. Use <code className="rounded bg-zinc-100 px-1">{"{{company.name}}"}</code>-style variables to personalise from HubSpot.</p>
        </div>
        {isAdmin(user) ? (
          <form action={async (fd) => { "use server"; await createTemplate(String(fd.get("name") ?? "")); }} className="flex gap-2">
            <input name="name" className="input w-56" placeholder="New template name" />
            <button className="btn-primary">Create</button>
          </form>
        ) : (
          <span className="text-xs text-zinc-400">Templates are managed by admins</span>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <div key={t.id} className="card flex flex-col p-5">
            <div className="font-medium">{t.name}</div>
            <div className="mt-1 flex-1 text-sm text-zinc-500">{t.description || `${(t.blocks as unknown[]).length} blocks`}</div>
            <div className="mt-4 flex items-center gap-2">
              {isAdmin(user) && <Link href={`/templates/${t.id}/edit`} className="btn-ghost">Edit</Link>}
              <Link href={`/proposals/new`} className="btn-ghost">Use</Link>
              {isAdmin(user) && (
                <form action={async () => { "use server"; await deleteTemplate(t.id); }} className="ml-auto">
                  <button className="text-sm text-zinc-400 hover:text-rose-600">Delete</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
