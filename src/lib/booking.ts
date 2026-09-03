import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  BOOKING_HORIZON_DAYS,
  generateSlotCandidates,
  parseAvailabilityJson,
  parseIsoOrThrow,
  withBuffers,
} from "@/lib/availability";
import {
  getHostBusyBlocks,
  getHostWriteAdapter,
} from "@/lib/calendar/host-calendar";
import { buildCalendarCancel, buildCalendarInvite } from "@/lib/ics";
import { sendEmail } from "@/lib/email";
import { hostNotifyEmail } from "@/lib/host-notify-email";
import {
  formatEmailWhen,
  renderBookingEmail,
} from "@/lib/email-templates";
import { APP_NAME } from "@/lib/brand";
import { resolveMeetingVideoUrl } from "@/lib/jitsi";
import { resolveBookingApproval } from "@/lib/approval";
import {
  DISABLED_REMINDER_PREFS,
  parseReminderPrefs,
  reminderPrefsSchema,
  stringifyReminderPrefs,
} from "@/lib/reminders";
import {
  cancelPendingReminders,
  rebuildRemindersForBooking,
  snapshotReminderPrefsFromMeetingType,
} from "@/lib/reminder-schedule";
import { addMinutes } from "date-fns";
import type { Booking, Host, MeetingType } from "@/generated/prisma/client";

export const bookSchema = z
  .object({
    meetingTypeSlug: z.string().min(1).optional(),
    meetingTypeId: z.string().min(1).optional(),
    startsAt: z.string().datetime(),
    guestName: z.string().min(1).max(120),
    guestEmail: z
      .string()
      .trim()
      .email()
      .transform((e) => e.toLowerCase()),
    notes: z.string().max(2000).optional(),
    emailOptIn: z.boolean().default(true),
    venue: z.string().trim().max(300).optional(),
    guestReminder: reminderPrefsSchema.optional(),
  })
  .refine((v) => v.meetingTypeSlug || v.meetingTypeId, {
    message: "Meeting type is required",
  });

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function newManageToken() {
  return randomBytes(24).toString("hex");
}

function locationFor(booking: {
  locationType: MeetingType["locationType"] | Booking["locationType"];
  jitsiUrl?: string | null;
  venue?: string | null;
  meetingType?: { locationNote?: string };
}): string {
  if (booking.locationType === "VIDEO") {
    return booking.jitsiUrl ?? "Video call";
  }
  const venue = (booking.venue || booking.meetingType?.locationNote || "").trim();
  return venue || "In person";
}

function resolveVenue(opts: {
  meetingType: MeetingType;
  proposed?: string | null;
  requireProposed: boolean;
}): string {
  if (opts.meetingType.locationType === "VIDEO") return "";
  if (opts.meetingType.venuePolicy === "HOST_FIXED") {
    return opts.meetingType.locationNote.trim();
  }
  const proposed = (opts.proposed ?? "").trim();
  if (opts.requireProposed && !proposed) {
    throw new Error("Please propose a venue for this meeting");
  }
  return proposed;
}

function whenLine(booking: Booking, timezone: string) {
  return formatEmailWhen(booking.startsAt, timezone);
}

export async function getHostBySlug(
  slug: string,
  opts?: { includePaused?: boolean },
) {
  return prisma.host.findFirst({
    where: {
      slug,
      ...(opts?.includePaused ? {} : { hostingActive: true }),
    },
    include: {
      meetingTypes: {
        where: { active: true, deletedAt: null },
        orderBy: { title: "asc" },
      },
      links: {
        where: { active: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

async function loadMeetingContext(opts: {
  hostId?: string;
  hostSlug?: string;
  meetingTypeSlug?: string;
  meetingTypeId?: string;
  allowInactive?: boolean;
}) {
  const host = opts.hostId
    ? await prisma.host.findUnique({ where: { id: opts.hostId } })
    : opts.hostSlug
      ? await prisma.host.findUnique({ where: { slug: opts.hostSlug } })
      : null;
  if (!host) throw new Error("Host not found");
  if (!host.hostingActive || !host.bookingEnabled) {
    throw new Error("Booking is not available for this profile");
  }

  const meetingType = opts.meetingTypeId
    ? await prisma.meetingType.findFirst({
        where: { id: opts.meetingTypeId, hostId: host.id },
      })
    : opts.meetingTypeSlug
      ? await prisma.meetingType.findUnique({
          where: {
            hostId_slug: { hostId: host.id, slug: opts.meetingTypeSlug },
          },
        })
      : null;

  if (!meetingType || meetingType.deletedAt) {
    throw new Error("Meeting type not found");
  }
  if (!opts.allowInactive && !meetingType.active) {
    throw new Error("Meeting type not found");
  }

  return { host, meetingType };
}

export async function listSlotsForMeetingType(opts: {
  hostSlug?: string;
  hostId?: string;
  meetingTypeSlug?: string;
  meetingTypeId?: string;
  allowInactive?: boolean;
  /** Ignore this booking when computing busy (reschedule). */
  excludeBookingId?: string;
  /** Host booking/reschedule: ignore weekly hours, still block overlaps. */
  ignoreAvailabilityWindows?: boolean;
}) {
  const { host, meetingType } = await loadMeetingContext(opts);

  const existing = await prisma.booking.findMany({
    where: {
      hostId: host.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      startsAt: { gte: new Date() },
      ...(opts.excludeBookingId
        ? { id: { not: opts.excludeBookingId } }
        : {}),
    },
    select: {
      startsAt: true,
      endsAt: true,
      meetingType: {
        select: { bufferBefore: true, bufferAfter: true },
      },
    },
  });

  const horizonDays = Math.min(
    365,
    Math.max(1, host.bookingHorizonDays ?? BOOKING_HORIZON_DAYS),
  );
  const rangeEnd = addMinutes(new Date(), 60 * 24 * horizonDays);
  const rangeStart = new Date();

  const timeBlocks = await prisma.hostTimeBlock.findMany({
    where: {
      hostId: host.id,
      startsAt: { lt: rangeEnd },
      endsAt: { gt: rangeStart },
    },
    select: { startsAt: true, endsAt: true },
  });

  const bookingBusy = [
    ...existing.map((b) =>
      withBuffers(
        b.startsAt,
        b.endsAt,
        b.meetingType.bufferBefore,
        b.meetingType.bufferAfter,
      ),
    ),
    ...timeBlocks.map((b) => ({
      startsAt: b.startsAt,
      endsAt: b.endsAt,
    })),
  ];

  const busy = await getHostBusyBlocks({
    hostId: host.id,
    rangeStart,
    rangeEnd,
    bookingBusy,
  });

  const windows = parseAvailabilityJson(meetingType.availabilityJson);
  const candidates = generateSlotCandidates({
    timezone: host.timezone,
    durationMins: meetingType.durationMins,
    windows,
    daysAhead: horizonDays,
    busy,
    bufferBeforeMins: meetingType.bufferBefore,
    bufferAfterMins: meetingType.bufferAfter,
    ignoreAvailabilityWindows: opts.ignoreAvailabilityWindows,
  });
  const slots = candidates
    .filter((c) => c.available)
    .map(({ startsAt, endsAt }) => ({ startsAt, endsAt }));

  return { host, meetingType, slots, candidates };
}

async function writeCalendarEvent(opts: {
  hostId: string;
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  attendeeEmail: string;
  /** Stable UID shared with emailed .ics so clients do not double-import. */
  uid: string;
}) {
  const adapter = await getHostWriteAdapter(opts.hostId);
  return adapter.createEvent({
    title: opts.title,
    description: opts.description,
    location: opts.location || undefined,
    startsAt: opts.startsAt,
    endsAt: opts.endsAt,
    attendeeEmail: opts.attendeeEmail,
    uid: opts.uid,
  });
}

/** True when bookings are written to a real calendar (CalDAV/Outlook). */
async function hostHasExternalWriteCalendar(hostId: string): Promise<boolean> {
  const conn = await prisma.calendarConnection.findFirst({
    where: { hostId, writeTarget: true },
    select: { provider: true },
  });
  return conn?.provider === "CALDAV" || conn?.provider === "OUTLOOK" || conn?.provider === "GOOGLE";
}

/**
 * Serialize booking creates/reschedules per host and reject overlapping
 * PENDING/CONFIRMED rows (closes the check-then-insert race).
 */
async function assertNoHostOverlap(
  tx: {
    $executeRaw: (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => Promise<unknown>;
    booking: {
      findFirst: (args: {
        where: Record<string, unknown>;
        select: { id: true };
      }) => Promise<{ id: string } | null>;
    };
  },
  opts: {
    hostId: string;
    startsAt: Date;
    endsAt: Date;
    excludeBookingId?: string;
  },
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(901121, hashtext(${opts.hostId}))`;
  const conflict = await tx.booking.findFirst({
    where: {
      hostId: opts.hostId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startsAt: { lt: opts.endsAt },
      endsAt: { gt: opts.startsAt },
      ...(opts.excludeBookingId
        ? { id: { not: opts.excludeBookingId } }
        : {}),
    },
    select: { id: true },
  });
  if (conflict) {
    throw new Error("That slot is no longer available");
  }
}

async function cancelCalendarEvent(hostId: string, eventId: string | null) {
  if (!eventId) return;
  try {
    const adapter = await getHostWriteAdapter(hostId);
    await adapter.cancelEvent(eventId);
  } catch (err) {
    console.error("[toucan:calendar] cancelEvent failed", err);
  }
}

function eventDescription(
  meetingType: MeetingType,
  booking: Pick<Booking, "jitsiUrl" | "notes">,
) {
  return [
    meetingType.description,
    booking.jitsiUrl ? `Join video: ${booking.jitsiUrl}` : "",
    booking.notes ? `Notes: ${booking.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function sendConfirmedEmails(opts: {
  host: Host;
  meetingType: MeetingType;
  booking: Booking;
  location: string;
  toGuest: boolean;
}) {
  const { host, meetingType, booking, location, toGuest } = opts;
  const hostInbox = await hostNotifyEmail(host);
  const ics = buildCalendarInvite({
    uid: booking.id,
    title: `${meetingType.title} with ${host.name}`,
    description: [
      meetingType.description,
      booking.jitsiUrl ? `Join video: ${booking.jitsiUrl}` : "",
      booking.notes ? `Notes: ${booking.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    location: location || undefined,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    organizerName: host.name,
    organizerEmail: hostInbox,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    url: booking.jitsiUrl ?? undefined,
  });

  const selfBook =
    booking.guestEmail.trim().toLowerCase() === hostInbox.trim().toLowerCase();
  // When CalDAV/Outlook already has the event, an emailed .ics with a different
  // history of UIDs (or a second METHOD:REQUEST) often lands as a duplicate —
  // especially when the host books themselves.
  const externalCalendar = await hostHasExternalWriteCalendar(host.id);
  const attachGuestIcs = !selfBook;
  const attachHostIcs = !externalCalendar;

  if (toGuest) {
    const guestMail = renderBookingEmail({
      subject: `Confirmed: ${meetingType.title} with ${host.name}`,
      preheader: `Your ${meetingType.title} is confirmed`,
      greeting: `Hi ${booking.guestName},`,
      intro: `Your ${meetingType.title} with ${host.name} is confirmed.`,
      hostName: host.name,
      guestName: booking.guestName,
      meetingTitle: meetingType.title,
      startsAt: booking.startsAt,
      timezone: host.timezone,
      location,
      videoUrl: booking.jitsiUrl,
      primaryCta: booking.jitsiUrl
        ? { label: "Open video room", url: booking.jitsiUrl }
        : undefined,
      hasCalendarInvite: attachGuestIcs,
      footerNote: "Reply to this email to reach the host directly.",
    });
    await sendEmail({
      to: booking.guestEmail,
      fromName: `${host.name} via ${APP_NAME}`,
      replyTo: host.email,
      subject: guestMail.subject,
      text: guestMail.text,
      html: guestMail.html,
      icsContent: attachGuestIcs ? ics : undefined,
    });
  }

  const hostMail = renderBookingEmail({
    subject: `Confirmed: ${meetingType.title} with ${booking.guestName}`,
    preheader: `${booking.guestName} is confirmed`,
    intro: `${booking.guestName} is confirmed for ${meetingType.title}.`,
    hostName: host.name,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    meetingTitle: meetingType.title,
    startsAt: booking.startsAt,
    timezone: host.timezone,
    location,
    notes: booking.notes || undefined,
    videoUrl: booking.jitsiUrl,
    hasCalendarInvite: attachHostIcs,
  });
  await sendEmail({
    to: hostInbox,
    replyTo: booking.guestEmail,
    subject: hostMail.subject,
    text: hostMail.text,
    html: hostMail.html,
    icsContent: attachHostIcs ? ics : undefined,
  });
}

/** Promote a pending booking to confirmed: calendar write + emails. */
export async function confirmBooking(opts: {
  bookingId: string;
  actor: "host" | "guest";
  manageToken?: string;
  guestReminder?: z.infer<typeof reminderPrefsSchema>;
  venue?: string;
}) {
  const booking = await prisma.booking.findUnique({
    where: { id: opts.bookingId },
    include: { host: true, meetingType: true },
  });
  if (!booking) throw new Error("Booking not found");
  if (booking.status === "CANCELLED") {
    throw new Error("This booking was cancelled");
  }
  if (booking.status === "COMPLETED") {
    throw new Error("This booking is already completed");
  }
  if (booking.status === "CONFIRMED") {
    return booking;
  }
  if (booking.status !== "PENDING") {
    throw new Error("Booking cannot be confirmed");
  }

  if (opts.actor === "guest") {
    if (booking.pendingOn !== "GUEST") {
      throw new Error("This booking is not waiting on the invitee");
    }
    if (!opts.manageToken || opts.manageToken !== booking.manageToken) {
      throw new Error("Invalid or expired invite link");
    }
  } else if (booking.pendingOn !== "HOST") {
    throw new Error("This booking is not waiting on host approval");
  }

  let venue = booking.venue;
  if (
    booking.meetingType.locationType === "IN_PERSON" &&
    booking.meetingType.venuePolicy === "GUEST_PROPOSES"
  ) {
    if (opts.actor === "guest") {
      venue = resolveVenue({
        meetingType: booking.meetingType,
        proposed: opts.venue || booking.venue,
        requireProposed: true,
      });
    } else if (!venue.trim()) {
      throw new Error("A venue is still needed for this meeting");
    }
  } else if (
    booking.meetingType.locationType === "IN_PERSON" &&
    booking.meetingType.venuePolicy === "HOST_FIXED" &&
    !venue.trim()
  ) {
    venue = booking.meetingType.locationNote.trim();
  }

  const bookingForLocation = { ...booking, venue };
  const location = locationFor(bookingForLocation);
  let calendarEventId = booking.calendarEventId;

  if (!calendarEventId) {
    const calendar = await writeCalendarEvent({
      hostId: booking.host.id,
      title: `${booking.meetingType.title} with ${booking.guestName}`,
      description: [
        booking.meetingType.description,
        booking.jitsiUrl ? `Join video: ${booking.jitsiUrl}` : "",
        booking.notes ? `Notes: ${booking.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      location,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      attendeeEmail: booking.guestEmail,
      uid: booking.id,
    });
    calendarEventId = calendar.eventId;
  }

  const confirmedAt = new Date();
  const guestReminderJson = opts.guestReminder
    ? stringifyReminderPrefs(opts.guestReminder)
    : booking.guestReminderJson && booking.guestReminderJson !== "{}"
      ? booking.guestReminderJson
      : stringifyReminderPrefs(
          parseReminderPrefs(booking.meetingType.guestReminderJson),
        );
  const hostReminderJson =
    booking.hostReminderJson && booking.hostReminderJson !== "{}"
      ? booking.hostReminderJson
      : stringifyReminderPrefs(
          parseReminderPrefs(booking.meetingType.hostReminderJson),
        );

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "CONFIRMED",
      pendingOn: null,
      calendarEventId,
      confirmedAt,
      hostReminderJson,
      guestReminderJson,
      venue,
    },
    include: { host: true, meetingType: true },
  });

  await sendConfirmedEmails({
    host: updated.host,
    meetingType: updated.meetingType,
    booking: updated,
    location,
    toGuest: true,
  });

  await rebuildRemindersForBooking({ booking: updated, confirmedAt });

  return updated;
}

export async function declineOrCancelBooking(opts: {
  bookingId: string;
  actor: "host" | "guest";
  manageToken?: string;
  /** Host cancel of an existing booking vs declining a pending request */
  reason?: "decline" | "cancel";
}) {
  const booking = await prisma.booking.findUnique({
    where: { id: opts.bookingId },
    include: { host: true, meetingType: true },
  });
  if (!booking) throw new Error("Booking not found");
  if (booking.status === "CANCELLED") return booking;
  if (booking.status === "COMPLETED") {
    throw new Error("Completed bookings cannot be cancelled — they are already closed");
  }

  if (opts.actor === "guest") {
    if (!opts.manageToken || opts.manageToken !== booking.manageToken) {
      throw new Error("Invalid or expired invite link");
    }
  }

  const wasConfirmed = booking.status === "CONFIRMED";
  const wasPendingHost =
    booking.status === "PENDING" && booking.pendingOn === "HOST";
  const mode =
    opts.reason ??
    (opts.actor === "host" && wasPendingHost ? "decline" : "cancel");

  await cancelCalendarEvent(booking.hostId, booking.calendarEventId);
  await cancelPendingReminders(booking.id);

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "CANCELLED",
      pendingOn: null,
      calendarEventId: null,
    },
    include: { host: true, meetingType: true },
  });

  const location = locationFor(updated);
  const hostInbox = await hostNotifyEmail(updated.host);

  const cancelIcs =
    wasConfirmed
      ? buildCalendarCancel({
          uid: updated.id,
          title: `${updated.meetingType.title} with ${updated.host.name}`,
          description: eventDescription(updated.meetingType, updated),
          location,
          startsAt: updated.startsAt,
          endsAt: updated.endsAt,
          organizerName: updated.host.name,
          organizerEmail: hostInbox,
          guestName: updated.guestName,
          guestEmail: updated.guestEmail,
          url: updated.jitsiUrl ?? undefined,
        })
      : undefined;

  if (opts.actor === "guest") {
    const toHost = renderBookingEmail({
      subject: `Cancelled: ${updated.meetingType.title} with ${updated.guestName}`,
      preheader: `${updated.guestName} cancelled`,
      intro: `${updated.guestName} declined or cancelled ${updated.meetingType.title}.`,
      hostName: updated.host.name,
      guestName: updated.guestName,
      guestEmail: updated.guestEmail,
      meetingTitle: updated.meetingType.title,
      startsAt: updated.startsAt,
      timezone: updated.host.timezone,
      location,
      hasCalendarInvite: Boolean(cancelIcs),
    });
    await sendEmail({
      to: hostInbox,
      replyTo: updated.guestEmail,
      subject: toHost.subject,
      text: toHost.text,
      html: toHost.html,
      icsContent: cancelIcs,
    });

    const toGuest = renderBookingEmail({
      subject: `Cancelled: ${updated.meetingType.title}`,
      preheader: "Booking cancelled",
      greeting: `Hi ${updated.guestName},`,
      intro: `You cancelled ${updated.meetingType.title} with ${updated.host.name}.`,
      hostName: updated.host.name,
      guestName: updated.guestName,
      meetingTitle: updated.meetingType.title,
      startsAt: updated.startsAt,
      timezone: updated.host.timezone,
      location,
      hasCalendarInvite: Boolean(cancelIcs),
      footerNote: "If this was a mistake, reply to this email to contact the host.",
    });
    await sendEmail({
      to: updated.guestEmail,
      fromName: `${updated.host.name} via ${APP_NAME}`,
      replyTo: updated.host.email,
      subject: toGuest.subject,
      text: toGuest.text,
      html: toGuest.html,
      icsContent: cancelIcs,
    });
  } else if (mode === "decline") {
    const toHost = renderBookingEmail({
      subject: `Declined: ${updated.meetingType.title} with ${updated.guestName}`,
      intro: `You declined ${updated.guestName}'s request for ${updated.meetingType.title}.`,
      hostName: updated.host.name,
      guestName: updated.guestName,
      guestEmail: updated.guestEmail,
      meetingTitle: updated.meetingType.title,
      startsAt: updated.startsAt,
      timezone: updated.host.timezone,
      location,
    });
    await sendEmail({
      to: hostInbox,
      replyTo: updated.guestEmail,
      subject: toHost.subject,
      text: toHost.text,
      html: toHost.html,
    });

    const toGuest = renderBookingEmail({
      subject: `Update: ${updated.meetingType.title} with ${updated.host.name}`,
      preheader: "Request not approved",
      greeting: `Hi ${updated.guestName},`,
      intro: `Your request for ${updated.meetingType.title} with ${updated.host.name} was not approved.`,
      hostName: updated.host.name,
      guestName: updated.guestName,
      meetingTitle: updated.meetingType.title,
      startsAt: updated.startsAt,
      timezone: updated.host.timezone,
      location,
      footerNote: "Reply to this email if you need to follow up with the host.",
    });
    await sendEmail({
      to: updated.guestEmail,
      fromName: `${updated.host.name} via ${APP_NAME}`,
      replyTo: updated.host.email,
      subject: toGuest.subject,
      text: toGuest.text,
      html: toGuest.html,
    });
  } else {
    const toHost = renderBookingEmail({
      subject: `Cancelled: ${updated.meetingType.title} with ${updated.guestName}`,
      intro: `You cancelled ${updated.meetingType.title} with ${updated.guestName}.`,
      hostName: updated.host.name,
      guestName: updated.guestName,
      guestEmail: updated.guestEmail,
      meetingTitle: updated.meetingType.title,
      startsAt: updated.startsAt,
      timezone: updated.host.timezone,
      location,
      hasCalendarInvite: Boolean(cancelIcs),
    });
    await sendEmail({
      to: hostInbox,
      replyTo: updated.guestEmail,
      subject: toHost.subject,
      text: toHost.text,
      html: toHost.html,
      icsContent: cancelIcs,
    });

    const toGuest = renderBookingEmail({
      subject: `Cancelled: ${updated.meetingType.title} with ${updated.host.name}`,
      preheader: "Booking cancelled",
      greeting: `Hi ${updated.guestName},`,
      intro: `${updated.host.name} cancelled your ${updated.meetingType.title}.`,
      hostName: updated.host.name,
      guestName: updated.guestName,
      meetingTitle: updated.meetingType.title,
      startsAt: updated.startsAt,
      timezone: updated.host.timezone,
      location,
      hasCalendarInvite: Boolean(cancelIcs),
      footerNote: wasConfirmed
        ? "If the event is still on your calendar, remove it or open the attached cancellation."
        : "This booking will not go ahead.",
    });
    await sendEmail({
      to: updated.guestEmail,
      fromName: `${updated.host.name} via ${APP_NAME}`,
      replyTo: updated.host.email,
      subject: toGuest.subject,
      text: toGuest.text,
      html: toGuest.html,
      icsContent: cancelIcs,
    });
  }

  return updated;
}

export async function rescheduleBooking(opts: {
  bookingId: string;
  hostId: string;
  startsAtIso: string;
}) {
  const startsAt = parseIsoOrThrow(opts.startsAtIso);
  const booking = await prisma.booking.findFirst({
    where: { id: opts.bookingId, hostId: opts.hostId },
    include: { host: true, meetingType: true },
  });
  if (!booking) throw new Error("Booking not found");

  const { slots } = await listSlotsForMeetingType({
    hostId: opts.hostId,
    meetingTypeId: booking.meetingTypeId,
    allowInactive: true,
    excludeBookingId: booking.id,
    ignoreAvailabilityWindows: true,
  });

  const match = slots.find((s) => s.startsAt.getTime() === startsAt.getTime());
  if (!match) {
    throw new Error("That slot is no longer available");
  }

  const previousWhen = whenLine(booking, booking.host.timezone);
  const location = locationFor(booking);
  const wasCancelled = booking.status === "CANCELLED";
  if (booking.status === "COMPLETED") {
    throw new Error("Completed bookings cannot be rescheduled");
  }
  // Host reschedule of a cancelled meeting reactivates it as confirmed.
  const nextStatus =
    wasCancelled
      ? ("CONFIRMED" as const)
      : booking.status === "CONFIRMED"
        ? ("CONFIRMED" as const)
        : booking.status;

  const confirmedAt =
    nextStatus === "CONFIRMED"
      ? wasCancelled
        ? new Date()
        : (booking.confirmedAt ?? new Date())
      : null;

  if (nextStatus === "CONFIRMED" && booking.calendarEventId) {
    await cancelCalendarEvent(booking.hostId, booking.calendarEventId);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await assertNoHostOverlap(tx, {
      hostId: booking.hostId,
      startsAt: match.startsAt,
      endsAt: match.endsAt,
      excludeBookingId: booking.id,
    });
    return tx.booking.update({
      where: { id: booking.id },
      data: {
        startsAt: match.startsAt,
        endsAt: match.endsAt,
        calendarEventId:
          nextStatus === "CONFIRMED" ? null : booking.calendarEventId,
        status: nextStatus,
        pendingOn: nextStatus === "CONFIRMED" ? null : booking.pendingOn,
        confirmedAt:
          nextStatus === "CONFIRMED" ? confirmedAt : booking.confirmedAt,
      },
      include: { host: true, meetingType: true },
    });
  });

  if (updated.status === "CONFIRMED") {
    const calendar = await writeCalendarEvent({
      hostId: updated.hostId,
      title: `${updated.meetingType.title} with ${updated.guestName}`,
      description: eventDescription(updated.meetingType, updated),
      location,
      startsAt: updated.startsAt,
      endsAt: updated.endsAt,
      attendeeEmail: updated.guestEmail,
      uid: updated.id,
    });
    await prisma.booking.update({
      where: { id: updated.id },
      data: { calendarEventId: calendar.eventId },
    });
    updated.calendarEventId = calendar.eventId;
    await rebuildRemindersForBooking({
      booking: updated,
      confirmedAt: updated.confirmedAt ?? updated.createdAt,
    });
  }

  const hostInbox = await hostNotifyEmail(updated.host);

  const ics =
    updated.status === "CONFIRMED"
      ? buildCalendarInvite({
          uid: updated.id,
          title: `${updated.meetingType.title} with ${updated.host.name}`,
          description: eventDescription(updated.meetingType, updated),
          location,
          startsAt: updated.startsAt,
          endsAt: updated.endsAt,
          organizerName: updated.host.name,
          organizerEmail: hostInbox,
          guestName: updated.guestName,
          guestEmail: updated.guestEmail,
          url: updated.jitsiUrl ?? undefined,
        })
      : undefined;

  const selfBook =
    updated.guestEmail.trim().toLowerCase() ===
    hostInbox.trim().toLowerCase();
  const externalCalendar = await hostHasExternalWriteCalendar(updated.hostId);
  const attachGuestIcs = Boolean(ics) && !selfBook;
  const attachHostIcs = Boolean(ics) && !externalCalendar;

  const inviteUrl = `${appUrl()}/invite/${updated.manageToken}`;
  const verb = wasCancelled ? "rebooked" : "rescheduled";
  const verbTitle = wasCancelled ? "Rebooked" : "Rescheduled";

  const guestMail = renderBookingEmail({
    subject:
      updated.status === "CONFIRMED"
        ? `${verbTitle}: ${updated.meetingType.title} with ${updated.host.name}`
        : `Updated invitation: ${updated.meetingType.title} with ${updated.host.name}`,
    preheader: `Your meeting was ${verb}`,
    greeting: `Hi ${updated.guestName},`,
    intro: `${updated.host.name} ${verb} your ${updated.meetingType.title}.`,
    hostName: updated.host.name,
    guestName: updated.guestName,
    meetingTitle: updated.meetingType.title,
    startsAt: updated.startsAt,
    timezone: updated.host.timezone,
    location,
    previousWhenLabel: previousWhen,
    videoUrl: updated.jitsiUrl,
    primaryCta:
      updated.status === "CONFIRMED"
        ? updated.jitsiUrl
          ? { label: "Open video room", url: updated.jitsiUrl }
          : undefined
        : { label: "Accept invitation", url: `${inviteUrl}?action=accept` },
    secondaryCta:
      updated.status === "CONFIRMED"
        ? undefined
        : { label: "Decline", url: `${inviteUrl}?action=decline` },
    hasCalendarInvite: attachGuestIcs,
    footerNote:
      updated.status === "CONFIRMED"
        ? attachGuestIcs
          ? "An updated calendar invite is attached."
          : "Your calendar was updated on the host calendar."
        : "This invitation is still pending your response.",
  });
  await sendEmail({
    to: updated.guestEmail,
    fromName: `${updated.host.name} via ${APP_NAME}`,
    replyTo: updated.host.email,
    subject: guestMail.subject,
    text: guestMail.text,
    html: guestMail.html,
    icsContent: attachGuestIcs ? ics : undefined,
  });

  const hostMail = renderBookingEmail({
    subject: `${verbTitle}: ${updated.meetingType.title} with ${updated.guestName}`,
    intro: `You ${verb} ${updated.meetingType.title} with ${updated.guestName}.`,
    hostName: updated.host.name,
    guestName: updated.guestName,
    guestEmail: updated.guestEmail,
    meetingTitle: updated.meetingType.title,
    startsAt: updated.startsAt,
    timezone: updated.host.timezone,
    location,
    previousWhenLabel: previousWhen,
    hasCalendarInvite: attachHostIcs && Boolean(ics),
  });
  await sendEmail({
    to: hostInbox,
    replyTo: updated.guestEmail,
    subject: hostMail.subject,
    text: hostMail.text,
    html: hostMail.html,
    icsContent: attachHostIcs ? ics : undefined,
  });

  return updated;
}

export async function createBooking(opts: {
  hostSlug?: string;
  hostId?: string;
  input: z.input<typeof bookSchema>;
  initiatedBy?: "guest" | "host";
  allowInactiveMeetingType?: boolean;
  guestUserId?: string | null;
  /** Host-initiated: confirm without invitee accept. */
  hostAutoConfirm?: boolean;
  /** Host-initiated: when false, disable visitor reminder emails for this booking. Host reminders still use meeting-type defaults. */
  sendReminders?: boolean;
}) {
  const initiatedBy = opts.initiatedBy ?? "guest";
  const parsed = bookSchema.parse(opts.input);
  const startsAt = parseIsoOrThrow(parsed.startsAt);

  const { host, meetingType, slots } = await listSlotsForMeetingType({
    hostSlug: opts.hostSlug,
    hostId: opts.hostId,
    meetingTypeSlug: parsed.meetingTypeSlug,
    meetingTypeId: parsed.meetingTypeId,
    allowInactive: opts.allowInactiveMeetingType,
    ignoreAvailabilityWindows: initiatedBy === "host",
  });

  const match = slots.find((s) => s.startsAt.getTime() === startsAt.getTime());
  if (!match) {
    throw new Error("That slot is no longer available");
  }

  const decision = await resolveBookingApproval({
    meetingType,
    guestEmail: parsed.guestEmail,
    startsAt: match.startsAt,
    initiatedBy,
    hostUserId: host.userId,
    guestUserId: opts.guestUserId,
    hostAutoConfirm: initiatedBy === "host" ? opts.hostAutoConfirm : undefined,
  });

  const jitsiUrl = resolveMeetingVideoUrl(meetingType);
  const venue = resolveVenue({
    meetingType,
    proposed: parsed.venue,
    // Guest public booking must propose; host invite may leave it for the invitee
    requireProposed:
      meetingType.locationType === "IN_PERSON" &&
      meetingType.venuePolicy === "GUEST_PROPOSES" &&
      initiatedBy === "guest",
  });
  const location = locationFor({
    locationType: meetingType.locationType,
    jitsiUrl,
    venue,
    meetingType,
  });
  const manageToken = newManageToken();

  const snapshots = snapshotReminderPrefsFromMeetingType(meetingType);
  const guestRemindersOff =
    initiatedBy === "host" && opts.sendReminders === false;
  const guestReminderJson = guestRemindersOff
    ? stringifyReminderPrefs(DISABLED_REMINDER_PREFS)
    : parsed.guestReminder
      ? stringifyReminderPrefs(parsed.guestReminder)
      : snapshots.guestReminderJson;
  const hostReminderJson = snapshots.hostReminderJson;
  const confirmedAt =
    decision.status === "CONFIRMED" ? new Date() : null;

  // Insert under a per-host advisory lock so two concurrent books of the same
  // slot cannot both pass the earlier availability check.
  const booking = await prisma.$transaction(async (tx) => {
    await assertNoHostOverlap(tx, {
      hostId: host.id,
      startsAt: match.startsAt,
      endsAt: match.endsAt,
    });
    return tx.booking.create({
      data: {
        hostId: host.id,
        meetingTypeId: meetingType.id,
        guestName: parsed.guestName,
        guestEmail: parsed.guestEmail,
        startsAt: match.startsAt,
        endsAt: match.endsAt,
        locationType: meetingType.locationType,
        venue,
        jitsiUrl,
        calendarEventId: null,
        notes: parsed.notes ?? "",
        emailOptIn: parsed.emailOptIn,
        status: decision.status,
        pendingOn: decision.pendingOn,
        manageToken,
        hostReminderJson,
        guestReminderJson,
        confirmedAt,
      },
    });
  });

  let calendarEventId: string | null = null;
  if (decision.status === "CONFIRMED") {
    const calendar = await writeCalendarEvent({
      hostId: host.id,
      title: `${meetingType.title} with ${parsed.guestName}`,
      description: [
        meetingType.description,
        jitsiUrl ? `Join video: ${jitsiUrl}` : "",
        parsed.notes ? `Notes: ${parsed.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      location,
      startsAt: match.startsAt,
      endsAt: match.endsAt,
      attendeeEmail: parsed.guestEmail,
      uid: booking.id,
    });
    calendarEventId = calendar.eventId;
    await prisma.booking.update({
      where: { id: booking.id },
      data: { calendarEventId },
    });
    booking.calendarEventId = calendarEventId;
  }

  const inviteUrl = `${appUrl()}/invite/${booking.manageToken}`;
  const hostDashboard = `${appUrl()}/dash`;
  const hostInbox = await hostNotifyEmail(host);

  if (decision.status === "CONFIRMED") {
    const shouldEmailGuest =
      initiatedBy === "host" ? true : parsed.emailOptIn;
    await sendConfirmedEmails({
      host,
      meetingType,
      booking,
      location,
      toGuest: shouldEmailGuest,
    });
    await rebuildRemindersForBooking({
      booking: { ...booking, host, meetingType },
      confirmedAt: confirmedAt!,
    });
    return booking;
  }

  // Pending flows
  if (decision.pendingOn === "GUEST") {
    const guestMail = renderBookingEmail({
      subject: `Invitation: ${meetingType.title} with ${host.name}`,
      preheader: `${host.name} invited you`,
      greeting: `Hi ${parsed.guestName},`,
      intro: `${host.name} has invited you to a ${meetingType.title}.`,
      hostName: host.name,
      guestName: parsed.guestName,
      meetingTitle: meetingType.title,
      startsAt: booking.startsAt,
      timezone: host.timezone,
      location,
      notes: parsed.notes,
      videoUrl: booking.jitsiUrl,
      primaryCta: { label: "Accept invitation", url: `${inviteUrl}?action=accept` },
      secondaryCta: { label: "Decline", url: `${inviteUrl}?action=decline` },
      footerNote: "Reply to this email to contact the host.",
    });
    await sendEmail({
      to: parsed.guestEmail,
      fromName: `${host.name} via ${APP_NAME}`,
      replyTo: host.email,
      subject: guestMail.subject,
      text: guestMail.text,
      html: guestMail.html,
    });

    const hostMail = renderBookingEmail({
      subject: `Invitation sent: ${meetingType.title} with ${parsed.guestName}`,
      intro: `You invited ${parsed.guestName}. Status: pending (awaiting invitee).`,
      hostName: host.name,
      guestName: parsed.guestName,
      guestEmail: parsed.guestEmail,
      meetingTitle: meetingType.title,
      startsAt: booking.startsAt,
      timezone: host.timezone,
      location,
      notes: parsed.notes,
    });
    await sendEmail({
      to: hostInbox,
      replyTo: parsed.guestEmail,
      subject: hostMail.subject,
      text: hostMail.text,
      html: hostMail.html,
    });
  } else {
    const hostMail = renderBookingEmail({
      subject: `Approval needed: ${meetingType.title} with ${parsed.guestName}`,
      preheader: "Action required",
      intro: `${parsed.guestName} requested ${meetingType.title}.`,
      hostName: host.name,
      guestName: parsed.guestName,
      guestEmail: parsed.guestEmail,
      meetingTitle: meetingType.title,
      startsAt: booking.startsAt,
      timezone: host.timezone,
      location,
      notes: parsed.notes,
      detailExtra: decision.reason,
      primaryCta: { label: "Review in dashboard", url: hostDashboard },
    });
    await sendEmail({
      to: hostInbox,
      replyTo: parsed.guestEmail,
      subject: hostMail.subject,
      text: hostMail.text,
      html: hostMail.html,
    });

    if (parsed.emailOptIn) {
      const guestMail = renderBookingEmail({
        subject: `Request received: ${meetingType.title} with ${host.name}`,
        preheader: "Waiting for approval",
        greeting: `Hi ${parsed.guestName},`,
        intro: `Your request for ${meetingType.title} with ${host.name} was received.`,
        hostName: host.name,
        guestName: parsed.guestName,
        meetingTitle: meetingType.title,
        startsAt: booking.startsAt,
        timezone: host.timezone,
        location,
        footerNote: "You'll get another email once it's approved.",
      });
      await sendEmail({
        to: parsed.guestEmail,
        fromName: `${host.name} via ${APP_NAME}`,
        replyTo: host.email,
        subject: guestMail.subject,
        text: guestMail.text,
        html: guestMail.html,
      });
    }
  }

  return booking;
}
