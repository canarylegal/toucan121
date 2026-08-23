import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Host, User } from "@/generated/prisma/client";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

function toSession(user: {
  id: string;
  email: string;
  name: string;
  emailVerifiedAt: Date | null;
}): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerifiedAt != null,
  };
}

/** Authenticated account (hosting optional). */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("Unauthorized");

  return toSession(user);
}

export async function requireUserOrRedirect(
  callbackUrl = "/dash",
): Promise<SessionUser> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);

  return toSession(user);
}

export async function getOptionalUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;
  return toSession(user);
}

/** Host profile for the signed-in user, or null if they have not set up hosting. */
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

export function isHostingLive(host: Host | null | undefined): boolean {
  return Boolean(host?.hostingActive);
}

export function isBookingEnabled(host: Host | null | undefined): boolean {
  return Boolean(host?.hostingActive && host?.bookingEnabled);
}

export async function requireHost(): Promise<Host & { user: User }> {
  const host = await getOptionalHost();
  if (!host) throw new Error("Unauthorized");
  return host;
}

export async function requireActiveHost(): Promise<Host & { user: User }> {
  const host = await requireHost();
  if (!host.hostingActive) throw new Error("Hosting is paused");
  return host;
}

/** Profile routes: any live public profile (links-only or full hosting). */
export async function requireHostOrRedirect(): Promise<Host & { user: User }> {
  await requireUserOrRedirect();
  const host = await getOptionalHost();
  if (!host) redirect("/dash/links/setup");
  if (!host.hostingActive) redirect("/dash");
  return host;
}

/** Booking, calendar, and meeting-type routes. */
export async function requireBookingHostOrRedirect(): Promise<
  Host & { user: User }
> {
  const host = await requireHostOrRedirect();
  if (!host.bookingEnabled) redirect("/dash?bookingRequired=1");
  return host;
}
