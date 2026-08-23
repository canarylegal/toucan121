import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const AVATAR_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "avatars",
);

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  const base = path.basename(filename);
  if (!base || base.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(base).toLowerCase();
  const contentType = MIME[ext];
  if (!contentType) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const data = await readFile(path.join(AVATAR_DIR, base));
    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
