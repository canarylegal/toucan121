import { NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/email-tokens";
import {
  emailForReminderRecipient,
  setReminderSuppressed,
  verifyReminderStopToken,
} from "@/lib/reminder-unsubscribe";

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const payload = verifyReminderStopToken(token);
  if (!payload) {
    return new NextResponse("Invalid token", { status: 400 });
  }

  const email = await emailForReminderRecipient(
    payload.bookingId,
    payload.recipient,
  );
  if (!email) {
    return new NextResponse("Not found", { status: 404 });
  }

  await setReminderSuppressed({
    email,
    recipient: payload.recipient,
    suppressed: true,
  });

  return new NextResponse("OK", { status: 200 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  return NextResponse.redirect(
    `${appBaseUrl()}/reminders/stop/${encodeURIComponent(token)}`,
    302,
  );
}
