"use server";

import { redirect } from "next/navigation";
import {
  emailForReminderRecipient,
  setReminderSuppressed,
  verifyReminderStopToken,
} from "@/lib/reminder-unsubscribe";

export async function stopAllRemindersFromTokenAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const payload = verifyReminderStopToken(token);
  if (!payload) {
    redirect("/reminders/link-expired");
  }
  const email = await emailForReminderRecipient(
    payload.bookingId,
    payload.recipient,
  );
  if (email) {
    await setReminderSuppressed({
      email,
      recipient: payload.recipient,
      suppressed: true,
    });
  }
  redirect(
    `/reminders/stop/${encodeURIComponent(token)}?all=1`,
  );
}
