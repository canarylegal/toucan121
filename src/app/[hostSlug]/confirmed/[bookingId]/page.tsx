import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatSlotLabel } from "@/lib/availability";

export default async function ConfirmedPage({
  params,
}: {
  params: Promise<{ hostSlug: string; bookingId: string }>;
}) {
  const { hostSlug, bookingId } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { host: true, meetingType: true },
  });

  if (!booking || booking.host.slug !== hostSlug) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="font-serif text-3xl">Booking not found</h1>
      </main>
    );
  }

  const pendingHost =
    booking.status === "PENDING" && booking.pendingOn === "HOST";
  const cancelled = booking.status === "CANCELLED";

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
        {cancelled ? "Cancelled" : pendingHost ? "Requested" : "Confirmed"}
      </p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight">
        {cancelled
          ? "This booking was cancelled"
          : pendingHost
            ? `Request sent to ${booking.host.name}`
            : `You’re booked with ${booking.host.name}`}
      </h1>
      {pendingHost ? (
        <p className="mt-3 text-muted">
          You’ll get an email once {booking.host.name} approves or declines.
        </p>
      ) : null}
      <div className="mt-8 space-y-3 rounded-lg border border-line bg-panel p-5 text-sm leading-relaxed">
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
            {formatSlotLabel(booking.startsAt, booking.host.timezone)} (
            {booking.host.timezone})
          </span>
        </p>
        <p>
          <span className="text-muted">Where</span>
          <br />
          <span className="text-base font-semibold">
            {booking.jitsiUrl ??
              (booking.venue ||
                booking.meetingType.locationNote ||
                "In person")}
          </span>
        </p>
        {booking.jitsiUrl && booking.status === "CONFIRMED" ? (
          <p>
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
        <p className="text-muted">
          {process.env.SMTP_HOST || process.env.SMTP_URL
            ? "A confirmation email was sent (check spam if you don’t see it)."
            : "Email is in console mode — check the server log, or set SMTP_* in .env."}
        </p>
      </div>
      <Link
        href={`/${booking.host.slug}`}
        className="mt-8 inline-block text-sm text-accent underline"
      >
        Back to profile
      </Link>
    </main>
  );
}
