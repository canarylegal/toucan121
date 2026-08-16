import { createHash, randomBytes } from "crypto";

/**
 * URL path suffix from a display name or user-entered suffix.
 * Allows letters, numbers, hyphens, and full stops.
 */
export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/[.-]{2,}/g, ".")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 48);

  return base || "host";
}

/** True if value is a valid booking-page suffix. */
export function isValidSuffix(value: string): boolean {
  return /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value);
}

export function randomSlugSuffix(): string {
  return randomBytes(2).toString("hex");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
