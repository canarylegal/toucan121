"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SlotCalendarPicker,
  type BookingSlotCandidate,
} from "@/components/slot-calendar-picker";
import { ReminderPrefsFields } from "@/components/reminder-prefs-fields";
import type { ReminderPrefs } from "@/lib/reminders";
import { BookingIdentityChoice } from "@/components/booking-identity-choice";
import {
  bookingReturnPath,
  loginWithReturnHref,
} from "@/lib/booking-return";

export function BookingForm({
  hostSlug,
  meetingTypeSlug,
  timezone,
  candidates,
  defaultGuestReminder,
  venueMode,
  fixedVenue,
  initialStartsAt = "",
  initialGuestName = "",
  initialGuestEmail = "",
  initialNotes = "",
  initialVenue = "",
  signedInAs = null,
}: {
  hostSlug: string;
  meetingTypeSlug: string;
  timezone: string;
  candidates: BookingSlotCandidate[];
  defaultGuestReminder: ReminderPrefs;
  venueMode: "video" | "host_fixed" | "guest_proposes";
  fixedVenue?: string;
  initialStartsAt?: string;
  initialGuestName?: string;
  initialGuestEmail?: string;
  initialNotes?: string;
  initialVenue?: string;
  signedInAs?: { name: string; email: string } | null;
}) {
  const router = useRouter();
  const [startsAt, setStartsAt] = useState(() => {
    if (
      initialStartsAt &&
      candidates.some((c) => c.available && c.value === initialStartsAt)
    ) {
      return initialStartsAt;
    }
    return "";
  });
  const [guestName, setGuestName] = useState(initialGuestName);
  const [guestEmail, setGuestEmail] = useState(initialGuestEmail);
  const [notes, setNotes] = useState(initialNotes);
  const [venue, setVenue] = useState(initialVenue);
  const [guestReminder, setGuestReminder] = useState(defaultGuestReminder);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const loginHref = useMemo(
    () =>
      loginWithReturnHref(
        bookingReturnPath({
          hostSlug,
          meetingTypeSlug,
          startsAt,
          guestName,
          guestEmail,
          notes,
          venue,
        }),
      ),
    [
      hostSlug,
      meetingTypeSlug,
      startsAt,
      guestName,
      guestEmail,
      notes,
      venue,
    ],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startsAt) {
      setError("Choose an available time");
      return;
    }
    if (venueMode === "guest_proposes" && !venue.trim()) {
      setError("Please propose a venue");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/book/${hostSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingTypeSlug,
          startsAt,
          guestName,
          guestEmail,
          notes,
          venue: venueMode === "guest_proposes" ? venue : undefined,
          emailOptIn: true,
          guestReminder,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Booking failed");
      }
      router.push(`/${hostSlug}/confirmed/${data.booking.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <BookingIdentityChoice
        loginHref={loginHref}
        signedInAs={signedInAs}
      />
      <SlotCalendarPicker
        timezone={timezone}
        candidates={candidates}
        value={startsAt}
        onChange={setStartsAt}
      />

      <div className="space-y-4 border-t border-line pt-5">
        {venueMode === "host_fixed" && fixedVenue ? (
          <p className="text-sm text-muted">
            Venue:{" "}
            <span className="font-medium text-foreground">{fixedVenue}</span>
          </p>
        ) : null}
        {venueMode === "guest_proposes" ? (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Propose a venue</span>
            <input
              className="w-full rounded-md border border-line bg-white px-3 py-2"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              required
              placeholder="Café, office address…"
            />
          </label>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Your name</span>
          <input
            className="w-full rounded-md border border-line bg-white px-3 py-2"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            className="w-full rounded-md border border-line bg-white px-3 py-2"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Notes (optional)</span>
          <textarea
            className="w-full rounded-md border border-line bg-white px-3 py-2"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <ReminderPrefsFields
          prefix="guest"
          title="Email reminders"
          description="You can change these before booking."
          value={guestReminder}
          onChange={setGuestReminder}
        />
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <p className="text-xs leading-relaxed text-muted">
        By confirming, you agree we may email you about this booking
        (confirmation, changes, and cancellations). Optional reminders can be
        changed above. See our{" "}
        <a href="/privacy" className="font-medium text-accent underline">
          privacy policy
        </a>
        .
      </p>

      <button
        type="submit"
        disabled={pending || !startsAt}
        className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Booking…" : "Confirm booking"}
      </button>
    </form>
  );
}
