"use client";

import { useState } from "react";
import {
  cancelBookingAction,
  completeBookingAction,
} from "@/lib/host-booking-manage-actions";

export type PastPendingBooking = {
  id: string;
  guestName: string;
  guestEmail: string;
  startsAt: Date;
  endsAt: Date;
  meetingType: { title: string };
};

type Props = {
  bookings: PastPendingBooking[];
  timezone: string;
};

export function HostPastPendingList({ bookings, timezone }: Props) {
  if (bookings.length === 0) return null;

  return (
    <section className="mt-8 rounded-lg border border-amber-300/80 bg-amber-50/60 p-5">
      <h2 className="text-lg font-semibold">Did these meetings happen?</h2>
      <p className="mt-1 text-sm text-muted">
        These invitations were never confirmed, but the scheduled time has
        passed. Yes marks them complete; No cancels them.
      </p>
      <ul className="mt-4 space-y-4">
        {bookings.map((b) => (
          <PastPendingRow key={b.id} booking={b} timezone={timezone} />
        ))}
      </ul>
    </section>
  );
}

function PastPendingRow({
  booking: b,
  timezone,
}: {
  booking: PastPendingBooking;
  timezone: string;
}) {
  const [step, setStep] = useState<"ask" | "actionPoints" | "write">("ask");
  const [rows, setRows] = useState<string[]>([""]);

  return (
    <li className="rounded-md border border-line bg-panel px-4 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {b.guestName}{" "}
            <span className="font-normal text-muted">
              · {b.meetingType.title}
            </span>
          </p>
          <p className="text-muted">
            {b.guestEmail} ·{" "}
            {b.startsAt.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: timezone,
            })}
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-amber-800">
          Unconfirmed
        </span>
      </div>

      {step === "ask" ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="w-full text-sm font-medium">Did this meeting happen?</p>
          <button
            type="button"
            onClick={() => setStep("actionPoints")}
            className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
          >
            Yes
          </button>
          <form action={cancelBookingAction}>
            <input type="hidden" name="bookingId" value={b.id} />
            <button
              type="submit"
              className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold hover:bg-accent-soft"
            >
              No
            </button>
          </form>
        </div>
      ) : null}

      {step === "actionPoints" ? (
        <div className="mt-3 space-y-2">
          <p className="font-medium">Add action points?</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setRows([""]);
                setStep("write");
              }}
              className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
            >
              Yes
            </button>
            <form action={completeBookingAction}>
              <input type="hidden" name="bookingId" value={b.id} />
              <button
                type="submit"
                className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold hover:bg-accent-soft"
              >
                No
              </button>
            </form>
            <button
              type="button"
              onClick={() => setStep("ask")}
              className="text-xs text-muted underline"
            >
              Back
            </button>
          </div>
        </div>
      ) : null}

      {step === "write" ? (
        <form action={completeBookingAction} className="mt-3 space-y-3">
          <input type="hidden" name="bookingId" value={b.id} />
          <div className="space-y-2">
            <span className="text-xs font-medium">Action points</span>
            {rows.map((value, index) => (
              <div key={index} className="flex gap-2">
                <input
                  name="actionPoint"
                  value={value}
                  onChange={(e) => {
                    const next = [...rows];
                    next[index] = e.target.value;
                    setRows(next);
                  }}
                  required={index === 0}
                  placeholder={
                    index === 0
                      ? "e.g. Send follow-up email"
                      : "Another action point"
                  }
                  className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
                />
                {rows.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setRows(rows.filter((_, i) => i !== index))
                    }
                    className="shrink-0 px-2 text-xs text-muted underline hover:text-foreground"
                    aria-label="Remove action point"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRows([...rows, ""])}
            className="text-xs font-medium text-accent underline"
          >
            + Add another
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
            >
              Save &amp; complete
            </button>
            <button
              type="button"
              onClick={() => setStep("actionPoints")}
              className="text-xs text-muted underline"
            >
              Back
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
