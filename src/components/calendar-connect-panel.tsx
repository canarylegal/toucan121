"use client";

import { useState } from "react";
import {
  CalendarProviderChooser,
  type CalendarProviderId,
} from "@/components/calendar-provider-chooser";
import { CalDavConnectForm } from "@/components/caldav-connect-form";
import { OutlookPickForm } from "@/components/outlook-pick-form";
import { GooglePickForm } from "@/components/google-pick-form";
import { disconnectCalendarAction } from "@/lib/calendar-actions";
import type { OutlookCalendarOption } from "@/lib/calendar/outlook";
import type { GoogleCalendarOption } from "@/lib/calendar/google";

type Connected =
  | {
      provider: "CALDAV";
      label: string;
      serverUrl: string;
      username: string;
      calendarDisplayName?: string;
    }
  | {
      provider: "OUTLOOK" | "GOOGLE";
      label: string;
      accountEmail?: string;
      calendarDisplayName?: string;
    };

type Props = {
  connected: Connected | null;
  outlookConfigured: boolean;
  googleConfigured: boolean;
  outlookPick?: {
    calendars: OutlookCalendarOption[];
    accountEmail?: string;
    error?: string;
  } | null;
  googlePick?: {
    calendars: GoogleCalendarOption[];
    accountEmail?: string;
    error?: string;
  } | null;
  flash?: { error?: string; success?: string };
  initialProvider?: CalendarProviderId | null;
};

function providerLabel(provider: Connected["provider"]) {
  if (provider === "CALDAV") return "CalDAV";
  if (provider === "GOOGLE") return "Google Calendar";
  return "Outlook / Microsoft 365";
}

export function CalendarConnectPanel({
  connected,
  outlookConfigured,
  googleConfigured,
  outlookPick,
  googlePick,
  flash,
  initialProvider = null,
}: Props) {
  const [provider, setProvider] = useState<CalendarProviderId | null>(
    initialProvider === "caldav"
      ? "caldav"
      : outlookPick
        ? "outlook"
        : googlePick
          ? "google"
          : null,
  );

  if (outlookPick) {
    return (
      <div className="space-y-4">
        {flash?.error ? (
          <p className="text-sm text-red-700">{flash.error}</p>
        ) : null}
        <OutlookPickForm
          calendars={outlookPick.calendars}
          accountEmail={outlookPick.accountEmail}
          listError={outlookPick.error}
        />
      </div>
    );
  }

  if (googlePick) {
    return (
      <div className="space-y-4">
        {flash?.error ? (
          <p className="text-sm text-red-700">{flash.error}</p>
        ) : null}
        <GooglePickForm
          calendars={googlePick.calendars}
          accountEmail={googlePick.accountEmail}
          listError={googlePick.error}
        />
      </div>
    );
  }

  if (connected && !provider) {
    return (
      <div className="space-y-4">
        {flash?.success ? (
          <p className="text-sm text-accent">{flash.success}</p>
        ) : null}
        {flash?.error ? (
          <p className="text-sm text-red-700">{flash.error}</p>
        ) : null}
        <div className="rounded-md border border-line bg-white px-4 py-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {providerLabel(connected.provider)}
          </p>
          <p className="mt-1 font-medium">
            {connected.calendarDisplayName || connected.label}
          </p>
          {connected.provider === "CALDAV" ? (
            <p className="mt-1 text-muted">
              {connected.username} · {connected.serverUrl}
            </p>
          ) : connected.accountEmail ? (
            <p className="mt-1 text-muted">{connected.accountEmail}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted">
            Bookings are written here and existing events block availability.
          </p>
        </div>
        <form action={disconnectCalendarAction}>
          <button
            type="submit"
            className="text-sm font-medium text-muted underline hover:text-foreground"
          >
            Disconnect calendar
          </button>
        </form>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-accent">
            Connect a different calendar
          </summary>
          <div className="mt-4">
            <CalendarProviderChooser
              outlookConfigured={outlookConfigured}
              googleConfigured={googleConfigured}
              onSelect={setProvider}
            />
          </div>
        </details>
      </div>
    );
  }

  if (provider === "caldav") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setProvider(null)}
          className="text-sm text-muted underline hover:text-foreground"
        >
          ← Choose provider
        </button>
        <CalDavConnectForm
          connected={
            connected?.provider === "CALDAV"
              ? {
                  label: connected.label,
                  serverUrl: connected.serverUrl,
                  username: connected.username,
                  calendarDisplayName: connected.calendarDisplayName,
                }
              : null
          }
          embedded
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {flash?.error ? (
        <p className="text-sm text-red-700">{flash.error}</p>
      ) : null}
      {flash?.success ? (
        <p className="text-sm text-accent">{flash.success}</p>
      ) : null}
      <CalendarProviderChooser
        outlookConfigured={outlookConfigured}
        googleConfigured={googleConfigured}
        onSelect={(p) => {
          if (p === "outlook" || p === "google") return;
          setProvider(p);
        }}
      />
      {connected ? (
        <button
          type="button"
          onClick={() => setProvider(null)}
          className="text-sm text-muted underline hover:text-foreground"
        >
          Cancel
        </button>
      ) : null}
    </div>
  );
}
