import Link from "next/link";
import { logoutAction } from "@/lib/auth-actions";

const linkClass =
  "rounded-md px-2 py-1 font-semibold text-muted hover:bg-accent-soft hover:text-foreground";

export function HomeFooterNav({ signedIn }: { signedIn: boolean }) {
  return (
    <nav
      className="mt-auto flex flex-wrap items-center gap-x-1 gap-y-2 pt-12 text-sm"
      aria-label="Site links"
    >
      <Link href="/about" className={linkClass}>Learn more</Link>
      <span className="text-muted/40" aria-hidden>·</span>
      <Link href="/privacy" className={linkClass}>Privacy</Link>
      {signedIn ? (
        <>
          <span className="text-muted/40" aria-hidden>·</span>
          <form action={logoutAction} className="inline">
            <button type="submit" className={linkClass}>Log out</button>
          </form>
        </>
      ) : null}
    </nav>
  );
}
