import Link from "next/link";
import { ToucanBrand } from "@/components/toucan-brand";
import { ResetPasswordForm } from "@/components/account-forms";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <ToucanBrand />
      <h1 className="mt-4 font-serif text-4xl tracking-tight">
        Choose a new password
      </h1>
      <p className="mt-2 text-muted">Use at least 8 characters.</p>
      <div className="mt-8 rounded-lg border border-line bg-panel p-5">
        <ResetPasswordForm token={token} />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-accent underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
