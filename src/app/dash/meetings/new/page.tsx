import Link from "next/link";
import { requireBookingHostOrRedirect } from "@/lib/current-user";
import { DEFAULT_WEEKDAY_WINDOWS } from "@/lib/availability";
import { DEFAULT_REMINDER_PREFS } from "@/lib/reminders";
import { MeetingTypeForm } from "@/components/meeting-type-form";
import { CalendarConnectBanner } from "@/components/calendar-connect-banner";
import { hostHasConnectedCalendarById } from "@/lib/calendar/host-calendar";

export const dynamic = "force-dynamic";

export default async function NewMeetingTypePage() {
  const host = await requireBookingHostOrRedirect();
  const calendarConnected = await hostHasConnectedCalendarById(host.id);

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <Link href="/dash" className="text-sm text-muted hover:text-foreground">
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-serif text-4xl tracking-tight">
        New meeting type
      </h1>
      {!calendarConnected ? (
        <CalendarConnectBanner className="mt-6" />
      ) : null}
      <div className="mt-8 rounded-lg border border-line bg-panel p-5">
        <MeetingTypeForm
          mode="create"
          bookingPreviewPath={host.slug}
          initialWindows={DEFAULT_WEEKDAY_WINDOWS}
          initial={{
            title: "",
            description: "",
            durationMins: "30",
            bufferBefore: "0",
            bufferAfter: "0",
            locationType: "VIDEO",
            venuePolicy: "HOST_FIXED",
            locationNote: "",
            videoMode: "jitsi",
            videoUrl: "",
            suffix: "",
            active: true,
            approvalMode: "AUTO",
            requireKnownGuest: false,
            minNoticeHours: "",
            hostReminder: DEFAULT_REMINDER_PREFS,
            guestReminder: DEFAULT_REMINDER_PREFS,
            availabilityJson: JSON.stringify(DEFAULT_WEEKDAY_WINDOWS),
          }}
        />
      </div>
    </main>
  );
}
