import { NextResponse } from "next/server";
import { getOptionalHost } from "@/lib/current-user";
import { createOAuthState } from "@/lib/calendar/oauth-state";
import {
  buildGoogleAuthorizeUrl,
  isHostGoogleConnectEnabled,
} from "@/lib/calendar/google";

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function GET() {
  const host = await getOptionalHost();
  const base = appUrl();

  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isHostGoogleConnectEnabled()) {
    const dest = new URL("/dash/calendar", base);
    dest.searchParams.set(
      "error",
      "Google Calendar for hosts is currently unavailable. Guests can still add bookings from the invite email.",
    );
    return NextResponse.redirect(dest);
  }

  const state = createOAuthState(host.id);
  const url = buildGoogleAuthorizeUrl(state);
  return NextResponse.redirect(url);
}
