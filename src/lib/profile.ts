import { prisma } from "@/lib/db";
import { isValidTimezone } from "@/lib/timezones";
import { z } from "zod";
import {
  deleteAvatarFile,
  saveAvatarFile,
} from "@/lib/profile-avatar";
import {
  parseSocialOrder,
  stringifySocialOrder,
} from "@/lib/social-order";
import type { SocialLinkKey } from "@/components/social-icons";
import {
  parseProfileTheme,
  stringifyProfileTheme,
} from "@/lib/profile-theme";
import {
  isValidWhatsAppInput,
  normalizeWhatsAppUrl,
} from "@/lib/whatsapp";

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => !v || /^https?:\/\//i.test(v),
    "URL must start with http:// or https://",
  );

const optionalEmail = z
  .string()
  .trim()
  .max(160)
  .refine((v) => !v || z.string().email().safeParse(v).success, "Invalid email");

const optionalWhatsApp = z
  .string()
  .trim()
  .max(200)
  .superRefine((v, ctx) => {
    if (v && !isValidWhatsAppInput(v)) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a phone number or WhatsApp link",
      });
    }
  })
  .transform((v) => normalizeWhatsAppUrl(v));

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  headline: z.string().trim().max(120),
  businessName: z.string().trim().max(120),
  bio: z
    .string()
    .trim()
    .max(600)
    .transform((v) =>
      v
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .trim(),
    ),
  websiteUrl: optionalUrl,
  publicEmail: optionalEmail,
  phone: z.string().trim().max(40),
  whatsappUrl: optionalWhatsApp,
  linkedinUrl: optionalUrl,
  facebookUrl: optionalUrl,
  instagramUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  xUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  socialOrderJson: z.string().trim().max(500).default("[]"),
  profileLayoutMode: z.enum(["BOOK_FIRST", "LINKS_FIRST"]).default("BOOK_FIRST"),
  contactRowEnabled: z.boolean().default(true),
  profileStackOrderJson: z.string().trim().max(4000).default("[]"),
  profileThemeJson: z
    .string()
    .trim()
    .max(500)
    .default("{}")
    .transform((raw) => stringifyProfileTheme(parseProfileTheme(raw))),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine(isValidTimezone, "Choose a valid timezone"),
  bookingHorizonDays: z.coerce.number().int().min(1).max(365).default(60),
  removeAvatar: z.boolean().default(false),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export type ProfileFormValues = {
  name: string;
  headline: string;
  businessName: string;
  bio: string;
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
  socialOrder: SocialLinkKey[];
  profileLayoutMode: "BOOK_FIRST" | "LINKS_FIRST";
  contactRowEnabled: boolean;
  profileStackOrderJson: string;
  profileThemeJson: string;
  links?: {
    id: string;
    title: string;
    url: string;
    iconKey?: string;
    emoji?: string;
  }[];
  timezone: string;
  bookingHorizonDays: number;
  avatarPath: string | null;
  bookingEnabled?: boolean;
  /** Active meeting types exist — tree “Book a meeting” only when true with bookingEnabled. */
  hasBookableMeetingTypes?: boolean;
};

export async function updateHostProfile(opts: {
  hostId: string;
  userId: string;
  input: ProfileInput;
  avatarFile?: File | null;
}) {
  const data = profileSchema.parse(opts.input);
  const host = await prisma.host.findUnique({ where: { id: opts.hostId } });
  if (!host || host.userId !== opts.userId) {
    throw new Error("Host not found");
  }

  let avatarPath = host.avatarPath;

  if (data.removeAvatar) {
    await deleteAvatarFile(host.avatarPath);
    avatarPath = null;
  } else if (opts.avatarFile && opts.avatarFile.size > 0) {
    await deleteAvatarFile(host.avatarPath);
    avatarPath = await saveAvatarFile(host.id, opts.avatarFile);
  }

  const [updated] = await prisma.$transaction([
    prisma.host.update({
      where: { id: host.id },
      data: {
        name: data.name,
        headline: data.headline,
        businessName: data.businessName,
        bio: data.bio,
        websiteUrl: data.websiteUrl,
        publicEmail: data.publicEmail,
        phone: data.phone,
        whatsappUrl: data.whatsappUrl,
        linkedinUrl: data.linkedinUrl,
        facebookUrl: data.facebookUrl,
        instagramUrl: data.instagramUrl,
        tiktokUrl: data.tiktokUrl,
        xUrl: data.xUrl,
        youtubeUrl: data.youtubeUrl,
        socialOrderJson: stringifySocialOrder(
          parseSocialOrder(data.socialOrderJson),
        ),
        profileLayoutMode: data.profileLayoutMode,
        contactRowEnabled: data.contactRowEnabled,
        profileStackOrderJson: data.profileStackOrderJson,
        profileThemeJson: data.profileThemeJson,
        timezone: data.timezone,
        bookingHorizonDays: data.bookingHorizonDays,
        avatarPath,
      },
    }),
    prisma.user.update({
      where: { id: opts.userId },
      data: { name: data.name },
    }),
  ]);

  return updated;
}
