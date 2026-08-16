import Link from "next/link";
import type { ComponentProps } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireHostOrRedirect } from "@/lib/current-user";
import {
  ensureHostCalendarSecretsEncrypted,
  parseCalDavConfig,
  parseGoogleConfig,
  parseOutlookConfig,
} from "@/lib/calendar/host-calendar";
import { isOutlookConfigured } from "@/lib/calendar/outlook";
import { isHostGoogleConnectEnabled } from "@/lib/calendar/google";
import {
  loadGoogleCalendarOptions,
  loadOutlookCalendarOptions,
} from "@/lib/calendar-actions";
import { CalendarConnectPanel } from "@/components/calendar-connect-panel";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  provider?: string;
  step?: string;
  error?: string;
  success?: string;
}>;

export default async function HostCalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sessionHost = await requireHostOrRedirect();
  const params = await searchParams;

  const host = await prisma.host.findUnique({
    where: { id: sessionHost.id },
    include: {
      calendars: {
        orderBy: [{ writeTarget: "desc" }, { createdAt: "desc" }],
      },
    },
  });
  if (!host) redirect("/dash/hosting/setup");

  await ensureHostCalendarSecretsEncrypted(host.id);

  const writeConn = host.calendars.find((c) => c.writeTarget) ?? null;
  const pendingOutlook = host.calendars.find((c) => {
    if (c.provider !== "OUTLOOK" || c.writeTarget) return false;
    const cfg = parseOutlookConfig(c.configJson);
    return !!cfg && !cfg.calendarId;
  });
  const pendingGoogle = host.calendars.find((c) => {
    if (c.provider !== "GOOGLE" || c.writeTarget) return false;
    const cfg = parseGoogleConfig(c.configJson);
    return !!cfg && !cfg.calendarId;
  });

  let connected: ComponentProps<typeof CalendarConnectPanel>["connected"] =
    null;

  if (writeConn?.provider === "CALDAV") {
    const config = parseCalDavConfig(writeConn.configJson);
    if (config) {
      connected = {
        provider: "CALDAV",
        label: writeConn.label,
        serverUrl: config.serverUrl,
        username: config.username,
        calendarDisplayName: config.calendarDisplayName,
      };
    }
  } else if (writeConn?.provider === "OUTLOOK") {
    const config = parseOutlookConfig(writeConn.configJson);
    if (config?.calendarId) {
      connected = {
        provider: "OUTLOOK",
        label: writeConn.label,
        accountEmail: config.accountEmail,
        calendarDisplayName: config.calendarDisplayName,
      };
    }
  } else if (writeConn?.provider === "GOOGLE") {
    const config = parseGoogleConfig(writeConn.configJson);
    if (config?.calendarId) {
      connected = {
        provider: "GOOGLE",
        label: writeConn.label,
        accountEmail: config.accountEmail,
        calendarDisplayName: config.calendarDisplayName,
      };
    }
  }

  let outlookPick: ComponentProps<
    typeof CalendarConnectPanel
  >["outlookPick"] = null;
  let googlePick: ComponentProps<
    typeof CalendarConnectPanel
  >["googlePick"] = null;

  if (pendingOutlook) {
    const listed = await loadOutlookCalendarOptions();
    outlookPick = {
      calendars: listed.calendars,
      accountEmail: listed.accountEmail,
      error: listed.error,
    };
  } else if (pendingGoogle && isHostGoogleConnectEnabled()) {
    const listed = await loadGoogleCalendarOptions();
    googlePick = {
      calendars: listed.calendars,
      accountEmail: listed.accountEmail,
      error: listed.error,
    };
  }

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <Link href="/dash" className="text-sm text-muted hover:text-foreground">
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-serif text-4xl tracking-tight">Calendar</h1>
      <p className="mt-2 text-muted">
        Connect CalDAV or Outlook so Toucan 121 can read busy times and write
        bookings.
      </p>
      <p className="mt-3 text-sm">
        <Link href="/dash/schedule" className="font-medium text-accent underline">
          View schedule preview
        </Link>
      </p>
      <div className="mt-8 rounded-lg border border-line bg-panel p-5">
        <CalendarConnectPanel
          connected={connected}
          outlookConfigured={isOutlookConfigured()}
          googleConfigured={isHostGoogleConnectEnabled()}
          outlookPick={outlookPick}
          googlePick={googlePick}
          flash={{
            error: params.error,
            success: params.success,
          }}
          initialProvider={params.provider === "caldav" ? "caldav" : null}
        />
      </div>
    </main>
  );
}
