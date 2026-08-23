import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserOrRedirect, getOptionalHost } from "@/lib/current-user";
import { logoutAction } from "@/lib/auth-actions";
import { ChangePasswordForm } from "@/components/account-forms";
import { EmailVerifyBanner } from "@/components/email-verify-banner";
import { HostingModeControls } from "@/components/hosting-mode-controls";
import { ToucanBrand } from "@/components/toucan-brand";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUserOrRedirect("/dash/account");
  const host = await getOptionalHost();

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
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
        ← Dashboard
      </Link>
      <h1 className="mt-4 font-serif text-4xl tracking-tight">Account</h1>
      <p className="mt-2 text-muted">{user.email}</p>

      {user.emailVerified ? (
        <p className="mt-4 text-sm text-muted">Email confirmed.</p>
      ) : (
        <EmailVerifyBanner />
      )}

      <HostingModeControls
        hasHost={Boolean(host)}
        hostingActive={host?.hostingActive ?? false}
        bookingEnabled={host?.bookingEnabled ?? true}
      />

      <div className="mt-8 rounded-lg border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold">Change password</h2>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </div>
    </main>
  );
}
