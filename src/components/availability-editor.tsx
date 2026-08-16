"use client";

import { useMemo, useState } from "react";
import type { WeeklyWindow } from "@/lib/availability";
import { DAY_LABELS } from "@/lib/availability";

type DayRow = {
  enabled: boolean;
  start: string;
  end: string;
};

function windowsToRows(windows: WeeklyWindow[]): DayRow[] {
  return Array.from({ length: 7 }, (_, day) => {
    const match = windows.find((w) => w.day === day);
    return {
      enabled: Boolean(match),
      start: match?.start ?? "09:00",
      end: match?.end ?? "17:00",
    };
  });
}

function normalizeTime(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)/);
  if (!match) return value;
  return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}

function rowsToWindows(rows: DayRow[]): WeeklyWindow[] {
  return rows
    .map((row, day) =>
      row.enabled
        ? {
            day,
            start: normalizeTime(row.start),
            end: normalizeTime(row.end),
          }
        : null,
    )
    .filter((w): w is WeeklyWindow => w !== null);
}

/** Mon–Sun display order (store still uses 0=Sun). */
const DISPLAY_DAYS = [1, 2, 3, 4, 5, 6, 0];

export function AvailabilityEditor({
  initialWindows,
}: {
  initialWindows: WeeklyWindow[];
}) {
  const [rows, setRows] = useState(() => windowsToRows(initialWindows));
  const json = useMemo(
    () => JSON.stringify(rowsToWindows(rows)),
    [rows],
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Weekly availability</p>
        <p className="text-xs text-muted">
          Times are in your host timezone. Guests only see open slots inside
          these windows.
        </p>
      </div>
      <input type="hidden" name="availabilityJson" value={json} />
      <ul className="space-y-2">
        {DISPLAY_DAYS.map((day) => {
          const row = rows[day]!;
          return (
            <li
              key={day}
              className="grid grid-cols-[7rem_1fr] items-center gap-3 rounded-md border border-line bg-white px-3 py-2 sm:grid-cols-[8rem_auto_auto_auto] sm:gap-4"
            >
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setRows((prev) =>
                      prev.map((r, i) =>
                        i === day ? { ...r, enabled } : r,
                      ),
                    );
                  }}
                />
                {DAY_LABELS[day]}
              </label>
              <div className="col-span-1 flex flex-wrap items-center gap-2 sm:col-span-3">
                <input
                  type="time"
                  value={row.start}
                  disabled={!row.enabled}
                  onChange={(e) => {
                    const start = e.target.value;
                    setRows((prev) =>
                      prev.map((r, i) =>
                        i === day ? { ...r, start } : r,
                      ),
                    );
                  }}
                  className="rounded-md border border-line px-2 py-1 text-sm disabled:opacity-40"
                />
                <span className="text-sm text-muted">to</span>
                <input
                  type="time"
                  value={row.end}
                  disabled={!row.enabled}
                  onChange={(e) => {
                    const end = e.target.value;
                    setRows((prev) =>
                      prev.map((r, i) => (i === day ? { ...r, end } : r)),
                    );
                  }}
                  className="rounded-md border border-line px-2 py-1 text-sm disabled:opacity-40"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
