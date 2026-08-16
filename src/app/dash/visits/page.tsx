import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserOrRedirect } from "@/lib/current-user";
import { formatSlotLabel } from "@/lib/availability";
import { ToucanBrand } from "@/components/toucan-brand";
import { logoutAction } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

export default async function VisitsPage() {
  const user = await requireUserOrRedirect("/dash/visits");

  const bookings = await prisma.booking.findMany({
    where: { guestEmail: { equals: user.email, mode: "insensitive" } },
    orderBy: { startsAt: "desc" },
    take: 100,
    include: {
      host: { select: { name: true, slug: true, timezone: true } },
      meetingType: { select: { title: true } },
    },
  });

  const now = new Date();
  const upcoming = bookings.filter(
    (b) =>
      b.endsAt > now &&
      (b.status === "PENDING" || b.status === "CONFIRMED"),
  );
  const past = bookings.filter((b) => !upcoming.includes(b));

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToucanBrand />
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-sm font-medium text-muted underline hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
      <Link href="/dash" className="mt-4 inline-block text-sm text-muted hover:text-foreground">
        ← Account
      </Link>
      <h1 className="mt-4 font-serif text-4xl tracking-tight">My bookings</h1>
      <p className="mt-2 text-muted">
        Meetings you booked (or were invited to) using {user.email}.
      </p>

      <section className="mt-8 rounded-lg border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing upcoming.</p>
        ) : (
          <VisitList bookings={upcoming} />
        )}
      </section>

      <section className="mt-6 rounded-lg border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold">Past &amp; other</h2>
        {past.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No earlier bookings.</p>
        ) : (
          <VisitList bookings={past} />
        )}
      </section>
    </main>
  );
}

function VisitList({
  bookings,
}: {
  bookings: {
    id: string;
    status: string;
    startsAt: Date;
    manageToken: string;
    host: { name: string; slug: string; timezone: string };
    meetingType: { title: string };
    jitsiUrl: string | null;
  }[];
}) {
  return (
    <ul className="mt-3 space-y-3 text-sm">
      {bookings.map((b) => (
        <li
          key={b.id}
          className="border-b border-line pb-3 last:border-0 last:pb-0"
        >
          <p className="font-medium">
            {b.meetingType.title} with {b.host.name}
          </p>
          <p className="text-muted">
            {formatSlotLabel(b.startsAt, b.host.timezone)} · {b.status}
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link
              href={`/${b.host.slug}`}
              className="font-medium text-accent underline"
            >
              Profile
            </Link>
            {b.status === "PENDING" ? (
              <Link
                href={`/invite/${b.manageToken}`}
                className="text-muted underline"
              >
                Open invite
              </Link>
            ) : null}
            {b.jitsiUrl && b.status === "CONFIRMED" ? (
              <a
                href={b.jitsiUrl}
                className="text-muted underline"
                target="_blank"
                rel="noreferrer"
              >
                Join video
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
