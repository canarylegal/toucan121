"use server";

import { redirect } from "next/navigation";
import { confirmBooking, declineOrCancelBooking } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { reminderPrefsFromFormData } from "@/lib/reminders";

export async function guestInviteAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const decision = String(formData.get("decision") ?? "");

  const booking = await prisma.booking.findUnique({
    where: { manageToken: token },
  });
  if (!booking) {
    redirect(`/invite/${token}?error=notfound`);
  }

  let donePath: string | null = null;
  try {
    if (decision === "accept") {
      const guestReminder = reminderPrefsFromFormData(formData, "guest");
      await confirmBooking({
        bookingId: booking.id,
        actor: "guest",
        manageToken: token,
        guestReminder,
        venue: String(formData.get("venue") ?? ""),
      });
      donePath = `/invite/${token}?done=accepted`;
    } else if (decision === "decline") {
      await declineOrCancelBooking({
        bookingId: booking.id,
        actor: "guest",
        manageToken: token,
      });
      donePath = `/invite/${token}?done=declined`;
    } else {
      donePath = `/invite/${token}?error=invalid`;
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not update invitation";
    redirect(`/invite/${token}?error=${encodeURIComponent(message)}`);
  }

  redirect(donePath!);
}
