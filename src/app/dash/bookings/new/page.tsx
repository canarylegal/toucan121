import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBookingHostOrRedirect } from "@/lib/current-user";
import { HostBookingForm } from "@/components/host-booking-form";

export const dynamic = "force-dynamic";

export default async function HostNewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ meetingTypeId?: string }>;
}) {
  const sessionHost = await requireBookingHostOrRedirect();
  const { meetingTypeId } = await searchParams;

  const host = await prisma.host.findUnique({
    where: { id: sessionHost.id },
    include: {
      meetingTypes: {
        where: { deletedAt: null },
        orderBy: { title: "asc" },
      },
    },
  });

  if (!host) {
    redirect("/dash/hosting/setup");
  }

  if (host.meetingTypes.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-12">
        <Link href="/dash" className="text-sm text-muted hover:text-foreground">
          ← Dashboard
        </Link>
        <h1 className="mt-4 font-serif text-4xl tracking-tight">New booking</h1>
        <p className="mt-3 text-muted">
          Create a meeting type first, then you can book invitees from here.
        </p>
        <Link
          href="/dash/meetings/new"
          className="mt-6 inline-block rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Add meeting type
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link href="/dash" className="text-sm text-muted hover:text-foreground">
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-serif text-4xl tracking-tight">New booking</h1>
      <p className="mt-2 text-muted">
        Pick a time and send a calendar invite to someone by email. You can
        book outside your usual hours; existing bookings still block that
        time.
      </p>

      <div className="mt-8 rounded-lg border border-line bg-panel p-5">
        <HostBookingForm
          timezone={host.timezone}
          meetingTypes={host.meetingTypes.map((mt) => ({
            id: mt.id,
            title: mt.title,
            durationMins: mt.durationMins,
            active: mt.active,
            locationType: mt.locationType,
            venuePolicy: mt.venuePolicy,
            locationNote: mt.locationNote,
          }))}
          initialMeetingTypeId={
            meetingTypeId &&
            host.meetingTypes.some((mt) => mt.id === meetingTypeId)
              ? meetingTypeId
              : undefined
          }
        />
      </div>
    </main>
  );
}
