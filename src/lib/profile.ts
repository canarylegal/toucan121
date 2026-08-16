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
  bio: z.string().trim().max(600),
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
  timezone: string;
  bookingHorizonDays: number;
  avatarPath: string | null;
};

function avatarsDir() {
  return path.join(process.cwd(), "public", "uploads", "avatars");
}

async function saveAvatar(hostId: string, file: File): Promise<string> {
  const ext = ALLOWED_TYPES[file.type];
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
