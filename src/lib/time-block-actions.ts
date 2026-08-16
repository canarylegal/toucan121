"use server";

import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";
import { requireHost } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { getHostWriteAdapter } from "@/lib/calendar/host-calendar";
import { APP_NAME } from "@/lib/brand";
import { invalidateCachePrefix } from "@/lib/ttl-cache";

const MAX_BLOCK_MS = 14 * 24 * 60 * 60 * 1000;

function parseDayTime(dayKey: string, time: string, timezone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    throw new Error("Invalid day");
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error("Invalid time");
  }
  const tz = timezone?.trim() || "UTC";
  const date = fromZonedTime(`${dayKey}T${time}:00`, tz);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Could not resolve time");
  }
  return date;
}

function normalizeRange(startsAt: Date, endsAt: Date) {
  if (endsAt <= startsAt) {
    throw new Error("End time must be after start time");
  }
  if (endsAt.getTime() - startsAt.getTime() > MAX_BLOCK_MS) {
    throw new Error("Block cannot exceed 14 days");
  }
}

/** Reject blocks that overlap PENDING/CONFIRMED bookings. */
async function assertNoBookingClash(opts: {
  hostId: string;
  startsAt: Date;
  endsAt: Date;
}) {
  const conflict = await prisma.booking.findFirst({
    where: {
      hostId: opts.hostId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startsAt: { lt: opts.endsAt },
      endsAt: { gt: opts.startsAt },
    },
    select: {
      id: true,
      startsAt: true,
      meetingType: { select: { title: true } },
    },
  });
  if (conflict) {
    throw new Error(
      `That time overlaps an existing booking (${conflict.meetingType.title}). Choose a free slot.`,
    );
  }
}

async function hostHasExternalWriteCalendar(hostId: string): Promise<boolean> {
  const conn = await prisma.calendarConnection.findFirst({
    where: { hostId, writeTarget: true },
    select: { provider: true },
  });
  return conn?.provider === "CALDAV" || conn?.provider === "OUTLOOK" || conn?.provider === "GOOGLE";
}

async function syncCalendarEvent(opts: {
  hostId: string;
  blockId: string;
  note: string;
  startsAt: Date;
  endsAt: Date;
  previousEventId: string | null;
}): Promise<string | null> {
  if (!(await hostHasExternalWriteCalendar(opts.hostId))) {
    return opts.previousEventId;
  }
  try {
    const adapter = await getHostWriteAdapter(opts.hostId);
    if (opts.previousEventId) {
      try {
        await adapter.cancelEvent(opts.previousEventId);
      } catch (err) {
        console.error("[toucan:time-block] calendar cancel failed", err);
      }
    }
    const { eventId } = await adapter.createEvent({
      title: opts.note || "Unavailable",
      description: `Blocked on ${APP_NAME}`,
      startsAt: opts.startsAt,
      endsAt: opts.endsAt,
      uid: opts.blockId,
    });
    return eventId;
  } catch (err) {
    console.error("[toucan:time-block] calendar write failed", err);
    return null;
  }
}

export async function createTimeBlockAction(formData: FormData) {
  const host = await requireHost();
  const startDayKey = String(formData.get("dayKey") ?? formData.get("startDayKey") ?? "");
  const endDayKey = String(formData.get("endDayKey") ?? startDayKey);
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);

  const startsAt = parseDayTime(startDayKey, startTime, host.timezone);
  const endsAt = parseDayTime(endDayKey, endTime, host.timezone);
  normalizeRange(startsAt, endsAt);
  await assertNoBookingClash({ hostId: host.id, startsAt, endsAt });

  const block = await prisma.hostTimeBlock.create({
    data: {
      hostId: host.id,
      startsAt,
      endsAt,
      note,
    },
  });

  const calendarEventId = await syncCalendarEvent({
    hostId: host.id,
    blockId: block.id,
    note,
    startsAt,
    endsAt,
    previousEventId: null,
  });
  if (calendarEventId) {
    await prisma.hostTimeBlock.update({
      where: { id: block.id },
      data: { calendarEventId },
    });
  }

  invalidateCachePrefix(`busy:${host.id}:`);
  revalidatePath("/dash/schedule");
}

export async function updateTimeBlockAction(formData: FormData) {
  const host = await requireHost();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing block id");

  const startDayKey = String(formData.get("startDayKey") ?? "");
  const endDayKey = String(formData.get("endDayKey") ?? startDayKey);
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");

  const block = await prisma.hostTimeBlock.findFirst({
    where: { id, hostId: host.id },
  });
  if (!block) throw new Error("Block not found");

  const startsAt = parseDayTime(startDayKey, startTime, host.timezone);
  const endsAt = parseDayTime(endDayKey, endTime, host.timezone);
  normalizeRange(startsAt, endsAt);
  await assertNoBookingClash({ hostId: host.id, startsAt, endsAt });

  const calendarEventId = await syncCalendarEvent({
    hostId: host.id,
    blockId: block.id,
    note: block.note,
    startsAt,
    endsAt,
    previousEventId: block.calendarEventId,
  });

  await prisma.hostTimeBlock.update({
    where: { id: block.id },
    data: {
      startsAt,
      endsAt,
      ...(calendarEventId ? { calendarEventId } : {}),
    },
  });

  invalidateCachePrefix(`busy:${host.id}:`);
  revalidatePath("/dash/schedule");
}

export async function deleteTimeBlockAction(formData: FormData) {
  const host = await requireHost();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing block id");

  const block = await prisma.hostTimeBlock.findFirst({
    where: { id, hostId: host.id },
  });
  if (!block) throw new Error("Block not found");

  if (block.calendarEventId) {
    try {
      const adapter = await getHostWriteAdapter(host.id);
      await adapter.cancelEvent(block.calendarEventId);
    } catch (err) {
      console.error("[toucan:time-block] calendar cancel failed", err);
    }
  }

  await prisma.hostTimeBlock.delete({ where: { id: block.id } });
  invalidateCachePrefix(`busy:${host.id}:`);
  revalidatePath("/dash/schedule");
}
