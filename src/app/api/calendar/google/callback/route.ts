import { NextResponse } from "next/server";
import { getOptionalHost } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { encodeCalendarConfig } from "@/lib/calendar/config-secrets";
import { verifyOAuthState } from "@/lib/calendar/oauth-state";
import {
  exchangeGoogleCode,
  fetchGoogleProfile,
  isHostGoogleConnectEnabled,
  listGoogleCalendars,
} from "@/lib/calendar/google";

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function redirectCalendar(query: Record<string, string>) {
  const url = new URL("/dash/calendar", appUrl());
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const host = await getOptionalHost();
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isHostGoogleConnectEnabled()) {
    return redirectCalendar({
      error:
        "Google Calendar for hosts is currently unavailable. Guests can still add bookings from the invite email.",
    });
  }

  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  if (error) {
    return redirectCalendar({
      error:
        errorDescription ||
        error ||
        "Google sign-in was cancelled or failed",
      provider: "google",
    });
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    return redirectCalendar({
      error: "Missing OAuth code from Google",
      provider: "google",
    });
  }

  const verified = verifyOAuthState(state);
  if ("error" in verified) {
    return redirectCalendar({ error: verified.error, provider: "google" });
  }
  if (verified.hostId !== host.id) {
    return redirectCalendar({
      error: "OAuth state does not match your account",
      provider: "google",
    });
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    const profile = await fetchGoogleProfile(tokens.accessToken);
    const calendars = await listGoogleCalendars(tokens.accessToken);

    const configJson = encodeCalendarConfig({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      accountEmail: profile.email,
    });

    if (calendars.length === 1) {
      const only = calendars[0]!;
      const finalConfig = encodeCalendarConfig({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        accountEmail: profile.email,
        calendarId: only.id,
        calendarDisplayName: only.displayName,
      });
      await prisma.$transaction(async (tx) => {
        await tx.calendarConnection.deleteMany({
          where: { hostId: verified.hostId },
        });
        await tx.calendarConnection.create({
          data: {
            hostId: verified.hostId,
            provider: "GOOGLE",
            label: only.displayName || profile.email || "Google Calendar",
            configJson: finalConfig,
            isPrimary: true,
            writeTarget: true,
          },
        });
      });
      return redirectCalendar({
        success: `Connected “${only.displayName}”`,
        provider: "google",
      });
    }

    if (calendars.length === 0) {
      return redirectCalendar({
        error: "No editable calendars found on that Google account",
        provider: "google",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.calendarConnection.deleteMany({
        where: { hostId: verified.hostId, provider: "GOOGLE" },
      });
      await tx.calendarConnection.create({
        data: {
          hostId: verified.hostId,
          provider: "GOOGLE",
          label: profile.email || "Google Calendar",
          configJson,
          isPrimary: false,
          writeTarget: false,
        },
      });
    });

    return redirectCalendar({ provider: "google", step: "pick" });
  } catch (err) {
    console.error("[toucan:google] OAuth callback failed", err);
    return redirectCalendar({
      error:
        err instanceof Error
          ? err.message
          : "Could not connect Google Calendar",
      provider: "google",
    });
  }
}
