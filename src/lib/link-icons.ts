import { z } from "zod";

export const HOST_LINK_ICON_KEYS = [
  "link",
  "shop",
  "blog",
  "video",
  "podcast",
  "music",
  "file",
  "download",
  "calendar",
  "map",
  "gift",
  "ticket",
  "newsletter",
  "contact",
] as const;

export type HostLinkIconKey = (typeof HOST_LINK_ICON_KEYS)[number];

export const HOST_LINK_ICON_META: {
  key: HostLinkIconKey;
  label: string;
}[] = [
  { key: "link", label: "Link" },
  { key: "shop", label: "Shop" },
  { key: "blog", label: "Blog" },
  { key: "video", label: "Video" },
  { key: "podcast", label: "Podcast" },
  { key: "music", label: "Music" },
  { key: "file", label: "Document" },
  { key: "download", label: "Download" },
  { key: "calendar", label: "Calendar" },
  { key: "map", label: "Location" },
  { key: "gift", label: "Gift" },
  { key: "ticket", label: "Ticket" },
  { key: "newsletter", label: "Newsletter" },
  { key: "contact", label: "Contact" },
];

export const HOST_LINK_EMOJI_PRESETS = [
  "🔗",
  "📍",
  "🛒",
  "🎵",
  "📄",
  "💼",
  "❤️",
  "☕",
  "🎁",
  "🎫",
] as const;

const iconKeySchema = z.enum(HOST_LINK_ICON_KEYS);

export function normalizeHostLinkEmoji(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  // Allow short emoji sequences (flags, skin tones, etc.)
  if (trimmed.length > 8) return trimmed.slice(0, 8);
  if (/[\u0000-\u001f]/.test(trimmed)) return "";
  return trimmed;
}

export function parseHostLinkIconKey(value: string | undefined): HostLinkIconKey {
  const parsed = iconKeySchema.safeParse(value);
  return parsed.success ? parsed.data : "link";
}
