import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isValidTimezone } from "@/lib/timezones";
import {
  parseSocialOrder,
  stringifySocialOrder,
} from "@/lib/social-order";
import type { SocialLinkKey } from "@/components/social-icons";
import {
  parseProfileTheme,
  stringifyProfileTheme,
} from "@/lib/profile-theme";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const MAX_BYTES = 2 * 1024 * 1024;

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
  linkedinUrl: optionalUrl,
  facebookUrl: optionalUrl,
  instagramUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  xUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  socialOrderJson: z.string().trim().max(500).default("[]"),
  profileLayoutMode: z.enum(["BOOK_FIRST", "LINKS_FIRST"]).default("BOOK_FIRST"),
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
  linkedinUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  xUrl: string;
  youtubeUrl: string;
  socialOrder: SocialLinkKey[];
  profileLayoutMode: "BOOK_FIRST" | "LINKS_FIRST";
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
};

function avatarsDir() {
  return path.join(process.cwd(), "public", "uploads", "avatars");
}

function avatarExtension(file: File): string | null {
  const fromType = ALLOWED_TYPES[file.type];
  if (fromType) return fromType;
  const name = file.name.trim().toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return ".jpg";
  if (name.endsWith(".png")) return ".png";
  if (name.endsWith(".webp")) return ".webp";
  return null;
}

async function saveAvatar(hostId: string, file: File): Promise<string> {
  const ext = avatarExtension(file);
  if (!ext) {
    throw new Error("Photo must be a JPEG, PNG, or WebP image");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Photo must be 2 MB or smaller");
  }

  const dir = avatarsDir();
  await mkdir(dir, { recursive: true });

  const filename = `${hostId}${ext}`;
  const diskPath = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, buffer);

  return `/uploads/avatars/${filename}?v=${Date.now()}`;
}

async function deleteAvatarFile(avatarPath: string | null | undefined) {
  if (!avatarPath) return;
  const clean = avatarPath.split("?")[0] ?? "";
  const base = path.basename(clean);
  if (!base || base.includes("..")) return;
  try {
    await unlink(path.join(avatarsDir(), base));
  } catch {
    // ignore missing files
  }
}

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
    avatarPath = await saveAvatar(host.id, opts.avatarFile);
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
