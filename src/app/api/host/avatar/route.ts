import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  AVATAR_MAX_BYTES,
  deleteAvatarFile,
  saveAvatarFile,
  validateAvatarFile,
} from "@/lib/profile-avatar";

export const runtime = "nodejs";

async function requireHostForAvatar() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const host = await prisma.host.findUnique({ where: { userId } });
  if (!host) return null;

  return host;
}

export async function POST(request: Request) {
  const host = await requireHostForAvatar();
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Could not read upload. Try a smaller photo (max 2 MB)." },
      { status: 400 },
    );
  }

  const avatar = formData.get("avatar");
  if (!(avatar instanceof File)) {
    return NextResponse.json({ error: "No photo selected" }, { status: 400 });
  }

  const validationError = validateAvatarFile(avatar);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    await deleteAvatarFile(host.avatarPath);
    const avatarPath = await saveAvatarFile(host.id, avatar);
    const updated = await prisma.host.update({
      where: { id: host.id },
      data: { avatarPath },
    });

    revalidatePath("/dash");
    revalidatePath(`/${updated.slug}`);

    return NextResponse.json({ avatarPath: updated.avatarPath });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save photo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    maxBytes: AVATAR_MAX_BYTES,
    maxMb: AVATAR_MAX_BYTES / (1024 * 1024),
    types: ["image/jpeg", "image/png", "image/webp"],
  });
}
