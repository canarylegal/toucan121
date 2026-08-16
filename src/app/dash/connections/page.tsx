import Link from "next/link";
import {
  requireUserOrRedirect,
} from "@/lib/current-user";
import { logoutAction } from "@/lib/auth-actions";
import {
  listConnectionsForUser,
  type ListedConnection,
} from "@/lib/connections";
import {
  acceptConnectionAction,
  removeConnectionAction,
} from "@/lib/connection-actions";
import { ConnectionLookupForm } from "@/components/connection-lookup-form";
import { ToucanBrand } from "@/components/toucan-brand";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const user = await requireUserOrRedirect("/dash/connections");
  const { accepted, incoming, outgoing } = await listConnectionsForUser(
    user.id,
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToucanBrand />
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-sm font-medium text-muted underline hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
      <Link
        href="/dash"
        className="mt-4 inline-block text-sm text-muted hover:text-foreground"
      >
        ← Account
      </Link>
      <h1 className="mt-4 font-serif text-4xl tracking-tight">Connections</h1>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <div className="space-y-6">
          <section className="rounded-lg border border-line bg-panel p-5">
            <h2 className="text-lg font-semibold">Add a connection</h2>
            <p className="mt-1 text-sm text-muted">
              Request by account email, or by someone&apos;s public profile path.
              You can also tap Add as connection on a profile page.
            </p>
            <div className="mt-4">
              <ConnectionLookupForm />
            </div>
          </section>

          <ConnectionSection
            title="Incoming requests"
            empty="No pending requests."
            items={incoming}
            variant="incoming"
          />
          <ConnectionSection
            title="Sent requests"
            empty="No outgoing requests."
            items={outgoing}
            variant="outgoing"
          />
        </div>

        <ConnectionSection
          title="Connected"
          empty="No connections yet."
          items={accepted}
          variant="accepted"
          sticky
        />
      </div>
    </main>
  );
}

function ConnectionSection({
  title,
  empty,
  items,
  variant,
  sticky = false,
}: {
  title: string;
  empty: string;
  items: ListedConnection[];
  variant: "incoming" | "outgoing" | "accepted";
  sticky?: boolean;
}) {
  return (
    <section
      className={`rounded-lg border border-line bg-panel p-5${
        sticky ? " lg:sticky lg:top-6" : ""
      }`}
    >
      <h2 className="text-lg font-semibold">
        {title}
        {items.length > 0 ? (
          <span className="ml-2 text-sm font-normal text-muted">
            ({items.length})
          </span>
        ) : null}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3 text-sm">
          {items.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0"
            >
              <div>
                <p className="font-medium">{c.other.name}</p>
                <p className="text-muted">{c.other.email}</p>
                {c.other.hostSlug ? (
                  <p>
                    <Link
                      href={`/${c.other.hostSlug}`}
                      className="text-accent underline"
                    >
                      /{c.other.hostSlug}
                    </Link>
                  </p>
                ) : (
                  <p className="text-muted">Account only — no public profile</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {variant === "incoming" ? (
                  <>
                    <form action={acceptConnectionAction}>
                      <input
                        type="hidden"
                        name="connectionId"
                        value={c.id}
                      />
                      <button
                        type="submit"
                        className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        Accept
                      </button>
                    </form>
                    <form action={removeConnectionAction}>
                      <input
                        type="hidden"
                        name="connectionId"
                        value={c.id}
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold hover:bg-accent-soft"
                      >
                        Ignore
                      </button>
                    </form>
                  </>
                ) : variant === "outgoing" ? (
                  <form action={removeConnectionAction}>
                    <input type="hidden" name="connectionId" value={c.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold hover:bg-accent-soft"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <form action={removeConnectionAction}>
                    <input type="hidden" name="connectionId" value={c.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold hover:bg-accent-soft"
                    >
                      Remove
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
