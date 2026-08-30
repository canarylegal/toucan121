import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBookingHostOrRedirect } from "@/lib/current-user";
import {
  currentDayKey,
  currentMonthKey,
  currentWeekStartKey,
  getHostDaySchedule,
  getHostListSchedule,
  getHostMonthSchedule,
  getHostWeekSchedule,
} from "@/lib/host-schedule";
import { HostScheduleView } from "@/components/host-schedule-view";
import type { ScheduleViewMode } from "@/lib/schedule-view-actions";
import { CalendarConnectBanner } from "@/components/calendar-connect-banner";
import { hostHasConnectedCalendar } from "@/lib/calendar/host-calendar";

export const dynamic = "force-dynamic";

const VIEWS = new Set(["DAY", "WEEK", "MONTH", "LIST"]);

export default async function HostSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    day?: string;
    week?: string;
    month?: string;
  }>;
}) {
  const sessionHost = await requireBookingHostOrRedirect();

  const host = await prisma.host.findUnique({
    where: { id: sessionHost.id },
    include: { calendars: true },
  });
  if (!host) redirect("/dash/hosting/setup");

  const q = await searchParams;
  const view = (
    q.view && VIEWS.has(q.view) ? q.view : host.scheduleView
  ) as ScheduleViewMode;

  const focusDay =
    q.day && /^\d{4}-\d{2}-\d{2}$/.test(q.day)
      ? q.day
      : currentDayKey(host.timezone);
  const weekStartKey =
    q.week && /^\d{4}-\d{2}-\d{2}$/.test(q.week)
      ? q.week
      : currentWeekStartKey(host.timezone);
  const monthKey =
    q.month && /^\d{4}-\d{2}$/.test(q.month)
      ? q.month
      : currentMonthKey(host.timezone);

  let items: Awaited<ReturnType<typeof getHostMonthSchedule>>["items"] = [];
  let weekDays: Awaited<ReturnType<typeof getHostWeekSchedule>>["days"] = [];

  if (view === "DAY") {
    const data = await getHostDaySchedule({
      hostId: host.id,
      timezone: host.timezone,
      dayKey: focusDay,
    });
    items = data.items;
  } else if (view === "WEEK") {
    const data = await getHostWeekSchedule({
      hostId: host.id,
      timezone: host.timezone,
      weekStartKey,
    });
    weekDays = data.days;
    items = data.items;
  } else if (view === "LIST") {
    const data = await getHostListSchedule({
      hostId: host.id,
      timezone: host.timezone,
      fromDayKey: `${monthKey}-01`,
      daysAhead: 42,
    });
    items = data.items;
  } else {
    const data = await getHostMonthSchedule({
      hostId: host.id,
      timezone: host.timezone,
      monthKey,
    });
    items = data.items;
  }

  const writeConn = host.calendars.find((c) => c.writeTarget);
  const syncsToCalendar =
    writeConn?.provider === "CALDAV" ||
    writeConn?.provider === "OUTLOOK" ||
    writeConn?.provider === "GOOGLE";
  const calendarConnected = hostHasConnectedCalendar(host.calendars);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <Link href="/dash" className="text-sm text-muted hover:text-foreground">
        ← Dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Schedule</h1>
          <p className="mt-2 text-muted">
            Bookings, busy times, and one-off blocks · {host.timezone}
          </p>
        </div>
        <Link
          href="/dash/calendar"
          className="text-sm font-medium text-accent underline"
        >
          {calendarConnected ? "Calendar connection" : "Connect calendar"}
        </Link>
      </div>

      {!calendarConnected ? <CalendarConnectBanner /> : null}

      <div className="mt-8 rounded-lg border border-line bg-panel p-5 sm:p-8">
        <HostScheduleView
          key={`${view}-${focusDay}-${weekStartKey}-${monthKey}`}
          timezone={host.timezone}
          initialView={view}
          initialFocusKey={focusDay}
          weekStartKey={weekStartKey}
          monthKey={monthKey}
          weekDays={weekDays}
          items={items}
          syncsToCalendar={syncsToCalendar}
        />
      </div>
    </main>
  );
}
