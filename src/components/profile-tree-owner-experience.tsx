"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ProfileForm, type ProfileFormValues } from "@/components/profile-form";
import { ProfileLinksFirstView } from "@/components/profile-links-first-view";
import { ToucanBrand } from "@/components/toucan-brand";
import type { ResolvedStackButton } from "@/lib/profile-stack";
import type { ResolvedProfileTheme } from "@/lib/profile-theme";
import type { ProfileMeetingType } from "@/components/profile-booking-panel";
import type { BookingSlotCandidate } from "@/components/slot-calendar-picker";
import type { PublicHostBranding } from "@/components/host-branding";

const headerLinkClass = "underline";

export function ProfileTreeOwnerExperience({
  initial,
  startEditing = false,
  hostingPaused = false,
  branding,
  stackButtons,
  hostSlug,
  timezone,
  meetingTypes,
  overviewCandidates,
  theme,
  bookingEnabled,
  profileUrl,
}: {
  initial: ProfileFormValues;
  startEditing?: boolean;
  hostingPaused?: boolean;
  branding: PublicHostBranding;
  stackButtons: ResolvedStackButton[];
  hostSlug: string;
  profileUrl: string;
  timezone: string;
  meetingTypes: ProfileMeetingType[];
  overviewCandidates: BookingSlotCandidate[];
  theme: ResolvedProfileTheme;
  bookingEnabled: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState(
    startEditing || searchParams.get("edit") === "1",
  );

  const mutedStyle = { color: "var(--profile-muted)" };

  function closeEdit() {
    setEditing(false);
    if (searchParams.get("edit") === "1") {
      router.replace(pathname);
    }
  }

  function openEdit() {
    setEditing(true);
  }

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <ToucanBrand tone="profile" />
        <nav
          className="flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 text-sm font-medium"
          aria-label="Owner actions"
        >
          <Link href="/dash" className={headerLinkClass} style={mutedStyle}>
            Dashboard
          </Link>
          <span className="text-muted/40" style={{ color: "var(--profile-muted)" }}>
            ·
          </span>
          {editing ? (
            <button
              type="button"
              onClick={closeEdit}
              className={headerLinkClass}
              style={mutedStyle}
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={openEdit}
              className={headerLinkClass}
              style={mutedStyle}
            >
              Edit profile
            </button>
          )}
        </nav>
      </div>

      {hostingPaused ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Hosting is paused — only you can see this preview. Your public profile
          is hidden from visitors.
        </p>
      ) : null}

      {editing ? (
        <section
          className="profile-editor-surface mx-auto w-full max-w-md rounded-lg border border-line p-5 shadow-sm"
        >
          <div>
            <h2 className="text-lg font-semibold">Edit your public profile</h2>
            <p className="mt-1 text-sm text-muted">
              Changes appear here the way visitors see them. Saving closes this
              panel.
            </p>
          </div>
          <div className="mt-5">
            <ProfileForm
              initial={initial}
              variant="inline"
              onSaved={closeEdit}
            />
          </div>
        </section>
      ) : (
        <ProfileLinksFirstView
          branding={branding}
          stackButtons={stackButtons}
          hostSlug={hostSlug}
          profileUrl={profileUrl}
          timezone={timezone}
          meetingTypes={meetingTypes}
          overviewCandidates={overviewCandidates}
          theme={theme}
          bookingEnabled={bookingEnabled}
        />
      )}
    </>
  );
}
