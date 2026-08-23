import { z } from "zod";
import {
  HOST_LINK_ICON_KEYS,
  normalizeHostLinkEmoji,
  parseHostLinkIconKey,
} from "@/lib/link-icons";

export const MAX_HOST_LINKS = 20;

export const hostLinkUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (v) =>
      /^https?:\/\//i.test(v) ||
      /^mailto:/i.test(v) ||
      /^tel:/i.test(v),
    "URL must start with http://, https://, mailto:, or tel:",
  );

export const hostLinkTitleSchema = z.string().trim().min(1).max(80);

export const hostLinkInputSchema = z.object({
  title: hostLinkTitleSchema,
  url: hostLinkUrlSchema,
  iconKey: z
    .string()
    .optional()
    .transform((v) => parseHostLinkIconKey(v)),
  emoji: z
    .string()
    .optional()
    .transform((v) => normalizeHostLinkEmoji(v ?? "")),
});

export type HostLinkInput = z.infer<typeof hostLinkInputSchema>;
