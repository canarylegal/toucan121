/**
 * One-off: send Mailjet review samples.
 * Usage: MAILJET_SAMPLE_TO=you@example.com npx tsx scripts/send-mailjet-samples.ts
 * Optional: SAMPLE_ONLY=invite|invite-host|confirmation|reminder|verify
 */
import "dotenv/config";
import { sendEmail } from "../src/lib/email";
import {
  renderBookingEmail,
  renderNoticeEmail,
} from "../src/lib/email-templates";
import { APP_NAME } from "../src/lib/brand";

const TO = process.env.MAILJET_SAMPLE_TO?.trim() || "notifications@toucan121.co.uk";
const ONLY = process.env.SAMPLE_ONLY?.trim().toLowerCase() || "";
const startsAt = new Date(Date.UTC(2026, 8, 4, 13, 0, 0));

async function main() {
  const confirmation = renderBookingEmail({
    subject: `[Sample] Confirmed: 30-minute 121 with Alex Host`,
    preheader: "Your meeting is confirmed",
    greeting: "Hi Sam Guest,",
    intro: "Your 30-minute 121 with Alex Host is confirmed.",
    hostName: "Alex Host",
    guestName: "Sam Guest",
    meetingTitle: "30-minute 121",
    startsAt,
    timezone: "Europe/London",
    location: "Video call",
    videoUrl: "https://meet.jit.si/toucan121-sample-room",
    primaryCta: {
      label: "Open video room",
      url: "https://meet.jit.si/toucan121-sample-room",
    },
    footerNote: "Reply to this email to reach the host directly.",
    hasCalendarInvite: false,
  });

  const inviteGuest = renderBookingEmail({
    subject: `[Sample] Invitation: 30-minute 121 with Alex Host`,
    preheader: "Alex Host invited you",
    greeting: "Hi Sam Guest,",
    intro: "Alex Host has invited you to a 30-minute 121.",
    hostName: "Alex Host",
    guestName: "Sam Guest",
    meetingTitle: "30-minute 121",
    startsAt,
    timezone: "Europe/London",
    location: "Video call",
    videoUrl: "https://meet.jit.si/toucan121-sample-room",
    primaryCta: {
      label: "Accept invitation",
      url: "https://toucan121.co.uk/invite/sample-token?action=accept",
    },
    secondaryCta: {
      label: "Decline",
      url: "https://toucan121.co.uk/invite/sample-token?action=decline",
    },
    footerNote: "Reply to this email to contact the host.",
  });

  const inviteHost = renderBookingEmail({
    subject: `[Sample] Invitation sent: 30-minute 121 with Sam Guest`,
    preheader: "Invitation pending",
    intro: "You invited Sam Guest. Status: pending (awaiting invitee).",
    hostName: "Alex Host",
    guestName: "Sam Guest",
    guestEmail: "sam.guest.sample@example.com",
    meetingTitle: "30-minute 121",
    startsAt,
    timezone: "Europe/London",
    location: "Video call",
    videoUrl: "https://meet.jit.si/toucan121-sample-room",
  });

  const reminder = renderBookingEmail({
    subject: `[Sample] Appointment reminder: 30-minute 121 with Alex Host`,
    preheader: "Appointment reminder",
    greeting: "Hi Sam Guest,",
    intro:
      "Friendly reminder: you have 30-minute 121 with Alex Host coming up.",
    hostName: "Alex Host",
    guestName: "Sam Guest",
    meetingTitle: "30-minute 121",
    startsAt,
    timezone: "Europe/London",
    location: "Video call",
    videoUrl: "https://meet.jit.si/toucan121-sample-room",
    primaryCta: {
      label: "Open video room",
      url: "https://meet.jit.si/toucan121-sample-room",
    },
    unsubscribe: {
      label: "Stop reminders for this meeting",
      url: "https://toucan121.co.uk/reminders/stop/sample-token",
    },
  });

  const verify = renderNoticeEmail({
    subject: `[Sample] Confirm your ${APP_NAME} email`,
    title: "Confirm your email",
    greeting: "Hi Sam,",
    intro: `Please confirm this is your email so you can host and add connections on ${APP_NAME}.`,
    primaryCta: {
      label: "Confirm email",
      url: "https://toucan121.co.uk/verify/sample-token",
    },
    footerNote: "If you did not create an account, you can ignore this message.",
  });

  const samples: {
    label: string;
    mail: { subject: string; text: string; html: string };
    listUnsubscribeUrl?: string;
  }[] = [
    { label: "confirmation", mail: confirmation },
    { label: "invite", mail: inviteGuest },
    { label: "invite-host", mail: inviteHost },
    {
      label: "reminder",
      mail: reminder,
      listUnsubscribeUrl:
        "https://toucan121.co.uk/api/reminders/unsubscribe/sample-token",
    },
    { label: "verify", mail: verify },
  ];

  const selected = ONLY
    ? samples.filter((s) => s.label === ONLY)
    : samples;
  if (selected.length === 0) {
    throw new Error(`No samples match SAMPLE_ONLY=${ONLY}`);
  }

  for (const sample of selected) {
    await sendEmail({
      to: TO,
      fromName: `Alex Host via ${APP_NAME}`,
      replyTo: "alex.host.sample@example.com",
      subject: sample.mail.subject,
      text: sample.mail.text,
      html: sample.mail.html,
      listUnsubscribeUrl: sample.listUnsubscribeUrl,
    });
    console.info(`[sample] sent ${sample.label} → ${TO}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
