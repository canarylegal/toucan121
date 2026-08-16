import { createDAVClient, type DAVCalendar } from "tsdav";
import { randomUUID } from "crypto";
import { fromZonedTime } from "date-fns-tz";
import type {
  BusyBlock,
  CalendarAdapter,
  CalendarEventInput,
} from "@/lib/calendar/adapters";

export type CalDavConfig = {
  serverUrl: string;
  username: string;
  password: string;
  calendarUrl: string;
  calendarDisplayName?: string;
};

export type CalDavCalendarOption = {
  url: string;
  displayName: string;
};

function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

async function makeClient(config: Pick<CalDavConfig, "serverUrl" | "username" | "password">) {
  return createDAVClient({
    serverUrl: normalizeServerUrl(config.serverUrl),
    credentials: {
      username: config.username,
      password: config.password,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
}

function calendarLabel(cal: DAVCalendar): string {
  const raw = cal.displayName;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (raw && typeof raw === "object" && "value" in raw) {
    const value = (raw as { value?: string }).value;
    if (value?.trim()) return value.trim();
  }
  try {
    return new URL(cal.url).pathname.split("/").filter(Boolean).pop() ?? cal.url;
  } catch {
    return cal.url;
  }
}

/** Discover calendars for the given CalDAV account. */
export async function listCalDavCalendars(opts: {
  serverUrl: string;
  username: string;
  password: string;
}): Promise<CalDavCalendarOption[]> {
  const client = await makeClient(opts);
  const calendars = await client.fetchCalendars();
  return calendars.map((cal) => ({
    url: cal.url,
    displayName: calendarLabel(cal),
  }));
}

function unfoldIcs(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

/** Map common Windows / ICS TZIDs to IANA zones we can resolve. */
function mapIcalTzid(tzid: string | undefined): string | null {
  if (!tzid) return null;
  const t = tzid.trim();
  if (/^Europe\//i.test(t) || /^UTC$/i.test(t) || /^Etc\//i.test(t)) {
    return t;
  }
  const lower = t.toLowerCase();
  if (
    lower === "gmt standard time" ||
    lower === "gmt daylight time" ||
    lower === "greenwich mean time" ||
    lower === "britain ireland and portugal"
  ) {
    return "Europe/London";
  }
  return null;
}

function parseIcalDate(
  value: string,
  tzid?: string,
): Date | null {
  const v = value.trim();
  // DATE only: 20260812
  if (/^\d{8}$/.test(v)) {
    const y = Number(v.slice(0, 4));
    const m = Number(v.slice(4, 6)) - 1;
    const d = Number(v.slice(6, 8));
    return new Date(Date.UTC(y, m, d));
  }
  // UTC: 20260812T090000Z
  const utc = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utc) {
    return new Date(
      Date.UTC(
        Number(utc[1]),
        Number(utc[2]) - 1,
        Number(utc[3]),
        Number(utc[4]),
        Number(utc[5]),
        Number(utc[6]),
      ),
    );
  }
  // Local floating / TZID: 20260812T090000
  const local = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (local) {
    const y = Number(local[1]);
    const mo = Number(local[2]);
    const d = Number(local[3]);
    const h = Number(local[4]);
    const mi = Number(local[5]);
    const s = Number(local[6]);
    const zone = mapIcalTzid(tzid);
    if (zone) {
      const stamp = `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      return fromZonedTime(stamp, zone);
    }
    return new Date(y, mo - 1, d, h, mi, s);
  }
  const asIso = new Date(v);
  return Number.isNaN(asIso.getTime()) ? null : asIso;
}

/** Read a property from a single VEVENT body (not the whole calendar). */
function extractProp(
  veventBody: string,
  name: string,
): { value: string; tzid?: string } | null {
  const re = new RegExp(`^${name}(;[^:\\n]*)?:([^\\n\\r]+)$`, "im");
  const match = veventBody.match(re);
  if (!match) return null;
  const params = match[1] ?? "";
  const value = match[2]!.trim();
  const tzid = params.match(/;TZID=([^;:]+)/i)?.[1]?.trim().replace(/^"|"$/g, "");
  return { value, tzid };
}

function isTransparent(veventBody: string): boolean {
  return /^TRANSP:TRANSPARENT\s*$/im.test(veventBody);
}

function extractVeventBodies(ics: string): string[] {
  const unfolded = unfoldIcs(ics);
  const bodies: string[] = [];
  const re = /BEGIN:VEVENT\r?\n([\s\S]*?)END:VEVENT/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(unfolded))) {
    bodies.push(match[1] ?? "");
  }
  return bodies;
}

function parseBusyFromVevent(veventBody: string): BusyBlock | null {
  if (isTransparent(veventBody)) return null;

  const startProp = extractProp(veventBody, "DTSTART");
  if (!startProp) return null;
  const startsAt = parseIcalDate(startProp.value, startProp.tzid);
  if (!startsAt) return null;

  let endsAt: Date | null = null;
  const endProp = extractProp(veventBody, "DTEND");
  if (endProp) {
    endsAt = parseIcalDate(endProp.value, endProp.tzid ?? startProp.tzid);
  } else {
    const duration = extractProp(veventBody, "DURATION");
    if (duration) {
      endsAt = addIcalDuration(startsAt, duration.value);
    } else if (/^\d{8}$/.test(startProp.value.trim())) {
      endsAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);
    }
  }
  if (!endsAt || !(endsAt > startsAt)) return null;

  // Guard against corrupt / mis-parsed multi-year blocks
  const maxMs = 14 * 24 * 60 * 60 * 1000;
  if (endsAt.getTime() - startsAt.getTime() > maxMs) {
    return null;
  }

  const title = extractProp(veventBody, "SUMMARY")?.value;
  return { startsAt, endsAt, title };
}

function parseBusyFromIcs(ics: string): BusyBlock[] {
  if (!/BEGIN:VEVENT/i.test(ics)) return [];
  const blocks: BusyBlock[] = [];
  for (const body of extractVeventBodies(ics)) {
    const block = parseBusyFromVevent(body);
    if (block) blocks.push(block);
  }
  return blocks;
}

function addIcalDuration(start: Date, duration: string): Date | null {
  // Basic PT#H#M / P#D support
  const match = duration.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i,
  );
  if (!match) return null;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const mins = Number(match[3] ?? 0);
  const secs = Number(match[4] ?? 0);
  return new Date(
    start.getTime() +
      ((days * 24 + hours) * 60 + mins) * 60 * 1000 +
      secs * 1000,
  );
}

function formatIcalUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildEventIcs(input: CalendarEventInput & { uid: string }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Toucan 121//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${formatIcalUtc(new Date())}`,
    `DTSTART:${formatIcalUtc(input.startsAt)}`,
    `DTEND:${formatIcalUtc(input.endsAt)}`,
    `SUMMARY:${escapeIcalText(input.title)}`,
    "TRANSP:OPAQUE",
    "STATUS:CONFIRMED",
  ];
  if (input.description) {
    lines.push(`DESCRIPTION:${escapeIcalText(input.description)}`);
  }
  if (input.location) {
    lines.push(`LOCATION:${escapeIcalText(input.location)}`);
  }
  if (input.attendeeEmail) {
    lines.push(
      `ATTENDEE;CN=${escapeIcalText(input.attendeeEmail)};RSVP=TRUE:mailto:${input.attendeeEmail}`,
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export function createCalDavAdapter(config: CalDavConfig): CalendarAdapter {
  return {
    async listBusy(rangeStart, rangeEnd) {
      const client = await makeClient(config);
      const calendars = await client.fetchCalendars();
      const calendar = calendars.find((c) => c.url === config.calendarUrl);
      if (!calendar) {
        throw new Error(
          "Connected CalDAV calendar was not found — reconnect it in Host settings",
        );
      }

      const objects = await client.fetchCalendarObjects({
        calendar,
        timeRange: {
          start: rangeStart.toISOString(),
          end: rangeEnd.toISOString(),
        },
        expand: true,
      });

      const busy: BusyBlock[] = [];
      for (const obj of objects) {
        if (!obj.data) continue;
        for (const block of parseBusyFromIcs(obj.data)) {
          if (block.startsAt < rangeEnd && block.endsAt > rangeStart) {
            busy.push(block);
          }
        }
      }
      return busy;
    },

    async createEvent(input) {
      const client = await makeClient(config);
      const calendars = await client.fetchCalendars();
      const calendar = calendars.find((c) => c.url === config.calendarUrl);
      if (!calendar) {
        throw new Error(
          "Connected CalDAV calendar was not found — reconnect it in Host settings",
        );
      }

      const uid = input.uid?.trim() || randomUUID();
      const filename = `${uid}.ics`;
      const iCalString = buildEventIcs({ ...input, uid });

      const res = await client.createCalendarObject({
        calendar,
        filename,
        iCalString,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `CalDAV create failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
        );
      }

      // Prefer object URL if returned via Location header
      const location = res.headers.get("location");
      return { eventId: location || `${config.calendarUrl}${filename}` };
    },

    async cancelEvent(eventId) {
      if (!eventId || eventId.startsWith("local-")) return;
      const client = await makeClient(config);
      const res = await client.deleteCalendarObject({
        calendarObject: { url: eventId },
      });
      if (!res.ok && res.status !== 404) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `CalDAV delete failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
        );
      }
    },
  };
}

/** Verify credentials and that the chosen calendar exists. */
export async function verifyCalDavConfig(
  config: CalDavConfig,
): Promise<{ ok: true; displayName: string }> {
  const calendars = await listCalDavCalendars(config);
  const match = calendars.find((c) => c.url === config.calendarUrl);
  if (!match) {
    throw new Error("Selected calendar was not found on that account");
  }
  return { ok: true, displayName: match.displayName };
}
