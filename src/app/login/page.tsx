import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { ToucanBrand } from "@/components/toucan-brand";
import { getOptionalUser } from "@/lib/current-user";
import { safeCallbackPath } from "@/lib/safe-callback";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const q = await searchParams;
  const callbackUrl = safeCallbackPath(q.callbackUrl);
  const user = await getOptionalUser();
  if (user) redirect(callbackUrl);

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <ToucanBrand />
      <h1 className="mt-4 font-serif text-4xl tracking-tight">Sign in</h1>
      <p className="mt-2 text-muted">Access your Toucan 121 account.</p>
      <div className="mt-8 rounded-lg border border-line bg-panel p-5">
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
