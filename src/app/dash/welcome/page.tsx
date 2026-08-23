import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserOrRedirect } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { setHostingPreferenceAction } from "@/lib/account-hosting-actions";
import { ToucanBrand } from "@/components/toucan-brand";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await requireUserOrRedirect("/dash/welcome");
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { hostingPreference: true },
  });

  if (record?.hostingPreference) {
    redirect("/dash");
  }

  return (
    <main className="mx-auto w-full max-w-lg px-6 py-12">
      <ToucanBrand />
      <h1 className="mt-6 font-serif text-4xl tracking-tight">
        Welcome, {user.name.split(" ")[0]}
      </h1>
      <p className="mt-2 text-muted">
        How would you like to use Toucan?
      </p>

      <div className="mt-8 space-y-4">
        <form action={setHostingPreferenceAction}>
          <input type="hidden" name="choice" value="VISITOR" />
          <button
            type="submit"
            className="w-full rounded-lg border border-line bg-panel px-5 py-4 text-left transition hover:border-accent/60 hover:bg-accent-soft/40"
          >
            <p className="font-semibold">Book only</p>
            <p className="mt-1 text-sm text-muted">
              Book meetings with others. No public profile page.
            </p>
          </button>
        </form>

        <form action={setHostingPreferenceAction}>
          <input type="hidden" name="choice" value="LINKS" />
          <button
            type="submit"
            className="w-full rounded-lg border border-line bg-panel px-5 py-4 text-left transition hover:border-accent/60 hover:bg-accent-soft/40"
          >
            <p className="font-semibold">Links profile</p>
            <p className="mt-1 text-sm text-muted">
              A public page for your links and socials — no booking yet.
            </p>
          </button>
        </form>

        <form action={setHostingPreferenceAction}>
          <input type="hidden" name="choice" value="HOST" />
          <button
            type="submit"
            className="w-full rounded-lg border border-accent bg-accent-soft px-5 py-4 text-left transition hover:bg-accent-soft/80"
          >
            <p className="font-semibold">Full hosting</p>
            <p className="mt-1 text-sm text-muted">
              Public profile plus meeting types so people can book you.
            </p>
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        You can change this later in{" "}
        <Link href="/dash/account" className="underline">
          Account
        </Link>
        .
      </p>
    </main>
  );
}
