import Link from "next/link";
import { Suspense } from "react";
import { getHostBySlug, listSlotsForMeetingType } from "@/lib/booking";
import { dayKeyInZone, formatSlotTime } from "@/lib/availability";
import { getOptionalHost, getOptionalUser } from "@/lib/current-user";
import { getConnectionBetween } from "@/lib/connections";
import { ProfileConnectionControls } from "@/components/profile-connection-controls";
import { loginWithReturnHref } from "@/lib/booking-return";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { parseSocialOrder } from "@/lib/social-order";
import { HostBrandingHeader } from "@/components/host-branding";
import { ProfileOwnerControls } from "@/components/profile-owner-controls";
import { ProfileBookingPanel } from "@/components/profile-booking-panel";
import { ToucanBrand } from "@/components/toucan-brand";
import type { ProfileFormValues } from "@/lib/profile";

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ hostSlug: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { hostSlug } = await params;
  const q = await searchParams;

  if (isReservedSlug(hostSlug)) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="font-serif text-3xl">Not found</h1>
        <ToucanBrand className="mt-6" />
      </main>
    );
  }

  const host = await getHostBySlug(hostSlug);
  if (!host) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="font-serif text-3xl">Profile not found</h1>
        <p className="mt-2 text-muted">No profile at “/{hostSlug}”.</p>
        <ToucanBrand className="mt-6" />
      </main>
    );
  }

  const viewerHost = await getOptionalHost();
  const viewer = await getOptionalUser();
  const isOwner = viewerHost?.id === host.id;

  let connectionState:
    | { kind: "none" }
    | { kind: "outgoing"; connectionId: string }
    | { kind: "incoming"; connectionId: string }
    | { kind: "accepted"; connectionId: string } = { kind: "none" };
  if (viewer && !isOwner) {
    const row = await getConnectionBetween(viewer.id, host.userId);
    if (row?.status === "ACCEPTED") {
      connectionState = { kind: "accepted", connectionId: row.id };
    } else if (row?.status === "PENDING") {
      connectionState =
        row.requestedById === viewer.id
          ? { kind: "outgoing", connectionId: row.id }
          : { kind: "incoming", connectionId: row.id };
    }
  }

  const socialOrder = parseSocialOrder(host.socialOrderJson);

  const branding = {
    name: host.name,
    headline: host.headline,
    businessName: host.businessName,
    bio: host.bio,
    websiteUrl: host.websiteUrl,
    publicEmail: host.publicEmail,
    phone: host.phone,
    linkedinUrl: host.linkedinUrl,
    facebookUrl: host.facebookUrl,
    instagramUrl: host.instagramUrl,
    tiktokUrl: host.tiktokUrl,
    xUrl: host.xUrl,
    youtubeUrl: host.youtubeUrl,
    socialOrder,
    avatarPath: host.avatarPath,
    timezone: host.timezone,
  };

  const profileValues: ProfileFormValues = {
    name: host.name,
    headline: host.headline,
    businessName: host.businessName,
    bio: host.bio,
    websiteUrl: host.websiteUrl,
    publicEmail: host.publicEmail,
    phone: host.phone,
    linkedinUrl: host.linkedinUrl,
    facebookUrl: host.facebookUrl,
    instagramUrl: host.instagramUrl,
    tiktokUrl: host.tiktokUrl,
    xUrl: host.xUrl,
    youtubeUrl: host.youtubeUrl,
    socialOrder,
    timezone: host.timezone,
    bookingHorizonDays: host.bookingHorizonDays,
    avatarPath: host.avatarPath,
  };

  const meetingTypes = host.meetingTypes.map((mt) => ({
    id: mt.id,
    slug: mt.slug,
    title: mt.title,
    durationMins: mt.durationMins,
    description: mt.description,
    locationType: mt.locationType,
    venuePolicy: mt.venuePolicy,
    locationNote: mt.locationNote,
  }));

  const overviewByDay = new Map<
    string,
    { value: string; dayKey: string; timeLabel: string; available: boolean }
  >();
  await Promise.all(
    meetingTypes.map(async (mt) => {
      try {
        const { candidates } = await listSlotsForMeetingType({
          hostSlug: host.slug,
          meetingTypeSlug: mt.slug,
        });
        for (const c of candidates) {
          if (!c.available) continue;
          const dayKey = dayKeyInZone(c.startsAt, host.timezone);
          if (overviewByDay.has(dayKey)) continue;
          overviewByDay.set(dayKey, {
            value: c.startsAt.toISOString(),
            dayKey,
            timeLabel: formatSlotTime(c.startsAt, host.timezone),
            available: true,
          });
        }
      } catch {
        // ignore per-type failures for overview
      }
    }),
  );
  const overviewCandidates = [...overviewByDay.values()];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between gap-3">
        <ToucanBrand />
        {isOwner ? (
          <Link
            href="/dash"
            className="text-sm font-medium text-muted underline hover:text-foreground"
          >
            Dashboard
          </Link>
        ) : null}
      </div>

      <div className="max-w-2xl">
        <HostBrandingHeader host={branding} />
      </div>

      {isOwner ? (
        <Suspense fallback={null}>
          <ProfileOwnerControls
            initial={profileValues}
            startEditing={q.edit === "1"}
          />
        </Suspense>
      ) : viewer ? (
        <ProfileConnectionControls
          hostName={host.name}
          hostSlug={host.slug}
          targetUserId={host.userId}
          state={connectionState}
        />
      ) : (
        <p className="mt-6 text-sm text-muted">
          Have a Toucan account?{" "}
          <Link
            href={loginWithReturnHref(`/${host.slug}`)}
            className="font-medium text-accent underline"
          >
            Log in
          </Link>{" "}
          to add a connection.
        </p>
      )}

      <section className="mt-12">
        <ProfileBookingPanel
          hostSlug={host.slug}
          timezone={host.timezone}
          meetingTypes={meetingTypes}
          overviewCandidates={overviewCandidates}
        />
      </section>
    </main>
  );
}
