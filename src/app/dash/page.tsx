import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logoutAction } from "@/lib/auth-actions";
import { EmailVerifyBanner } from "@/components/email-verify-banner";
import { toggleMeetingTypeAction } from "@/lib/meeting-type-actions";
import {
  getOptionalHost,
  isHostingLive,
  requireUserOrRedirect,
} from "@/lib/current-user";
import { incomingConnectionCount } from "@/lib/connections";
import { HostBookingList } from "@/components/host-booking-list";
import { HostWrapUpList } from "@/components/host-wrap-up-list";
import { HostPastPendingList } from "@/components/host-past-pending-list";
import { DashHostActions } from "@/components/dash-host-actions";
import { ProfileLinkActions } from "@/components/profile-link-actions";
import { VisitorModeBanner } from "@/components/visitor-mode-banner";
import { ToucanBrand } from "@/components/toucan-brand";
import { formatSlotLabel } from "@/lib/availability";
import { dashProfileStatusText } from "@/lib/dash-profile-status";
import { hostHasConnectedCalendar } from "@/lib/calendar/host-calendar";
import { CalendarConnectBanner } from "@/components/calendar-connect-banner";

export const dynamic = "force-dynamic";

export default async function DashPage({
  searchParams,
}: {
  searchParams: Promise<{
    booked?: string;
    rescheduled?: string;
    cancelled?: string;
    deletedMeetingType?: string;
    meetingTypeCreated?: string;
    hostingEnabled?: string;
    hostingPaused?: string;
    linksEnabled?: string;
    bookingRequired?: string;
    verified?: string;
  }>;
}) {
  const user = await requireUserOrRedirect();
  const userRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: { hostingPreference: true },
  });
  if (!userRecord?.hostingPreference) {
    redirect("/dash/welcome");
  }

  const host = await getOptionalHost();
  const q = await searchParams;

  if (userRecord.hostingPreference === "LINKS" && !host) {
    redirect("/dash/links/setup");
  }

  const incomingConnections = await incomingConnectionCount(user.id);
  const connectionsLabel =
    incomingConnections > 0
      ? `Connections (${incomingConnections})`
      : "Connections";

  if (!isHostingLive(host)) {
    const paused = Boolean(host);
    const visits = await prisma.booking.findMany({
      where: { guestEmail: { equals: user.email, mode: "insensitive" } },
      orderBy: { startsAt: "desc" },
      take: 8,
      include: {
        host: { select: { name: true, slug: true, timezone: true } },
        meetingType: { select: { title: true } },
      },
    });

    const now = new Date();
    const hostUpcoming =
      paused && host
        ? await prisma.booking.findMany({
            where: {
              hostId: host.id,
              status: { in: ["PENDING", "CONFIRMED"] },
              endsAt: { gt: now },
            },
            orderBy: { startsAt: "asc" },
            take: 15,
            include: { meetingType: { select: { title: true } } },
          })
        : [];

    const hostPastPending =
      paused && host
        ? await prisma.booking.findMany({
            where: {
              hostId: host.id,
              status: "PENDING",
              endsAt: { lte: now },
            },
            orderBy: { endsAt: "desc" },
            take: 20,
            include: { meetingType: { select: { title: true } } },
          })
        : [];

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
        <h1 className="mt-4 font-serif text-4xl tracking-tight">
          Hello, {user.name}
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          {dashProfileStatusText(host)}
        </p>
        {user.emailVerified ? null : <EmailVerifyBanner />}
        <VisitorModeBanner variant={paused ? "paused" : "visitor"} />
        {q.verified === "1" ? (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Email confirmed.
          </p>
        ) : null}
        {q.hostingPaused === "1" ? (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Hosting paused — your public profile is hidden.
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          {!paused ? (
            <>
              <Link
                href="/dash/links/setup"
                className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Create links profile
              </Link>
              <Link
                href="/dash/hosting/setup"
                className="rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-semibold hover:bg-accent-soft"
              >
                Start full hosting
              </Link>
            </>
          ) : null}
          <Link
            href="/dash/visits"
            className="rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-semibold hover:bg-accent-soft"
          >
            My bookings
          </Link>
          <Link
            href="/dash/connections"
            className="rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-semibold hover:bg-accent-soft"
          >
            {connectionsLabel}
          </Link>
          <Link
            href="/dash/account"
            className="rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-semibold hover:bg-accent-soft"
          >
            Account
          </Link>
        </div>

        {paused && host ? (
          <>
            <HostPastPendingList
              bookings={hostPastPending}
              timezone={host.timezone}
            />
            <section className="mt-10 rounded-lg border border-line bg-panel p-5">
              <h2 className="text-lg font-semibold">
                Upcoming meetings you&apos;re hosting
              </h2>
              <HostBookingList
                bookings={hostUpcoming}
                timezone={host.timezone}
                empty="Nothing upcoming."
              />
            </section>
          </>
        ) : null}

        <section className="mt-10 rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Recent bookings</h2>
            <Link
              href="/dash/visits"
              className="text-sm font-medium text-accent underline"
            >
              View all
            </Link>
          </div>
          {visits.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              No bookings yet. When you book someone&apos;s profile page with
              this email, they show up here.
            </p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {visits.map((b) => (
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
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    );
  }

  if (!host!.bookingEnabled) {
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const profileUrl = `${appUrl}/${host!.slug}`;
    const visits = await prisma.booking.findMany({
      where: { guestEmail: { equals: user.email, mode: "insensitive" } },
      orderBy: { startsAt: "desc" },
      take: 8,
      include: {
        host: { select: { name: true, slug: true, timezone: true } },
        meetingType: { select: { title: true } },
      },
    });

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
        <h1 className="mt-4 font-serif text-4xl tracking-tight">
          Hello, {host!.name}
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          {dashProfileStatusText(host)}
        </p>
        {user.emailVerified ? null : <EmailVerifyBanner />}
        <VisitorModeBanner variant="links" />
        {q.verified === "1" ? (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Email confirmed.
          </p>
        ) : null}
        {q.linksEnabled === "1" ? (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Links profile published — share your profile link.
          </p>
        ) : null}
        {q.bookingRequired === "1" ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            That page needs booking to be activated on your account.
          </p>
        ) : null}

        <div className="mt-6 border-l-4 border-accent bg-accent-soft/50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Profile page
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 break-all font-serif text-xl tracking-tight sm:text-2xl">
              <Link
                href={`/${host!.slug}`}
                className="text-foreground underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
              >
                {profileUrl}
              </Link>
            </p>
            <ProfileLinkActions url={profileUrl} slug={host!.slug} />
          </div>
        </div>

        <DashHostActions
          hostSlug={host!.slug}
          connectionsLabel={connectionsLabel}
          bookingEnabled={false}
        />

        <section className="mt-10 rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Recent bookings</h2>
            <Link
              href="/dash/visits"
              className="text-sm font-medium text-accent underline"
            >
              View all
            </Link>
          </div>
          {visits.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              No bookings yet. When you book someone&apos;s profile page with
              this email, they show up here.
            </p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {visits.map((b) => (
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
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    );
  }

  const hostId = host!.id;
  const now = new Date();
  const since30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [hostFull, wrapUp, pastPending, upcoming, recent, cancelledList] =
    await Promise.all([
      prisma.host.findUnique({
        where: { id: hostId },
        include: {
          meetingTypes: {
            where: { deletedAt: null },
            orderBy: { title: "asc" },
          },
          calendars: {
            select: {
              provider: true,
              configJson: true,
              writeTarget: true,
            },
          },
        },
      }),
      prisma.booking.findMany({
        where: {
          hostId,
          status: "CONFIRMED",
          endsAt: { lte: now },
        },
        orderBy: { endsAt: "desc" },
        take: 20,
        include: { meetingType: { select: { title: true } } },
      }),
      prisma.booking.findMany({
        where: {
          hostId,
          status: "PENDING",
          endsAt: { lte: now },
        },
        orderBy: { endsAt: "desc" },
        take: 20,
        include: { meetingType: { select: { title: true } } },
      }),
      prisma.booking.findMany({
        where: {
          hostId,
          status: { in: ["PENDING", "CONFIRMED"] },
          endsAt: { gt: now },
        },
        orderBy: { startsAt: "asc" },
        take: 15,
        include: { meetingType: { select: { title: true } } },
      }),
      prisma.booking.findMany({
        where: {
          hostId,
          status: "COMPLETED",
          endsAt: { gte: since30Days },
        },
        orderBy: [{ completedAt: "desc" }, { startsAt: "desc" }],
        take: 50,
        include: { meetingType: { select: { title: true } } },
      }),
      prisma.booking.findMany({
        where: {
          hostId,
          status: "CANCELLED",
          updatedAt: { gte: since30Days },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: { meetingType: { select: { title: true } } },
      }),
    ]);

  if (!hostFull) {
    redirect("/login");
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const bookedPending = q.booked === "1" || q.booked === "pending";
  const bookedConfirmed = q.booked === "confirmed";
  const rescheduled = q.rescheduled === "1";
  const cancelled = q.cancelled === "1";
  const deletedMeetingType = q.deletedMeetingType === "1";
  const meetingTypeCreated = q.meetingTypeCreated === "1";
  const hostingEnabled = q.hostingEnabled === "1";
  const bookingUrl = `${appUrl}/${hostFull.slug}`;
  const needsCalendar =
    hostFull.bookingEnabled &&
    hostFull.hostingActive &&
    !hostHasConnectedCalendar(hostFull.calendars);

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-12">
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

      <h1 className="mt-4 font-serif text-4xl tracking-tight">
        Hello, {hostFull.name}
      </h1>
      <p className="mt-2 max-w-xl text-muted">
        {dashProfileStatusText(hostFull)}
      </p>
      {user.emailVerified ? null : <EmailVerifyBanner />}
      {q.verified === "1" ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Email confirmed.
        </p>
      ) : null}

      {hostingEnabled ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Hosting enabled — connect a calendar and share your profile link.
        </p>
      ) : null}
      {needsCalendar ? <CalendarConnectBanner /> : null}
      {bookedPending ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Invitation sent — pending until the invitee accepts.
        </p>
      ) : null}
      {bookedConfirmed ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Booking confirmed — visitor emailed.
        </p>
      ) : null}
      {rescheduled ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Booking rescheduled — guest emailed.
        </p>
      ) : null}
      {cancelled ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Booking cancelled — guest emailed.
        </p>
      ) : null}
      {deletedMeetingType ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Meeting type deleted.
        </p>
      ) : null}
      {meetingTypeCreated ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Meeting type created.
        </p>
      ) : null}

      <div className="mt-6 border-l-4 border-accent bg-accent-soft/50 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Profile page
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 break-all font-serif text-xl tracking-tight sm:text-2xl">
            <Link
              href={`/${hostFull.slug}`}
              className="text-foreground underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
            >
              {bookingUrl}
            </Link>
          </p>
          <ProfileLinkActions url={bookingUrl} slug={hostFull.slug} />
        </div>
      </div>

      <DashHostActions
        hostSlug={hostFull.slug}
        connectionsLabel={connectionsLabel}
      />

      <HostPastPendingList
        bookings={pastPending}
        timezone={hostFull.timezone}
      />
      <HostWrapUpList bookings={wrapUp} timezone={hostFull.timezone} />

      <div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-lg border border-line bg-panel p-5">
          <h2 className="text-lg font-semibold">Meeting types</h2>
          {hostFull.meetingTypes.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              No meeting types yet — create one to start taking bookings.
            </p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {hostFull.meetingTypes.map((mt) => (
                <li
                  key={mt.id}
                  className="border-b border-line pb-3 last:border-0 last:pb-0"
                >
                  <p className="font-medium">
                    {mt.title}{" "}
                    {!mt.active ? (
                      <span className="text-muted">(inactive)</span>
                    ) : null}
                  </p>
                  <p className="text-muted">
                    {mt.durationMins} min
                    {mt.bufferBefore || mt.bufferAfter
                      ? ` · buffer ${mt.bufferBefore}/${mt.bufferAfter}`
                      : ""}{" "}
                    ·{" "}
                    {mt.locationType === "VIDEO"
                      ? mt.videoUrl.trim()
                        ? "video · fixed link"
                        : "video · Jitsi"
                      : mt.venuePolicy === "GUEST_PROPOSES"
                        ? "in person · guest venue"
                        : "in person"}{" "}
                    ·{" "}
                    {mt.approvalMode === "AUTO"
                      ? "auto-confirm"
                      : mt.approvalMode === "MANUAL"
                        ? "manual approval"
                        : mt.approvalMode === "CONNECTIONS"
                          ? "auto if connected"
                          : "conditional"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <Link
                      href={`/dash/meetings/${mt.id}`}
                      className="font-medium text-accent underline"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/${hostFull.slug}/${mt.slug}`}
                      className="text-muted underline"
                    >
                      Preview
                    </Link>
                    <form action={toggleMeetingTypeAction}>
                      <input type="hidden" name="id" value={mt.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={mt.active ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        className="text-muted underline hover:text-foreground"
                      >
                        {mt.active ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <h2 className="text-lg font-semibold">Upcoming meetings</h2>
          <HostBookingList
            bookings={upcoming}
            timezone={hostFull.timezone}
            empty="Nothing upcoming."
          />
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Recent meetings</h2>
            <Link
              href="/dash/history"
              className="text-sm font-medium text-accent underline"
            >
              Full history
            </Link>
          </div>
          <p className="mt-1 text-xs text-muted">Last 30 days</p>
          <HostBookingList
            bookings={recent}
            timezone={hostFull.timezone}
            empty="No meetings in the last 30 days."
            showActionStatus
          />
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              Cancelled{" "}
              {cancelledList.length > 0 ? (
                <span className="text-sm font-normal text-muted">
                  ({cancelledList.length})
                </span>
              ) : null}
            </h2>
            <Link
              href="/dash/history"
              className="text-sm font-medium text-accent underline"
            >
              Full history
            </Link>
          </div>
          <p className="mt-1 text-xs text-muted">Last 30 days</p>
          <HostBookingList
            bookings={cancelledList}
            timezone={hostFull.timezone}
            empty="No cancellations in the last 30 days."
            allowRescheduleCancelled
          />
        </section>
      </div>
    </main>
  );
}
