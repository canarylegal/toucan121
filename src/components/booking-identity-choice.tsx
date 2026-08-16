"use client";

export function BookingIdentityChoice({
  loginHref,
  signedInAs,
}: {
  loginHref: string;
  signedInAs?: { name: string; email: string } | null;
}) {
  if (signedInAs) {
    return (
      <p className="rounded-lg border border-line bg-white px-4 py-3 text-sm text-muted">
        Signed in as{" "}
        <span className="font-medium text-foreground">{signedInAs.name}</span>{" "}
        ({signedInAs.email}). Saved details and connections apply.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3">
      <p className="text-sm text-muted">
        Booking as guest. Log in to use saved details and connections.
      </p>
      <a
        href={loginHref}
        className="inline-flex items-center justify-center rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-semibold hover:bg-accent-soft"
      >
        Log in
      </a>
    </div>
  );
}
