import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { appBaseUrl } from "@/lib/email-tokens";
import {
  DISABLED_REMINDER_PREFS,
  stringifyReminderPrefs,
} from "@/lib/reminders";
import type { ReminderRecipient } from "@/generated/prisma/client";

export type ReminderStopPayload = {
  bookingId: string;
  recipient: ReminderRecipient;
  exp: number;
};

function secret(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createReminderStopToken(opts: {
  bookingId: string;
  recipient: ReminderRecipient;
  startsAt: Date;
}): string {
  const exp = Math.max(opts.startsAt.getTime(), Date.now()) + 30 * 24 * 60 * 60 * 1000;
  const body = Buffer.from(
    JSON.stringify({
      bookingId: opts.bookingId,
      recipient: opts.recipient,
      exp,
    } satisfies ReminderStopPayload),
    "utf8",
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyReminderStopToken(
  raw: string,
): ReminderStopPayload | null {
  const token = raw.trim();
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Partial<ReminderStopPayload>;
    if (
      !parsed.bookingId ||
      (parsed.recipient !== "GUEST" && parsed.recipient !== "HOST") ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (Date.now() > parsed.exp) return null;
    return {
      bookingId: parsed.bookingId,
      recipient: parsed.recipient,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function reminderStopPageUrl(token: string): string {
  return `${appBaseUrl()}/reminders/stop/${encodeURIComponent(token)}`;
}

export function reminderUnsubscribeApiUrl(token: string): string {
  return `${appBaseUrl()}/api/reminders/unsubscribe/${encodeURIComponent(token)}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function isReminderSuppressed(
  email: string,
  recipient: ReminderRecipient,
): Promise<boolean> {
  const row = await prisma.reminderSuppression.findUnique({
    where: {
      email_recipient: {
        email: normalizeEmail(email),
        recipient,
      },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function stopRemindersForBooking(
  bookingId: string,
  recipient: ReminderRecipient,
): Promise<void> {
  const now = new Date();
  await prisma.bookingReminder.updateMany({
    where: {
      bookingId,
      recipient,
      sentAt: null,
      cancelledAt: null,
    },
    data: { cancelledAt: now },
  });
  const json = stringifyReminderPrefs(DISABLED_REMINDER_PREFS);
  await prisma.booking.update({
    where: { id: bookingId },
    data:
      recipient === "GUEST"
        ? { guestReminderJson: json }
        : { hostReminderJson: json },
  });
}

async function cancelPendingForEmail(
  email: string,
  recipient: ReminderRecipient,
) {
  const now = new Date();
  if (recipient === "GUEST") {
    await prisma.bookingReminder.updateMany({
      where: {
        recipient: "GUEST",
        sentAt: null,
        cancelledAt: null,
        booking: { guestEmail: { equals: email, mode: "insensitive" } },
      },
      data: { cancelledAt: now },
    });
    return;
  }
  await prisma.bookingReminder.updateMany({
    where: {
      recipient: "HOST",
      sentAt: null,
      cancelledAt: null,
      booking: { host: { email: { equals: email, mode: "insensitive" } } },
    },
    data: { cancelledAt: now },
  });
}

export async function setReminderSuppressed(opts: {
  email: string;
  recipient: ReminderRecipient;
  suppressed: boolean;
}): Promise<void> {
  const email = normalizeEmail(opts.email);
  if (!email.includes("@")) return;

  if (opts.suppressed) {
    await prisma.reminderSuppression.upsert({
      where: { email_recipient: { email, recipient: opts.recipient } },
      create: { email, recipient: opts.recipient },
      update: {},
    });
    await cancelPendingForEmail(email, opts.recipient);
    return;
  }

  await prisma.reminderSuppression.deleteMany({
    where: { email, recipient: opts.recipient },
  });
}

export async function emailForReminderRecipient(
  bookingId: string,
  recipient: ReminderRecipient,
): Promise<string | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      guestEmail: true,
      host: { select: { email: true } },
    },
  });
  if (!booking) return null;
  return recipient === "GUEST" ? booking.guestEmail : booking.host.email;
}
