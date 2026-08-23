"use client";

import { useState } from "react";
import {
  pauseHostingAction,
  reactivateHostingAction,
} from "@/lib/account-hosting-actions";

export function HostingModeControls({
  hostingActive,
  hasHost,
  bookingEnabled = true,
}: {
  hostingActive: boolean;
  hasHost: boolean;
  bookingEnabled?: boolean;
}) {
  const [confirmPause, setConfirmPause] = useState(false);

  if (!hasHost) return null;

  if (!hostingActive) {
    return (
      <div className="mt-8 rounded-lg border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold">Public profile</h2>
        <p className="mt-2 text-sm text-muted">
          Your profile is paused. Reactivate to show your public page again.
          {bookingEnabled
            ? " Booking will resume when you reactivate."
            : " Booking stays off until you activate it."}
        </p>
        <form action={reactivateHostingAction} className="mt-4">
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Reactivate profile
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-lg border border-line bg-panel p-5">
      <h2 className="text-lg font-semibold">Public profile</h2>
      <p className="mt-2 text-sm text-muted">
        {bookingEnabled
          ? "Pause to hide your public profile and stop new bookings. Existing confirmed meetings stay on your calendar."
          : "Pause to hide your links profile. You can still book others as a guest."}
      </p>
      {!confirmPause ? (
        <button
          type="button"
          onClick={() => setConfirmPause(true)}
          className="mt-4 text-sm font-medium text-muted underline hover:text-foreground"
        >
          Pause public profile
        </button>
      ) : (
        <div className="mt-4 space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="text-amber-950">
            Your profile URL will stop working for visitors. You can reactivate
            anytime from Account.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={pauseHostingAction}>
              <button
                type="submit"
                className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                Yes, pause profile
              </button>
            </form>
            <button
              type="button"
              onClick={() => setConfirmPause(false)}
              className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
