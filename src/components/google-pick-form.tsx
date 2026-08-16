"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelGoogleConnectAction,
  selectGoogleCalendarAction,
  type GooglePickState,
} from "@/lib/calendar-actions";
import type { GoogleCalendarOption } from "@/lib/calendar/google";
import { CalendarConnectConfirm } from "@/components/calendar-connect-confirm";

type Props = {
  calendars: GoogleCalendarOption[];
  accountEmail?: string;
  listError?: string;
};

export function GooglePickForm({
  calendars,
  accountEmail,
  listError,
}: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    selectGoogleCalendarAction,
    {} satisfies GooglePickState,
  );
  const [selectedId, setSelectedId] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  useEffect(() => {
    setConfirmChecked(false);
  }, [selectedId]);

  if (state.success) {
    return <p className="text-sm text-accent">{state.success}</p>;
  }

  if (listError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700">{listError}</p>
        <Link
          href="/api/calendar/google/start"
          className="inline-block text-sm font-medium text-accent underline"
        >
          Sign in with Google again
        </Link>
      </div>
    );
  }

  const selected = calendars.find((c) => c.id === selectedId);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="calendarId" value={selectedId} />
        <div>
          <p className="text-sm font-medium">Choose a Google calendar</p>
          {accountEmail ? (
            <p className="mt-1 text-xs text-muted">{accountEmail}</p>
          ) : null}
        </div>
        <ul className="space-y-2">
          {calendars.map((cal) => {
            const active = selectedId === cal.id;
            return (
              <li key={cal.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(cal.id)}
                  className={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-sm transition ${
                    active
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-white hover:bg-accent-soft/60"
                  }`}
                >
                  <span
                    className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border ${
                      active
                        ? "border-accent bg-accent"
                        : "border-line bg-white"
                    }`}
                    aria-hidden
                  />
                  <span className="font-medium">{cal.displayName}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {selected ? (
          <CalendarConnectConfirm
            calendarName={selected.displayName}
            checked={confirmChecked}
            onCheckedChange={setConfirmChecked}
          />
        ) : (
          <p className="text-xs text-muted">Select a calendar to continue.</p>
        )}

        {state.error ? (
          <p className="text-sm text-red-700">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !selectedId || !confirmChecked}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Connecting…" : "Connect calendar"}
        </button>
      </form>

      <form action={cancelGoogleConnectAction}>
        <button
          type="submit"
          className="text-sm text-muted underline hover:text-foreground"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}
