import "dotenv/config";
import { processDueReminders } from "../src/lib/reminder-schedule";

const intervalMs = Number(process.env.REMINDER_POLL_MS ?? "30000");

async function tick() {
  try {
    const result = await processDueReminders({ limit: 50 });
    if (result.checked > 0 || result.sent > 0) {
      console.info("[toucan:reminders]", result);
    }
  } catch (err) {
    console.error("[toucan:reminders] tick failed", err);
  }
}

async function main() {
  const once = process.argv.includes("--once");
  console.info(
    once
      ? "[toucan:reminders] processing due reminders once"
      : `[toucan:reminders] worker polling every ${intervalMs}ms`,
  );

  await tick();
  if (once) return;

  setInterval(tick, intervalMs);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
