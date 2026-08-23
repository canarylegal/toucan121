"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, getOptionalHost } from "@/lib/current-user";
import { activateBookingForHost } from "@/lib/register";

export async function setHostingPreferenceAction(formData: FormData) {
  const user = await requireUser();
  const choice = String(formData.get("choice") ?? "");

  if (choice !== "VISITOR" && choice !== "LINKS" && choice !== "HOST") {
    throw new Error("Invalid choice");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { hostingPreference: choice },
  });

  revalidatePath("/dash");
  revalidatePath("/dash/welcome");

  if (choice === "HOST") {
    const host = await getOptionalHost();
    if (host && !host.hostingActive) {
      await prisma.host.update({
        where: { id: host.id },
        data: { hostingActive: true },
      });
      redirect("/dash?hostingEnabled=1");
    }
    redirect("/dash/hosting/setup");
  }

  if (choice === "LINKS") {
    redirect("/dash/links/setup");
  }

  redirect("/dash");
}

export async function activateBookingAction() {
  const user = await requireUser();
  const host = await getOptionalHost();
  if (!host) redirect("/dash/hosting/setup");
  if (!host.hostingActive) redirect("/dash/account");
  if (host.bookingEnabled) redirect("/dash");

  await activateBookingForHost(host.id);

  revalidatePath("/dash");
  revalidatePath("/dash/account");
  revalidatePath(`/${host.slug}`);
  redirect("/dash/calendar");
}

export async function pauseHostingAction() {
  const user = await requireUser();
  const host = await getOptionalHost();
  if (!host) throw new Error("You are not hosting");

  const pausedPreference = host.bookingEnabled ? "VISITOR" : "LINKS";

  await prisma.$transaction([
    prisma.host.update({
      where: { id: host.id },
      data: { hostingActive: false },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { hostingPreference: pausedPreference },
    }),
  ]);

  revalidatePath("/dash");
  revalidatePath("/dash/account");
  revalidatePath(`/${host.slug}`);
  redirect("/dash?hostingPaused=1");
}

export async function reactivateHostingAction() {
  const user = await requireUser();
  const host = await getOptionalHost();

  if (!host) {
    await prisma.user.update({
      where: { id: user.id },
      data: { hostingPreference: "HOST" },
    });
    redirect("/dash/hosting/setup");
  }

  const preference = host.bookingEnabled ? "HOST" : "LINKS";

  await prisma.$transaction([
    prisma.host.update({
      where: { id: host.id },
      data: { hostingActive: true },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { hostingPreference: preference },
    }),
  ]);

  revalidatePath("/dash");
  revalidatePath("/dash/account");
  revalidatePath(`/${host.slug}`);
  redirect("/dash?hostingEnabled=1");
}
