/** Public booking URL that restores slot + form fields after optional login. */
export function bookingReturnPath(opts: {
  hostSlug: string;
  meetingTypeSlug: string;
  startsAt?: string;
  guestName?: string;
  guestEmail?: string;
  notes?: string;
  venue?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.startsAt?.trim()) params.set("startsAt", opts.startsAt.trim());
  if (opts.guestName?.trim()) {
    params.set("guestName", opts.guestName.trim().slice(0, 120));
  }
  if (opts.guestEmail?.trim()) {
    params.set("guestEmail", opts.guestEmail.trim().slice(0, 254));
  }
  if (opts.notes?.trim()) {
    params.set("notes", opts.notes.trim().slice(0, 400));
  }
  if (opts.venue?.trim()) {
    params.set("venue", opts.venue.trim().slice(0, 300));
  }
  const qs = params.toString();
  const path = `/${opts.hostSlug}/${opts.meetingTypeSlug}`;
  return qs ? `${path}?${qs}` : path;
}

export function loginWithReturnHref(returnPath: string): string {
  return `/login?callbackUrl=${encodeURIComponent(returnPath)}`;
}

export function signupWithReturnHref(returnPath: string): string {
  return `/signup?callbackUrl=${encodeURIComponent(returnPath)}`;
}
