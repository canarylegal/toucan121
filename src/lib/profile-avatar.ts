import { createWriteStream } from "fs";
import { mkdir, unlink } from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function avatarsDir() {
  return path.join(process.cwd(), "public", "uploads", "avatars");
}

export function avatarExtension(file: File): string | null {
  const fromType = ALLOWED_TYPES[file.type];
  if (fromType) return fromType;
  const name = file.name.trim().toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return ".jpg";
  if (name.endsWith(".png")) return ".png";
  if (name.endsWith(".webp")) return ".webp";
  return null;
}

export function validateAvatarFile(file: File): string | null {
  if (!avatarExtension(file)) {
    return "Photo must be a JPEG, PNG, or WebP image";
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return "Photo must be 2 MB or smaller";
  }
  if (file.size === 0) {
    return "Photo file is empty";
  }
  return null;
}

export async function deleteAvatarFile(avatarPath: string | null | undefined) {
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

export async function saveAvatarFile(hostId: string, file: File): Promise<string> {
  const validationError = validateAvatarFile(file);
  if (validationError) throw new Error(validationError);

  const ext = avatarExtension(file)!;
  const dir = avatarsDir();
  await mkdir(dir, { recursive: true });

  const filename = `${hostId}${ext}`;
  const diskPath = path.join(dir, filename);

  const webStream = file.stream();
  const nodeStream = Readable.fromWeb(
    webStream as import("stream/web").ReadableStream,
  );
  await pipeline(nodeStream, createWriteStream(diskPath));

  return `/uploads/avatars/${filename}?v=${Date.now()}`;
}
