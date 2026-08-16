"use server";

import { revalidatePath } from "next/cache";
import { requireHost } from "@/lib/current-user";
import { prisma } from "@/lib/db";

const VIEWS = ["DAY", "WEEK", "MONTH", "LIST"] as const;
export type ScheduleViewMode = (typeof VIEWS)[number];

export async function setScheduleViewAction(formData: FormData) {
  const host = await requireHost();

  const view = String(formData.get("view") ?? "");
  if (!VIEWS.includes(view as ScheduleViewMode)) {
    throw new Error("Invalid schedule view");
  }

  await prisma.host.update({
    where: { id: host.id },
    data: { scheduleView: view as ScheduleViewMode },
  });

  revalidatePath("/dash/schedule");
}
