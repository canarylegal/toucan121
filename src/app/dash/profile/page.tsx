import { requireHostOrRedirect } from "@/lib/current-user";
import { redirect } from "next/navigation";

/** Profile editing happens on the public profile page (WYSIWYG). */
export default async function DashProfileRedirectPage() {
  const host = await requireHostOrRedirect();
  redirect(`/${host.slug}?edit=1`);
}
