import Link from "next/link";
import { ToucanBrand } from "@/components/toucan-brand";
import { ForgotPasswordForm } from "@/components/account-forms";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <ToucanBrand />
      <h1 className="mt-4 font-serif text-4xl tracking-tight">
        Forgot password
      </h1>
      <p className="mt-2 text-muted">
        Enter your account email and we will send a reset link if it exists.
      </p>
      <div className="mt-8 rounded-lg border border-line bg-panel p-5">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-accent underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
