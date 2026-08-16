"use client";

import Link from "next/link";

export type CalendarProviderId = "caldav" | "outlook" | "google";

type Props = {
  outlookConfigured: boolean;
  googleConfigured: boolean;
  onSelect: (provider: CalendarProviderId) => void;
};

export function CalendarProviderChooser({
  outlookConfigured,
  googleConfigured,
  onSelect,
}: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Connect one calendar for busy times and bookings. You can switch
        providers later.
      </p>
      <ul className="space-y-2">
        <li>
          <button
            type="button"
            onClick={() => onSelect("caldav")}
            className="flex w-full flex-col items-start rounded-md border border-line bg-white px-4 py-3 text-left transition hover:border-accent hover:bg-accent-soft/50"
          >
            <span className="text-sm font-semibold">CalDAV</span>
            <span className="mt-0.5 text-xs text-muted">
              Nextcloud, Fastmail, iCloud (app password), and other CalDAV
              servers
            </span>
          </button>
        </li>
        <li>
          {outlookConfigured ? (
            <Link
              href="/api/calendar/outlook/start"
              className="flex w-full flex-col items-start rounded-md border border-line bg-white px-4 py-3 text-left transition hover:border-accent hover:bg-accent-soft/50"
            >
              <span className="text-sm font-semibold">
                Outlook / Microsoft 365
              </span>
              <span className="mt-0.5 text-xs text-muted">
                Sign in with Microsoft and pick a calendar
              </span>
            </Link>
          ) : (
            <div className="rounded-md border border-dashed border-line bg-white/60 px-4 py-3">
              <p className="text-sm font-semibold text-muted">
                Outlook / Microsoft 365
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Not configured yet — add{" "}
                <code className="text-[11px]">MICROSOFT_CLIENT_ID</code> and{" "}
                <code className="text-[11px]">MICROSOFT_CLIENT_SECRET</code> to
                your environment.
              </p>
            </div>
          )}
        </li>
        <li>
          {googleConfigured ? (
            <Link
              href="/api/calendar/google/start"
              className="flex w-full flex-col items-start rounded-md border border-line bg-white px-4 py-3 text-left transition hover:border-accent hover:bg-accent-soft/50"
            >
              <span className="text-sm font-semibold">Google Calendar</span>
              <span className="mt-0.5 text-xs text-muted">
                Sign in with Google and pick a calendar
              </span>
            </Link>
          ) : (
            <div className="rounded-md border border-dashed border-line bg-white/60 px-4 py-3 opacity-80">
              <p className="text-sm font-semibold text-muted">Google Calendar</p>
              <p className="mt-0.5 text-xs text-muted">
                Currently unavailable — guests can still add bookings to Google
                Calendar from the invite email.
              </p>
            </div>
          )}
        </li>
      </ul>
    </div>
  );
}
