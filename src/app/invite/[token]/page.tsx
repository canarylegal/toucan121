import { prisma } from "@/lib/db";
import { formatSlotLabel } from "@/lib/availability";
import { parseReminderPrefs } from "@/lib/reminders";
import { guestInviteAction } from "@/lib/invite-actions";
import { ReminderPrefsFields } from "@/components/reminder-prefs-fields";
import { ToucanBrand } from "@/components/toucan-brand";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    action?: string;
    done?: string;
    error?: string;
  }>;
}) {
  const { token } = await params;
  const q = await searchParams;

  const booking = await prisma.booking.findUnique({
    where: { manageToken: token },
    include: { host: true, meetingType: true },
  });

  if (!booking) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="font-serif text-3xl">Invitation not found</h1>
        <p className="mt-3 text-muted">
          This link may be invalid or the booking was removed.
        </p>
        <ToucanBrand className="mt-6" />
      </main>
    );
  }

  const when = formatSlotLabel(booking.startsAt, booking.host.timezone);
  const done = q.done;
  const error = q.error;
  const preferDecline = q.action === "decline";
  const guestReminder = parseReminderPrefs(
    booking.guestReminderJson !== "{}"
      ? booking.guestReminderJson
      : booking.meetingType.guestReminderJson,
  );

  if (done === "accepted" || booking.status === "CONFIRMED") {
    return (
      <main className="mx-auto w-full max-w-lg px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          Confirmed
        </p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">
          You’re booked with {booking.host.name}
        </h1>
        <p className="mt-4 text-muted">
          {booking.meetingType.title} · {when} ({booking.host.timezone})
        </p>
        {booking.venue || booking.meetingType.locationNote ? (
          <p className="mt-2 text-muted">
            Venue: {booking.venue || booking.meetingType.locationNote}
          </p>
        ) : null}
        {booking.jitsiUrl ? (
          <p className="mt-4">
            <a
              href={booking.jitsiUrl}
              className="font-semibold text-accent underline"
              target="_blank"
              rel="noreferrer"
            >
              Open Jitsi room
            </a>
          </p>
        ) : null}
      </main>
    );
  }

  if (done === "declined" || booking.status === "CANCELLED") {
    return (
      <main className="mx-auto w-full max-w-lg px-6 py-12">
        <h1 className="font-serif text-4xl tracking-tight">Invitation declined</h1>
        <p className="mt-4 text-muted">
          {booking.meetingType.title} with {booking.host.name} was cancelled.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
        Invitation
      </p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight">
        {booking.host.name} invited you
      </h1>
      <div className="mt-6 space-y-2 rounded-lg border border-line bg-panel p-5 text-sm">
        <p>
          <span className="text-muted">Meeting</span>
          <br />
          <span className="text-base font-semibold">
            {booking.meetingType.title}
          </span>
        </p>
        <p>
          <span className="text-muted">When</span>
          <br />
          <span className="text-base font-semibold">
            {when} ({booking.host.timezone})
          </span>
        </p>
        <p>
          <span className="text-muted">Where</span>
          <br />
          <span className="text-base font-semibold">
            {booking.jitsiUrl ??
              (booking.venue ||
                booking.meetingType.locationNote ||
                (booking.meetingType.venuePolicy === "GUEST_PROPOSES"
                  ? "Propose a venue when you accept"
                  : "In person"))}
          </span>
        </p>
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error === "notfound" ? "Invitation not found" : error}
        </p>
      ) : null}

      {booking.pendingOn === "GUEST" && booking.status === "PENDING" ? (
        <div className="mt-6 space-y-5">
          <form action={guestInviteAction} className="space-y-5">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="decision" value="accept" />
            {booking.meetingType.locationType === "IN_PERSON" &&
            booking.meetingType.venuePolicy === "GUEST_PROPOSES" ? (
              <label className="block space-y-1.5 rounded-lg border border-line bg-panel p-4">
                <span className="text-sm font-medium">Propose a venue</span>
                <input
                  name="venue"
                  required={!booking.venue.trim()}
                  defaultValue={booking.venue}
                  placeholder="Café, office address…"
                  className="mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
                />
              </label>
            ) : null}
            <div className="rounded-lg border border-line bg-panel p-4">
              <ReminderPrefsFields
                prefix="guest"
                title="Email reminders"
                description="Defaults from the host — change them before you accept."
                value={guestReminder}
              />
            </div>
            <p className="text-xs leading-relaxed text-muted">
              By accepting, you agree we may email you about this booking
              (confirmation, changes, and cancellations). See our{" "}
              <a href="/privacy" className="font-medium text-accent underline">
                privacy policy
              </a>
              .
            </p>
            <button
              type="submit"
              className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Accept invitation
            </button>
          </form>
          <form action={guestInviteAction}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="decision" value="decline" />
            <button
              type="submit"
              className={
                preferDecline
                  ? "rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-white"
                  : "rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-semibold hover:bg-accent-soft"
              }
            >
              Decline
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">
          This invitation is no longer awaiting a response.
        </p>
      )}
    </main>
  );
}
