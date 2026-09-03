/**
 * Resend "Approval needed" email for the latest pending-on-host booking.
 * Usage: npx tsx scripts/resend-host-pending-notification.ts [hostEmail]
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { sendEmail } from "../src/lib/email";
import { hostNotifyEmail } from "../src/lib/host-notify-email";
import { renderBookingEmail } from "../src/lib/email-templates";
import { APP_NAME } from "../src/lib/brand";

function appUrl() {
  return (process.env.APP_URL ?? "https://toucan121.co.uk").replace(/\/$/, "");
}

async function main() {
  const hostEmail = process.argv[2]?.trim() || "colin@mcwilliamslegal.co.uk";
  const booking = await prisma.booking.findFirst({
    where: {
      status: "PENDING",
      pendingOn: "HOST",
      host: { email: { equals: hostEmail, mode: "insensitive" } },
    },
    orderBy: { createdAt: "desc" },
    include: { host: true, meetingType: true },
  });
  if (!booking) {
    console.log(`No pending host-approval booking for ${hostEmail}`);
    return;
  }

  const hostInbox = await hostNotifyEmail(booking.host);
  const location =
    booking.jitsiUrl ??
    (booking.venue ||
      booking.meetingType.locationNote ||
      "In person");

  const mail = renderBookingEmail({
    subject: `Approval needed: ${booking.meetingType.title} with ${booking.guestName}`,
    preheader: "Action required",
    intro: `${booking.guestName} requested ${booking.meetingType.title}.`,
    hostName: booking.host.name,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    meetingTitle: booking.meetingType.title,
    startsAt: booking.startsAt,
    timezone: booking.host.timezone,
    location,
    notes: booking.notes || undefined,
    primaryCta: { label: "Review in dashboard", url: `${appUrl()}/dash` },
  });

  await sendEmail({
    to: hostInbox,
    replyTo: booking.guestEmail,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });

  console.log(
    `Resent approval notification to ${hostInbox} (booking ${booking.id}, guest ${booking.guestEmail})`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
