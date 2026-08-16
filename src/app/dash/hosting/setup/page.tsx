import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getOptionalHost,
  requireUserOrRedirect,
} from "@/lib/current-user";
import { EnableHostingForm } from "@/components/enable-hosting-form";
import { ToucanBrand } from "@/components/toucan-brand";

export const dynamic = "force-dynamic";

export default async function EnableHostingPage() {
  const user = await requireUserOrRedirect("/dash/hosting/setup");
  const host = await getOptionalHost();
  if (host) redirect("/dash");

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <Link href="/dash" className="text-sm text-muted hover:text-foreground">
        ← Account
      </Link>
      <ToucanBrand className="mt-4" />
      <h1 className="mt-4 font-serif text-4xl tracking-tight">Start hosting</h1>
      <p className="mt-2 text-muted">
        Create a public profile page and meeting types so people can book you.
      </p>
      <div className="mt-8 rounded-lg border border-line bg-panel p-5">
        <EnableHostingForm defaultName={user.name} />
      </div>
    </main>
  );
}
