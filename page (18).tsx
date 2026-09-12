import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { NewProposalForm } from "@/components/editor/NewProposalForm";

export default async function NewProposal({ searchParams }: PageProps<"/proposals/new">) {
  const user = await requireUser();
  const sp = await searchParams;
  const dealId = typeof sp.dealId === "string" ? sp.dealId : undefined;
  const templates = await prisma.template.findMany({ where: { workspaceId: user.workspaceId }, orderBy: { updatedAt: "desc" } });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">New proposal</h1>
      <p className="mt-1 text-sm text-zinc-500">Pick a template, link a HubSpot deal, and we&apos;ll fill in the client details and line items.</p>
      <NewProposalForm
        templates={templates.map((t) => ({ id: t.id, name: t.name, description: t.description ?? "" }))}
        initialDealId={dealId}
        hubspotConnected={Boolean(user.workspace.hubspot)}
      />
    </div>
  );
}
