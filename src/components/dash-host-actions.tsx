import Link from "next/link";

const linkClass =
  "rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-semibold hover:bg-accent-soft";
const primaryClass =
  "rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90";

type DashHostActionsProps = {
  hostSlug: string;
  connectionsLabel: string;
  bookingEnabled?: boolean;
};

export function DashHostActions({
  hostSlug,
  connectionsLabel,
  bookingEnabled = true,
}: DashHostActionsProps) {
  if (!bookingEnabled) {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href={`/${hostSlug}?edit=1`} className={primaryClass}>
          Edit profile
        </Link>
        <Link href="/dash/connections" className={linkClass}>
          {connectionsLabel}
        </Link>
        <Link href="/dash/account" className={linkClass}>
          Account
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <Link href="/dash/bookings/new" className={primaryClass}>
        New booking
      </Link>
      <Link href="/dash/schedule" className={linkClass}>
        View schedule
      </Link>
      <details className="group relative">
        <summary
          className={`${linkClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
        >
          More
          <span className="ml-1 text-muted group-open:hidden" aria-hidden>
            ▾
          </span>
          <span className="ml-1 hidden text-muted group-open:inline" aria-hidden>
            ▴
          </span>
        </summary>
        <div className="absolute left-0 z-20 mt-2 min-w-[12rem] rounded-md border border-line bg-panel py-1 shadow-sm">
          <Link
            href="/dash/meetings/new"
            className="block px-4 py-2.5 text-sm font-semibold hover:bg-accent-soft"
          >
            Add meeting type
          </Link>
          <Link
            href={`/${hostSlug}?edit=1`}
            className="block px-4 py-2.5 text-sm font-semibold hover:bg-accent-soft"
          >
            Edit profile
          </Link>
          <Link
            href="/dash/calendar"
            className="block px-4 py-2.5 text-sm font-semibold hover:bg-accent-soft"
          >
            Connect calendar
          </Link>
          <Link
            href="/dash/connections"
            className="block px-4 py-2.5 text-sm font-semibold hover:bg-accent-soft"
          >
            {connectionsLabel}
          </Link>
          <Link
            href="/dash/account"
            className="block px-4 py-2.5 text-sm font-semibold hover:bg-accent-soft"
          >
            Account
          </Link>
        </div>
      </details>
    </div>
  );
}
