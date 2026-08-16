/** Path segments that cannot be claimed as a public profile slug. */
export const RESERVED_SLUGS = new Set([
  "about",
  "api",
  "book",
  "confirmed",
  "dash",
  "faq",
  "dashboard",
  "host",
  "invite",
  "login",
  "logout",
  "signup",
  "sign-up",
  "sign-in",
  "signin",
  "uploads",
  "public",
  "static",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "admin",
  "settings",
  "account",
  "me",
  "app",
  "hosting",
  "visits",
  "connections",
  "_next",
  "next",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}
