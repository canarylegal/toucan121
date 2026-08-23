import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ToucanBrand } from "@/components/toucan-brand";
import { formatEmailWhen } from "@/lib/email-templates";
import { APP_NAME } from "@/lib/brand";
import {
  stopRemindersForBooking,
  verifyReminderStopToken,
} from "@/lib/reminder-unsubscribe";
import { stopAllRemindersFromTokenAction } from "@/lib/reminder-stop-actions";

export const dynamic = "force-dynamic";

export default async function StopRemindersPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ all?: string }>;
}) {
  const { token } = await params;
  const { all } = await searchParams;
  const payload = verifyReminderStopToken(token);
  if (!payload) redirect("/reminders/link-expired");

  const booking = await prisma.booking.findUnique({
    where: { id: payload.bookingId },
    include: {
      host: { select: { name: true, email: true, timezone: true } },
      meetingType: { select: { title: true } },
    },
  });
  if (!booking) redirect("/reminders/link-expired");

  await stopRemindersForBooking(booking.id, payload.recipient);

  const email =
    payload.recipient === "GUEST" ? booking.guestEmail : booking.host.email;
  const stoppedAll = all === "1";
  const when = formatEmailWhen(booking.startsAt, booking.host.timezone);

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <ToucanBrand />
      <h1 className="mt-4 font-serif text-4xl tracking-tight">
        Reminders stopped
      </h1>
      <p className="mt-3 text-muted">
        {stoppedAll
          ? `No more reminder emails will be sent to ${email} for ${
              payload.recipient === "HOST" ? "meetings you host" : "meetings you book"
            }. Confirmations, cancellations, and time changes will still be emailed.`
          : `You will not get further reminder emails for this ${booking.meetingType.title} (${when}). Confirmations, cancellations, and time changes will still be emailed.`}
      </p>

      {stoppedAll ? null : (
        <form action={stopAllRemindersFromTokenAction} className="mt-8">
          <input type="hidden" name="token" value={token} />
          <p className="text-sm text-muted">
            Optional: also stop reminder emails to {email} for other meetings.
          </p>
          <button
            type="submit"
            className="mt-3 rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-semibold hover:bg-accent-soft"
          >
            Stop all reminder emails to this address
          </button>
        </form>
      )}

      <p className="mt-8 text-sm text-muted">
        <Link href="/" className="font-medium text-accent underline">
          {APP_NAME} home
        </Link>
      </p>
    </main>
  );
}
