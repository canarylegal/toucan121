import { APP_NAME } from "@/lib/brand";
import { formatSlotLabel } from "@/lib/availability";
import { formatTimezoneDisplay } from "@/lib/timezones";
import { appBaseUrl } from "@/lib/email-tokens";

export type EmailCta = { label: string; url: string };

function privacyPolicyUrl(): string {
  return `${appBaseUrl()}/privacy`;
}

function emailLegalFooterText(opts?: { unsubscribe?: EmailCta }): string {
  const lines = [`Privacy policy: ${privacyPolicyUrl()}`];
  if (opts?.unsubscribe) {
    lines.push(`${opts.unsubscribe.label}: ${opts.unsubscribe.url}`);
  }
  lines.push(`— ${APP_NAME}`);
  return lines.join("\n");
}

function emailLegalFooterHtml(opts?: { unsubscribe?: EmailCta }): string {
  const privacy = privacyPolicyUrl();
  return `Sent by ${escapeHtml(APP_NAME)}
        <div style="margin-top:8px;"><a href="${escapeHtml(privacy)}" style="color:#5c6b63;text-decoration:underline;">Privacy policy</a></div>
        ${
          opts?.unsubscribe
            ? `<div style="margin-top:8px;"><a href="${escapeHtml(opts.unsubscribe.url)}" style="color:#5c6b63;text-decoration:underline;">${escapeHtml(opts.unsubscribe.label)}</a></div>`
            : ""
        }`;
}

export type BookingEmailPayload = {
  subject: string;
  preheader?: string;
  greeting?: string;
  intro: string;
  hostName: string;
  guestName: string;
  guestEmail?: string;
  meetingTitle: string;
  startsAt: Date;
  timezone: string;
  location: string;
  notes?: string;
  previousWhenLabel?: string;
  detailExtra?: string;
  videoUrl?: string | null;
  primaryCta?: EmailCta;
  secondaryCta?: EmailCta;
  footerNote?: string;
  hasCalendarInvite?: boolean;
  /** Reminder mail only — stop reminders for this meeting. */
  unsubscribe?: EmailCta;
};

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatEmailWhen(startsAt: Date, timezone: string): string {
  return `${formatSlotLabel(startsAt, timezone)} (${formatTimezoneDisplay(timezone)})`;
}

function factRows(payload: BookingEmailPayload): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: "Meeting", value: payload.meetingTitle },
    { label: "When", value: formatEmailWhen(payload.startsAt, payload.timezone) },
  ];
  if (payload.previousWhenLabel) {
    rows.push({ label: "Was", value: payload.previousWhenLabel });
  }
  rows.push({ label: "Where", value: payload.location });
  if (payload.guestEmail) {
    rows.push({
      label: "Guest",
      value: `${payload.guestName} <${payload.guestEmail}>`,
    });
  }
  if (payload.notes?.trim()) {
    rows.push({ label: "Notes", value: payload.notes.trim() });
  }
  if (payload.detailExtra?.trim()) {
    rows.push({ label: "Note", value: payload.detailExtra.trim() });
  }
  return rows;
}

function renderText(payload: BookingEmailPayload): string {
  const lines: string[] = [];
  if (payload.greeting) lines.push(payload.greeting, "");
  lines.push(payload.intro, "");
  for (const row of factRows(payload)) {
    lines.push(`${row.label}: ${row.value}`);
  }
  if (payload.videoUrl) {
    lines.push("", `Join video: ${payload.videoUrl}`);
  }
  if (payload.primaryCta) {
    lines.push("", `${payload.primaryCta.label}: ${payload.primaryCta.url}`);
  }
  if (payload.secondaryCta) {
    lines.push(`${payload.secondaryCta.label}: ${payload.secondaryCta.url}`);
  }
  if (payload.hasCalendarInvite) {
    lines.push(
      "",
      "A calendar invite is attached — open or accept it to update your calendar.",
    );
  }
  if (payload.footerNote) {
    lines.push("", payload.footerNote);
  }
  lines.push("", emailLegalFooterText({ unsubscribe: payload.unsubscribe }));
  return lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");
}

function ctaButton(cta: EmailCta, primary: boolean): string {
  const bg = primary ? "#0f6a4b" : "#ffffff";
  const color = primary ? "#ffffff" : "#0f6a4b";
  const border = primary ? "#0f6a4b" : "#c5d4cc";
  return `<a href="${escapeHtml(cta.url)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 18px;border-radius:6px;border:1px solid ${border};background:${bg};color:${color};font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(cta.label)}</a>`;
}

function renderHtml(payload: BookingEmailPayload): string {
  const rows = factRows(payload)
    .map(
      (row) => `
      <tr>
        <td style="padding:8px 0;width:88px;vertical-align:top;color:#5c6b63;font-size:13px;">${escapeHtml(row.label)}</td>
        <td style="padding:8px 0;vertical-align:top;color:#14201a;font-size:15px;font-weight:600;">${escapeHtml(row.value).replace(/\n/g, "<br/>")}</td>
      </tr>`,
    )
    .join("");

  const preheader = payload.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(payload.preheader)}</div>`
    : "";

  const ctas = [payload.primaryCta, payload.secondaryCta].filter(
    Boolean,
  ) as EmailCta[];

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:Georgia,'Times New Roman',serif;">
${preheader}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ea;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #d8e0db;border-radius:10px;overflow:hidden;">
      <tr><td style="padding:20px 24px;background:#0f6a4b;color:#ffffff;">
        <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">${escapeHtml(APP_NAME)}</div>
        <div style="margin-top:6px;font-size:22px;font-weight:700;">${escapeHtml(payload.meetingTitle)}</div>
      </td></tr>
      <tr><td style="padding:24px;">
        ${
          payload.greeting
            ? `<p style="margin:0 0 12px;font-size:16px;color:#14201a;">${escapeHtml(payload.greeting)}</p>`
            : ""
        }
        <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#24332c;">${escapeHtml(payload.intro)}</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e6ebe8;border-bottom:1px solid #e6ebe8;margin:0 0 18px;">
          ${rows}
        </table>
        ${
          payload.videoUrl
            ? `<p style="margin:0 0 16px;font-size:14px;"><a href="${escapeHtml(payload.videoUrl)}" style="color:#0f6a4b;font-weight:600;">Open video room</a></p>`
            : ""
        }
        ${
          ctas.length
            ? `<div style="margin:4px 0 8px;">${ctas
                .map((c, i) => ctaButton(c, i === 0))
                .join("")}</div>`
            : ""
        }
        ${
          payload.hasCalendarInvite
            ? `<p style="margin:12px 0 0;font-size:13px;color:#5c6b63;">A calendar invite is attached — open or accept it to update your calendar.</p>`
            : ""
        }
        ${
          payload.footerNote
            ? `<p style="margin:16px 0 0;font-size:13px;color:#5c6b63;line-height:1.45;">${escapeHtml(payload.footerNote)}</p>`
            : ""
        }
      </td></tr>
      <tr><td style="padding:14px 24px;background:#f7faf8;color:#5c6b63;font-size:12px;">
        ${emailLegalFooterHtml({ unsubscribe: payload.unsubscribe })}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Build subject + text + HTML for a booking-related message. */
export function renderBookingEmail(payload: BookingEmailPayload): RenderedEmail {
  return {
    subject: payload.subject,
    text: renderText(payload),
    html: renderHtml(payload),
  };
}

export type NoticeEmailPayload = {
  subject: string;
  title: string;
  greeting?: string;
  intro: string;
  primaryCta?: EmailCta;
  footerNote?: string;
};

/** Account notices (connections, etc.) — same look as booking mail without a slot table. */
export function renderNoticeEmail(payload: NoticeEmailPayload): RenderedEmail {
  const lines: string[] = [];
  if (payload.greeting) lines.push(payload.greeting, "");
  lines.push(payload.intro);
  if (payload.primaryCta) {
    lines.push("", `${payload.primaryCta.label}: ${payload.primaryCta.url}`);
  }
  if (payload.footerNote) {
    lines.push("", payload.footerNote);
  }
  lines.push("", emailLegalFooterText());

  const ctaHtml = payload.primaryCta
    ? `<div style="margin:4px 0 8px;">${ctaButton(payload.primaryCta, true)}</div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ea;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #d8e0db;border-radius:10px;overflow:hidden;">
      <tr><td style="padding:20px 24px;background:#0f6a4b;color:#ffffff;">
        <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">${escapeHtml(APP_NAME)}</div>
        <div style="margin-top:6px;font-size:22px;font-weight:700;">${escapeHtml(payload.title)}</div>
      </td></tr>
      <tr><td style="padding:24px;">
        ${
          payload.greeting
            ? `<p style="margin:0 0 12px;font-size:16px;color:#14201a;">${escapeHtml(payload.greeting)}</p>`
            : ""
        }
        <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#24332c;">${escapeHtml(payload.intro)}</p>
        ${ctaHtml}
        ${
          payload.footerNote
            ? `<p style="margin:16px 0 0;font-size:13px;color:#5c6b63;line-height:1.45;">${escapeHtml(payload.footerNote)}</p>`
            : ""
        }
      </td></tr>
      <tr><td style="padding:14px 24px;background:#f7faf8;color:#5c6b63;font-size:12px;">
        ${emailLegalFooterHtml()}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return {
    subject: payload.subject,
    text: lines.join("\n"),
    html,
  };
}
