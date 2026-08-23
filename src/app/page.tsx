import Link from "next/link";
import { getOptionalHost, getOptionalUser } from "@/lib/current-user";
import { HomeFooterNav } from "@/components/home-footer-nav";
import { ToucanBrand } from "@/components/toucan-brand";

export default async function Home() {
  const user = await getOptionalUser();
  const host = user ? await getOptionalHost() : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-16">
      <div className="flex flex-1 flex-col justify-center gap-8">
        <ToucanBrand size="hero" />
        <div className="space-y-3">
          <h1 className="max-w-xl font-serif text-3xl leading-tight tracking-tight">
            Organise your 121s with ease.
          </h1>
          <div className="max-w-lg space-y-3 text-lg text-muted">
            <p>
              A simple calendar management app to help you get the most out of
              your 121s. Suitable for video calls and in person meetings.
            </p>
            <p>
              A free open source alternative to Calendly, compatible with Outlook,
              Google, CalDAV and iCal.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {user ? (
            <>
              <Link
                href="/dash"
                className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
              >
                Open account
              </Link>
              {host ? (
                <Link
                  href={`/${host.slug}`}
                  className="rounded-md border border-line bg-panel px-5 py-3 text-sm font-semibold hover:bg-accent-soft"
                >
                  View my profile page
                </Link>
              ) : (
                <Link
                  href="/dash/hosting/setup"
                  className="rounded-md border border-line bg-panel px-5 py-3 text-sm font-semibold hover:bg-accent-soft"
                >
                  Start hosting
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                href="/signup"
                className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
              >
                Create account
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-line bg-panel px-5 py-3 text-sm font-semibold hover:bg-accent-soft"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
      <HomeFooterNav signedIn={Boolean(user)} />
    </main>
  );
}
