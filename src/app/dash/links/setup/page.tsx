import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getOptionalHost,
  requireUserOrRedirect,
} from "@/lib/current-user";
import { EnableLinksForm } from "@/components/enable-links-form";
import { EmailVerifyBanner } from "@/components/email-verify-banner";
import { ToucanBrand } from "@/components/toucan-brand";

export const dynamic = "force-dynamic";

export default async function LinksSetupPage() {
  const user = await requireUserOrRedirect("/dash/links/setup");
  const host = await getOptionalHost();
  if (host?.hostingActive && !host.bookingEnabled) redirect("/dash");
  if (host?.hostingActive && host.bookingEnabled) redirect("/dash");

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <Link href="/dash" className="text-sm text-muted hover:text-foreground">
        ← Dashboard
      </Link>
      <ToucanBrand className="mt-4" />
      <h1 className="mt-4 font-serif text-4xl tracking-tight">
        {host ? "Reactivate links profile" : "Create your links profile"}
      </h1>
      <p className="mt-2 text-muted">
        {host
          ? "Turn your public profile back on. Booking stays off until you activate it."
          : "Share links and socials on a public page. You can turn on booking later."}
      </p>
      {user.emailVerified ? (
        <div className="mt-8 rounded-lg border border-line bg-panel p-5">
          <EnableLinksForm
            defaultName={user.name}
            submitLabel={host ? "Reactivate profile" : "Publish links profile"}
          />
        </div>
      ) : (
        <EmailVerifyBanner />
      )}
    </main>
  );
}
