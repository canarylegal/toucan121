type DashHostStatus = {
  hostingActive: boolean;
  bookingEnabled: boolean;
} | null;

/** Subtitle under the dashboard greeting — reflects whether the profile is public. */
export function dashProfileStatusText(host: DashHostStatus): string {
  if (!host) {
    return "You do not have a public profile yet.";
  }
  if (!host.hostingActive) {
    return "Your public profile is hidden. Visitors cannot view your profile page.";
  }
  if (!host.bookingEnabled) {
    return "Your links profile is live — booking is off.";
  }
  return "Your public profile page is live.";
}
