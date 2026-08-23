import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getOptionalHost,
  requireUserOrRedirect,
} from "@/lib/current-user";
import { EnableHostingForm } from "@/components/enable-hosting-form";
import { reactivateHostingAction } from "@/lib/account-hosting-actions";
import { EmailVerifyBanner } from "@/components/email-verify-banner";
import { ToucanBrand } from "@/components/toucan-brand";

export const dynamic = "force-dynamic";

export default async function EnableHostingPage() {
  const user = await requireUserOrRedirect("/dash/hosting/setup");
  const host = await getOptionalHost();
  if (host?.hostingActive && host.bookingEnabled) redirect("/dash");

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <Link href="/dash" className="text-sm text-muted hover:text-foreground">
        ← Dashboard
      </Link>
      <ToucanBrand className="mt-4" />
      <h1 className="mt-4 font-serif text-4xl tracking-tight">
        {host
          ? host.bookingEnabled
            ? "Reactivate hosting"
            : "Activate booking"
          : "Start hosting"}
      </h1>
      <p className="mt-2 text-muted">
        {host?.bookingEnabled === false
          ? "Add meeting types and calendar sync so people can book time with you."
          : host
            ? "Turn your public profile back on and start taking bookings again."
            : "Create a public profile page and meeting types so people can book you."}
      </p>
      {user.emailVerified ? (
        <div className="mt-8 rounded-lg border border-line bg-panel p-5">
          {host ? (
            <form action={reactivateHostingAction}>
              <button
                type="submit"
                className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Reactivate hosting
              </button>
            </form>
          ) : (
            <EnableHostingForm defaultName={user.name} />
          )}
        </div>
      ) : (
        <EmailVerifyBanner />
      )}
    </main>
  );
}
