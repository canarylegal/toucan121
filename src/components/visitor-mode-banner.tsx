import Link from "next/link";
import { activateBookingAction } from "@/lib/account-hosting-actions";

export function VisitorModeBanner({
  variant = "visitor",
}: {
  variant?: "visitor" | "paused" | "links";
}) {
  if (variant === "paused") {
    return (
      <div className="mt-4 rounded-md border border-accent/30 bg-accent-soft/60 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">Hosting is paused</p>
        <p className="mt-1 text-muted">
          Your public profile is hidden and you cannot take new bookings.
          Existing meetings you host are still listed below.
        </p>
        <Link
          href="/dash/account"
          className="mt-2 inline-block font-semibold text-accent underline"
        >
          Reactivate hosting
        </Link>
      </div>
    );
  }

  if (variant === "links") {
    return (
      <div className="mt-4 rounded-md border border-accent/30 bg-accent-soft/60 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">Booking is off</p>
        <p className="mt-1 text-muted">
          Your links profile is live. Activate booking when you want people to
          schedule meetings with you.
        </p>
        <form action={activateBookingAction} className="mt-2">
          <button
            type="submit"
            className="font-semibold text-accent underline"
          >
            Activate booking
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-accent/30 bg-accent-soft/60 px-4 py-3 text-sm">
      <p className="font-medium text-foreground">No public profile yet</p>
      <p className="mt-1 text-muted">
        You can book others and manage connections. Create a links profile or
        start full hosting when you&apos;re ready.
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Link
          href="/dash/links/setup"
          className="font-semibold text-accent underline"
        >
          Create links profile
        </Link>
        <Link
          href="/dash/hosting/setup"
          className="font-semibold text-accent underline"
        >
          Start full hosting
        </Link>
      </div>
    </div>
  );
}
