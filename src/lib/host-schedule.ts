import { format, startOfWeek } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { dayKeyInZone, formatSlotTime } from "@/lib/availability";
import { getHostExternalBusy } from "@/lib/calendar/host-calendar";
import {
  addCalendarDays,
  groupItemsIntoWeekDays,
  shiftMonthKey,
  shiftWeekStartKey,
  type ScheduleItem,
} from "@/lib/host-schedule-shared";

export type { ScheduleItem, ScheduleDay } from "@/lib/host-schedule-shared";
export {
  addCalendarDays,
  busyRangeKeysForView,
  groupItemsIntoWeekDays,
  shiftMonthKey,
  shiftWeekStartKey,
} from "@/lib/host-schedule-shared";

export function rangeInZone(
  startKey: string,
  endKeyExclusive: string,
  timezone: string,
) {
  const tz = timezone?.trim() || "UTC";
  const rangeStart = fromZonedTime(`${startKey}T00:00:00.000`, tz);
  const rangeEnd = fromZonedTime(`${endKeyExclusive}T00:00:00.000`, tz);
  if (
    Number.isNaN(rangeStart.getTime()) ||
    Number.isNaN(rangeEnd.getTime())
  ) {
    throw new Error(`Could not resolve range ${startKey}–${endKeyExclusive} in ${tz}`);
  }
  return { rangeStart, rangeEnd };
}

export function currentWeekStartKey(timezone: string, now = new Date()): string {
  const tz = timezone?.trim() || "UTC";
  const local = toZonedTime(now, tz);
  const monday = startOfWeek(local, { weekStartsOn: 1 });
  return format(monday, "yyyy-MM-dd");
}

export function currentMonthKey(timezone: string, now = new Date()): string {
  const tz = timezone?.trim() || "UTC";
  const local = toZonedTime(now, tz);
  return format(local, "yyyy-MM");
}

export function currentDayKey(timezone: string, now = new Date()): string {
  const tz = timezone?.trim() || "UTC";
  return format(toZonedTime(now, tz), "yyyy-MM-dd");
}

export function shiftDayKey(dayKey: string, days: number): string {
  return addCalendarDays(dayKey, days);
}

/** Toucan bookings + time blocks only (fast). External busy loads separately. */
async function getHostLocalScheduleInRange(opts: {
  hostId: string;
  timezone: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<ScheduleItem[]> {
  const { rangeStart, rangeEnd } = opts;

  const [bookings, timeBlocks] = await Promise.all([
    prisma.booking.findMany({
      where: {
        hostId: opts.hostId,
        NOT: { status: "CANCELLED" },
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
      },
      include: { meetingType: { select: { title: true } } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.hostTimeBlock.findMany({
      where: {
        hostId: opts.hostId,
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
      },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const items: ScheduleItem[] = [];

  for (const b of bookings) {
    const statusLabel =
      b.status === "PENDING"
        ? b.pendingOn === "GUEST"
          ? "awaiting guest"
          : "needs approval"
        : "confirmed";
    items.push({
      id: `booking-${b.id}`,
      source: "booking",
      title: b.guestName,
      subtitle: `${b.meetingType.title} · ${statusLabel}`,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      dayKey: dayKeyInZone(b.startsAt, opts.timezone),
      timeLabel: formatSlotTime(b.startsAt, opts.timezone),
      endTimeLabel: formatSlotTime(b.endsAt, opts.timezone),
      status: b.status,
      bookingId: b.id,
    });
  }

  for (const block of timeBlocks) {
    items.push({
      id: `block-${block.id}`,
      source: "block",
      title: block.note.trim() || "Unavailable",
      subtitle: "Time block",
      startsAt: block.startsAt.toISOString(),
      endsAt: block.endsAt.toISOString(),
      dayKey: dayKeyInZone(block.startsAt, opts.timezone),
      timeLabel: formatSlotTime(block.startsAt, opts.timezone),
      endTimeLabel: formatSlotTime(block.endsAt, opts.timezone),
      timeBlockId: block.id,
    });
  }

  items.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  return items;
}

/** External calendar busy as schedule items (skips windows already covered locally). */
export async function getHostExternalScheduleItems(opts: {
  hostId: string;
  timezone: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<{ items: ScheduleItem[]; error?: string }> {
  const { rangeStart, rangeEnd } = opts;

  const local = await getHostLocalScheduleInRange(opts);
  const ownedWindows = local.map((it) => ({
    start: new Date(it.startsAt).getTime(),
    end: new Date(it.endsAt).getTime(),
  }));

  let external: { startsAt: Date; endsAt: Date; title?: string }[] = [];
  try {
    external = await getHostExternalBusy({
      hostId: opts.hostId,
      rangeStart,
      rangeEnd,
    });
  } catch (err) {
    return {
      items: [],
      error:
        err instanceof Error ? err.message : "Could not load external calendar",
    };
  }

  const items: ScheduleItem[] = [];
  for (const block of external) {
    const s = block.startsAt.getTime();
    const e = block.endsAt.getTime();
    if (ownedWindows.some((w) => s < w.end && e > w.start)) continue;
    const start = block.startsAt < rangeStart ? rangeStart : block.startsAt;
    if (start >= rangeEnd) continue;
    items.push({
      id: `ext-${block.startsAt.toISOString()}-${block.endsAt.toISOString()}`,
      source: "external",
      title: block.title?.trim() || "Busy",
      subtitle: "External calendar",
      startsAt: block.startsAt.toISOString(),
      endsAt: block.endsAt.toISOString(),
      dayKey: dayKeyInZone(start, opts.timezone),
      timeLabel: formatSlotTime(block.startsAt, opts.timezone),
      endTimeLabel: formatSlotTime(block.endsAt, opts.timezone),
    });
  }

  items.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  return { items };
}

async function getHostScheduleInRange(opts: {
  hostId: string;
  timezone: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<{ items: ScheduleItem[] }> {
  const items = await getHostLocalScheduleInRange(opts);
  return { items };
}

export async function getHostWeekSchedule(opts: {
  hostId: string;
  timezone: string;
  weekStartKey: string;
}): Promise<{
  days: ReturnType<typeof groupItemsIntoWeekDays>;
  items: ScheduleItem[];
}> {
  const { rangeStart, rangeEnd } = rangeInZone(
    opts.weekStartKey,
    shiftWeekStartKey(opts.weekStartKey, 1),
    opts.timezone,
  );
  const { items } = await getHostScheduleInRange({
    hostId: opts.hostId,
    timezone: opts.timezone,
    rangeStart,
    rangeEnd,
  });

  return {
    days: groupItemsIntoWeekDays(opts.weekStartKey, items, opts.timezone),
    items,
  };
}

/** Load schedule items for a calendar month (and adjacent grid padding days). */
export async function getHostMonthSchedule(opts: {
  hostId: string;
  timezone: string;
  /** yyyy-MM */
  monthKey: string;
}): Promise<{ items: ScheduleItem[]; monthKey: string }> {
  if (!/^\d{4}-\d{2}$/.test(opts.monthKey)) {
    throw new Error(`Invalid month: ${opts.monthKey}`);
  }
  const startKey = `${opts.monthKey}-01`;
  const paddedStart = addCalendarDays(startKey, -7);
  const nextMonth = shiftMonthKey(opts.monthKey, 1);
  const paddedEnd = addCalendarDays(`${nextMonth}-01`, 7);

  const { rangeStart, rangeEnd } = rangeInZone(
    paddedStart,
    paddedEnd,
    opts.timezone,
  );
  const { items } = await getHostScheduleInRange({
    hostId: opts.hostId,
    timezone: opts.timezone,
    rangeStart,
    rangeEnd,
  });

  return { items, monthKey: opts.monthKey };
}

export async function getHostDaySchedule(opts: {
  hostId: string;
  timezone: string;
  dayKey: string;
}): Promise<{ items: ScheduleItem[]; dayKey: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.dayKey)) {
    throw new Error(`Invalid day: ${opts.dayKey}`);
  }
  const { rangeStart, rangeEnd } = rangeInZone(
    opts.dayKey,
    addCalendarDays(opts.dayKey, 1),
    opts.timezone,
  );
  const { items } = await getHostScheduleInRange({
    hostId: opts.hostId,
    timezone: opts.timezone,
    rangeStart,
    rangeEnd,
  });
  return { items, dayKey: opts.dayKey };
}

/** Upcoming list: from dayKey through +N days. */
export async function getHostListSchedule(opts: {
  hostId: string;
  timezone: string;
  fromDayKey: string;
  daysAhead?: number;
}): Promise<{ items: ScheduleItem[] }> {
  const ahead = opts.daysAhead ?? 28;
  const { rangeStart, rangeEnd } = rangeInZone(
    opts.fromDayKey,
    addCalendarDays(opts.fromDayKey, ahead),
    opts.timezone,
  );
  return getHostScheduleInRange({
    hostId: opts.hostId,
    timezone: opts.timezone,
    rangeStart,
    rangeEnd,
  });
}
