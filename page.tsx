import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { env } from "@/lib/env";

export default async function Landing({ searchParams }: PageProps<"/">) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-aurora" />
          <span className="text-lg font-semibold tracking-tight">Propel</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Proposals that close</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Interactive, mobile-ready proposals with pricing, e-signature and engagement analytics —
          created straight from a HubSpot deal.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error === "hubspot_not_configured"
              ? "HubSpot app credentials are not configured. Add HUBSPOT_CLIENT_ID / SECRET to .env."
              : error === "oauth_state"
                ? "Sign-in state mismatch. Please try again."
                : "HubSpot sign-in failed. Check the server logs."}
          </div>
        )}

        <a href="/api/hubspot/install" className="btn-primary mt-6 w-full py-2.5">
          Continue with HubSpot
        </a>
        {env.isDev && (
          <Link href="/dev-login" className="btn-ghost mt-2 w-full">
            Dev login (no HubSpot)
          </Link>
        )}
        <p className="mt-4 text-center text-xs text-zinc-500">
          Signing in installs the Propel app on your HubSpot portal and adds a proposals card to every deal.
        </p>
      </div>
    </main>
  );
}
