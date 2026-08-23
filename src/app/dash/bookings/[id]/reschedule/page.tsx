import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBookingHostOrRedirect } from "@/lib/current-user";
import { listSlotsForMeetingType } from "@/lib/booking";
import { dayKeyInZone, formatSlotLabel, formatSlotTime } from "@/lib/availability";
import { HostRescheduleForm } from "@/components/host-reschedule-form";

export const dynamic = "force-dynamic";

export default async function HostReschedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const host = await requireBookingHostOrRedirect();

  const booking = await prisma.booking.findFirst({
    where: { id, hostId: host.id },
    include: { meetingType: true, host: true },
  });
  if (!booking) notFound();

  const wasCancelled = booking.status === "CANCELLED";

  const { candidates } = await listSlotsForMeetingType({
    hostId: host.id,
    meetingTypeId: booking.meetingTypeId,
    allowInactive: true,
    excludeBookingId: booking.id,
    ignoreAvailabilityWindows: true,
  });

  const slotCandidates = candidates.map((c) => ({
    value: c.startsAt.toISOString(),
    dayKey: dayKeyInZone(c.startsAt, booking.host.timezone),
    timeLabel: formatSlotTime(c.startsAt, booking.host.timezone),
    available: c.available,
  }));

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link href="/dash" className="text-sm text-muted hover:text-foreground">
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-serif text-4xl tracking-tight">
        {wasCancelled ? "Reschedule cancelled meeting" : "Reschedule"}
      </h1>
      <p className="mt-2 text-muted">
        {wasCancelled
          ? "Pick a new time to reactivate this meeting. The guest will be emailed a confirmed invite."
          : "Pick a new time. You can use a slot outside your usual hours if it is not already booked. The guest will be emailed the update."}
      </p>

      <div className="mt-8 rounded-lg border border-line bg-panel p-5">
        <HostRescheduleForm
          bookingId={booking.id}
          timezone={booking.host.timezone}
          candidates={slotCandidates}
          guestName={booking.guestName}
          meetingTitle={booking.meetingType.title}
          currentLabel={`${formatSlotLabel(booking.startsAt, booking.host.timezone)} (${booking.host.timezone})`}
        />
      </div>
    </main>
  );
}
