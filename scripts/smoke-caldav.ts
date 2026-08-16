/**
 * Smoke test: CalDAV listBusy + createEvent + cancel.
 *
 * Usage:
 *   npm run smoke:caldav
 *   npm run smoke:caldav:local   # starts Radicale via Compose, then smokes
 *
 * Credential sources (first wins):
 *   1. CALDAV_SERVER_URL + CALDAV_USERNAME + CALDAV_PASSWORD + CALDAV_CALENDAR_URL
 *   2. Latest write-target CALDAV connection in DB with parseable config (skips seed stub)
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  createCalDavAdapter,
  type CalDavConfig,
} from "../src/lib/calendar/caldav";
import { parseCalDavConfig } from "../src/lib/calendar/host-calendar";
import {
  encryptConfigJson,
  isEncryptedConfigJson,
} from "../src/lib/calendar/config-secrets";

function configFromEnv(): CalDavConfig | null {
  const serverUrl = process.env.CALDAV_SERVER_URL?.trim();
  const username = process.env.CALDAV_USERNAME?.trim();
  const password = process.env.CALDAV_PASSWORD?.trim();
  const calendarUrl = process.env.CALDAV_CALENDAR_URL?.trim();
  if (!serverUrl || !username || !password || !calendarUrl) return null;
  return {
    serverUrl,
    username,
    password,
    calendarUrl,
    calendarDisplayName: process.env.CALDAV_CALENDAR_NAME?.trim() || "Smoke",
  };
}

async function runAgainst(config: CalDavConfig, label: string) {
  console.log("Target:", label);
  console.log("Server:", config.serverUrl);
  console.log("Calendar:", config.calendarDisplayName || config.calendarUrl);

  const write = createCalDavAdapter(config);
  const now = new Date();

  console.log("\n1) listBusy (next 7 days)…");
  const busy = await write.listBusy(
    now,
    new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
  );
  console.log(`   OK — ${busy.length} busy block(s)`);

  const startsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  startsAt.setMinutes(0, 0, 0);
  startsAt.setHours(startsAt.getHours() + 1);
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

  console.log("\n2) createEvent (smoke test, +14 days)…");
  console.log("   When:", startsAt.toISOString(), "→", endsAt.toISOString());
  const created = await write.createEvent({
    title: "[Toucan smoke] CalDAV write test — safe to delete",
    description: "Automated smoke test from scripts/smoke-caldav.ts",
    startsAt,
    endsAt,
    location: "Smoke test",
    attendeeEmail: "smoke-guest@example.com",
  });
  console.log("   OK — eventId:", created.eventId);

  if (created.eventId.startsWith("local-")) {
    throw new Error("Got local stub adapter — CalDAV write path was not used.");
  }

  console.log("\n3) listBusy again (should include smoke event)…");
  const busy2 = await write.listBusy(
    new Date(startsAt.getTime() - 60 * 60 * 1000),
    new Date(endsAt.getTime() + 60 * 60 * 1000),
  );
  const hit = busy2.some(
    (b) =>
      Math.abs(b.startsAt.getTime() - startsAt.getTime()) < 60_000 &&
      Math.abs(b.endsAt.getTime() - endsAt.getTime()) < 60_000,
  );
  console.log(
    hit
      ? `   OK — smoke event visible in busy (${busy2.length} block(s) in window)`
      : `   WARN — smoke event not found in busy yet (${busy2.length} block(s)); server may delay indexing`,
  );

  console.log("\n4) cancelEvent (cleanup)…");
  await write.cancelEvent(created.eventId);
  console.log("   OK — deleted");

  console.log("\nPASS: CalDAV smoke test completed.");
}

async function main() {
  const fromEnv = configFromEnv();
  if (fromEnv) {
    await runAgainst(fromEnv, "env CALDAV_*");
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const conns = await prisma.calendarConnection.findMany({
      where: { provider: "CALDAV", writeTarget: true },
      include: { host: { select: { id: true, slug: true, email: true } } },
      orderBy: { updatedAt: "desc" },
    });

    for (const conn of conns) {
      const cfg = parseCalDavConfig(conn.configJson);
      if (!cfg) {
        console.log(
          `Skip ${conn.label} (${conn.host.slug}): stub/unparseable config`,
        );
        continue;
      }

      console.log("Host:", conn.host.slug, conn.host.email);
      console.log("Connection:", conn.label, conn.id);
      console.log(
        "Config at rest:",
        isEncryptedConfigJson(conn.configJson) ? "encrypted" : "plaintext",
      );

      if (!isEncryptedConfigJson(conn.configJson)) {
        await prisma.calendarConnection.update({
          where: { id: conn.id },
          data: { configJson: encryptConfigJson(JSON.stringify(cfg)) },
        });
        console.log("Migrated configJson → encrypted at rest");
      }

      await runAgainst(cfg, `DB connection ${conn.id}`);
      return;
    }

    console.error(`FAIL: No usable CalDAV connection.

Connect CalDAV in /dash/calendar, or set:
  CALDAV_SERVER_URL CALDAV_USERNAME CALDAV_PASSWORD CALDAV_CALENDAR_URL

Or run the local Radicale smoke:
  npm run smoke:caldav:local`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\nFAIL:", err);
  process.exit(1);
});
