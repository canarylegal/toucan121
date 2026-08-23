"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";
import { requireHost } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import {
  listCalDavCalendars,
  verifyCalDavConfig,
  type CalDavCalendarOption,
  type CalDavConfig,
} from "@/lib/calendar/caldav";
import { encodeCalendarConfig } from "@/lib/calendar/config-secrets";
import {
  describeRepublish,
  republishHostMeetingsToWriteCalendar,
} from "@/lib/calendar/republish";
import {
  listOutlookCalendars,
  parseOutlookConfig,
  withValidOutlookAccess,
  type OutlookCalendarOption,
  type OutlookConfig,
} from "@/lib/calendar/outlook";
import {
  isHostGoogleConnectEnabled,
  listGoogleCalendars,
  parseGoogleConfig,
  withValidGoogleAccess,
  type GoogleCalendarOption,
  type GoogleConfig,
} from "@/lib/calendar/google";

export type CalendarFormState = {
  error?: string;
  success?: string;
  step: "credentials" | "pick-calendar" | "confirm" | "done";
  values?: {
    serverUrl: string;
    username: string;
    password: string;
  };
  calendars?: CalDavCalendarOption[];
  /** Calendar waiting on explicit sync confirmation */
  pendingCalendar?: CalDavCalendarOption;
  formKey?: number;
};

export type OutlookPickState = {
  error?: string;
  success?: string;
};

export type GooglePickState = {
  error?: string;
  success?: string;
};

const credsSchema = z.object({
  serverUrl: z.string().trim().url("Enter a valid CalDAV server URL"),
  username: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(500),
});

function friendly(err: unknown): string {
  if (err instanceof ZodError) {
    return err.issues[0]?.message ?? "Invalid input";
  }
  if (err instanceof Error) {
    const msg = err.message;
    if (/401|unauthorized|auth/i.test(msg)) {
      return "Could not authenticate — check username and password (use an app password if required).";
    }
    if (/ENOTFOUND|ECONNREFUSED|fetch failed|network/i.test(msg)) {
      return "Could not reach that CalDAV server — check the URL.";
    }
    return msg;
  }
  return "Could not connect to CalDAV";
}

function readCreds(formData: FormData) {
  return {
    serverUrl: String(formData.get("serverUrl") ?? ""),
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
}

function readCalendars(formData: FormData): CalDavCalendarOption[] | null {
  const raw = String(formData.get("calendarsJson") ?? "");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CalDavCalendarOption[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function revalidateHost(slug: string) {
  revalidatePath("/dash");
  revalidatePath("/dash/calendar");
  revalidatePath("/dash/schedule");
  revalidatePath(`/${slug}`);
}

/** One write/read calendar for v1 — replace all prior connections. */
async function replacePrimaryConnection(opts: {
  hostId: string;
  provider: "CALDAV" | "OUTLOOK" | "GOOGLE";
  label: string;
  configJson: string;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.calendarConnection.deleteMany({ where: { hostId: opts.hostId } });
    await tx.calendarConnection.create({
      data: {
        hostId: opts.hostId,
        provider: opts.provider,
        label: opts.label,
        configJson: opts.configJson,
        isPrimary: true,
        writeTarget: true,
      },
    });
  });
  return republishHostMeetingsToWriteCalendar(opts.hostId);
}

export async function calendarConnectAction(
  prev: CalendarFormState,
  formData: FormData,
): Promise<CalendarFormState> {
  const intent = String(formData.get("intent") ?? "discover");
  const values = readCreds(formData);
  const formKey = (prev.formKey ?? 0) + 1;

  try {
    await requireHost();
    const creds = credsSchema.parse(values);

    if (intent === "back") {
      const calendars =
        readCalendars(formData) ?? prev.calendars ?? undefined;
      if (calendars && calendars.length > 1) {
        return {
          step: "pick-calendar",
          values,
          calendars,
          formKey,
        };
      }
      return {
        step: "credentials",
        values,
        formKey,
      };
    }

    if (intent === "confirm") {
      const calendarUrl = String(formData.get("calendarUrl") ?? "").trim();
      const confirmed = String(formData.get("confirmSync") ?? "") === "yes";
      const calendars =
        readCalendars(formData) ??
        prev.calendars ??
        (prev.pendingCalendar ? [prev.pendingCalendar] : null) ??
        (await listCalDavCalendars(creds));

      const selected =
        calendars.find((c) => c.url === calendarUrl) ??
        calendars.find(
          (c) =>
            c.url.replace(/\/$/, "") === calendarUrl.replace(/\/$/, ""),
        ) ??
        (prev.pendingCalendar?.url === calendarUrl
          ? prev.pendingCalendar
          : undefined);

      if (!selected) {
        return {
          error: "That calendar is no longer in the list — try connecting again.",
          values,
          calendars,
          step: "pick-calendar",
          formKey,
        };
      }

      if (!confirmed) {
        return {
          error:
            "Please confirm you want existing events on this calendar to block availability.",
          values,
          calendars,
          pendingCalendar: selected,
          step: "confirm",
          formKey,
        };
      }

      const copied = await saveCalDavConnection({
        ...creds,
        calendarUrl: selected.url,
        calendarDisplayName: selected.displayName,
      });

      return {
        success: `Connected “${selected.displayName}”.${describeRepublish(copied)}`,
        step: "done",
        formKey,
      };
    }

    if (intent === "select") {
      const calendarUrl = String(formData.get("calendarUrl") ?? "").trim();
      const calendars =
        readCalendars(formData) ??
        prev.calendars ??
        (await listCalDavCalendars(creds));

      if (!calendarUrl) {
        return {
          error: "Choose a calendar, then continue.",
          values,
          calendars,
          step: "pick-calendar",
          formKey,
        };
      }

      const selected =
        calendars.find((c) => c.url === calendarUrl) ??
        calendars.find(
          (c) =>
            c.url.replace(/\/$/, "") === calendarUrl.replace(/\/$/, ""),
        );

      if (!selected) {
        return {
          error: "That calendar is no longer in the list — try connecting again.",
          values,
          calendars,
          step: "pick-calendar",
          formKey,
        };
      }

      // Always pause for explicit confirmation before treating events as busy.
      return {
        step: "confirm",
        values,
        calendars,
        pendingCalendar: selected,
        formKey,
      };
    }

    // discover
    const calendars = await listCalDavCalendars(creds);
    if (calendars.length === 0) {
      return {
        error: "No calendars found on that account",
        values,
        formKey,
        step: "credentials",
      };
    }
    if (calendars.length === 1) {
      return {
        step: "confirm",
        values,
        calendars,
        pendingCalendar: calendars[0],
        formKey,
      };
    }

    return {
      step: "pick-calendar",
      values,
      calendars,
      formKey,
    };
  } catch (err) {
    const fallbackStep =
      intent === "confirm"
        ? "confirm"
        : intent === "select"
          ? "pick-calendar"
          : "credentials";
    return {
      error: friendly(err),
      values,
      calendars:
        intent === "select" || intent === "confirm" ? prev.calendars : undefined,
      pendingCalendar: intent === "confirm" ? prev.pendingCalendar : undefined,
      formKey,
      step: fallbackStep,
    };
  }
}

async function saveCalDavConnection(config: CalDavConfig) {
  const host = await requireHost();
  await verifyCalDavConfig(config);

  const copied = await replacePrimaryConnection({
    hostId: host.id,
    provider: "CALDAV",
    label: config.calendarDisplayName || "CalDAV",
    configJson: encodeCalendarConfig(config),
  });

  revalidateHost(host.slug);
  return copied;
}

export async function disconnectCalendarAction() {
  const host = await requireHost();
  await prisma.calendarConnection.deleteMany({
    where: { hostId: host.id },
  });
  revalidateHost(host.slug);
}

/** @deprecated use disconnectCalendarAction */
export async function disconnectCalDavAction() {
  return disconnectCalendarAction();
}

export async function selectOutlookCalendarAction(
  _prev: OutlookPickState,
  formData: FormData,
): Promise<OutlookPickState> {
  try {
    const confirmed = String(formData.get("confirmSync") ?? "") === "yes";
    if (!confirmed) {
      return {
        error:
          "Please confirm you want existing events on this calendar to block availability.",
      };
    }

    const host = await requireHost();
    const calendarId = String(formData.get("calendarId") ?? "").trim();
    if (!calendarId) {
      return { error: "Choose a calendar, then confirm." };
    }

    const conn = await prisma.calendarConnection.findFirst({
      where: { hostId: host.id, provider: "OUTLOOK" },
      orderBy: { createdAt: "desc" },
    });
    if (!conn) {
      return { error: "Outlook sign-in expired — connect again." };
    }

    let config = parseOutlookConfig(conn.configJson);
    if (!config) {
      return { error: "Outlook credentials are invalid — connect again." };
    }

    const token = await withValidOutlookAccess(config, async (next) => {
      config = next;
      await prisma.calendarConnection.update({
        where: { id: conn.id },
        data: { configJson: encodeCalendarConfig(next) },
      });
    });

    const calendars = await listOutlookCalendars(token);
    const selected = calendars.find((c) => c.id === calendarId);
    if (!selected) {
      return { error: "That calendar is no longer available — try again." };
    }

    const finalConfig: OutlookConfig = {
      ...config!,
      calendarId: selected.id,
      calendarDisplayName: selected.displayName,
    };

    const copied = await replacePrimaryConnection({
      hostId: host.id,
      provider: "OUTLOOK",
      label: selected.displayName || config!.accountEmail || "Outlook",
      configJson: encodeCalendarConfig(finalConfig),
    });

    revalidateHost(host.slug);
    return {
      success: `Connected “${selected.displayName}”.${describeRepublish(copied)}`,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Could not save Outlook calendar",
    };
  }
}

export async function cancelOutlookConnectAction() {
  const host = await requireHost();
  await prisma.calendarConnection.deleteMany({
    where: {
      hostId: host.id,
      provider: "OUTLOOK",
      writeTarget: false,
    },
  });
  revalidateHost(host.slug);
}

export async function loadOutlookCalendarOptions(): Promise<{
  calendars: OutlookCalendarOption[];
  accountEmail?: string;
  error?: string;
}> {
  try {
    const host = await requireHost();
    const conn = await prisma.calendarConnection.findFirst({
      where: { hostId: host.id, provider: "OUTLOOK" },
      orderBy: { createdAt: "desc" },
    });
    if (!conn) {
      return { calendars: [], error: "Outlook sign-in expired — connect again." };
    }
    let config = parseOutlookConfig(conn.configJson);
    if (!config) {
      return { calendars: [], error: "Outlook credentials are invalid." };
    }
    const token = await withValidOutlookAccess(config, async (next) => {
      config = next;
      await prisma.calendarConnection.update({
        where: { id: conn.id },
        data: { configJson: encodeCalendarConfig(next) },
      });
    });
    const calendars = await listOutlookCalendars(token);
    return { calendars, accountEmail: config?.accountEmail };
  } catch (err) {
    return {
      calendars: [],
      error:
        err instanceof Error
          ? err.message
          : "Could not list Outlook calendars",
    };
  }
}

export async function selectGoogleCalendarAction(
  _prev: GooglePickState,
  formData: FormData,
): Promise<GooglePickState> {
  try {
    if (!isHostGoogleConnectEnabled()) {
      return {
        error:
          "Google Calendar for hosts is currently unavailable. Guests can still add bookings from the invite email.",
      };
    }
    const confirmed = String(formData.get("confirmSync") ?? "") === "yes";
    if (!confirmed) {
      return {
        error:
          "Please confirm you want existing events on this calendar to block availability.",
      };
    }

    const host = await requireHost();
    const calendarId = String(formData.get("calendarId") ?? "").trim();
    if (!calendarId) {
      return { error: "Choose a calendar, then confirm." };
    }

    const conn = await prisma.calendarConnection.findFirst({
      where: { hostId: host.id, provider: "GOOGLE" },
      orderBy: { createdAt: "desc" },
    });
    if (!conn) {
      return { error: "Google sign-in expired — connect again." };
    }

    let config = parseGoogleConfig(conn.configJson);
    if (!config) {
      return { error: "Google credentials are invalid — connect again." };
    }

    const token = await withValidGoogleAccess(config, async (next) => {
      config = next;
      await prisma.calendarConnection.update({
        where: { id: conn.id },
        data: { configJson: encodeCalendarConfig(next) },
      });
    });

    const calendars = await listGoogleCalendars(token);
    const selected = calendars.find((c) => c.id === calendarId);
    if (!selected) {
      return { error: "That calendar is no longer available — try again." };
    }

    const finalConfig: GoogleConfig = {
      ...config!,
      calendarId: selected.id,
      calendarDisplayName: selected.displayName,
    };

    const copied = await replacePrimaryConnection({
      hostId: host.id,
      provider: "GOOGLE",
      label: selected.displayName || config!.accountEmail || "Google Calendar",
      configJson: encodeCalendarConfig(finalConfig),
    });

    revalidateHost(host.slug);
    return {
      success: `Connected “${selected.displayName}”.${describeRepublish(copied)}`,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Could not save Google calendar",
    };
  }
}

export async function cancelGoogleConnectAction() {
  const host = await requireHost();
  await prisma.calendarConnection.deleteMany({
    where: {
      hostId: host.id,
      provider: "GOOGLE",
      writeTarget: false,
    },
  });
  revalidateHost(host.slug);
}

export async function loadGoogleCalendarOptions(): Promise<{
  calendars: GoogleCalendarOption[];
  accountEmail?: string;
  error?: string;
}> {
  try {
    const host = await requireHost();
    const conn = await prisma.calendarConnection.findFirst({
      where: { hostId: host.id, provider: "GOOGLE" },
      orderBy: { createdAt: "desc" },
    });
    if (!conn) {
      return { calendars: [], error: "Google sign-in expired — connect again." };
    }
    let config = parseGoogleConfig(conn.configJson);
    if (!config) {
      return { calendars: [], error: "Google credentials are invalid." };
    }
    const token = await withValidGoogleAccess(config, async (next) => {
      config = next;
      await prisma.calendarConnection.update({
        where: { id: conn.id },
        data: { configJson: encodeCalendarConfig(next) },
      });
    });
    const calendars = await listGoogleCalendars(token);
    return { calendars, accountEmail: config?.accountEmail };
  } catch (err) {
    return {
      calendars: [],
      error:
        err instanceof Error
          ? err.message
          : "Could not list Google calendars",
    };
  }
}
