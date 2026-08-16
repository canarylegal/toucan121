"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  busyRangeKeysForView,
  groupItemsIntoWeekDays,
  itemOverlapsDay,
  type ScheduleItem,
} from "@/lib/host-schedule-shared";
import { APP_NAME } from "@/lib/brand";
import {
  setScheduleViewAction,
  type ScheduleViewMode,
} from "@/lib/schedule-view-actions";
import { deleteTimeBlockAction } from "@/lib/time-block-actions";
import { ScheduleTimeGrid } from "@/components/schedule-time-grid";

function parseDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d);
}

function sourceBadge(source: ScheduleItem["source"]) {
  if (source === "booking") {
    return {
      label: APP_NAME,
      className:
        "rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent",
    };
  }
  if (source === "block") {
    return {
      label: "Blocked",
      className:
        "rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900",
    };
  }
  return {
    label: "Busy",
    className:
      "rounded bg-line/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted",
  };
}

function chipClass(source: ScheduleItem["source"]) {
  if (source === "booking") return "bg-accent-soft text-accent";
  if (source === "block") return "bg-amber-100 text-amber-950";
  return "bg-black/[0.06] text-muted";
}

function ItemRow({ item }: { item: ScheduleItem }) {
  const [pending, startTransition] = useTransition();
  const badge = sourceBadge(item.source);

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 border-b border-line py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium sm:text-base">
          <span className="tabular-nums text-muted">
            {item.timeLabel}–{item.endTimeLabel}
          </span>{" "}
          {item.title}
        </p>
        {item.subtitle ? (
          <p className="mt-0.5 text-sm text-muted">{item.subtitle}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={badge.className}>{badge.label}</span>
        {item.bookingId && item.status !== "CANCELLED" ? (
          <Link
            href={`/dash/bookings/${item.bookingId}/reschedule`}
            className="text-xs font-medium text-accent underline sm:text-sm"
          >
            Reschedule
          </Link>
        ) : null}
        {item.timeBlockId ? (
          <button
            type="button"
            disabled={pending}
            className="text-xs font-medium text-red-700 underline disabled:opacity-60 sm:text-sm"
            onClick={() => {
              startTransition(async () => {
                const fd = new FormData();
                fd.set("id", item.timeBlockId!);
                await deleteTimeBlockAction(fd);
              });
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
    </li>
  );
}

const VIEW_OPTIONS: { id: ScheduleViewMode; label: string }[] = [
  { id: "DAY", label: "Day" },
  { id: "WEEK", label: "Week" },
  { id: "MONTH", label: "Month" },
  { id: "LIST", label: "List" },
];

const MONTH_CHIPS = 3;

export function HostScheduleView({
  timezone,
  initialView,
  initialFocusKey,
  weekStartKey,
  monthKey,
  weekDays,
  items,
  syncsToCalendar,
}: {
  timezone: string;
  initialView: ScheduleViewMode;
  /** yyyy-MM-dd focus day */
  initialFocusKey: string;
  weekStartKey: string;
  monthKey: string;
  weekDays: { dayKey: string; label: string; items: ScheduleItem[] }[];
  items: ScheduleItem[];
  syncsToCalendar?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<ScheduleViewMode>(initialView);
  const [selectedDay, setSelectedDay] = useState(initialFocusKey);
  const [externalItems, setExternalItems] = useState<ScheduleItem[]>([]);
  const [externalLoading, setExternalLoading] = useState(Boolean(syncsToCalendar));
  const [externalError, setExternalError] = useState<string | null>(null);

  const [month, setMonth] = useState(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return startOfMonth(new Date(y!, (m ?? 1) - 1, 1));
  });

  useEffect(() => {
    if (!syncsToCalendar) {
      setExternalItems([]);
      setExternalLoading(false);
      setExternalError(null);
      return;
    }

    const { startKey, endKeyExclusive } = busyRangeKeysForView({
      view,
      dayKey: selectedDay,
      weekStartKey,
      monthKey,
    });

    let cancelled = false;
    setExternalLoading(true);
    setExternalError(null);

    fetch(
      `/api/host/schedule-busy?start=${encodeURIComponent(startKey)}&end=${encodeURIComponent(endKeyExclusive)}`,
    )
      .then(async (res) => {
        const data = (await res.json()) as {
          items?: ScheduleItem[];
          error?: string | null;
        };
        if (cancelled) return;
        if (!res.ok) {
          setExternalItems([]);
          setExternalError(data.error || "Could not load external calendar");
          return;
        }
        setExternalItems(data.items ?? []);
        setExternalError(data.error ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setExternalItems([]);
          setExternalError("Could not load external calendar");
        }
      })
      .finally(() => {
        if (!cancelled) setExternalLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [syncsToCalendar, view, selectedDay, weekStartKey, monthKey]);

  const mergedItems = useMemo(() => {
    const map = new Map<string, ScheduleItem>();
    for (const it of items) map.set(it.id, it);
    for (const it of externalItems) map.set(it.id, it);
    return [...map.values()].sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  }, [items, externalItems]);

  const mergedWeekDays = useMemo(() => {
    if (view !== "WEEK") return weekDays;
    return groupItemsIntoWeekDays(weekStartKey, mergedItems, timezone);
  }, [view, weekStartKey, mergedItems, weekDays, timezone]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const dayItems = useMemo(
    () =>
      mergedItems.filter((it) => itemOverlapsDay(it, selectedDay, timezone)),
    [mergedItems, selectedDay, timezone],
  );

  const dayGridDays = useMemo(() => {
    const [y, m, d] = selectedDay.split("-").map(Number);
    const label = new Date(
      Date.UTC(y!, m! - 1, d!, 12, 0, 0),
    ).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    return [{ dayKey: selectedDay, label, items: dayItems }];
  }, [selectedDay, dayItems]);

  const listItems = mergedItems;

  function navigate(params: {
    view?: ScheduleViewMode;
    day?: string;
    week?: string;
    month?: string;
  }) {
    const nextView = params.view ?? view;
    const sp = new URLSearchParams();
    sp.set("view", nextView);
    if (nextView === "DAY") sp.set("day", params.day ?? selectedDay);
    if (nextView === "WEEK") sp.set("week", params.week ?? weekStartKey);
    if (nextView === "MONTH" || nextView === "LIST") {
      sp.set("month", params.month ?? monthKey);
    }
    router.push(`/dash/schedule?${sp.toString()}`);
  }

  function switchView(next: ScheduleViewMode) {
    setView(next);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("view", next);
      await setScheduleViewAction(fd);
      navigate({ view: next });
    });
  }

  function goMonth(delta: number) {
    const next = addMonths(month, delta);
    setMonth(next);
    navigate({
      view: "MONTH",
      month: format(next, "yyyy-MM"),
    });
  }

  function shiftDay(delta: number) {
    const [y, m, d] = selectedDay.split("-").map(Number);
    const date = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
    date.setUTCDate(date.getUTCDate() + delta);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    setSelectedDay(key);
    navigate({ view: "DAY", day: key });
  }

  function shiftWeek(delta: number) {
    const [y, m, d] = weekStartKey.split("-").map(Number);
    const date = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
    date.setUTCDate(date.getUTCDate() + delta * 7);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    navigate({ view: "WEEK", week: key });
  }

  function openDay(dayKey: string) {
    setSelectedDay(dayKey);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("view", "DAY");
      await setScheduleViewAction(fd);
      router.push(`/dash/schedule?view=DAY&day=${dayKey}`);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-md border border-line bg-white p-1"
          role="tablist"
          aria-label="Schedule view"
        >
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={view === opt.id}
              disabled={pending}
              onClick={() => switchView(opt.id)}
              className={[
                "rounded px-3 py-1.5 text-sm font-medium transition",
                view === opt.id
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          Times in {timezone}
          {externalLoading ? " · loading calendar…" : ""}
        </p>
      </div>

      {externalError ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          External calendar unavailable: {externalError}. Showing Toucan
          bookings and blocks only.
        </p>
      ) : null}

      {view === "MONTH" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold sm:text-xl">
              {format(month, "MMMM yyyy")}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-accent-soft"
                onClick={() => goMonth(-1)}
                aria-label="Previous month"
              >
                ←
              </button>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-accent-soft"
                onClick={() => goMonth(1)}
                aria-label="Next month"
              >
                →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line text-center text-xs font-medium uppercase tracking-wide text-muted">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="bg-panel py-2">
                {d}
              </div>
            ))}
            {monthDays.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const inMonth = isSameMonth(day, month);
              const isToday = isSameDay(day, new Date());
              const dayEvents = mergedItems.filter((it) =>
                itemOverlapsDay(it, key, timezone),
              );
              const shown = dayEvents.slice(0, MONTH_CHIPS);
              const more = dayEvents.length - shown.length;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => openDay(key)}
                  className={[
                    "flex min-h-[6.5rem] flex-col gap-0.5 bg-white p-1.5 text-left transition hover:bg-accent-soft/40 sm:min-h-[7.5rem]",
                    !inMonth ? "bg-black/[0.02] text-muted/45" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-sm",
                      isToday
                        ? "bg-accent font-semibold text-white"
                        : "font-medium",
                    ].join(" ")}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="mt-0.5 flex w-full flex-col gap-0.5 overflow-hidden">
                    {shown.map((item) => (
                      <span
                        key={item.id}
                        className={[
                          "truncate rounded px-1 py-0.5 text-[10px] leading-tight",
                          chipClass(item.source),
                        ].join(" ")}
                        title={`${item.timeLabel} ${item.title}`}
                      >
                        <span className="tabular-nums">{item.timeLabel}</span>{" "}
                        {item.title}
                      </span>
                    ))}
                    {more > 0 ? (
                      <span className="px-1 text-[10px] text-muted">
                        +{more} more
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {view === "WEEK" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold sm:text-xl">Week</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-accent-soft"
                onClick={() => shiftWeek(-1)}
              >
                ←
              </button>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-accent-soft"
                onClick={() => shiftWeek(1)}
              >
                →
              </button>
            </div>
          </div>
          <ScheduleTimeGrid
            timezone={timezone}
            days={mergedWeekDays}
            syncsToCalendar={syncsToCalendar}
          />
        </div>
      ) : null}

      {view === "DAY" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold sm:text-xl">
              {format(parseDayKey(selectedDay), "EEEE d MMMM yyyy")}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-accent-soft"
                onClick={() => shiftDay(-1)}
              >
                ←
              </button>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-accent-soft"
                onClick={() => shiftDay(1)}
              >
                →
              </button>
            </div>
          </div>
          <ScheduleTimeGrid
            timezone={timezone}
            days={dayGridDays}
            syncsToCalendar={syncsToCalendar}
          />
        </div>
      ) : null}

      {view === "LIST" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold sm:text-xl">Upcoming</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-accent-soft"
                onClick={() =>
                  navigate({
                    view: "LIST",
                    month: format(
                      addMonths(parseDayKey(`${monthKey}-01`), -1),
                      "yyyy-MM",
                    ),
                  })
                }
              >
                ←
              </button>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-accent-soft"
                onClick={() =>
                  navigate({
                    view: "LIST",
                    month: format(
                      addMonths(parseDayKey(`${monthKey}-01`), 1),
                      "yyyy-MM",
                    ),
                  })
                }
              >
                →
              </button>
            </div>
          </div>
          {listItems.length === 0 ? (
            <p className="text-muted">
              {externalLoading ? "Loading…" : "Nothing in this period."}
            </p>
          ) : (
            <ul>
              {listItems.map((item) => (
                <li key={item.id}>
                  <p className="border-b border-transparent pt-3 text-xs text-muted first:pt-0">
                    {format(parseDayKey(item.dayKey), "EEE d MMM")}
                  </p>
                  <ItemRow item={item} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
