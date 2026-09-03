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
  /** RFC 8058 one-click unsubscribe (reminder mail only). */
  listUnsubscribeUrl?: string;
};

let transporter: Transporter | null | undefined;
let authTransporter: Transporter | null | undefined;

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
    requireTLS: !secure && port === 587,
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
    const info = await transport.sendMail({
      from,
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
      headers: message.listUnsubscribeUrl
        ? {
            "List-Unsubscribe": `<${message.listUnsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : undefined,
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
    console.info("[toucan:email] sent", {
      to: message.to,
      subject: message.subject,
      messageId: info.messageId,
      response: info.response,
    });
  } catch (err) {
    console.error("[toucan:email] SMTP send failed", err);
    throw err instanceof Error ? err : new Error("SMTP send failed");
  }
}

function envOr(primary: string | undefined, fallback: string | undefined) {
  const a = primary?.trim();
  if (a) return a;
  return fallback?.trim() || "";
}

function buildAuthFrom(): string {
  return (
    process.env.AUTH_SMTP_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    `${APP_NAME} <no-reply@localhost>`
  );
}

function getAuthTransporter(): Transporter | null {
  if (authTransporter !== undefined) return authTransporter;
  if (
    !smtpConfigured() &&
    !process.env.AUTH_SMTP_HOST?.trim() &&
    !process.env.AUTH_SMTP_URL?.trim()
  ) {
    authTransporter = null;
    return null;
  }

  if (process.env.AUTH_SMTP_URL?.trim()) {
    authTransporter = nodemailer.createTransport(
      process.env.AUTH_SMTP_URL.trim(),
    );
    return authTransporter;
  }

  const host = envOr(process.env.AUTH_SMTP_HOST, process.env.SMTP_HOST);
  if (!host) {
    authTransporter = null;
    return null;
  }
  const port = Number(
    envOr(process.env.AUTH_SMTP_PORT, process.env.SMTP_PORT) || "587",
  );
  const secure =
    process.env.AUTH_SMTP_SECURE === "true" ||
    process.env.AUTH_SMTP_SECURE === "1" ||
    process.env.SMTP_SECURE === "true" ||
    process.env.SMTP_SECURE === "1" ||
    port === 465;
  const user = envOr(process.env.AUTH_SMTP_USER, process.env.SMTP_USER);
  const pass = envOr(process.env.AUTH_SMTP_PASS, process.env.SMTP_PASS);

  authTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: user && pass ? { user, pass } : undefined,
  });
  return authTransporter;
}

/** Account mail: password reset, email confirm. Uses AUTH_SMTP_* or the booking SMTP. */
export async function sendAuthEmail(
  message: Omit<OutboundEmail, "icsContent" | "fromName">,
): Promise<void> {
  const from = buildAuthFrom();
  const transport = getAuthTransporter();

  if (!transport) {
    logFallback(message, from);
    return;
  }

  try {
    const info = await transport.sendMail({
      from,
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    console.info("[toucan:email] AUTH SMTP sent", {
      to: message.to,
      subject: message.subject,
      id: info.messageId,
      response: info.response,
    });
  } catch (err) {
    console.error("[toucan:email] AUTH SMTP send failed", err);
    throw err;
  }
}

/** Reset cached transporter (tests / env changes). */
export function resetEmailTransport(): void {
  transporter = undefined;
  authTransporter = undefined;
}
