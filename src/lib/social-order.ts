import {
  SOCIAL_LINK_META,
  type SocialLinkKey,
} from "@/components/social-icons";

export const DEFAULT_SOCIAL_ORDER: SocialLinkKey[] = SOCIAL_LINK_META.map(
  (m) => m.key,
);

export function parseSocialOrder(json: string | null | undefined): SocialLinkKey[] {
  const known = new Set(DEFAULT_SOCIAL_ORDER);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json || "[]");
  } catch {
    return [...DEFAULT_SOCIAL_ORDER];
  }
  if (!Array.isArray(parsed)) return [...DEFAULT_SOCIAL_ORDER];

  const ordered: SocialLinkKey[] = [];
  for (const item of parsed) {
    if (typeof item === "string" && known.has(item as SocialLinkKey)) {
      const key = item as SocialLinkKey;
      if (!ordered.includes(key)) ordered.push(key);
    }
  }
  for (const key of DEFAULT_SOCIAL_ORDER) {
    if (!ordered.includes(key)) ordered.push(key);
  }
  return ordered;
}

export function stringifySocialOrder(order: SocialLinkKey[]): string {
  return JSON.stringify(parseSocialOrder(JSON.stringify(order)));
}
