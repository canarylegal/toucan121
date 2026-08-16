import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireHostOrRedirect } from "@/lib/current-user";
import { HostBookingList } from "@/components/host-booking-list";

export const dynamic = "force-dynamic";

export default async function HostMeetingHistoryPage() {
  const host = await requireHostOrRedirect();
  const now = new Date();

  const meetings = await prisma.booking.findMany({
    where: {
      hostId: host.id,
      OR: [
        { status: "COMPLETED" },
        { status: "CANCELLED" },
        { status: "PENDING", endsAt: { lte: now } },
      ],
    },
    orderBy: [{ startsAt: "desc" }],
    take: 200,
    include: { meetingType: { select: { title: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/dash" className="text-sm text-muted hover:text-foreground">
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-serif text-4xl tracking-tight">
        Meeting history
      </h1>
      <p className="mt-2 text-muted">
        Completed, cancelled, and expired invitations (up to 200 most recent).
      </p>
      <div className="mt-8 rounded-lg border border-line bg-panel p-5">
        <HostBookingList
          bookings={meetings}
          timezone={host.timezone}
          empty="No meeting history yet."
          showActionStatus
          allowRescheduleCancelled
        />
      </div>
    </main>
  );
}
