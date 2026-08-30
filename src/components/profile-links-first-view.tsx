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
import { ProfileContactRow } from "@/components/profile-contact-row";
import type { ContactRowItem } from "@/lib/profile-contact-row";

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
  contactRowItems = [],
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
  contactRowItems?: ContactRowItem[];
}) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const showBooking = bookingEnabled && meetingTypes.length > 0;
  const visibleButtons = showBooking
    ? stackButtons
    : stackButtons.filter((item) => item.kind !== "book");

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

      {contactRowItems.length > 0 ? (
        <div className="mt-6">
          <ProfileContactRow items={contactRowItems} />
        </div>
      ) : null}

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
            items={visibleButtons}
            onBook={showBooking ? () => setBookingOpen(true) : undefined}
            theme={theme}
          />
        )}
      </div>
    </div>
  );
}
