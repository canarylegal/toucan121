"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export type BookingSlotCandidate = {
  value: string;
  dayKey: string;
  timeLabel: string;
  available: boolean;
};

function parseDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d);
}

export function SlotCalendarPicker({
  timezone,
  candidates,
  value,
  onChange,
  showTimeSlots = true,
  interactive = true,
  emptyMessage = "No open slots in the next four weeks for this meeting type.",
}: {
  timezone: string;
  candidates: BookingSlotCandidate[];
  value: string;
  onChange: (iso: string) => void;
  /** When false, only the month grid is shown (overview / pick a type first). */
  showTimeSlots?: boolean;
  /** When false, month/day controls are disabled (preview only). */
  interactive?: boolean;
  emptyMessage?: string;
}) {
  const availableDays = useMemo(() => {
    const set = new Set<string>();
    for (const c of candidates) {
      if (c.available) set.add(c.dayKey);
    }
    return set;
  }, [candidates]);

  const firstAvailableDay = useMemo(() => {
    const hit = candidates.find((c) => c.available);
    return hit?.dayKey ?? null;
  }, [candidates]);

  const [month, setMonth] = useState(() =>
    firstAvailableDay
      ? startOfMonth(parseDayKey(firstAvailableDay))
      : new Date(),
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(
    interactive ? firstAvailableDay : null,
  );

  const daySlots = useMemo(() => {
    if (!selectedDay) return [];
    return candidates.filter((c) => c.dayKey === selectedDay);
  }, [candidates, selectedDay]);

  const selectedDayDate = selectedDay ? parseDayKey(selectedDay) : null;

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const hasAnyAvailable = candidates.some((c) => c.available);

  if (!hasAnyAvailable) {
    return <p className="text-muted">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">
            {format(month, "MMMM yyyy")}
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!interactive}
              className="rounded-md border border-line px-2 py-1 text-sm hover:bg-accent-soft disabled:pointer-events-none disabled:opacity-50"
              onClick={() => setMonth((m) => addMonths(m, -1))}
              aria-label="Previous month"
            >
              ←
            </button>
            <button
              type="button"
              disabled={!interactive}
              className="rounded-md border border-line px-2 py-1 text-sm hover:bg-accent-soft disabled:pointer-events-none disabled:opacity-50"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
            >
              →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-1 font-medium">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, month);
            const hasOpen = availableDays.has(key);
            const selected = selectedDay === key;
            const isToday = isSameDay(day, new Date());

            return (
              <button
                key={key}
                type="button"
                disabled={!interactive || !hasOpen}
                onClick={() => {
                  if (!interactive || !hasOpen) return;
                  setSelectedDay(key);
                  onChange("");
                }}
                className={[
                  "aspect-square rounded-md text-sm transition",
                  !inMonth ? "text-muted/40" : "",
                  !hasOpen
                    ? "cursor-not-allowed bg-black/[0.03] text-muted/50"
                    : !interactive
                      ? "cursor-default bg-accent-soft/50 font-medium text-foreground"
                      : selected
                        ? "bg-accent font-semibold text-white"
                        : "bg-accent-soft/70 font-medium text-foreground hover:bg-accent-soft",
                  isToday && !selected ? "ring-1 ring-accent/40" : "",
                ].join(" ")}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">
          Times in {timezone}. Grey days have no open slots.
        </p>
      </div>

      {showTimeSlots && selectedDay && selectedDayDate ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">
            {format(selectedDayDate, "EEEE d MMMM")}
          </h3>
          {daySlots.length === 0 ? (
            <p className="text-sm text-muted">
              No bookable times on this day (outside working hours).
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {daySlots.map((slot) => {
                const selected = value === slot.value;
                if (!slot.available) {
                  return (
                    <div
                      key={slot.value}
                      className="rounded-md border border-transparent bg-black/[0.04] px-2 py-2 text-center text-sm text-muted/50 line-through"
                      title="Unavailable"
                    >
                      {slot.timeLabel}
                    </div>
                  );
                }
                return (
                  <button
                    key={slot.value}
                    type="button"
                    onClick={() => onChange(slot.value)}
                    className={[
                      "rounded-md border px-2 py-2 text-sm font-medium transition",
                      selected
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-white hover:border-accent hover:bg-accent-soft",
                    ].join(" ")}
                  >
                    {slot.timeLabel}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {!showTimeSlots && interactive ? (
        <p className="text-sm text-muted">
          Choose a meeting type to see bookable times.
        </p>
      ) : null}
    </div>
  );
}

