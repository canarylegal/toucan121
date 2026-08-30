import Link from "next/link";

export function CalendarConnectBanner({
  className = "mt-4",
}: {
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 ${className}`}
      role="status"
    >
      <p className="font-medium">Connect a calendar before people book you</p>
      <p className="mt-1 text-amber-900/90">
        Without a calendar, Toucan only knows your weekly hours and bookings made
        here — not busy time in Outlook, Google, or CalDAV. Confirmed meetings
        also won&apos;t appear on your real calendar.
      </p>
      <p className="mt-2">
        <Link
          href="/dash/calendar"
          className="font-semibold text-amber-950 underline underline-offset-2 hover:opacity-80"
        >
          Connect calendar
        </Link>
      </p>
    </div>
  );
}
