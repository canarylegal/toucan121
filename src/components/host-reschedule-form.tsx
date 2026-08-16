"use client";

import { useActionState, useState } from "react";
import {
  SlotCalendarPicker,
  type BookingSlotCandidate,
} from "@/components/slot-calendar-picker";
import {
  rescheduleBookingAction,
  type RescheduleFormState,
} from "@/lib/host-booking-manage-actions";

export function HostRescheduleForm({
  bookingId,
  timezone,
  candidates,
  guestName,
  meetingTitle,
  currentLabel,
}: {
  bookingId: string;
  timezone: string;
  candidates: BookingSlotCandidate[];
  guestName: string;
  meetingTitle: string;
  currentLabel: string;
}) {
  const bound = rescheduleBookingAction.bind(null, bookingId);
  const [state, action, pending] = useActionState(bound, {
    values: { startsAt: "" },
  } satisfies RescheduleFormState);

  const [startsAt, setStartsAt] = useState(state.values?.startsAt ?? "");

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="startsAt" value={startsAt} />

      <div className="rounded-md border border-line bg-white px-3 py-2 text-sm">
        <p className="font-medium">
          {meetingTitle} with {guestName}
        </p>
        <p className="text-muted">Current: {currentLabel}</p>
      </div>

      <SlotCalendarPicker
        key={state.formKey ?? 0}
        timezone={timezone}
        candidates={candidates}
        value={startsAt}
        onChange={setStartsAt}
      />

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !startsAt}
        className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save new time"}
      </button>
    </form>
  );
}
