"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SlotCalendarPicker,
  type BookingSlotCandidate,
} from "@/components/slot-calendar-picker";
import { formatTimezoneDisplay } from "@/lib/timezones";

export type ProfileMeetingType = {
  id: string;
  slug: string;
  title: string;
  durationMins: number;
  description: string;
  locationType: "VIDEO" | "IN_PERSON";
  venuePolicy: "HOST_FIXED" | "GUEST_PROPOSES";
  locationNote: string;
};

function locationSummary(mt: ProfileMeetingType): string {
  if (mt.locationType === "VIDEO") return "Video call";
  if (mt.venuePolicy === "GUEST_PROPOSES") return "In person · propose a venue";
  if (mt.locationNote) return `In person · ${mt.locationNote}`;
  return "In person";
}

export function ProfileBookingPanel({
  hostSlug,
  timezone,
  meetingTypes,
  overviewCandidates = [],
  variant = "default",
}: {
  hostSlug: string;
  timezone: string;
  meetingTypes: ProfileMeetingType[];
  /** Union of available days across meeting types (no preselected type). */
  overviewCandidates?: BookingSlotCandidate[];
  variant?: "default" | "stack";
}) {
  const router = useRouter();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<BookingSlotCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slot, setSlot] = useState("");

  const selected = useMemo(
    () => meetingTypes.find((m) => m.slug === selectedSlug) ?? null,
    [meetingTypes, selectedSlug],
  );

  const tzLabel = formatTimezoneDisplay(timezone);

  useEffect(() => {
    if (!selectedSlug) {
      setCandidates([]);
      setSlot("");
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSlot("");

    fetch(
      `/api/book/${encodeURIComponent(hostSlug)}/availability?meetingTypeSlug=${encodeURIComponent(selectedSlug)}`,
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load availability");
        if (!cancelled) setCandidates(data.candidates ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setCandidates([]);
          setError(
            err instanceof Error ? err.message : "Could not load availability",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hostSlug, selectedSlug]);

  if (meetingTypes.length === 0) {
    return (
      <p className="text-sm text-muted">No meeting types available yet.</p>
    );
  }

  const stackLayout = variant === "stack";

  return (
    <div className={stackLayout ? "profile-booking-surface" : undefined}>
      {!stackLayout ? (
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
          Book a meeting
        </h2>
      ) : null}

      <div
        className={
          stackLayout
            ? "space-y-6"
            : "mt-4 grid items-start gap-8 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]"
        }
      >
        <ul className="space-y-2">
          {meetingTypes.map((mt) => {
            const active = mt.slug === selectedSlug;
            return (
              <li key={mt.id}>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedSlug((prev) => (prev === mt.slug ? null : mt.slug))
                  }
                  className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                    active
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-panel hover:border-accent/60 hover:bg-accent-soft/40"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{mt.title}</span>
                    <span className="text-xs text-muted">
                      {mt.durationMins} min
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {locationSummary(mt)}
                    {mt.description ? ` · ${mt.description}` : ""}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>

        <div
          className={
            stackLayout
              ? "rounded-lg border border-line bg-panel p-4"
              : "rounded-lg border border-line bg-panel p-5"
          }
        >
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">
              {selected ? selected.title : "Availability"}
            </h3>
            <p className="text-xs text-muted">Times in {tzLabel}</p>
          </div>

          {!selectedSlug ? (
            stackLayout ? (
              <p className="text-sm text-muted">
                Choose a meeting type above to pick a time.
              </p>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted">
                  Choose a meeting type to pick a time.
                </p>
                <div
                  className="pointer-events-none select-none opacity-40"
                  aria-hidden
                >
                  <SlotCalendarPicker
                    key="overview"
                    timezone={tzLabel}
                    candidates={overviewCandidates}
                    value=""
                    onChange={() => {}}
                    showTimeSlots={false}
                    interactive={false}
                    emptyMessage="No open days in the next four weeks."
                  />
                </div>
              </>
            )
          ) : loading ? (
            <p className="text-sm text-muted">Loading availability…</p>
          ) : error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : (
            <>
              <SlotCalendarPicker
                key={selectedSlug}
                timezone={tzLabel}
                candidates={candidates}
                value={slot}
                onChange={setSlot}
                showTimeSlots
              />
              <button
                type="button"
                disabled={!slot || !selected}
                onClick={() => {
                  if (!selected || !slot) return;
                  router.push(
                    `/${hostSlug}/${selected.slug}?startsAt=${encodeURIComponent(slot)}`,
                  );
                }}
                className="mt-5 w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                Continue
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
