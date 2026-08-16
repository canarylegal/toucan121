import { NextResponse } from "next/server";
import { getOptionalHost } from "@/lib/current-user";
import { createOAuthState } from "@/lib/calendar/oauth-state";
import {
  buildOutlookAuthorizeUrl,
  isOutlookConfigured,
} from "@/lib/calendar/outlook";

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function GET() {
  const host = await getOptionalHost();
  const base = appUrl();

  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isOutlookConfigured()) {
    const dest = new URL("/dash/calendar", base);
    dest.searchParams.set(
      "error",
      "Outlook is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.",
    );
    return NextResponse.redirect(dest);
  }

  const state = createOAuthState(host.id);
  const url = buildOutlookAuthorizeUrl(state);
  return NextResponse.redirect(url);
}
