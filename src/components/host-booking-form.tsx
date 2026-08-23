"use client";

import { useActionState, useEffect, useState } from "react";
import {
  SlotCalendarPicker,
  type BookingSlotCandidate,
} from "@/components/slot-calendar-picker";
import {
  createHostBookingAction,
  type HostBookingFormState,
} from "@/lib/host-booking-actions";

type MeetingTypeOption = {
  id: string;
  title: string;
  durationMins: number;
  active: boolean;
  locationType: "VIDEO" | "IN_PERSON";
  venuePolicy: "HOST_FIXED" | "GUEST_PROPOSES";
  locationNote: string;
};

export function HostBookingForm({
  meetingTypes,
  timezone,
  initialMeetingTypeId,
}: {
  meetingTypes: MeetingTypeOption[];
  timezone: string;
  initialMeetingTypeId?: string;
}) {
  const [state, action, pending] = useActionState(createHostBookingAction, {
    values: {
      meetingTypeId: initialMeetingTypeId ?? meetingTypes[0]?.id ?? "",
      guestName: "",
      guestEmail: "",
      notes: "",
      startsAt: "",
      venue: "",
      confirmMode: "ask",
      sendReminders: "1",
    },
  } satisfies HostBookingFormState);

  const values = state.values ?? {
    meetingTypeId: initialMeetingTypeId ?? meetingTypes[0]?.id ?? "",
    guestName: "",
    guestEmail: "",
    notes: "",
    startsAt: "",
    venue: "",
    confirmMode: "ask" as const,
    sendReminders: "1" as const,
  };

  const [meetingTypeId, setMeetingTypeId] = useState(values.meetingTypeId);
  const [startsAt, setStartsAt] = useState(values.startsAt);
  const [confirmMode, setConfirmMode] = useState<"ask" | "auto">(
    values.confirmMode ?? "ask",
  );
  const [sendReminders, setSendReminders] = useState(
    (values.sendReminders ?? "1") === "1",
  );
  const [candidates, setCandidates] = useState<BookingSlotCandidate[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const selected = meetingTypes.find((mt) => mt.id === meetingTypeId);
  const needsGuestVenue =
    selected?.locationType === "IN_PERSON" &&
    selected.venuePolicy === "GUEST_PROPOSES";

  useEffect(() => {
    if (!meetingTypeId) {
      setCandidates([]);
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);
    setSlotsError(null);
    setStartsAt("");

    fetch(`/api/host/availability?meetingTypeId=${encodeURIComponent(meetingTypeId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load slots");
        if (!cancelled) setCandidates(data.candidates ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setCandidates([]);
          setSlotsError(
            err instanceof Error ? err.message : "Failed to load slots",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [meetingTypeId, state.formKey]);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="startsAt" value={startsAt} />

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Meeting type</span>
        <select
          name="meetingTypeId"
          className="w-full rounded-md border border-line bg-white px-3 py-2"
          value={meetingTypeId}
          onChange={(e) => setMeetingTypeId(e.target.value)}
          required
        >
          {meetingTypes.map((mt) => (
            <option key={mt.id} value={mt.id}>
              {mt.title} ({mt.durationMins} min)
              {!mt.active ? " — inactive" : ""}
            </option>
          ))}
        </select>
      </label>

      {selected?.locationType === "IN_PERSON" &&
      selected.venuePolicy === "HOST_FIXED" ? (
        <p className="text-sm text-muted">
          Venue:{" "}
          <span className="font-medium text-foreground">
            {selected.locationNote || "Not set"}
          </span>
        </p>
      ) : null}

      {loadingSlots ? (
        <p className="text-sm text-muted">Loading available times…</p>
      ) : slotsError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {slotsError}
        </p>
      ) : (
        <SlotCalendarPicker
          key={`${meetingTypeId}-${state.formKey ?? 0}`}
          timezone={timezone}
          candidates={candidates}
          value={startsAt}
          onChange={setStartsAt}
        />
      )}

      <div className="space-y-4 border-t border-line pt-5">
        <p className="text-sm font-medium">Invitee</p>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Name</span>
          <input
            name="guestName"
            className="w-full rounded-md border border-line bg-white px-3 py-2"
            defaultValue={values.guestName}
            required
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <input
            name="guestEmail"
            type="email"
            className="w-full rounded-md border border-line bg-white px-3 py-2"
            defaultValue={values.guestEmail}
            required
          />
        </label>
        {needsGuestVenue ? (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">
              Venue (optional — invitee can propose)
            </span>
            <input
              name="venue"
              className="w-full rounded-md border border-line bg-white px-3 py-2"
              defaultValue={values.venue}
              placeholder="Leave blank for invitee to propose"
            />
          </label>
        ) : (
          <input type="hidden" name="venue" value="" />
        )}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Notes (optional)</span>
          <textarea
            name="notes"
            rows={3}
            className="w-full rounded-md border border-line bg-white px-3 py-2"
            defaultValue={values.notes}
          />
        </label>
      </div>

      <div className="space-y-4 border-t border-line pt-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Confirmation</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="confirmMode"
              value="ask"
              checked={confirmMode === "ask"}
              onChange={() => setConfirmMode("ask")}
              className="mt-1"
            />
            <span>
              Ask visitor to confirm
              <span className="block text-muted">
                Sends an invite — pending until they accept.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="confirmMode"
              value="auto"
              checked={confirmMode === "auto"}
              onChange={() => setConfirmMode("auto")}
              className="mt-1"
            />
            <span>
              Auto-confirm
              <span className="block text-muted">
                Confirms now and emails the visitor a booking confirmation.
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Visitor reminders</legend>
          <input
            type="hidden"
            name="sendReminders"
            value={sendReminders ? "1" : "0"}
          />
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendReminders}
              onChange={(e) => setSendReminders(e.target.checked)}
              className="mt-1"
            />
            <span>
              Send reminder emails to the visitor
              <span className="block text-muted">
                Per booking. Uses this meeting type&apos;s reminder timing when
                on. Your own host reminders are unchanged. Confirmations and
                cancellations are always emailed.
              </span>
            </span>
          </label>
        </fieldset>
      </div>

      <p className="text-xs leading-relaxed text-muted">
        The visitor will receive transactional emails about this booking. See
        our{" "}
        <a href="/privacy" className="font-medium text-accent underline">
          privacy policy
        </a>
        .
      </p>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !startsAt || loadingSlots}
        className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending
          ? confirmMode === "auto"
            ? "Creating…"
            : "Sending invite…"
          : confirmMode === "auto"
            ? "Create booking"
            : "Create booking & send invite"}
      </button>
    </form>
  );
}
