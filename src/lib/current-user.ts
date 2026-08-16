import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Host, User } from "@/generated/prisma/client";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

/** Authenticated account (hosting optional). */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("Unauthorized");

  return { id: user.id, email: user.email, name: user.name };
}

export async function requireUserOrRedirect(
  callbackUrl = "/dash",
): Promise<SessionUser> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);

  return { id: user.id, email: user.email, name: user.name };
}

export async function getOptionalUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}

/** Host profile for the signed-in user, or null if they are not hosting yet. */
export async function getOptionalHost(): Promise<
  (Host & { user: User }) | null
> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return prisma.host.findUnique({
    where: { userId: id },
    include: { user: true },
  });
}

export async function requireHost(): Promise<Host & { user: User }> {
  const host = await getOptionalHost();
  if (!host) throw new Error("Unauthorized");
  return host;
}

/** Hosting routes: login, then opt-in to hosting if needed. */
export async function requireHostOrRedirect(): Promise<Host & { user: User }> {
  await requireUserOrRedirect();
  const host = await getOptionalHost();
  if (!host) redirect("/dash/hosting/setup");
  return host;
}
