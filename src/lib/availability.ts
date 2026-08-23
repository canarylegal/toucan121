import {
  addDays,
  addMinutes,
  format,
  isBefore,
  setHours,
  setMinutes,
  startOfDay,
  subMinutes,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type WeeklyWindow = {
  /** 0 = Sunday … 6 = Saturday */
  day: number;
  start: string; // "09:00"
  end: string; // "17:00"
};

export type Slot = {
  startsAt: Date;
  endsAt: Date;
};

export type SlotCandidate = Slot & {
  available: boolean;
  reason?: "past" | "busy" | "outside";
};

/** How far ahead guests can book (rolling window from today). */
export const BOOKING_HORIZON_DAYS = 60;

/** Start-time grid for bookable slots (independent of meeting duration). */
export const SLOT_INTERVAL_MINS = 15;

function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Expand a meeting interval by before/after buffers for conflict checks.
 * Meeting length itself is unchanged — buffers only protect surrounding time.
 */
export function withBuffers(
  startsAt: Date,
  endsAt: Date,
  bufferBeforeMins = 0,
  bufferAfterMins = 0,
): { startsAt: Date; endsAt: Date } {
  const before = Math.max(0, bufferBeforeMins);
  const after = Math.max(0, bufferAfterMins);
  return {
    startsAt: before > 0 ? subMinutes(startsAt, before) : startsAt,
    endsAt: after > 0 ? addMinutes(endsAt, after) : endsAt,
  };
}

/** All windowed candidates with availability flags (for calendar UI). */
export function generateSlotCandidates(opts: {
  timezone: string;
  durationMins: number;
  windows: WeeklyWindow[];
  daysAhead?: number;
  busy?: { startsAt: Date; endsAt: Date }[];
  /** Minutes blocked before each candidate (Calendly-style). */
  bufferBeforeMins?: number;
  /** Minutes blocked after each candidate. */
  bufferAfterMins?: number;
  now?: Date;
  /**
   * Host-initiated booking: offer starts every SLOT_INTERVAL_MINS across
   * each day, ignoring weekly availability windows. Busy bookings still block.
   */
  ignoreAvailabilityWindows?: boolean;
}): SlotCandidate[] {
  const {
    timezone,
    durationMins,
    windows,
    daysAhead = BOOKING_HORIZON_DAYS,
    busy = [],
    bufferBeforeMins = 0,
    bufferAfterMins = 0,
    now = new Date(),
    ignoreAvailabilityWindows = false,
  } = opts;

  const candidates: SlotCandidate[] = [];
  const nowZoned = toZonedTime(now, timezone);

  for (let d = 0; d < daysAhead; d++) {
    const dayLocal = startOfDay(addDays(nowZoned, d));
    const dow = dayLocal.getDay();
    const dayWindows = ignoreAvailabilityWindows
      ? [{ day: dow, start: "00:00", end: "24:00" }]
      : windows.filter((w) => w.day === dow);

    for (const window of dayWindows) {
      const [sh, sm] = window.start.split(":").map(Number);
      const [eh, em] = window.end.split(":").map(Number);
      let cursor = setMinutes(setHours(dayLocal, sh ?? 0), sm ?? 0);
      const windowEnd =
        eh === 24 && (em ?? 0) === 0
          ? addDays(dayLocal, 1)
          : setMinutes(setHours(dayLocal, eh ?? 0), em ?? 0);

      while (addMinutes(cursor, durationMins) <= windowEnd) {
        const startsLocal = cursor;
        const endsLocal = addMinutes(cursor, durationMins);
        const startsAt = fromZonedTime(startsLocal, timezone);
        const endsAt = fromZonedTime(endsLocal, timezone);
        const footprint = withBuffers(
          startsAt,
          endsAt,
          bufferBeforeMins,
          bufferAfterMins,
        );

        const past = !isBefore(now, startsAt);
        const conflict = busy.some((b) =>
          overlaps(
            footprint.startsAt,
            footprint.endsAt,
            b.startsAt,
            b.endsAt,
          ),
        );

        candidates.push({
          startsAt,
          endsAt,
          available: !past && !conflict,
          reason: past ? "past" : conflict ? "busy" : undefined,
        });
        cursor = addMinutes(cursor, SLOT_INTERVAL_MINS);
      }
    }
  }

  return candidates;
}

/** Generate bookable slots in the host timezone for the next N days. */
export function generateSlots(opts: {
  timezone: string;
  durationMins: number;
  windows: WeeklyWindow[];
  daysAhead?: number;
  busy?: { startsAt: Date; endsAt: Date }[];
  bufferBeforeMins?: number;
  bufferAfterMins?: number;
  now?: Date;
  ignoreAvailabilityWindows?: boolean;
}): Slot[] {
  return generateSlotCandidates(opts)
    .filter((c) => c.available)
    .map(({ startsAt, endsAt }) => ({ startsAt, endsAt }));
}

export function formatSlotLabel(startsAt: Date, timezone: string): string {
  const local = toZonedTime(startsAt, timezone);
  return format(local, "EEE d MMM · HH:mm");
}

export function formatSlotTime(startsAt: Date, timezone: string): string {
  const local = toZonedTime(startsAt, timezone);
  return format(local, "HH:mm");
}

export function dayKeyInZone(date: Date, timezone: string): string {
  return format(toZonedTime(date, timezone), "yyyy-MM-dd");
}

export function parseIsoOrThrow(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid datetime: ${value}`);
  }
  return d;
}

export function parseAvailabilityJson(raw: string): WeeklyWindow[] {
  try {
    const parsed = JSON.parse(raw) as WeeklyWindow[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/** Helper for seed/demo: Mon–Fri 09:00–17:00 */
export const DEFAULT_WEEKDAY_WINDOWS: WeeklyWindow[] = [1, 2, 3, 4, 5].map(
  (day) => ({ day, start: "09:00", end: "17:00" }),
);

export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
