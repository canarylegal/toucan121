import Link from "next/link";
import { listSlotsForMeetingType } from "@/lib/booking";
import {
  dayKeyInZone,
  formatSlotTime,
} from "@/lib/availability";
import { parseReminderPrefs } from "@/lib/reminders";
import { getOptionalUser } from "@/lib/current-user";
import { BookingForm } from "@/components/booking-form";
import { ToucanBrand } from "@/components/toucan-brand";

export default async function BookMeetingTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ hostSlug: string; meetingTypeSlug: string }>;
  searchParams: Promise<{
    startsAt?: string;
    guestName?: string;
    guestEmail?: string;
    notes?: string;
    venue?: string;
  }>;
}) {
  const { hostSlug, meetingTypeSlug } = await params;
  const q = await searchParams;
  const viewer = await getOptionalUser();

  let data;
  try {
    data = await listSlotsForMeetingType({ hostSlug, meetingTypeSlug });
  } catch {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="font-serif text-3xl">Not found</h1>
        <ToucanBrand className="mt-6" />
      </main>
    );
  }

  const { host, meetingType, candidates } = data;
  const slotCandidates = candidates.map((c) => ({
    value: c.startsAt.toISOString(),
    dayKey: dayKeyInZone(c.startsAt, host.timezone),
    timeLabel: formatSlotTime(c.startsAt, host.timezone),
    available: c.available,
  }));

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <Link
        href={`/${host.slug}`}
        className="text-sm text-muted hover:text-foreground"
      >
        ← {host.name}
      </Link>
      <h1 className="mt-4 font-serif text-4xl tracking-tight">
        {meetingType.title}
      </h1>
      <p className="mt-2 text-muted">
        {meetingType.durationMins} minutes ·{" "}
        {meetingType.locationType === "VIDEO"
          ? meetingType.videoUrl.trim()
            ? "Video call"
            : "Video call (Jitsi)"
          : meetingType.venuePolicy === "GUEST_PROPOSES"
            ? "In person — you propose the venue"
            : `In person — ${meetingType.locationNote || "venue TBC"}`}
      </p>
      {meetingType.description ? (
        <p className="mt-4 text-foreground/80">{meetingType.description}</p>
      ) : null}

      <div className="mt-8 rounded-lg border border-line bg-panel p-5">
        <BookingForm
          hostSlug={host.slug}
          meetingTypeSlug={meetingType.slug}
          timezone={host.timezone}
          candidates={slotCandidates}
          initialStartsAt={q.startsAt}
          initialGuestName={viewer?.name ?? q.guestName ?? ""}
          initialGuestEmail={viewer?.email ?? q.guestEmail ?? ""}
          initialNotes={q.notes ?? ""}
          initialVenue={q.venue ?? ""}
          signedInAs={
            viewer
              ? { name: viewer.name, email: viewer.email }
              : null
          }
          defaultGuestReminder={parseReminderPrefs(
            meetingType.guestReminderJson,
          )}
          venueMode={
            meetingType.locationType === "VIDEO"
              ? "video"
              : meetingType.venuePolicy === "GUEST_PROPOSES"
                ? "guest_proposes"
                : "host_fixed"
          }
          fixedVenue={meetingType.locationNote || undefined}
        />
      </div>
    </main>
  );
}
