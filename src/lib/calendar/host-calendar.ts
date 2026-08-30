import { prisma } from "@/lib/db";
import {
  createLocalBusyAdapter,
  type BusyBlock,
  type CalendarAdapter,
} from "@/lib/calendar/adapters";
import {
  createCalDavAdapter,
  type CalDavConfig,
} from "@/lib/calendar/caldav";
import {
  encodeCalendarConfig,
  decryptConfigJson,
  encryptConfigJson,
  isEncryptedConfigJson,
} from "@/lib/calendar/config-secrets";
import {
  createOutlookAdapter,
  parseOutlookConfig,
  type OutlookConfig,
} from "@/lib/calendar/outlook";
import {
  createGoogleAdapter,
  parseGoogleConfig,
  type GoogleConfig,
} from "@/lib/calendar/google";
import { getCached, setCache } from "@/lib/ttl-cache";

export function parseCalDavConfig(configJson: string): CalDavConfig | null {
  try {
    const parsed = JSON.parse(decryptConfigJson(configJson)) as Partial<CalDavConfig>;
    if (
      !parsed.serverUrl ||
      !parsed.username ||
      !parsed.password ||
      !parsed.calendarUrl
    ) {
      return null;
    }
    return {
      serverUrl: parsed.serverUrl,
      username: parsed.username,
      password: parsed.password,
      calendarUrl: parsed.calendarUrl,
      calendarDisplayName: parsed.calendarDisplayName,
    };
  } catch {
    return null;
  }
}

export { parseOutlookConfig, parseGoogleConfig };

/** If a row still has plaintext config, rewrite it encrypted (one-shot migrate). */
export async function ensureEncryptedAtRest(
  connectionId: string,
  stored: string,
) {
  if (isEncryptedConfigJson(stored) || stored === "{}") return;
  try {
    const plain = decryptConfigJson(stored);
    JSON.parse(plain);
    await prisma.calendarConnection.update({
      where: { id: connectionId },
      data: { configJson: encryptConfigJson(plain) },
    });
  } catch (err) {
    console.error("[toucan:calendar] failed to encrypt existing config", err);
  }
}

/** Encrypt any plaintext calendar credentials for a host (dashboard entry). */
export async function ensureHostCalendarSecretsEncrypted(hostId: string) {
  const rows = await prisma.calendarConnection.findMany({
    where: { hostId },
    select: { id: true, configJson: true },
  });
  for (const row of rows) {
    await ensureEncryptedAtRest(row.id, row.configJson);
  }
}

async function persistOutlookConfig(
  connectionId: string,
  next: OutlookConfig,
) {
  await prisma.calendarConnection.update({
    where: { id: connectionId },
    data: {
      configJson: encodeCalendarConfig(next),
      label: next.calendarDisplayName || next.accountEmail || "Outlook",
    },
  });
}

async function persistGoogleConfig(
  connectionId: string,
  next: GoogleConfig,
) {
  await prisma.calendarConnection.update({
    where: { id: connectionId },
    data: {
      configJson: encodeCalendarConfig(next),
      label: next.calendarDisplayName || next.accountEmail || "Google Calendar",
    },
  });
}

/** Adapter used to write bookings (CalDAV/Outlook/Google if connected, else local log). */
export async function getHostWriteAdapter(
  hostId: string,
): Promise<CalendarAdapter> {
  const conn = await prisma.calendarConnection.findFirst({
    where: { hostId, writeTarget: true },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  if (conn?.provider === "CALDAV") {
    await ensureEncryptedAtRest(conn.id, conn.configJson);
    const config = parseCalDavConfig(conn.configJson);
    if (config) return createCalDavAdapter(config);
  }

  if (conn?.provider === "OUTLOOK") {
    await ensureEncryptedAtRest(conn.id, conn.configJson);
    const config = parseOutlookConfig(conn.configJson);
    if (config?.calendarId) {
      return createOutlookAdapter(config, (next) =>
        persistOutlookConfig(conn.id, next),
      );
    }
  }

  if (conn?.provider === "GOOGLE") {
    await ensureEncryptedAtRest(conn.id, conn.configJson);
    const config = parseGoogleConfig(conn.configJson);
    if (config?.calendarId) {
      return createGoogleAdapter(config, (next) =>
        persistGoogleConfig(conn.id, next),
      );
    }
  }

  return createLocalBusyAdapter();
}

type CalendarConnRow = {
  provider: string;
  configJson: string;
  writeTarget: boolean;
};

/** True when the host has a fully configured write calendar (not OAuth-pending). */
export function hostHasConnectedCalendar(
  connections: CalendarConnRow[],
): boolean {
  const writeConn =
    connections.find((c) => c.writeTarget) ?? connections[0] ?? null;
  if (!writeConn) return false;

  if (writeConn.provider === "CALDAV") {
    return Boolean(parseCalDavConfig(writeConn.configJson));
  }
  if (writeConn.provider === "OUTLOOK") {
    return Boolean(parseOutlookConfig(writeConn.configJson)?.calendarId);
  }
  if (writeConn.provider === "GOOGLE") {
    return Boolean(parseGoogleConfig(writeConn.configJson)?.calendarId);
  }
  return false;
}

export async function hostHasConnectedCalendarById(
  hostId: string,
): Promise<boolean> {
  const rows = await prisma.calendarConnection.findMany({
    where: { hostId },
    select: { provider: true, configJson: true, writeTarget: true },
  });
  return hostHasConnectedCalendar(rows);
}

/**
 * Busy times for availability: Toucan 121 bookings + external calendar (if any).
 * External errors are logged and treated as no external busy (slots still work).
 * External listBusy results are cached briefly so schedule navigation stays snappy.
 */
export async function getHostBusyBlocks(opts: {
  hostId: string;
  rangeStart: Date;
  rangeEnd: Date;
  bookingBusy: BusyBlock[];
}): Promise<BusyBlock[]> {
  const cacheKey = `busy:${opts.hostId}:${opts.rangeStart.toISOString()}:${opts.rangeEnd.toISOString()}`;
  let external = getCached<BusyBlock[]>(cacheKey);
  if (!external) {
    const adapter = await getHostWriteAdapter(opts.hostId);
    try {
      external = await adapter.listBusy(opts.rangeStart, opts.rangeEnd);
      setCache(cacheKey, external, 45_000);
    } catch (err) {
      console.error("[toucan:calendar] listBusy failed", err);
      external = [];
    }
  }
  return [...opts.bookingBusy, ...external];
}

/** External busy only (for schedule overlay). Uses the same cache as getHostBusyBlocks. */
export async function getHostExternalBusy(opts: {
  hostId: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<BusyBlock[]> {
  return getHostBusyBlocks({
    hostId: opts.hostId,
    rangeStart: opts.rangeStart,
    rangeEnd: opts.rangeEnd,
    bookingBusy: [],
  });
}
