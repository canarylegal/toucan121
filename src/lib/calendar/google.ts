import type {
  BusyBlock,
  CalendarAdapter,
  CalendarEventInput,
} from "@/lib/calendar/adapters";
import { decryptConfigJson } from "@/lib/calendar/config-secrets";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export type GoogleConfig = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  accountEmail?: string;
  calendarId?: string;
  calendarDisplayName?: string;
};

export type GoogleCalendarOption = {
  id: string;
  displayName: string;
  canEdit: boolean;
};

export type GoogleEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function getGoogleEnv(): GoogleEnv | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/calendar/google/callback`,
  };
}

export function isGoogleConfigured(): boolean {
  return getGoogleEnv() !== null;
}

/** Hosts cannot connect Google until Cloud verification is complete. */
export const HOST_GOOGLE_CONNECT_ENABLED = false;

export function isHostGoogleConnectEnabled(): boolean {
  return HOST_GOOGLE_CONNECT_ENABLED && isGoogleConfigured();
}

export function buildGoogleAuthorizeUrl(state: string): string {
  const env = getGoogleEnv();
  if (!env) throw new Error("Google Calendar is not configured");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("redirect_uri", env.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
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
  const env = getGoogleEnv();
  if (!env) throw new Error("Google Calendar is not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
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
      json.error_description || json.error || "Google token exchange failed",
    );
  }
  if (!json.access_token) {
    throw new Error("Google token response missing access_token");
  }
  return json;
}

export async function exchangeGoogleCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const env = getGoogleEnv();
  if (!env) throw new Error("Google Calendar is not configured");

  const json = await exchangeToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.redirectUri,
  });

  if (!json.refresh_token) {
    throw new Error(
      "Google did not return a refresh token — revoke Toucan access in your Google Account and connect again (prompt=consent).",
    );
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

export async function refreshGoogleTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const json = await exchangeToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

export function parseGoogleConfig(configJson: string): GoogleConfig | null {
  try {
    const parsed = JSON.parse(
      decryptConfigJson(configJson),
    ) as Partial<GoogleConfig>;
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

async function googleFetch(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export async function fetchGoogleProfile(
  accessToken: string,
): Promise<{ email?: string; displayName?: string }> {
  const res = await googleFetch(
    accessToken,
    "https://www.googleapis.com/oauth2/v2/userinfo",
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Google userinfo failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }
  const me = (await res.json()) as {
    email?: string;
    name?: string;
  };
  return { email: me.email, displayName: me.name };
}

export async function listGoogleCalendars(
  accessToken: string,
): Promise<GoogleCalendarOption[]> {
  const res = await googleFetch(
    accessToken,
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=100",
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Google calendarList failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }
  const data = (await res.json()) as {
    items?: Array<{
      id?: string;
      summary?: string;
      accessRole?: string;
      primary?: boolean;
    }>;
  };

  return (data.items ?? [])
    .filter((c) => {
      const role = (c.accessRole ?? "").toLowerCase();
      return role === "owner" || role === "writer";
    })
    .map((c) => ({
      id: c.id!,
      displayName:
        c.summary?.trim() || (c.primary ? "Primary" : "Calendar"),
      canEdit: true,
    }))
    .filter((c) => Boolean(c.id));
}

export async function withValidGoogleAccess(
  config: GoogleConfig,
  persist: (next: GoogleConfig) => Promise<void>,
): Promise<string> {
  if (config.expiresAt > Date.now() + 2 * 60 * 1000) {
    return config.accessToken;
  }

  const refreshed = await refreshGoogleTokens(config.refreshToken);
  const next: GoogleConfig = {
    ...config,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: refreshed.expiresAt,
  };
  await persist(next);
  return next.accessToken;
}

function parseGoogleDateTime(ev: {
  dateTime?: string;
  date?: string;
}): Date | null {
  if (ev.dateTime) {
    const d = new Date(ev.dateTime);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (ev.date) {
    // All-day: treat as UTC midnight of that date
    const d = new Date(`${ev.date}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function createGoogleAdapter(
  config: GoogleConfig,
  persist: (next: GoogleConfig) => Promise<void>,
): CalendarAdapter {
  if (!config.calendarId) {
    throw new Error("Google calendar is not selected yet");
  }
  const calendarId = config.calendarId;

  return {
    async listBusy(rangeStart, rangeEnd) {
      const token = await withValidGoogleAccess(config, persist);
      const busy: BusyBlock[] = [];
      let pageToken: string | undefined;

      do {
        const params = new URLSearchParams({
          timeMin: rangeStart.toISOString(),
          timeMax: rangeEnd.toISOString(),
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "250",
        });
        if (pageToken) params.set("pageToken", pageToken);

        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
        const res = await googleFetch(token, url);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `Google events.list failed (${res.status}): ${text.slice(0, 200)}`,
          );
        }
        const data = (await res.json()) as {
          items?: Array<{
            summary?: string;
            status?: string;
            transparency?: string;
            start?: { dateTime?: string; date?: string };
            end?: { dateTime?: string; date?: string };
          }>;
          nextPageToken?: string;
        };

        for (const ev of data.items ?? []) {
          if (ev.status === "cancelled") continue;
          if ((ev.transparency ?? "opaque").toLowerCase() === "transparent") {
            continue;
          }
          const startsAt = ev.start ? parseGoogleDateTime(ev.start) : null;
          const endsAt = ev.end ? parseGoogleDateTime(ev.end) : null;
          if (!startsAt || !endsAt) continue;
          busy.push({
            startsAt,
            endsAt,
            title: ev.summary,
          });
        }
        pageToken = data.nextPageToken;
      } while (pageToken);

      return busy;
    },

    async createEvent(input: CalendarEventInput) {
      const token = await withValidGoogleAccess(config, persist);
      const body: Record<string, unknown> = {
        summary: input.title,
        description: input.description ?? "",
        location: input.location,
        start: { dateTime: input.startsAt.toISOString() },
        end: { dateTime: input.endsAt.toISOString() },
      };
      if (input.uid) {
        body.iCalUID = input.uid;
      }
      if (input.attendeeEmail) {
        body.attendees = [{ email: input.attendeeEmail }];
      }

      const res = await googleFetch(
        token,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        { method: "POST", body: JSON.stringify(body) },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Google createEvent failed (${res.status}): ${text.slice(0, 200)}`,
        );
      }
      const created = (await res.json()) as { id?: string };
      if (!created.id) throw new Error("Google createEvent missing id");
      return { eventId: created.id };
    },

    async cancelEvent(eventId: string) {
      const token = await withValidGoogleAccess(config, persist);
      const res = await googleFetch(
        token,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        const text = await res.text();
        throw new Error(
          `Google cancelEvent failed (${res.status}): ${text.slice(0, 200)}`,
        );
      }
    },
  };
}
