import { prisma } from "@/lib/db";
import { APP_NAME } from "@/lib/brand";
import { getHostWriteAdapter } from "@/lib/calendar/host-calendar";
import { invalidateCachePrefix } from "@/lib/ttl-cache";

export type RepublishResult = {
  bookings: number;
  timeBlocks: number;
  failed: number;
};

function locationFor(booking: {
  locationType: "VIDEO" | "IN_PERSON";
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

function eventDescription(opts: {
  description: string;
  jitsiUrl: string | null;
  notes: string;
}): string {
  return [
    opts.description,
    opts.jitsiUrl ? `Join video: ${opts.jitsiUrl}` : "",
    opts.notes ? `Notes: ${opts.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function describeRepublish(result: RepublishResult): string {
  const parts: string[] = [];
  if (result.bookings === 1) parts.push("1 upcoming booking");
  else if (result.bookings > 1) parts.push(`${result.bookings} upcoming bookings`);
  if (result.timeBlocks === 1) parts.push("1 blocked time");
  else if (result.timeBlocks > 1) {
    parts.push(`${result.timeBlocks} blocked times`);
  }
  if (parts.length === 0) return "";
  const copied = ` Copied ${parts.join(" and ")} to this calendar.`;
  if (result.failed > 0) {
    return `${copied} ${result.failed} could not be written — check the calendar logs.`;
  }
  return copied;
}

/**
 * After switching the write calendar, existing Toucan meetings stay in the
 * database but are not on the new calendar unless we write them again.
 */
export async function republishHostMeetingsToWriteCalendar(
  hostId: string,
  opts?: {
    statuses?: Array<"CONFIRMED" | "PENDING">;
    includeTimeBlocks?: boolean;
  },
): Promise<RepublishResult> {
  const adapter = await getHostWriteAdapter(hostId);
  const now = new Date();
  const result: RepublishResult = { bookings: 0, timeBlocks: 0, failed: 0 };
  const statuses = opts?.statuses ?? ["CONFIRMED", "PENDING"];
  const includeTimeBlocks = opts?.includeTimeBlocks ?? true;

  const bookings = await prisma.booking.findMany({
    where: {
      hostId,
      status: { in: statuses },
      endsAt: { gte: now },
    },
    include: { meetingType: true },
    orderBy: { startsAt: "asc" },
  });

  for (const booking of bookings) {
    try {
      const { eventId } = await adapter.createEvent({
        title: `${booking.meetingType.title} with ${booking.guestName}`,
        description: eventDescription({
          description: booking.meetingType.description,
          jitsiUrl: booking.jitsiUrl,
          notes: booking.notes,
        }),
        location: locationFor(booking),
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        attendeeEmail: booking.guestEmail,
        uid: booking.id,
      });
      await prisma.booking.update({
        where: { id: booking.id },
        data: { calendarEventId: eventId },
      });
      result.bookings += 1;
    } catch (err) {
      console.error("[toucan:calendar] republish booking failed", booking.id, err);
      result.failed += 1;
    }
  }

  if (includeTimeBlocks) {
    const blocks = await prisma.hostTimeBlock.findMany({
      where: { hostId, endsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
    });

    for (const block of blocks) {
      try {
        const { eventId } = await adapter.createEvent({
          title: block.note || "Unavailable",
          description: `Blocked on ${APP_NAME}`,
          startsAt: block.startsAt,
          endsAt: block.endsAt,
          uid: block.id,
        });
        await prisma.hostTimeBlock.update({
          where: { id: block.id },
          data: { calendarEventId: eventId },
        });
        result.timeBlocks += 1;
      } catch (err) {
        console.error("[toucan:calendar] republish time block failed", block.id, err);
        result.failed += 1;
      }
    }
  }

  invalidateCachePrefix(`busy:${hostId}:`);
  return result;
}
