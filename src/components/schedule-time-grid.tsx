"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import {
  addCalendarDays,
  dayKeyInTimezone,
  timeHmInTimezone,
  type ScheduleItem,
} from "@/lib/host-schedule-shared";
import { APP_NAME } from "@/lib/brand";
import {
  createTimeBlockAction,
  deleteTimeBlockAction,
  updateTimeBlockAction,
} from "@/lib/time-block-actions";

const DEFAULT_START_MIN = 7 * 60;
const DEFAULT_END_MIN = 21 * 60;
const PX_PER_HOUR = 52;
const SNAP = 15;

function formatHm(totalMins: number): string {
  const h = Math.floor(totalMins / 60) % 24;
  const m = Math.round(totalMins % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function snapMins(mins: number): number {
  return Math.round(mins / SNAP) * SNAP;
}

function minutesInZone(iso: string, timezone: string): number {
  const local = toZonedTime(new Date(iso), timezone);
  return local.getHours() * 60 + local.getMinutes() + local.getSeconds() / 60;
}

function sourceStyles(source: ScheduleItem["source"]) {
  if (source === "booking") {
    return "border-accent/40 bg-accent-soft text-foreground";
  }
  if (source === "block") {
    return "border-amber-300/80 bg-amber-50 text-amber-950";
  }
  return "border-line bg-black/[0.04] text-muted";
}

type DraftBlock = {
  startDayKey: string;
  endDayKey: string;
  startTime: string;
  endTime: string;
};

type DragCreate = {
  startDayKey: string;
  endDayKey: string;
  startMins: number;
  endMins: number;
};

type ResizeEdge = "top" | "bottom" | "left" | "right";

type ResizeState = {
  itemId: string;
  timeBlockId: string;
  edge: ResizeEdge;
  startsAt: string;
  endsAt: string;
};

function draftFromRange(
  startDay: string,
  endDay: string,
  startMins: number,
  endMins: number,
): DraftBlock {
  let aDay = startDay;
  let bDay = endDay;
  let aMins = startMins;
  let bMins = endMins;
  const a = `${aDay}T${formatHm(aMins)}`;
  const b = `${bDay}T${formatHm(bMins)}`;
  if (b < a) {
    [aDay, bDay] = [bDay, aDay];
    [aMins, bMins] = [bMins, aMins];
  }
  if (aDay === bDay && bMins - aMins < SNAP) {
    bMins = Math.min(24 * 60, aMins + 60);
  }
  return {
    startDayKey: aDay,
    endDayKey: bDay,
    startTime: formatHm(aMins),
    endTime: formatHm(bMins >= 24 * 60 ? 23 * 60 + 45 : bMins),
  };
}

function rangeIso(draft: DraftBlock, timezone: string) {
  const start = fromZonedTime(
    `${draft.startDayKey}T${draft.startTime}:00`,
    timezone,
  );
  const end = fromZonedTime(`${draft.endDayKey}T${draft.endTime}:00`, timezone);
  return { start, end };
}

function segmentLayout(
  startsAt: Date,
  endsAt: Date,
  dayKey: string,
  timezone: string,
  gridStart: number,
  gridEnd: number,
  pxPerHour: number,
): { top: number; height: number } | null {
  const dayStart = fromZonedTime(`${dayKey}T00:00:00`, timezone);
  const dayEnd = fromZonedTime(
    `${addCalendarDays(dayKey, 1)}T00:00:00`,
    timezone,
  );
  const s = Math.max(startsAt.getTime(), dayStart.getTime());
  const e = Math.min(endsAt.getTime(), dayEnd.getTime());
  if (e <= s) return null;

  const startLocal = toZonedTime(new Date(s), timezone);
  const endLocal = toZonedTime(new Date(e), timezone);
  let startMins =
    startLocal.getHours() * 60 +
    startLocal.getMinutes() +
    startLocal.getSeconds() / 60;
  let endMins =
    endLocal.getHours() * 60 +
    endLocal.getMinutes() +
    endLocal.getSeconds() / 60;
  // Midnight end of exclusive dayEnd shows as 0:00 — treat as end of day
  if (e === dayEnd.getTime()) endMins = 24 * 60;

  startMins = Math.max(gridStart, Math.min(gridEnd, startMins));
  endMins = Math.max(gridStart, Math.min(gridEnd, endMins));
  if (endMins <= startMins) return null;

  return {
    top: ((startMins - gridStart) / 60) * pxPerHour,
    height: Math.max(16, ((endMins - startMins) / 60) * pxPerHour - 2),
  };
}

export function ScheduleTimeGrid({
  timezone,
  days,
  syncsToCalendar,
}: {
  timezone: string;
  days: { dayKey: string; label: string; items: ScheduleItem[] }[];
  syncsToCalendar?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<DraftBlock | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ScheduleItem | null>(null);
  const [createDrag, setCreateDrag] = useState<DragCreate | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, { startsAt: string; endsAt: string }>
  >({});
  const dragMoved = useRef(false);
  const columnRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const displayItems = useMemo(() => {
    const byDay = new Map<string, ScheduleItem[]>();
    for (const day of days) {
      const list = day.items.map((it) => {
        const o = localOverrides[it.id];
        return o ? { ...it, startsAt: o.startsAt, endsAt: o.endsAt } : it;
      });
      byDay.set(day.dayKey, list);
    }
    return byDay;
  }, [days, localOverrides]);

  const { gridStart, gridEnd, hours } = useMemo(() => {
    let start = DEFAULT_START_MIN;
    let end = DEFAULT_END_MIN;
    for (const day of days) {
      for (const item of day.items) {
        const o = localOverrides[item.id];
        const sIso = o?.startsAt ?? item.startsAt;
        const eIso = o?.endsAt ?? item.endsAt;
        if (dayKeyInTimezone(sIso, timezone) === day.dayKey) {
          start = Math.min(start, Math.floor(minutesInZone(sIso, timezone) / 60) * 60);
        }
        if (dayKeyInTimezone(eIso, timezone) === day.dayKey) {
          end = Math.max(end, Math.ceil(minutesInZone(eIso, timezone) / 60) * 60);
        }
      }
    }
    start = Math.max(0, start);
    end = Math.min(24 * 60, Math.max(start + 60, end));
    const list: number[] = [];
    for (let m = start; m < end; m += 60) list.push(m);
    return { gridStart: start, gridEnd: end, hours: list };
  }, [days, timezone, localOverrides]);

  const totalMins = gridEnd - gridStart;
  const heightPx = (totalMins / 60) * PX_PER_HOUR;

  function dayUnderPointer(clientX: number, clientY: number): string | null {
    for (const [dayKey, el] of columnRefs.current) {
      const rect = el.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return dayKey;
      }
    }
    // Fallback: nearest column by X
    let best: string | null = null;
    let bestDist = Infinity;
    for (const [dayKey, el] of columnRefs.current) {
      const rect = el.getBoundingClientRect();
      const mid = (rect.left + rect.right) / 2;
      const dist = Math.abs(clientX - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = dayKey;
      }
    }
    return best;
  }

  function yToMins(clientY: number, dayKey: string): number {
    const el = columnRefs.current.get(dayKey);
    if (!el) return gridStart;
    const rect = el.getBoundingClientRect();
    const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    const raw = gridStart + (y / rect.height) * totalMins;
    return Math.min(gridEnd, Math.max(gridStart, snapMins(raw)));
  }

  function openDraft(next: DraftBlock) {
    setDraft(next);
    setNote("");
    setError(null);
    setSelected(null);
    setCreateDrag(null);
  }

  function onCreatePointerDown(
    e: React.PointerEvent<HTMLDivElement>,
    dayKey: string,
  ) {
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragMoved.current = false;
    const mins = yToMins(e.clientY, dayKey);
    setCreateDrag({
      startDayKey: dayKey,
      endDayKey: dayKey,
      startMins: mins,
      endMins: mins,
    });
    setSelected(null);
  }

  function onCreatePointerMove(
    e: React.PointerEvent<HTMLDivElement>,
    dayKey: string,
  ) {
    if (!createDrag) return;
    const over = dayUnderPointer(e.clientX, e.clientY) ?? dayKey;
    const mins = yToMins(e.clientY, over);
    if (
      over !== createDrag.startDayKey ||
      Math.abs(mins - createDrag.startMins) >= SNAP
    ) {
      dragMoved.current = true;
    }
    setCreateDrag({
      ...createDrag,
      endDayKey: over,
      endMins: mins,
    });
  }

  function onCreatePointerUp(
    e: React.PointerEvent<HTMLDivElement>,
    dayKey: string,
  ) {
    if (!createDrag) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const over = dayUnderPointer(e.clientX, e.clientY) ?? dayKey;
    const mins = yToMins(e.clientY, over);
    const next = draftFromRange(
      createDrag.startDayKey,
      over,
      createDrag.startMins,
      mins,
    );
    setCreateDrag(null);
    if (dragMoved.current) {
      openDraft(next);
    }
  }

  function beginResize(
    e: React.PointerEvent,
    item: ScheduleItem,
    edge: ResizeEdge,
  ) {
    if (!item.timeBlockId) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setResize({
      itemId: item.id,
      timeBlockId: item.timeBlockId,
      edge,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
    });
    setSelected(item);
    setDraft(null);
  }

  function onResizeMove(e: React.PointerEvent) {
    if (!resize) return;
    const over = dayUnderPointer(e.clientX, e.clientY);
    if (!over) return;
    const mins = yToMins(e.clientY, over);
    const startDay = dayKeyInTimezone(resize.startsAt, timezone);
    const endDay = dayKeyInTimezone(resize.endsAt, timezone);
    const startHm = timeHmInTimezone(resize.startsAt, timezone);
    const endHm = timeHmInTimezone(resize.endsAt, timezone);

    let nextStartDay = startDay;
    let nextEndDay = endDay;
    let nextStartHm = startHm;
    let nextEndHm = endHm;

    if (resize.edge === "top") {
      nextStartHm = formatHm(mins);
      nextStartDay = over;
    } else if (resize.edge === "bottom") {
      nextEndHm = formatHm(mins);
      nextEndDay = over;
    } else if (resize.edge === "left") {
      nextStartDay = over;
    } else if (resize.edge === "right") {
      nextEndDay = over;
    }

    let startsAt = fromZonedTime(`${nextStartDay}T${nextStartHm}:00`, timezone);
    let endsAt = fromZonedTime(`${nextEndDay}T${nextEndHm}:00`, timezone);
    if (endsAt <= startsAt) {
      if (resize.edge === "top" || resize.edge === "left") {
        startsAt = new Date(endsAt.getTime() - SNAP * 60_000);
      } else {
        endsAt = new Date(startsAt.getTime() + SNAP * 60_000);
      }
    }

    setLocalOverrides((prev) => ({
      ...prev,
      [resize.itemId]: {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      },
    }));
    setResize({
      ...resize,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
  }

  function onResizeUp() {
    if (!resize) return;
    const { timeBlockId, startsAt, endsAt, itemId } = resize;
    setResize(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", timeBlockId);
        fd.set("startDayKey", dayKeyInTimezone(startsAt, timezone));
        fd.set("endDayKey", dayKeyInTimezone(endsAt, timezone));
        fd.set("startTime", timeHmInTimezone(startsAt, timezone));
        fd.set("endTime", timeHmInTimezone(endsAt, timezone));
        await updateTimeBlockAction(fd);
        setLocalOverrides((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not resize block");
        setLocalOverrides((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }
    });
  }

  function submitDraft() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("dayKey", draft.startDayKey);
        fd.set("endDayKey", draft.endDayKey);
        fd.set("startTime", draft.startTime);
        fd.set("endTime", draft.endTime);
        fd.set("note", note);
        await createTimeBlockAction(fd);
        setDraft(null);
        setNote("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create block");
      }
    });
  }

  function removeBlock(id: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      await deleteTimeBlockAction(fd);
      setSelected(null);
      router.refresh();
    });
  }

  const selectionOverlay: DraftBlock | null =
    draft ??
    (createDrag
      ? draftFromRange(
          createDrag.startDayKey,
          createDrag.endDayKey,
          createDrag.startMins,
          createDrag.endMins,
        )
      : null);

  const selectionRange = selectionOverlay
    ? rangeIso(selectionOverlay, timezone)
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted sm:text-sm">
          Drag empty space to block time · drag block edges to resize
          {syncsToCalendar ? " · syncs to your calendar" : ""}.
        </p>
        <button
          type="button"
          className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-accent-soft"
          onClick={() =>
            openDraft({
              startDayKey: days[0]?.dayKey ?? "",
              endDayKey: days[0]?.dayKey ?? "",
              startTime: formatHm(DEFAULT_START_MIN + 2 * 60),
              endTime: formatHm(DEFAULT_START_MIN + 3 * 60),
            })
          }
        >
          Block time
        </button>
      </div>

      <div className="overflow-x-auto">
        <div
          className="min-w-[640px] select-none"
          style={{
            display: "grid",
            gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))`,
          }}
          onPointerMove={(e) => {
            if (resize) onResizeMove(e);
          }}
          onPointerUp={() => {
            if (resize) onResizeUp();
          }}
          onPointerCancel={() => {
            if (resize) {
              setResize(null);
              setLocalOverrides({});
            }
          }}
        >
          <div />
          {days.map((day) => (
            <div
              key={`head-${day.dayKey}`}
              className="border-b border-line px-1 pb-2 text-center text-xs font-semibold text-muted"
            >
              {day.label}
            </div>
          ))}

          <div className="relative" style={{ height: heightPx }}>
            {hours.map((m) => (
              <div
                key={m}
                className="absolute right-1 -translate-y-1/2 text-[10px] tabular-nums text-muted"
                style={{ top: ((m - gridStart) / 60) * PX_PER_HOUR }}
              >
                {formatHm(m)}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const items = displayItems.get(day.dayKey) ?? [];
            const unique = new Map<string, ScheduleItem>();
            for (const it of items) unique.set(it.id, it);

            return (
              <div
                key={day.dayKey}
                ref={(el) => {
                  if (el) columnRefs.current.set(day.dayKey, el);
                  else columnRefs.current.delete(day.dayKey);
                }}
                role="presentation"
                className="relative cursor-crosshair touch-none border-l border-line bg-white"
                style={{ height: heightPx }}
                onPointerDown={(e) => onCreatePointerDown(e, day.dayKey)}
                onPointerMove={(e) => onCreatePointerMove(e, day.dayKey)}
                onPointerUp={(e) => onCreatePointerUp(e, day.dayKey)}
                onPointerCancel={() => setCreateDrag(null)}
              >
                {hours.map((m) => (
                  <div
                    key={m}
                    className="pointer-events-none absolute inset-x-0 border-t border-line/70"
                    style={{ top: ((m - gridStart) / 60) * PX_PER_HOUR }}
                  />
                ))}

                {selectionRange
                  ? (() => {
                      const layout = segmentLayout(
                        selectionRange.start,
                        selectionRange.end,
                        day.dayKey,
                        timezone,
                        gridStart,
                        gridEnd,
                        PX_PER_HOUR,
                      );
                      if (!layout) return null;
                      return (
                        <div
                          className="pointer-events-none absolute inset-x-0.5 z-10 rounded border border-amber-400/80 bg-amber-100/80"
                          style={{ top: layout.top, height: layout.height }}
                        />
                      );
                    })()
                  : null}

                {[...unique.values()].map((item) => {
                  const layout = segmentLayout(
                    new Date(item.startsAt),
                    new Date(item.endsAt),
                    day.dayKey,
                    timezone,
                    gridStart,
                    gridEnd,
                    PX_PER_HOUR,
                  );
                  if (!layout) return null;
                  const isBlock = item.source === "block" && item.timeBlockId;
                  return (
                    <div
                      key={`${item.id}-${day.dayKey}`}
                      data-event
                      className={[
                        "absolute inset-x-0.5 z-[1] overflow-visible rounded border text-left text-[10px] leading-4 sm:text-xs sm:leading-5",
                        sourceStyles(item.source),
                      ].join(" ")}
                      style={{ top: layout.top, height: layout.height }}
                      title={`${item.timeLabel}–${item.endTimeLabel} ${item.title}`}
                    >
                      <button
                        type="button"
                        className="absolute inset-0 overflow-hidden px-1 text-left"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(item);
                          setDraft(null);
                        }}
                      >
                        <span className="block truncate whitespace-nowrap">
                          <span className="font-semibold tabular-nums">
                            {item.timeLabel}
                          </span>{" "}
                          {item.title}
                        </span>
                      </button>
                      {isBlock ? (
                        <>
                          <span
                            role="presentation"
                            className="absolute inset-x-1 top-0 z-[2] h-2 cursor-ns-resize"
                            onPointerDown={(e) => beginResize(e, item, "top")}
                          />
                          <span
                            role="presentation"
                            className="absolute inset-x-1 bottom-0 z-[2] h-2 cursor-ns-resize"
                            onPointerDown={(e) =>
                              beginResize(e, item, "bottom")
                            }
                          />
                          <span
                            role="presentation"
                            className="absolute inset-y-1 left-0 z-[2] w-2 cursor-ew-resize"
                            onPointerDown={(e) => beginResize(e, item, "left")}
                          />
                          <span
                            role="presentation"
                            className="absolute inset-y-1 right-0 z-[2] w-2 cursor-ew-resize"
                            onPointerDown={(e) => beginResize(e, item, "right")}
                          />
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {draft ? (
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold">Block time</h3>
          <p className="mt-1 text-sm text-muted">
            Marks you unavailable for guest booking
            {syncsToCalendar
              ? " and adds a busy event to your connected calendar"
              : ""}
            .
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block text-muted">Start day</span>
              <input
                type="date"
                value={draft.startDayKey}
                onChange={(e) =>
                  setDraft({ ...draft, startDayKey: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">Start</span>
              <input
                type="time"
                value={draft.startTime}
                onChange={(e) =>
                  setDraft({ ...draft, startTime: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">End day</span>
              <input
                type="date"
                value={draft.endDayKey}
                onChange={(e) =>
                  setDraft({ ...draft, endDayKey: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">End</span>
              <input
                type="time"
                value={draft.endTime}
                onChange={(e) =>
                  setDraft({ ...draft, endTime: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2"
              />
            </label>
          </div>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-muted">Note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Something came up"
              maxLength={200}
              className="w-full rounded-md border border-line bg-white px-3 py-2"
            />
          </label>
          {error ? (
            <p className="mt-2 text-sm text-red-700">{error}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={submitDraft}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Block"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setDraft(null)}
              className="rounded-md border border-line px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {selected && !draft ? (
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm tabular-nums text-muted">
                {selected.timeLabel}–{selected.endTimeLabel}
              </p>
              <h3 className="text-base font-semibold">{selected.title}</h3>
              {selected.subtitle ? (
                <p className="mt-0.5 text-sm text-muted">{selected.subtitle}</p>
              ) : null}
              {selected.timeBlockId ? (
                <p className="mt-1 text-xs text-muted">
                  Drag top/bottom to change times, left/right to span days.
                </p>
              ) : null}
            </div>
            <span
              className={
                selected.source === "booking"
                  ? "rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent"
                  : selected.source === "block"
                    ? "rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900"
                    : "rounded bg-line/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted"
              }
            >
              {selected.source === "booking"
                ? APP_NAME
                : selected.source === "block"
                  ? "Blocked"
                  : "Busy"}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {selected.bookingId && selected.status !== "CANCELLED" ? (
              <Link
                href={`/dash/bookings/${selected.bookingId}/reschedule`}
                className="text-sm font-medium text-accent underline"
              >
                Reschedule
              </Link>
            ) : null}
            {selected.timeBlockId ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => removeBlock(selected.timeBlockId!)}
                className="text-sm font-medium text-red-700 underline disabled:opacity-60"
              >
                Remove block
              </button>
            ) : null}
            <button
              type="button"
              className="text-sm text-muted underline"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {error && !draft ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
