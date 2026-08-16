"use client";

import { useEffect, useState } from "react";
import { toggleActionPointAction } from "@/lib/host-booking-manage-actions";
import type { ActionPoint } from "@/lib/action-points";

type Props = {
  bookingId: string;
  points: ActionPoint[];
};

export function ActionPointsDisclosure({ bookingId, points }: Props) {
  const storageKey = `toucan:action-points-open:${bookingId}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(sessionStorage.getItem(storageKey) === "1");
    } catch {
      // ignore
    }
  }, [storageKey]);

  function setExpanded(next: boolean) {
    setOpen(next);
    try {
      sessionStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  const openCount = points.filter((p) => !p.done).length;
  const summary =
    openCount === 0
      ? `${points.length} action point${points.length === 1 ? "" : "s"}`
      : `${openCount} of ${points.length} open`;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded(!open)}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
        aria-expanded={open}
        aria-label={open ? `Collapse ${summary}` : `Expand ${summary}`}
      >
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded border border-line bg-white text-[10px] font-semibold leading-none text-foreground"
          aria-hidden
        >
          {open ? "−" : "+"}
        </span>
        <span>{summary}</span>
      </button>
      {open ? (
        <ul className="mt-2 space-y-1.5 pl-5">
          {points.map((point) => (
            <li key={point.id}>
              <form
                action={toggleActionPointAction}
                className="flex items-start gap-2"
              >
                <input type="hidden" name="bookingId" value={bookingId} />
                <input type="hidden" name="pointId" value={point.id} />
                <input
                  type="hidden"
                  name="done"
                  value={point.done ? "false" : "true"}
                />
                <button
                  type="submit"
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none ${
                    point.done
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-line bg-white text-transparent hover:border-accent"
                  }`}
                  aria-label={
                    point.done
                      ? `Mark “${point.text}” not done`
                      : `Mark “${point.text}” done`
                  }
                >
                  ✓
                </button>
                <span
                  className={
                    point.done
                      ? "text-muted line-through"
                      : "text-foreground/90"
                  }
                >
                  {point.text}
                </span>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
