"use client";

import { useState } from "react";
import type { ResolvedStackButton } from "@/lib/profile-stack";
import type { ResolvedProfileTheme } from "@/lib/profile-theme";
import { ProfileLinkButtonList } from "@/components/profile-link-button";
import {
  ProfileBookingPanel,
  type ProfileMeetingType,
} from "@/components/profile-booking-panel";
import type { BookingSlotCandidate } from "@/components/slot-calendar-picker";
import { HostBrandingHeader, type PublicHostBranding } from "@/components/host-branding";
import { ProfileTreeAvatarGallery } from "@/components/profile-tree-avatar-gallery";

export function ProfileLinksFirstView({
  branding,
  stackButtons,
  hostSlug,
  timezone,
  meetingTypes,
  overviewCandidates,
  theme,
  bookingEnabled = true,
  profileUrl,
}: {
  branding: PublicHostBranding;
  stackButtons: ResolvedStackButton[];
  hostSlug: string;
  profileUrl: string;
  timezone: string;
  meetingTypes: ProfileMeetingType[];
  overviewCandidates: BookingSlotCandidate[];
  theme: ResolvedProfileTheme;
  bookingEnabled?: boolean;
}) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const showBooking = bookingEnabled && meetingTypes.length > 0;

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="text-center">
        <HostBrandingHeader
          host={branding}
          showTimezone={false}
          variant="centered"
          hideSocialIcons
          themed
          avatarSlot={
            <ProfileTreeAvatarGallery
              avatarPath={branding.avatarPath}
              name={branding.name}
              profileUrl={profileUrl}
              hostSlug={hostSlug}
            />
          }
        />
      </div>

      <div className="mt-8">
        {bookingOpen && showBooking ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setBookingOpen(false)}
              className="text-sm font-medium underline"
              style={{ color: "var(--profile-muted)" }}
            >
              ← Back to links
            </button>
            <ProfileBookingPanel
              hostSlug={hostSlug}
              timezone={timezone}
              meetingTypes={meetingTypes}
              overviewCandidates={overviewCandidates}
              variant="stack"
            />
          </div>
        ) : (
          <ProfileLinkButtonList
            items={stackButtons}
            onBook={showBooking ? () => setBookingOpen(true) : undefined}
            theme={theme}
          />
        )}
      </div>
    </div>
  );
}
