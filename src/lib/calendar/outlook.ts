import type {
  BusyBlock,
  CalendarAdapter,
  CalendarEventInput,
} from "@/lib/calendar/adapters";
import { decryptConfigJson } from "@/lib/calendar/config-secrets";

export const OUTLOOK_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Calendars.ReadWrite",
].join(" ");

export type OutlookConfig = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  accountEmail?: string;
  calendarId?: string;
  calendarDisplayName?: string;
};

export type OutlookCalendarOption = {
  id: string;
  displayName: string;
  canEdit: boolean;
};

export type OutlookEnv = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
};

export function getOutlookEnv(): OutlookEnv | null {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  const tenantId = process.env.MICROSOFT_TENANT_ID?.trim() || "common";
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    tenantId,
    redirectUri: `${appUrl}/api/calendar/outlook/callback`,
  };
}

export function isOutlookConfigured(): boolean {
  return getOutlookEnv() !== null;
}

function tokenUrl(tenantId: string) {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

export function buildOutlookAuthorizeUrl(state: string): string {
  const env = getOutlookEnv();
  if (!env) throw new Error("Microsoft Outlook is not configured");

  const url = new URL(
    `https://login.microsoftonline.com/${env.tenantId}/oauth2/v2.0/authorize`,
  );
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", env.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", OUTLOOK_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

async function exchangeToken(body: Record<string, string>): Promise<TokenResponse> {
  const env = getOutlookEnv();
  if (!env) throw new Error("Microsoft Outlook is not configured");

  const res = await fetch(tokenUrl(env.tenantId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      ...body,
    }),
  });

  const json = (await res.json()) as TokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok) {
    throw new Error(
      json.error_description || json.error || "Microsoft token exchange failed",
    );
  }
  if (!json.access_token) {
    throw new Error("Microsoft token response missing access_token");
  }
  return json;
}

export async function exchangeOutlookCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const env = getOutlookEnv();
  if (!env) throw new Error("Microsoft Outlook is not configured");

  const json = await exchangeToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.redirectUri,
    scope: OUTLOOK_SCOPES,
  });

  if (!json.refresh_token) {
    throw new Error(
      "Microsoft did not return a refresh token — ensure offline_access is consented",
    );
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

export async function refreshOutlookTokens(
  refreshToken: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const json = await exchangeToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: OUTLOOK_SCOPES,
  });

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

export function parseOutlookConfig(configJson: string): OutlookConfig | null {
  try {
    const parsed = JSON.parse(decryptConfigJson(configJson)) as Partial<OutlookConfig>;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAt) {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: Number(parsed.expiresAt),
      accountEmail: parsed.accountEmail,
      calendarId: parsed.calendarId,
      calendarDisplayName: parsed.calendarDisplayName,
    };
  } catch {
    return null;
  }
}

async function graphFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = path.startsWith("http")
    ? path
    : `https://graph.microsoft.com/v1.0${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export async function fetchOutlookProfile(
  accessToken: string,
): Promise<{ email?: string; displayName?: string }> {
  const res = await graphFetch(accessToken, "/me");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph /me failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const me = (await res.json()) as {
    mail?: string;
    userPrincipalName?: string;
    displayName?: string;
  };
  return {
    email: me.mail || me.userPrincipalName,
    displayName: me.displayName,
  };
}

export async function listOutlookCalendars(
  accessToken: string,
): Promise<OutlookCalendarOption[]> {
  const res = await graphFetch(
    accessToken,
    "/me/calendars?$select=id,name,canEdit&$top=50",
  );
  if (res.ok) {
    const data = (await res.json()) as {
      value?: Array<{ id: string; name?: string; canEdit?: boolean }>;
    };
    return (data.value ?? [])
      .filter((c) => c.canEdit !== false)
      .map((c) => ({
        id: c.id,
        displayName: c.name?.trim() || "Calendar",
        canEdit: c.canEdit !== false,
      }));
  }

  const listStatus = res.status;
  const listBody = (await res.text()).slice(0, 200);

  // Personal MSAs sometimes 401 on /me/calendars while primary /me/calendar works
  const primary = await graphFetch(
    accessToken,
    "/me/calendar?$select=id,name,canEdit",
  );
  if (primary.ok) {
    const cal = (await primary.json()) as {
      id?: string;
      name?: string;
      canEdit?: boolean;
    };
    if (cal.id) {
      return [
        {
          id: cal.id,
          displayName: cal.name?.trim() || "Calendar",
          canEdit: cal.canEdit !== false,
        },
      ];
    }
  }

  const hint =
    listStatus === 401
      ? " Entra app must allow personal Microsoft accounts (Authentication → Supported account types). Also grant admin consent for Calendars.ReadWrite, and sign in with an account that has an Outlook calendar (not a no-reply mailbox without one)."
      : "";
  throw new Error(
    `Graph calendars failed (${listStatus}): ${listBody}${hint}`,
  );
}


/**
 * Ensure a valid access token, refreshing and persisting when needed.
 * `persist` writes updated tokens back to storage.
 */
export async function withValidOutlookAccess(
  config: OutlookConfig,
  persist: (next: OutlookConfig) => Promise<void>,
): Promise<string> {
  // Refresh 2 minutes early
  if (config.expiresAt > Date.now() + 2 * 60 * 1000) {
    return config.accessToken;
  }

  const refreshed = await refreshOutlookTokens(config.refreshToken);
  const next: OutlookConfig = {
    ...config,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: refreshed.expiresAt,
  };
  await persist(next);
  return next.accessToken;
}

function toGraphDateTime(d: Date) {
  return {
    dateTime: d.toISOString().replace(/\.\d{3}Z$/, ""),
    timeZone: "UTC",
  };
}

export function createOutlookAdapter(
  config: OutlookConfig,
  persist: (next: OutlookConfig) => Promise<void>,
): CalendarAdapter {
  if (!config.calendarId) {
    throw new Error("Outlook calendar is not selected yet");
  }
  const calendarId = config.calendarId;

  return {
    async listBusy(rangeStart, rangeEnd) {
      const token = await withValidOutlookAccess(config, persist);
      const params = new URLSearchParams({
        startDateTime: rangeStart.toISOString(),
        endDateTime: rangeEnd.toISOString(),
        $select: "subject,start,end,showAs,isCancelled",
        $top: "250",
      });
      const path = `/me/calendars/${encodeURIComponent(calendarId)}/calendarView?${params}`;
      const busy: BusyBlock[] = [];
      let nextUrl: string | null = path;

      while (nextUrl) {
        const res = await graphFetch(token, nextUrl);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `Graph calendarView failed (${res.status}): ${text.slice(0, 200)}`,
          );
        }
        const data = (await res.json()) as {
          value?: Array<{
            subject?: string;
            start?: { dateTime?: string; timeZone?: string };
            end?: { dateTime?: string; timeZone?: string };
            showAs?: string;
            isCancelled?: boolean;
          }>;
          "@odata.nextLink"?: string;
        };

        for (const ev of data.value ?? []) {
          if (ev.isCancelled) continue;
          const showAs = (ev.showAs ?? "busy").toLowerCase();
          if (showAs === "free" || showAs === "unknown") continue;
          const startRaw = ev.start?.dateTime;
          const endRaw = ev.end?.dateTime;
          if (!startRaw || !endRaw) continue;
          // Graph returns local wall time without Z when timeZone is set; treat as UTC if Z or append Z for UTC zone
          const startsAt = parseGraphDateTime(startRaw, ev.start?.timeZone);
          const endsAt = parseGraphDateTime(endRaw, ev.end?.timeZone);
          if (!startsAt || !endsAt) continue;
          busy.push({
            startsAt,
            endsAt,
            title: ev.subject,
          });
        }
        nextUrl = data["@odata.nextLink"] ?? null;
      }

      return busy;
    },

    async createEvent(input: CalendarEventInput) {
      const token = await withValidOutlookAccess(config, persist);
      const body: Record<string, unknown> = {
        subject: input.title,
        body: {
          contentType: "text",
          content: input.description ?? "",
        },
        start: toGraphDateTime(input.startsAt),
        end: toGraphDateTime(input.endsAt),
        location: input.location
          ? { displayName: input.location }
          : undefined,
      };
      if (input.attendeeEmail) {
        body.attendees = [
          {
            emailAddress: { address: input.attendeeEmail },
            type: "required",
          },
        ];
      }

      const res = await graphFetch(
        token,
        `/me/calendars/${encodeURIComponent(calendarId)}/events`,
        { method: "POST", body: JSON.stringify(body) },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Graph createEvent failed (${res.status}): ${text.slice(0, 200)}`,
        );
      }
      const created = (await res.json()) as { id?: string };
      if (!created.id) throw new Error("Graph createEvent missing id");
      return { eventId: created.id };
    },

    async cancelEvent(eventId: string) {
      const token = await withValidOutlookAccess(config, persist);
      const res = await graphFetch(
        token,
        `/me/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 404) {
        const text = await res.text();
        throw new Error(
          `Graph cancelEvent failed (${res.status}): ${text.slice(0, 200)}`,
        );
      }
    },
  };
}

function parseGraphDateTime(
  dateTime: string,
  timeZone?: string,
): Date | null {
  const raw = dateTime.trim();
  if (!raw) return null;
  // Already has offset or Z
  if (/Z$|[+-]\d{2}:\d{2}$/.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Graph often returns "2026-08-12T09:00:00.0000000" with timeZone "UTC"
  if (!timeZone || timeZone.toUpperCase() === "UTC") {
    const d = new Date(raw.endsWith("Z") ? raw : `${raw}Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Fallback: parse as UTC (host timezone handling is imperfect without a TZ lib here)
  const d = new Date(`${raw}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
