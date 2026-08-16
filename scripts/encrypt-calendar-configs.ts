/**
 * One-shot: encrypt any plaintext CalendarConnection.configJson rows.
 * Safe to re-run (skips already-encrypted).
 *
 *   npx tsx scripts/encrypt-calendar-configs.ts
 */
import { prisma } from "../src/lib/db";
import {
  decryptConfigJson,
  encryptConfigJson,
  isEncryptedConfigJson,
} from "../src/lib/calendar/config-secrets";

async function main() {
  const rows = await prisma.calendarConnection.findMany({
    select: { id: true, provider: true, label: true, configJson: true },
  });

  let migrated = 0;
  let already = 0;
  let failed = 0;

  for (const row of rows) {
    if (isEncryptedConfigJson(row.configJson) || row.configJson === "{}") {
      already += 1;
      continue;
    }
    try {
      const plain = decryptConfigJson(row.configJson);
      JSON.parse(plain);
      await prisma.calendarConnection.update({
        where: { id: row.id },
        data: { configJson: encryptConfigJson(plain) },
      });
      migrated += 1;
      console.log(`encrypted ${row.provider} ${row.label} (${row.id})`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${row.id}`, err);
    }
  }

  console.log(
    JSON.stringify({ total: rows.length, migrated, already, failed }, null, 2),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
