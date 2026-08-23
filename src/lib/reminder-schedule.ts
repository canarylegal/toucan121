import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { renderBookingEmail } from "@/lib/email-templates";
import { APP_NAME } from "@/lib/brand";
import {
  DISABLED_REMINDER_PREFS,
  parseReminderPrefs,
  planReminders,
  stringifyReminderPrefs,
  type ReminderPrefs,
} from "@/lib/reminders";
import {
  createReminderStopToken,
  isReminderSuppressed,
  reminderStopPageUrl,
  reminderUnsubscribeApiUrl,
} from "@/lib/reminder-unsubscribe";
import type { Booking, Host, MeetingType } from "@/generated/prisma/client";

export async function cancelPendingReminders(bookingId: string) {
  await prisma.bookingReminder.updateMany({
    where: {
      bookingId,
      sentAt: null,
      cancelledAt: null,
    },
    data: { cancelledAt: new Date() },
  });
}

/** Replace reminder schedule for a confirmed booking. */
export async function rebuildRemindersForBooking(opts: {
  booking: Booking & { host: Host; meetingType: MeetingType };
  confirmedAt?: Date;
}) {
  const { booking } = opts;
  if (booking.status !== "CONFIRMED") return;

  await cancelPendingReminders(booking.id);

  const hostPrefs = parseReminderPrefs(booking.hostReminderJson);
  const guestPrefs = parseReminderPrefs(booking.guestReminderJson);
  const [hostSuppressed, guestSuppressed] = await Promise.all([
    isReminderSuppressed(booking.host.email, "HOST"),
    isReminderSuppressed(booking.guestEmail, "GUEST"),
  ]);
  const planned = planReminders({
    confirmedAt: opts.confirmedAt ?? booking.updatedAt,
    startsAt: booking.startsAt,
    hostPrefs: hostSuppressed ? DISABLED_REMINDER_PREFS : hostPrefs,
    guestPrefs: guestSuppressed ? DISABLED_REMINDER_PREFS : guestPrefs,
  });

  if (planned.length === 0) return;

  await prisma.bookingReminder.createMany({
    data: planned.map((p) => ({
      bookingId: booking.id,
      recipient: p.recipient,
      kind: p.kind,
      scheduledFor: p.scheduledFor,
    })),
  });
}

export function snapshotReminderPrefsFromMeetingType(meetingType: {
  hostReminderJson: string;
  guestReminderJson: string;
}): { hostReminderJson: string; guestReminderJson: string } {
  return {
    hostReminderJson: stringifyReminderPrefs(
      parseReminderPrefs(meetingType.hostReminderJson),
    ),
    guestReminderJson: stringifyReminderPrefs(
      parseReminderPrefs(meetingType.guestReminderJson),
    ),
  };
}

export async function processDueReminders(opts?: { limit?: number }) {
  const limit = opts?.limit ?? 50;
  const now = new Date();

  const due = await prisma.bookingReminder.findMany({
    where: {
      sentAt: null,
      cancelledAt: null,
      scheduledFor: { lte: now },
      booking: { status: "CONFIRMED" },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
    include: {
      booking: { include: { host: true, meetingType: true } },
    },
  });

  let sent = 0;
  for (const row of due) {
    const { booking } = row;
    // Skip if meeting already started
    if (booking.startsAt <= now) {
      await prisma.bookingReminder.update({
        where: { id: row.id },
        data: { cancelledAt: now },
      });
      continue;
    }

    const email =
      row.recipient === "GUEST" ? booking.guestEmail : booking.host.email;
    if (await isReminderSuppressed(email, row.recipient)) {
      await prisma.bookingReminder.update({
        where: { id: row.id },
        data: { cancelledAt: now },
      });
      continue;
    }

    const location =
      booking.jitsiUrl ??
      (booking.venue || booking.meetingType.locationNote || "In person");
    const kindLabel =
      row.kind === "FINAL" ? "Upcoming appointment" : "Appointment reminder";
    const introGuest =
      row.kind === "FINAL"
        ? `This is your reminder for ${booking.meetingType.title} with ${booking.host.name}.`
        : `Friendly reminder: you have ${booking.meetingType.title} with ${booking.host.name} coming up.`;
    const introHost =
      row.kind === "FINAL"
        ? `Upcoming: ${booking.meetingType.title} with ${booking.guestName}.`
        : `Reminder: ${booking.meetingType.title} with ${booking.guestName} is coming up.`;
    const dashUrl = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/dash`;
    const stopToken = createReminderStopToken({
      bookingId: booking.id,
      recipient: row.recipient,
      startsAt: booking.startsAt,
    });
    const stopUrl = reminderStopPageUrl(stopToken);
    const listUnsubscribeUrl = reminderUnsubscribeApiUrl(stopToken);
    const unsubscribe = {
      label: "Stop reminders for this meeting",
      url: stopUrl,
    };

    try {
      if (row.recipient === "GUEST") {
        const mail = renderBookingEmail({
          subject: `${kindLabel}: ${booking.meetingType.title} with ${booking.host.name}`,
          preheader: kindLabel,
          greeting: `Hi ${booking.guestName},`,
          intro: introGuest,
          hostName: booking.host.name,
          guestName: booking.guestName,
          meetingTitle: booking.meetingType.title,
          startsAt: booking.startsAt,
          timezone: booking.host.timezone,
          location,
          videoUrl: booking.jitsiUrl,
          primaryCta: booking.jitsiUrl
            ? { label: "Open video room", url: booking.jitsiUrl }
            : undefined,
          unsubscribe,
        });
        await sendEmail({
          to: booking.guestEmail,
          fromName: `${booking.host.name} via ${APP_NAME}`,
          replyTo: booking.host.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          listUnsubscribeUrl,
        });
      } else {
        const mail = renderBookingEmail({
          subject: `${kindLabel}: ${booking.meetingType.title} with ${booking.guestName}`,
          preheader: kindLabel,
          intro: introHost,
          hostName: booking.host.name,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          meetingTitle: booking.meetingType.title,
          startsAt: booking.startsAt,
          timezone: booking.host.timezone,
          location,
          videoUrl: booking.jitsiUrl,
          primaryCta: { label: "Open dashboard", url: dashUrl },
          unsubscribe,
        });
        await sendEmail({
          to: booking.host.email,
          replyTo: booking.guestEmail,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          listUnsubscribeUrl,
        });
      }

      await prisma.bookingReminder.update({
        where: { id: row.id },
        data: { sentAt: now },
      });
      sent += 1;
    } catch (err) {
      console.error("[toucan:reminders] send failed", row.id, err);
    }
  }

  return { checked: due.length, sent };
}

export type { ReminderPrefs };
