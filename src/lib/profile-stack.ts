import type { SocialLinkKey } from "@/components/social-icons";
import { SOCIAL_LINK_META } from "@/components/social-icons";
import { CONTACT_ROW_SOCIAL_KEYS } from "@/lib/profile-contact-row";
import { parseSocialOrder } from "@/lib/social-order";

export type ProfileStackEntry =
  | { type: "book" }
  | { type: "social"; key: SocialLinkKey }
  | { type: "link"; linkId: string };

export type ResolvedStackButton = {
  id: string;
  label: string;
  href?: string;
  kind: "book" | "social" | "link";
  external?: boolean;
  socialKey?: SocialLinkKey;
  linkIconKey?: string;
  linkEmoji?: string;
};

type HostLinkRow = {
  id: string;
  title: string;
  url: string;
  active: boolean;
  iconKey: string;
  emoji: string;
};

type HostFields = {
  websiteUrl: string;
  publicEmail: string;
  phone: string;
  whatsappUrl: string;
  linkedinUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  xUrl: string;
  youtubeUrl: string;
  socialOrderJson: string;
};

const metaByKey = new Map(SOCIAL_LINK_META.map((m) => [m.key, m]));

function linkValue(host: HostFields, key: SocialLinkKey): string {
  return (host[key] ?? "").trim();
}

function withoutContactRowSocials(
  keys: Set<SocialLinkKey>,
  excludeContactRowSocials?: boolean,
): Set<SocialLinkKey> {
  if (!excludeContactRowSocials) return keys;
  const next = new Set(keys);
  for (const key of CONTACT_ROW_SOCIAL_KEYS) next.delete(key);
  return next;
}

export function parseProfileStackOrder(
  json: string | null | undefined,
): ProfileStackEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: ProfileStackEntry[] = [];
  for (const item of parsed) {
    if (item === "book" || item?.type === "book") {
      out.push({ type: "book" });
      continue;
    }
    if (
      item?.type === "social" &&
      typeof item.key === "string" &&
      metaByKey.has(item.key as SocialLinkKey)
    ) {
      out.push({ type: "social", key: item.key as SocialLinkKey });
      continue;
    }
    if (item?.type === "link" && typeof item.linkId === "string") {
      out.push({ type: "link", linkId: item.linkId });
    }
  }
  return out;
}

export function stringifyProfileStackOrder(entries: ProfileStackEntry[]): string {
  return JSON.stringify(entries);
}

/** Default stack when none saved: book first, then links, then socials. */
export function defaultProfileStackOrder(opts: {
  host: HostFields;
  links: HostLinkRow[];
  includeBook?: boolean;
}): ProfileStackEntry[] {
  const entries: ProfileStackEntry[] = [];
  if (opts.includeBook !== false) {
    entries.push({ type: "book" });
  }
  for (const link of opts.links.filter((l) => l.active)) {
    entries.push({ type: "link", linkId: link.id });
  }
  const socialOrder = parseSocialOrder(opts.host.socialOrderJson);
  for (const key of socialOrder) {
    if (linkValue(opts.host, key)) {
      entries.push({ type: "social", key });
    }
  }
  return entries;
}

export function mergeProfileStackOrder(opts: {
  saved: ProfileStackEntry[];
  host: HostFields;
  links: HostLinkRow[];
  includeBook?: boolean;
  excludeContactRowSocials?: boolean;
}): ProfileStackEntry[] {
  const activeLinkIds = new Set(
    opts.links.filter((l) => l.active).map((l) => l.id),
  );
  const socialWithValue = withoutContactRowSocials(
    new Set(
      parseSocialOrder(opts.host.socialOrderJson).filter((k) =>
        linkValue(opts.host, k),
      ),
    ),
    opts.excludeContactRowSocials,
  );

  const merged: ProfileStackEntry[] = [];
  const seen = new Set<string>();

  for (const entry of opts.saved) {
    const key = stackEntryKey(entry);
    if (seen.has(key)) continue;
    if (entry.type === "link" && !activeLinkIds.has(entry.linkId)) continue;
    if (entry.type === "social" && !socialWithValue.has(entry.key)) continue;
    merged.push(entry);
    seen.add(key);
  }

  for (const link of opts.links.filter((l) => l.active)) {
    const key = stackEntryKey({ type: "link", linkId: link.id });
    if (!seen.has(key)) {
      merged.push({ type: "link", linkId: link.id });
      seen.add(key);
    }
  }

  for (const socialKey of socialWithValue) {
    const key = stackEntryKey({ type: "social", key: socialKey });
    if (!seen.has(key)) {
      merged.push({ type: "social", key: socialKey });
      seen.add(key);
    }
  }

  if (opts.includeBook !== false) {
    const bookKey = stackEntryKey({ type: "book" });
    if (!seen.has(bookKey)) {
      merged.unshift({ type: "book" });
    }
  } else {
    return merged.filter((e) => e.type !== "book");
  }

  return merged;
}

export function stackEntryKey(entry: ProfileStackEntry): string {
  if (entry.type === "book") return "book";
  if (entry.type === "social") return `social:${entry.key}`;
  return `link:${entry.linkId}`;
}

export function resolveProfileStackButtons(opts: {
  entries: ProfileStackEntry[];
  host: HostFields;
  links: HostLinkRow[];
  excludeContactRowSocials?: boolean;
}): ResolvedStackButton[] {
  const linkById = new Map(opts.links.map((l) => [l.id, l]));
  const buttons: ResolvedStackButton[] = [];
  const skipSocial = opts.excludeContactRowSocials
    ? new Set(CONTACT_ROW_SOCIAL_KEYS)
    : null;

  for (const entry of opts.entries) {
    if (entry.type === "book") {
      buttons.push({
        id: "book",
        label: "Book a meeting",
        kind: "book",
      });
      continue;
    }
    if (entry.type === "social") {
      if (skipSocial?.has(entry.key)) continue;
      const meta = metaByKey.get(entry.key);
      const value = linkValue(opts.host, entry.key);
      if (!meta || !value) continue;
      const external = entry.key !== "publicEmail" && entry.key !== "phone";
      buttons.push({
        id: `social-${entry.key}`,
        label: meta.label,
        href: meta.href(value),
        kind: "social",
        external,
        socialKey: entry.key,
      });
      continue;
    }
    const link = linkById.get(entry.linkId);
    if (!link?.active) continue;
    const external =
      /^https?:\/\//i.test(link.url) &&
      !/^mailto:/i.test(link.url) &&
      !/^tel:/i.test(link.url);
    buttons.push({
      id: `link-${link.id}`,
      label: link.title,
      href: link.url,
      kind: "link",
      external,
      linkIconKey: link.iconKey,
      linkEmoji: link.emoji,
    });
  }

  return buttons;
}

/** Custom links only, in stack order (for book-first under-bio list). */
export function resolveCustomLinkButtons(opts: {
  entries: ProfileStackEntry[];
  links: HostLinkRow[];
}): ResolvedStackButton[] {
  return resolveProfileStackButtons({
    entries: opts.entries.filter((e) => e.type === "link"),
    host: {
      websiteUrl: "",
      publicEmail: "",
      phone: "",
      whatsappUrl: "",
      linkedinUrl: "",
      facebookUrl: "",
      instagramUrl: "",
      tiktokUrl: "",
      xUrl: "",
      youtubeUrl: "",
      socialOrderJson: "[]",
    },
    links: opts.links,
  });
}
