"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError, z } from "zod";
import { requireHost } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import {
  confirmBooking,
  declineOrCancelBooking,
  rescheduleBooking,
} from "@/lib/booking";
import { cancelPendingReminders } from "@/lib/reminder-schedule";
import {
  actionPointsAllDone,
  actionPointsFromTexts,
  parseActionPoints,
  stringifyActionPoints,
} from "@/lib/action-points";

export async function completeBookingAction(formData: FormData) {
  const host = await requireHost();
  const hostId = host.id;
  const bookingId = String(formData.get("bookingId") ?? "");
  const texts = formData
    .getAll("actionPoint")
    .map((v) => String(v))
    .filter((t) => t.trim().length > 0);
  const points = actionPointsFromTexts(texts);

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, hostId },
  });
  if (!booking) throw new Error("Booking not found");
  const now = new Date();
  if (booking.endsAt > now) {
    throw new Error("This meeting has not ended yet");
  }
  // Ended CONFIRMED (wrap-up) or ended PENDING (never accepted — host says it happened).
  if (booking.status !== "CONFIRMED" && booking.status !== "PENDING") {
    throw new Error("Only confirmed or past unconfirmed meetings can be completed");
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      actionPoints: stringifyActionPoints(points),
      actionPointsDone: actionPointsAllDone(points),
      pendingOn: null,
      // If it was never confirmed, treat completion as confirmation for history.
      confirmedAt: booking.confirmedAt ?? now,
    },
  });
  await cancelPendingReminders(booking.id);
  revalidatePath("/dash");
}

export async function toggleActionPointAction(formData: FormData) {
  const host = await requireHost();
  const hostId = host.id;
  const bookingId = String(formData.get("bookingId") ?? "");
  const pointId = String(formData.get("pointId") ?? "");
  const done = formData.get("done") === "true";

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, hostId, status: "COMPLETED" },
  });
  if (!booking) throw new Error("Booking not found");

  const points = parseActionPoints(booking.actionPoints).map((p) =>
    p.id === pointId ? { ...p, done } : p,
  );

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      actionPoints: stringifyActionPoints(points),
      actionPointsDone: actionPointsAllDone(points),
    },
  });
  revalidatePath("/dash");
}

export async function approveBookingAction(formData: FormData) {
  const host = await requireHost();
  const hostId = host.id;
  const bookingId = String(formData.get("bookingId") ?? "");
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, hostId },
  });
  if (!booking) throw new Error("Booking not found");

  await confirmBooking({ bookingId, actor: "host" });
  revalidatePath("/dash");
}

export async function declineBookingAction(formData: FormData) {
  const host = await requireHost();
  const hostId = host.id;
  const bookingId = String(formData.get("bookingId") ?? "");
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, hostId },
  });
  if (!booking) throw new Error("Booking not found");

  await declineOrCancelBooking({
    bookingId,
    actor: "host",
    reason: "decline",
  });
  revalidatePath("/dash");
}

export async function cancelBookingAction(formData: FormData) {
  const host = await requireHost();
  const hostId = host.id;
  const bookingId = String(formData.get("bookingId") ?? "");
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, hostId },
  });
  if (!booking) throw new Error("Booking not found");

  await declineOrCancelBooking({
    bookingId,
    actor: "host",
    reason: "cancel",
  });
  revalidatePath("/dash");
  redirect("/dash?cancelled=1");
}

export type RescheduleFormState = {
  error?: string;
  values?: { startsAt: string };
  formKey?: number;
};

export async function rescheduleBookingAction(
  bookingId: string,
  prev: RescheduleFormState,
  formData: FormData,
): Promise<RescheduleFormState> {
  const values = { startsAt: String(formData.get("startsAt") ?? "") };
  const formKey = (prev.formKey ?? 0) + 1;

  try {
    const host = await requireHost();
    const hostId = host.id;
    const parsed = z
      .object({ startsAt: z.string().datetime() })
      .parse(values);

    await rescheduleBooking({
      bookingId,
      hostId,
      startsAtIso: parsed.startsAt,
    });

    revalidatePath("/dash");
    revalidatePath(`/dash/bookings/${bookingId}/reschedule`);
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        error: err.issues[0]?.message ?? "Pick a valid time",
        values,
        formKey,
      };
    }
    return {
      error: err instanceof Error ? err.message : "Could not reschedule",
      values,
      formKey,
    };
  }

  redirect("/dash?rescheduled=1");
}
