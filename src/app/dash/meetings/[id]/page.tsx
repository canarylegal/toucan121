import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBookingHostOrRedirect } from "@/lib/current-user";
import { parseAvailabilityJson } from "@/lib/availability";
import { parseApprovalRules } from "@/lib/approval";
import { parseReminderPrefs } from "@/lib/reminders";
import { MeetingTypeForm } from "@/components/meeting-type-form";
import { DeleteMeetingTypeButton } from "@/components/delete-meeting-type-button";
import { toggleMeetingTypeAction } from "@/lib/meeting-type-actions";

export const dynamic = "force-dynamic";

export default async function EditMeetingTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const host = await requireBookingHostOrRedirect();

  const meetingType = await prisma.meetingType.findFirst({
    where: { id, hostId: host.id, deletedAt: null },
    include: {
      _count: {
        select: {
          bookings: {
            where: { status: { in: ["PENDING", "CONFIRMED"] } },
          },
        },
      },
    },
  });
  if (!meetingType) notFound();

  const windows = parseAvailabilityJson(meetingType.availabilityJson);
  const rules = parseApprovalRules(meetingType.approvalRulesJson);
  const hostReminder = parseReminderPrefs(meetingType.hostReminderJson);
  const guestReminder = parseReminderPrefs(meetingType.guestReminderJson);

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <Link href="/dash" className="text-sm text-muted hover:text-foreground">
        ← Dashboard
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">
            {meetingType.title}
          </h1>
          <p className="mt-2 text-muted">
            Edit details, approval policy, and weekly availability.
          </p>
        </div>
        <Link
          href={`/${host.slug}/${meetingType.slug}`}
          className="text-sm font-medium text-accent underline"
        >
          Preview booking
        </Link>
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <form action={toggleMeetingTypeAction}>
          <input type="hidden" name="id" value={meetingType.id} />
          <input
            type="hidden"
            name="active"
            value={meetingType.active ? "false" : "true"}
          />
          <button
            type="submit"
            className="text-sm font-medium text-muted underline hover:text-foreground"
          >
            {meetingType.active ? "Deactivate" : "Reactivate"}
          </button>
        </form>
        <DeleteMeetingTypeButton
          meetingTypeId={meetingType.id}
          title={meetingType.title}
          openBookingCount={meetingType._count.bookings}
        />
      </div>

      <div className="mt-8 rounded-lg border border-line bg-panel p-5">
        <MeetingTypeForm
          mode="edit"
          meetingTypeId={meetingType.id}
          bookingPreviewPath={host.slug}
          initialWindows={windows}
          initial={{
            title: meetingType.title,
            description: meetingType.description,
            durationMins: String(meetingType.durationMins),
            bufferBefore: String(meetingType.bufferBefore),
            bufferAfter: String(meetingType.bufferAfter),
            locationType: meetingType.locationType,
            venuePolicy: meetingType.venuePolicy,
            locationNote: meetingType.locationNote,
            videoMode: meetingType.videoUrl.trim() ? "custom" : "jitsi",
            videoUrl: meetingType.videoUrl,
            suffix: meetingType.slug,
            active: meetingType.active,
            approvalMode:
              meetingType.approvalMode === "MANUAL" ||
              meetingType.approvalMode === "CONDITIONAL" ||
              meetingType.approvalMode === "CONNECTIONS"
                ? meetingType.approvalMode
                : "AUTO",
            requireKnownGuest: rules.requireKnownGuest,
            minNoticeHours:
              rules.minNoticeHours == null ? "" : String(rules.minNoticeHours),
            hostReminder,
            guestReminder,
            availabilityJson: meetingType.availabilityJson,
          }}
        />
      </div>
    </main>
  );
}
