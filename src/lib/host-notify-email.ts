import type { Host } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Host-facing mail always uses the signed-in account email (User), not publicEmail. */
export async function hostNotifyEmail(
  host: Pick<Host, "id" | "email" | "userId">,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: host.userId },
    select: { email: true },
  });
  const accountEmail = user?.email?.trim().toLowerCase();
  const hostEmail = host.email.trim().toLowerCase();
  if (!accountEmail) return host.email.trim();

  if (accountEmail !== hostEmail) {
    console.warn("[toucan:email] syncing host.email to account email", {
      hostId: host.id,
      from: host.email,
      to: user!.email,
    });
    await prisma.host.update({
      where: { id: host.id },
      data: { email: user!.email },
    });
  }
  return user!.email.trim();
}
