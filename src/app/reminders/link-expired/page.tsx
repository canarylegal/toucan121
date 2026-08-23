import Link from "next/link";
import { ToucanBrand } from "@/components/toucan-brand";
import { APP_NAME } from "@/lib/brand";

export default function ReminderLinkExpiredPage() {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <ToucanBrand />
      <h1 className="mt-4 font-serif text-4xl tracking-tight">
        Link expired
      </h1>
      <p className="mt-3 text-muted">
        This stop-reminders link is invalid or has expired. Use the link in a
        more recent reminder email, or reply to that email if you need help.
      </p>
      <p className="mt-8 text-sm text-muted">
        <Link href="/" className="font-medium text-accent underline">
          {APP_NAME} home
        </Link>
      </p>
    </main>
  );
}
