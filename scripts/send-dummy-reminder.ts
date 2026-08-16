/**
 * One-shot: send a sample appointment reminder email.
 * Usage: npx tsx scripts/send-dummy-reminder.ts [to]
 */
import { sendEmail } from "../src/lib/email";
import { renderBookingEmail } from "../src/lib/email-templates";
import { APP_NAME } from "../src/lib/brand";

async function main() {
  const to = process.argv[2]?.trim() || "colin@mcwilliamslegal.co.uk";
  const startsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  startsAt.setHours(14, 0, 0, 0);

  const mail = renderBookingEmail({
    subject: `Appointment reminder: Intro call with Colin McWilliams`,
    preheader: "Appointment reminder",
    greeting: "Hi Colin,",
    intro:
      "Friendly reminder: you have Intro call with Colin McWilliams coming up. (This is a test message from Toucan 121.)",
    hostName: "Colin McWilliams",
    guestName: "Colin",
    meetingTitle: "Intro call",
    startsAt,
    timezone: "Europe/London",
    location: "Video call",
    videoUrl: "https://meet.jit.si/toucan121-demo-room",
    primaryCta: {
      label: "Open video room",
      url: "https://meet.jit.si/toucan121-demo-room",
    },
    footerNote: `Test reminder sent from ${APP_NAME}.`,
  });

  await sendEmail({
    to,
    fromName: `Colin McWilliams via ${APP_NAME}`,
    replyTo: "colin@mcwilliamslegal.co.uk",
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });

  console.log(`Dummy reminder sent to ${to}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
