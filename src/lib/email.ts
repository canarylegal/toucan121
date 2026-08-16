import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { APP_NAME } from "@/lib/brand";

/**
 * Central Toucan 121 outbound mail.
 * - From: SMTP_FROM (Toucan 121 domain)
 * - Optional display name override (e.g. "Colin via Toucan 121")
 * - Reply-To: typically the host (guest-facing) or guest (host-facing)
 * - If SMTP is not configured, logs to the console (local/dev fallback)
 */
export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Overrides the display name in SMTP_FROM */
  fromName?: string;
  replyTo?: string;
  icsContent?: string;
};

let transporter: Transporter | null | undefined;

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_URL?.trim() || process.env.SMTP_HOST?.trim(),
  );
}

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  if (!smtpConfigured()) {
    transporter = null;
    return null;
  }

  if (process.env.SMTP_URL?.trim()) {
    transporter = nodemailer.createTransport(process.env.SMTP_URL.trim());
    return transporter;
  }

  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT ?? "587");
  const secure =
    process.env.SMTP_SECURE === "true" ||
    process.env.SMTP_SECURE === "1" ||
    port === 465;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });
  return transporter;
}

function buildFrom(fromName?: string): string {
  const raw = process.env.SMTP_FROM?.trim() || `${APP_NAME} <bookings@localhost>`;
  if (!fromName) return raw;

  const angle = raw.match(/^(.*)<([^>]+)>\s*$/);
  if (angle) {
    return `${fromName} <${angle[2]!.trim()}>`;
  }
  // SMTP_FROM is a bare address
  return `${fromName} <${raw}>`;
}

function logFallback(message: OutboundEmail, from: string): void {
  console.info("[toucan:email]", {
    mode: "console",
    from,
    to: message.to,
    replyTo: message.replyTo,
    subject: message.subject,
    text: message.text,
    hasHtml: Boolean(message.html),
    hasIcs: Boolean(message.icsContent),
  });
  if (message.icsContent) {
    console.info("[toucan:email:ics]\n" + message.icsContent);
  }
}

export async function sendEmail(message: OutboundEmail): Promise<void> {
  const from = buildFrom(message.fromName);
  const transport = getTransporter();

  if (!transport) {
    logFallback(message, from);
    return;
  }

  try {
    await transport.sendMail({
      from,
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.icsContent
        ? [
            {
              filename: "invite.ics",
              content: message.icsContent,
              contentType: "text/calendar; charset=utf-8; method=REQUEST",
            },
          ]
        : undefined,
    });
  } catch (err) {
    console.error("[toucan:email] SMTP send failed; falling back to console", err);
    logFallback(message, from);
  }
}

/** Reset cached transporter (tests / env changes). */
export function resetEmailTransport(): void {
  transporter = undefined;
}
