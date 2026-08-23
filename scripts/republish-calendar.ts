/**
 * Copy upcoming confirmed bookings and blocked times onto the host's
 * current write calendar.
 *
 * Usage: npx tsx scripts/republish-calendar.ts [email] [--pending-only]
 */
import { prisma } from "../src/lib/db";
import { republishHostMeetingsToWriteCalendar } from "../src/lib/calendar/republish";

async function main() {
  const email = (process.argv[2] ?? "colin@mcwilliamslegal.co.uk")
    .trim()
    .toLowerCase();
  const host = await prisma.host.findFirst({
    where: { user: { email: { equals: email, mode: "insensitive" } } },
    select: { id: true, slug: true, email: true },
  });
  if (!host) {
    console.error("no host for", email);
    process.exit(1);
  }
  const pendingOnly = process.argv.includes("--pending-only");
  console.log("host", host.slug, host.email);
  const result = await republishHostMeetingsToWriteCalendar(host.id, {
    statuses: pendingOnly ? ["PENDING"] : ["CONFIRMED", "PENDING"],
    includeTimeBlocks: !pendingOnly,
  });
  console.log("republish", result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
