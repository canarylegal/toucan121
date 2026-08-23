import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { consumeEmailToken } from "@/lib/email-tokens";
import { ToucanBrand } from "@/components/toucan-brand";

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const consumed = await consumeEmailToken(token, "EMAIL_VERIFY");
  if (!consumed) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-12">
        <ToucanBrand />
        <h1 className="mt-4 font-serif text-4xl tracking-tight">
          Link expired
        </h1>
        <p className="mt-2 text-muted">
          That confirm link is invalid or has already been used. Sign in and
          resend one from your account page.
        </p>
        <p className="mt-6">
          <Link href="/login" className="font-medium text-accent underline">
            Sign in
          </Link>
        </p>
      </main>
    );
  }

  await prisma.user.update({
    where: { id: consumed.userId },
    data: { emailVerifiedAt: new Date() },
  });
  redirect("/dash?verified=1");
}
