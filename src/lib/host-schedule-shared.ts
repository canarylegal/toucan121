import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { format } from "date-fns";

/** Client-safe schedule types and pure helpers (no DB). */

export type ScheduleItem = {
  id: string;
  source: "booking" | "external" | "block";
  title: string;
  subtitle?: string;
  startsAt: string;
  endsAt: string;
  dayKey: string;
  timeLabel: string;
  endTimeLabel: string;
  status?: string;
  bookingId?: string;
  timeBlockId?: string;
};

export type ScheduleDay = {
  dayKey: string;
  label: string;
  items: ScheduleItem[];
};

/** Shift a yyyy-MM-dd by N weeks using UTC calendar math. */
export function shiftWeekStartKey(weekStartKey: string, weeks: number): string {
  const [y, m, d] = weekStartKey.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid week start: ${weekStartKey}`);
  }
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addCalendarDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, 1, 12, 0, 0));
  date.setUTCMonth(date.getUTCMonth() + delta);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0)).toLocaleDateString(
    undefined,
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    },
  );
}

export function dayKeyInTimezone(iso: string, timezone: string): string {
  return format(toZonedTime(new Date(iso), timezone), "yyyy-MM-dd");
}

export function timeHmInTimezone(iso: string, timezone: string): string {
  return format(toZonedTime(new Date(iso), timezone), "HH:mm");
}

export function itemOverlapsDay(
  item: { startsAt: string; endsAt: string },
  dayKey: string,
  timezone: string,
): boolean {
  const dayStart = fromZonedTime(`${dayKey}T00:00:00`, timezone);
  const dayEnd = fromZonedTime(
    `${addCalendarDays(dayKey, 1)}T00:00:00`,
    timezone,
  );
  const start = new Date(item.startsAt).getTime();
  const end = new Date(item.endsAt).getTime();
  return start < dayEnd.getTime() && end > dayStart.getTime();
}

export function groupItemsIntoWeekDays(
  weekStartKey: string,
  items: ScheduleItem[],
  timezone: string,
): ScheduleDay[] {
  const days: ScheduleDay[] = [];
  for (let i = 0; i < 7; i++) {
    const dayKey = addCalendarDays(weekStartKey, i);
    days.push({
      dayKey,
      label: dayLabel(dayKey),
      items: items.filter((it) => itemOverlapsDay(it, dayKey, timezone)),
    });
  }
  return days;
}

/** Resolve start/end day keys for the schedule busy API from the active view. */
export function busyRangeKeysForView(opts: {
  view: "DAY" | "WEEK" | "MONTH" | "LIST";
  dayKey: string;
  weekStartKey: string;
  monthKey: string;
}): { startKey: string; endKeyExclusive: string } {
  if (opts.view === "DAY") {
    return {
      startKey: opts.dayKey,
      endKeyExclusive: addCalendarDays(opts.dayKey, 1),
    };
  }
  if (opts.view === "WEEK") {
    return {
      startKey: opts.weekStartKey,
      endKeyExclusive: shiftWeekStartKey(opts.weekStartKey, 1),
    };
  }
  const startKey = addCalendarDays(`${opts.monthKey}-01`, -7);
  const nextMonth = shiftMonthKey(opts.monthKey, 1);
  const endKeyExclusive = addCalendarDays(`${nextMonth}-01`, 7);
  return { startKey, endKeyExclusive };
}
