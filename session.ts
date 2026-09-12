import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./db";
import { env } from "./env";

export type SessionData = {
  userId?: string;
  workspaceId?: string;
};

const sessionOptions: SessionOptions = {
  cookieName: "propel_session",
  password: env.sessionSecret,
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  },
};

export async function getSession() {
  const store = await cookies();
  return getIronSession<SessionData>(store, sessionOptions);
}

/** Current user + workspace, or null when signed out. Memoised per request. */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { workspace: { include: { hubspot: { select: { id: true, expiresAt: true } } } } },
  });
  return user;
});

/** Use in server components / actions that require auth. Redirects to / when signed out. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}

/** Admin-only pages/actions (settings, templates, audit log, user roles). */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard?error=admin_only");
  return user;
}

export function isAdmin(user: { role: string }) {
  return user.role === "ADMIN";
}
